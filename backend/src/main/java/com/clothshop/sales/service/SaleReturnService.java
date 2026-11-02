package com.clothshop.sales.service;

import com.clothshop.catalog.domain.ProductVariant;
import com.clothshop.catalog.repository.ProductVariantRepository;
import com.clothshop.catalog.service.Costing;
import com.clothshop.common.ApiException;
import com.clothshop.inventory.domain.Location;
import com.clothshop.inventory.domain.MovementType;
import com.clothshop.inventory.service.InventoryService;
import com.clothshop.platform.domain.Staff;
import com.clothshop.platform.repository.StaffRepository;
import com.clothshop.sales.domain.*;
import com.clothshop.sales.dto.SaleDtos.*;
import com.clothshop.sales.repository.SaleLineRepository;
import com.clothshop.sales.repository.SaleRepository;
import com.clothshop.sales.repository.SaleReturnLineRepository;
import com.clothshop.sales.repository.SaleReturnRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class SaleReturnService {
    private final SaleRepository sales;
    private final SaleLineRepository saleLines;
    private final SaleReturnRepository returns;
    private final SaleReturnLineRepository returnLines;
    private final StaffRepository staff;
    private final ProductVariantRepository variants;
    private final InventoryService inventory;
    private final SaleService checkout;

    public SaleReturnService(SaleRepository sales, SaleLineRepository saleLines,
                             SaleReturnRepository returns, SaleReturnLineRepository returnLines,
                             StaffRepository staff, ProductVariantRepository variants,
                             InventoryService inventory, SaleService checkout) {
        this.sales = sales;
        this.saleLines = saleLines;
        this.returns = returns;
        this.returnLines = returnLines;
        this.staff = staff;
        this.variants = variants;
        this.inventory = inventory;
        this.checkout = checkout;
    }

    @Transactional
    public ReturnResult process(Long saleId, ReturnRequest request) {
        sales.lockById(saleId).orElseThrow(() -> ApiException.notFound("Bill"));
        Sale original = sales.findWithLines(saleId).orElseThrow(() -> ApiException.notFound("Bill"));
        if (!"COMPLETED".equals(original.getStatus())) {
            throw ApiException.badRequest("SALE_NOT_RETURNABLE", "This bill is not available for returns.");
        }
        String type = request.returnType() == null ? "" : request.returnType().trim().toUpperCase();
        if (!type.equals("REFUND") && !type.equals("EXCHANGE")) {
            throw ApiException.badRequest("INVALID_RETURN_TYPE", "Choose refund or exchange.");
        }
        if (type.equals("EXCHANGE") && (request.exchangeLines() == null || request.exchangeLines().isEmpty())) {
            throw ApiException.badRequest("EXCHANGE_ITEMS_REQUIRED", "Add at least one replacement item for an exchange.");
        }
        Staff operator = staff.findById(request.staffId()).orElseThrow(() -> ApiException.notFound("Staff member"));
        String returnNo = "R-" + String.format("%06d", returns.nextReturnSequence());
        SaleReturn doc = new SaleReturn();
        doc.setReturnNo(returnNo);
        doc.setOriginalSaleId(original.getId());
        doc.setStaffId(operator.getId());
        doc.setCreatedBy(operator.getName());
        doc.setReason(blankToNull(request.reason()));
        doc.setReturnType(type);
        doc.setRefundPaymentMode(request.refundPaymentMode() == null ? null : request.refundPaymentMode().name());
        returns.save(doc);

        BigDecimal credit = BigDecimal.ZERO;
        List<ReturnLine> resultLines = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        BigDecimal discountFactor = original.getSubtotal().signum() == 0 ? BigDecimal.ONE
                : original.getTotal().divide(original.getSubtotal(), 8, RoundingMode.HALF_UP);
        Location location = inventory.defaultLocation();
        for (ReturnLineRequest requested : request.lines()) {
            if (!seen.add(requested.saleLineId())) {
                throw ApiException.badRequest("DUPLICATE_RETURN_LINE", "Choose each original bill line once.");
            }
            SaleLine sold = original.getLines().stream().filter(line -> line.getId().equals(requested.saleLineId()))
                    .findFirst().orElseThrow(() -> ApiException.badRequest("LINE_NOT_IN_BILL", "A selected item is not part of this bill."));
            BigDecimal alreadyReturned = returnLines.returnedQuantity(sold.getId());
            BigDecimal available = sold.getQty().subtract(alreadyReturned);
            if (requested.quantity().compareTo(available) > 0) {
                throw ApiException.conflict("RETURN_QUANTITY_EXCEEDED", sold.getArticleCode() + " has only "
                        + available.stripTrailingZeros().toPlainString() + " piece(s) left to return.",
                        Map.of("articleCode", sold.getArticleCode(), "availableQuantity", available,
                                "requestedQuantity", requested.quantity()));
            }
            BigDecimal refund = sold.getUnitPrice().multiply(requested.quantity()).multiply(discountFactor)
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal unitRefund = refund.divide(requested.quantity(), 2, RoundingMode.HALF_UP);
            SaleReturnLine entry = new SaleReturnLine();
            entry.setSaleReturn(doc);
            entry.setOriginalSaleLineId(sold.getId());
            entry.setVariantId(sold.getVariantId());
            entry.setArticleCode(sold.getArticleCode());
            entry.setDescription(sold.getDescription());
            entry.setColour(sold.getColour());
            entry.setSize(sold.getSize());
            entry.setQuantity(requested.quantity());
            entry.setUnitRefund(unitRefund);
            entry.setRefundTotal(refund);
            entry.setRestocked(requested.restock());
            returnLines.save(entry);
            credit = credit.add(refund);

            if (requested.restock()) {
                ProductVariant variant = variants.findById(sold.getVariantId())
                        .orElseThrow(() -> ApiException.notFound("Article " + sold.getArticleCode()));
                BigDecimal onHand = inventory.onHand(variant.getId(), location.getId());
                variant.setAvgCost(Costing.weightedAverage(onHand, variant.getAvgCost(), requested.quantity(), sold.getUnitCost()));
                variants.save(variant);
                inventory.post(variant.getId(), location.getId(), MovementType.RETURN_IN,
                        requested.quantity(), sold.getUnitCost(), null, "RETURN", returnNo,
                        doc.getReason(), operator.getName());
            }
            resultLines.add(new ReturnLine(sold.getId(), sold.getArticleCode(), sold.getDescription(),
                    sold.getColour(), sold.getSize(), requested.quantity(), refund, requested.restock()));
        }
        doc.setRefundAmount(credit.setScale(2, RoundingMode.HALF_UP));

        Bill exchangeBill = null;
        BigDecimal exchangeTotal = BigDecimal.ZERO;
        if (type.equals("EXCHANGE")) {
            PaymentMode mode = request.refundPaymentMode() == null ? original.getPaymentMode() : request.refundPaymentMode();
            exchangeBill = checkout.checkout(new CheckoutRequest(request.exchangeLines(), operator.getId(), null,
                    original.getCustomerName(), original.getCustomerPhone(), false, BigDecimal.ZERO, mode,
                    "Exchange for " + returnNo, null, true));
            exchangeTotal = exchangeBill.total();
            doc.setExchangeSaleId(exchangeBill.id());
        }
        BigDecimal due = exchangeTotal.subtract(credit).setScale(2, RoundingMode.HALF_UP);
        doc.setSettlementDue(due);
        returns.save(doc);
        return new ReturnResult(doc.getId(), returnNo, original.getBillNo(), type, credit, exchangeTotal,
                due, doc.getRefundPaymentMode(), doc.getCreatedAt(), exchangeBill, resultLines);
    }

    @Transactional(readOnly = true)
    public ReturnableBill returnable(Long saleId) {
        Sale sale = sales.findWithLines(saleId).orElseThrow(() -> ApiException.notFound("Bill"));
        List<ReturnableLine> lines = sale.getLines().stream().map(line -> {
            BigDecimal returned = returnLines.returnedQuantity(line.getId());
            return new ReturnableLine(line.getId(), line.getVariantId(), line.getArticleCode(),
                    line.getDescription(), line.getColour(), line.getSize(), line.getQty(), returned,
                    line.getQty().subtract(returned), line.getUnitPrice());
        }).toList();
        return new ReturnableBill(checkout.bill(saleId), lines);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
