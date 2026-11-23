package com.clothshop.sales.service;

import com.clothshop.catalog.domain.ProductVariant;
import com.clothshop.catalog.repository.ProductVariantRepository;
import com.clothshop.common.ApiException;
import com.clothshop.inventory.domain.Location;
import com.clothshop.inventory.service.InventoryService;
import com.clothshop.platform.repository.StaffRepository;
import com.clothshop.platform.domain.Customer;
import com.clothshop.platform.service.CustomerService;
import com.clothshop.sales.domain.Sale;
import com.clothshop.sales.domain.SaleLine;
import com.clothshop.sales.dto.SaleDtos.Bill;
import com.clothshop.sales.dto.SaleDtos.BillLine;
import com.clothshop.sales.dto.SaleDtos.BillPriceEditRequest;
import com.clothshop.sales.dto.SaleDtos.BillSummary;
import com.clothshop.sales.dto.SaleDtos.CartArticle;
import com.clothshop.sales.dto.SaleDtos.CheckoutLine;
import com.clothshop.sales.dto.SaleDtos.CheckoutRequest;
import com.clothshop.sales.dto.SaleDtos.DaySummary;
import com.clothshop.sales.dto.SaleDtos.SalesImportRequest;
import com.clothshop.sales.dto.SaleDtos.SalesImportResponse;
import com.clothshop.sales.repository.SaleRepository;
import com.clothshop.sales.repository.SaleReturnLineRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SaleService {

    /** Every amount a customer sees or pays is rounded here, once, the same way. */
    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private final ProductVariantRepository variants;
    private final SaleRepository sales;
    private final SaleReturnLineRepository returnLines;
    private final StaffRepository staff;
    private final CustomerService customers;
    private final InventoryService inventory;
    private final BillNumberGenerator billNumbers;
    private final ZoneId shopZone;

    public SaleService(ProductVariantRepository variants, SaleRepository sales,
                       StaffRepository staff, InventoryService inventory, SaleReturnLineRepository returnLines,
                       BillNumberGenerator billNumbers, CustomerService customers,
                       @Value("${app.shop.zone}") String shopZone) {
        this.variants = variants;
        this.sales = sales;
        this.returnLines = returnLines;
        this.staff = staff;
        this.customers = customers;
        this.inventory = inventory;
        this.billNumbers = billNumbers;
        this.shopZone = ZoneId.of(shopZone);
    }

    // ------------------------------------------------------------------
    // Price check - what the cart asks before anyone is charged
    // ------------------------------------------------------------------

    /**
     * The cart is held in the browser and can be hours old. This is the counter asking
     * the server what these articles actually cost, sell for, and how many are left, so
     * the screen can correct itself before a price is agreed rather than after.
     *
     * <p>Articles that have since been deleted simply do not come back. The cart drops
     * the lines it gets no answer for, which is the only honest thing it can do.
     */
    @Transactional(readOnly = true)
    public List<CartArticle> priceCheck(List<Long> variantIds) {
        if (variantIds == null || variantIds.isEmpty()) {
            return List.of();
        }

        List<ProductVariant> found = variants.findAllForSale(variantIds);
        Map<Long, BigDecimal> stock = inventory.onHandByVariant(
                found.stream().map(ProductVariant::getId).toList());

        return found.stream()
                .map(v -> new CartArticle(
                        v.getId(),
                        v.getArticleCode(),
                        v.getProduct().getDisplayName(),
                        v.getColour().getName(),
                        v.getColour().getHex(),
                        v.getSize().getName(),
                        v.getSellingPrice(),
                        v.getAvgCost(),
                        v.getMrp(),
                        stock.getOrDefault(v.getId(), BigDecimal.ZERO),
                        v.getStatus()))
                .toList();
    }

    // ------------------------------------------------------------------
    // Checkout
    // ------------------------------------------------------------------

    /**
     * Turn the cart into a bill and take the goods off the shelf, in one transaction.
     *
     * <p>Nothing here recomputes the price. The counter has already agreed it with the
     * customer, and overriding that from the catalogue would hand someone a bill they
     * did not consent to. What the server does own is the <em>cost</em>: the margin is
     * fixed here, from the average in force at this moment, and is never editable after.
     *
     * <p>A line priced below cost is accepted. Clearing old stock at a loss is a
     * decision the shop is entitled to make, and refusing it would only teach staff to
     * work around the till.
     */
    @Transactional
    public Bill checkout(CheckoutRequest request) {
        String user = staff.findById(request.staffId())
                .orElseThrow(() -> ApiException.notFound("Staff member"))
                .getName();

        Location location = inventory.defaultLocation();

        // One lookup for the whole cart, then index it: a bill of twenty garments must
        // not become twenty queries while the customer stands there.
        List<Long> ids = request.lines().stream().map(CheckoutLine::variantId).distinct().toList();
        Map<Long, ProductVariant> byId = variants.findAllForSale(ids).stream()
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));

        for (Long id : ids) {
            if (!byId.containsKey(id)) {
                throw ApiException.notFound("Article " + id);
            }
        }

        Sale sale = new Sale();
        String requestedBillNo = blankToNull(request.billNo());
        if (requestedBillNo != null && sales.findByBillNo(requestedBillNo).isPresent()) {
            throw ApiException.conflict("DUPLICATE_BILL", "Bill " + requestedBillNo + " already exists",
                    Map.of("billNo", requestedBillNo));
        }
        sale.setBillNo(requestedBillNo == null ? billNumbers.next() : requestedBillNo);
        sale.setLocationId(location.getId());
        sale.setStaffId(request.staffId());
        Customer customer = customers.findOrCreate(request.customerPhone(), request.customerName(), request.whatsappOptIn());
        sale.setCustomerId(customer == null ? null : customer.getId());
        sale.setWhatsappOptInSnapshot(customer != null && Boolean.TRUE.equals(request.whatsappOptIn()));
        sale.setCustomerName(blankToNull(request.customerName()) != null
                ? blankToNull(request.customerName()) : customer == null ? null : customer.getName());
        sale.setCustomerPhone(blankToNull(request.customerPhone()));
        sale.setPaymentMode(request.paymentMode());
        sale.setNote(blankToNull(request.note()));
        sale.setCreatedBy(user);
        if (request.createdAt() != null) {
            sale.setCreatedAt(request.createdAt());
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal costTotal = BigDecimal.ZERO;

        for (CheckoutLine requested : request.lines()) {
            ProductVariant v = byId.get(requested.variantId());

            BigDecimal qty = requested.qty();
            BigDecimal unitPrice = money(requested.unitPrice());
            boolean historicalImport = request.createdAt() != null && Boolean.FALSE.equals(request.affectInventory());
            BigDecimal unitCost = historicalImport && requested.historicalUnitCost() != null
                    ? requested.historicalUnitCost() : v.getAvgCost();
            BigDecimal lineTotal = money(unitPrice.multiply(qty));

            SaleLine line = new SaleLine();
            line.setVariantId(v.getId());
            line.setArticleCode(v.getArticleCode());
            line.setDescription(v.getProduct().getDisplayName());
            line.setColour(v.getColour().getName());
            line.setSize(v.getSize().getName());
            line.setQty(qty);
            line.setListPrice(v.getSellingPrice());
            line.setUnitPrice(unitPrice);
            line.setUnitCost(unitCost);
            line.setCostEstimated(historicalImport && requested.historicalUnitCost() == null);
            line.setLineTotal(lineTotal);
            sale.addLine(line);

            subtotal = subtotal.add(lineTotal);
            costTotal = costTotal.add(unitCost.multiply(qty));
        }

        subtotal = money(subtotal);
        BigDecimal discount = money(request.discount() == null ? BigDecimal.ZERO : request.discount());
        if (discount.compareTo(subtotal) > 0) {
            throw ApiException.badRequest("DISCOUNT_EXCEEDS_BILL",
                    "A discount of " + discount.toPlainString() + " is more than the bill itself");
        }

        BigDecimal total = money(subtotal.subtract(discount));
        sale.setSubtotal(subtotal);
        sale.setDiscount(discount);
        sale.setTotal(total);
        sale.setCostTotal(money(costTotal));
        sale.setProfit(money(total.subtract(costTotal)));

        sales.save(sale);

        // Stock moves last. A line that cannot be fulfilled takes the whole transaction
        // down with it, rather than leaving half a cart sold and half refused.
        String ledgerNote = sale.getCustomerName() == null
                ? null
                : "Sold to " + sale.getCustomerName();
        if (request.affectInventory() == null || request.affectInventory()) {
            for (SaleLine line : sale.getLines()) {
                inventory.postSale(line.getVariantId(), location.getId(), line.getQty(),
                        line.getUnitCost(), line.getUnitPrice(), sale.getBillNo(),
                        ledgerNote, user);
            }
        }

        return toBill(sale);
    }

    /** Save a reviewed workbook as one transaction so a failed bill cannot leave a partial import. */
    @Transactional
    public SalesImportResponse importBills(SalesImportRequest request) {
        if (request.bills().size() > 1000) {
            throw ApiException.badRequest("IMPORT_TOO_LARGE", "Import up to 1,000 bills at a time.");
        }
        validateImportStock(request.bills());
        List<Bill> imported = request.bills().stream().map(this::checkout).toList();
        return new SalesImportResponse(imported);
    }

    /** Check total demand for the complete stock-affecting import before writing any bill. */
    private void validateImportStock(List<CheckoutRequest> bills) {
        Map<Long, BigDecimal> demand = new HashMap<>();
        Map<Long, Set<String>> billNumbers = new HashMap<>();
        for (CheckoutRequest bill : bills) {
            if (Boolean.FALSE.equals(bill.affectInventory())) continue;
            String billNo = blankToNull(bill.billNo());
            for (CheckoutLine line : bill.lines()) {
                demand.merge(line.variantId(), line.qty(), BigDecimal::add);
                if (billNo != null) billNumbers.computeIfAbsent(line.variantId(), ignored -> new HashSet<>()).add(billNo);
            }
        }
        if (demand.isEmpty()) return;

        Location location = inventory.defaultLocation();
        Map<Long, ProductVariant> articles = variants.findAllForSale(demand.keySet()).stream()
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));
        for (Map.Entry<Long, BigDecimal> entry : demand.entrySet()) {
            ProductVariant article = articles.get(entry.getKey());
            if (article == null) continue; // checkout reports the missing article with its normal 404.
            BigDecimal available = inventory.onHand(article.getId(), location.getId());
            if (entry.getValue().compareTo(available) > 0) {
                BigDecimal shortBy = entry.getValue().subtract(available);
                Set<String> impactedBills = billNumbers.getOrDefault(article.getId(), Set.of());
                throw ApiException.conflict("INSUFFICIENT_STOCK",
                        "Article " + article.getArticleCode() + " needs " + entry.getValue().stripTrailingZeros().toPlainString()
                                + " units across this import, but only " + available.stripTrailingZeros().toPlainString() + " are available.",
                        Map.of("variantId", article.getId(), "articleCode", article.getArticleCode(),
                                "requested", entry.getValue(), "available", available, "shortBy", shortBy,
                                "billNumbers", String.join(", ", impactedBills)));
            }
        }
    }

    // ------------------------------------------------------------------
    // Reading bills back
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Bill bill(Long id) {
        return toBill(sales.findWithLines(id).orElseThrow(() -> ApiException.notFound("Bill")));
    }

    @Transactional
    public Bill confirmWhatsAppSent(Long id) {
        Sale sale = sales.findWithLines(id).orElseThrow(() -> ApiException.notFound("Bill"));
        if (blankToNull(sale.getCustomerPhone()) == null) {
            throw ApiException.badRequest("CUSTOMER_PHONE_REQUIRED", "Add a customer phone number before confirming a WhatsApp message.");
        }
        if (!sale.isWhatsappOptInSnapshot()) {
            throw ApiException.badRequest("WHATSAPP_CONSENT_REQUIRED", "This bill has no recorded WhatsApp consent.");
        }
        sale.setWhatsappStatus("SENT");
        sale.setWhatsappLastError(null);
        sale.setWhatsappSentAt(Instant.now());
        return toBill(sale);
    }

    @Transactional
    public Bill updateBillPrices(Long id, BillPriceEditRequest request) {
        sales.lockById(id).orElseThrow(() -> ApiException.notFound("Bill"));
        Sale sale = sales.findWithLines(id).orElseThrow(() -> ApiException.notFound("Bill"));
        if (!"COMPLETED".equals(sale.getStatus())) {
            throw ApiException.badRequest("BILL_NOT_EDITABLE", "Only completed bills can be edited.");
        }
        if (returnLines.existsByOriginalSaleLineIdIn(sale.getLines().stream().map(SaleLine::getId).toList())) {
            throw ApiException.badRequest("BILL_ALREADY_RETURNED", "A bill with returned items cannot have its prices changed.");
        }
        if (request.lines().size() != sale.getLines().size()) {
            throw ApiException.badRequest("BILL_LINES_MISMATCH", "Submit the price for every bill line.");
        }
        Map<Long, BigDecimal> prices = new HashMap<>();
        for (var edit : request.lines()) {
            if (prices.put(edit.lineId(), money(edit.unitPrice())) != null) {
                throw ApiException.badRequest("DUPLICATE_BILL_LINE", "A bill line was submitted more than once.");
            }
        }
        BigDecimal subtotal = BigDecimal.ZERO;
        for (SaleLine line : sale.getLines()) {
            BigDecimal unitPrice = prices.remove(line.getId());
            if (unitPrice == null) throw ApiException.badRequest("BILL_LINES_MISMATCH", "A bill line is missing.");
            line.setUnitPrice(unitPrice);
            line.setLineTotal(money(unitPrice.multiply(line.getQty())));
            subtotal = subtotal.add(line.getLineTotal());
        }
        if (!prices.isEmpty()) throw ApiException.badRequest("BILL_LINES_MISMATCH", "A submitted line does not belong to this bill.");
        subtotal = money(subtotal);
        BigDecimal total = request.total() == null ? subtotal.subtract(sale.getDiscount()) : money(request.total());
        if (total.compareTo(subtotal) > 0) {
            throw ApiException.badRequest("TOTAL_EXCEEDS_SUBTOTAL", "The total paid cannot be more than the corrected subtotal.");
        }
        sale.setSubtotal(subtotal);
        sale.setDiscount(money(subtotal.subtract(total)));
        sale.setTotal(total);
        sale.setProfit(money(sale.getTotal().subtract(sale.getCostTotal())));
        return toBill(sale);
    }

    /**
     * How the day is going, and every bill in it. "Today" is the shop's day, not UTC's:
     * a sale rung up at nine in the evening belongs to the day the shutter came down on.
     */
    @Transactional(readOnly = true)
    public DaySummary day(LocalDate date) {
        LocalDate on = date == null ? LocalDate.now(shopZone) : date;
        Instant from = on.atStartOfDay(shopZone).toInstant();
        Instant to = on.plusDays(1).atStartOfDay(shopZone).toInstant();

        List<Sale> bills = sales.findByCreatedAtBetweenOrderByCreatedAtDesc(from, to);

        BigDecimal takings = BigDecimal.ZERO;
        BigDecimal profit = BigDecimal.ZERO;
        BigDecimal discount = BigDecimal.ZERO;
        BigDecimal items = BigDecimal.ZERO;

        for (Sale s : bills) {
            takings = takings.add(s.getTotal());
            profit = profit.add(s.getProfit());
            discount = discount.add(s.getDiscount());
            items = items.add(itemCount(s));
        }

        return new DaySummary(on, bills.size(), items, takings, profit, discount,
                bills.stream()
                        .map(s -> new BillSummary(s.getId(), s.getBillNo(), s.getCreatedAt(),
                                s.getCustomerName(), s.getCreatedBy(), itemCount(s),
                                s.getTotal(), s.getProfit(), s.getPaymentMode().name(),
                                s.getLines().stream().anyMatch(SaleLine::isCostEstimated), s.getWhatsappStatus()))
                        .toList());
    }

    @Transactional(readOnly = true)
    public Page<BillSummary> bills(String query, Pageable pageable) {
        String q = query == null ? "" : query.trim();
        return sales.searchCompleted(q, pageable).map(s -> new BillSummary(s.getId(), s.getBillNo(),
                s.getCreatedAt(), s.getCustomerName(), s.getCreatedBy(), itemCount(s), s.getTotal(),
                s.getProfit(), s.getPaymentMode().name(), s.getLines().stream().anyMatch(SaleLine::isCostEstimated), s.getWhatsappStatus()));
    }

    @Transactional(readOnly = true)
    public List<String> existingBillNumbers(List<String> billNumbers) {
        if (billNumbers == null || billNumbers.isEmpty()) return List.of();
        if (billNumbers.size() > 1000) throw ApiException.badRequest("IMPORT_TOO_LARGE", "Check up to 1,000 bill numbers at a time.");
        return sales.findByBillNoIn(billNumbers.stream().map(SaleService::blankToNull).filter(java.util.Objects::nonNull).toList())
                .stream().map(Sale::getBillNo).toList();
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private Bill toBill(Sale s) {
        return new Bill(
                s.getId(), s.getBillNo(), s.getCreatedAt(), s.getCreatedBy(),
                s.getCustomerName(), s.getCustomerPhone(), s.getCustomerId(),
                s.getSubtotal(), s.getDiscount(), s.getTotal(),
                s.getCostTotal(), s.getProfit(),
                s.getPaymentMode().name(), s.getNote(), s.getStatus(), s.getWhatsappStatus(),
                s.isWhatsappOptInSnapshot(),
                s.getLines().stream().anyMatch(SaleLine::isCostEstimated),
                itemCount(s),
                s.getLines().stream()
                        .map(l -> new BillLine(l.getId(), l.getVariantId(), l.getArticleCode(),
                                l.getDescription(), l.getColour(), l.getSize(), l.getQty(),
                                l.getListPrice(), l.getUnitPrice(), l.getUnitCost(),
                                l.getLineTotal(), l.isCostEstimated()))
                        .toList());
    }

    /** Pieces, not lines. Three of one shirt is three items on the day's count. */
    private BigDecimal itemCount(Sale s) {
        return s.getLines().stream()
                .map(SaleLine::getQty)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
