package com.clothshop.sales.dto;

import com.clothshop.sales.domain.PaymentMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Request and response shapes for the counter: the cart, the bill, and the day. */
public final class SaleDtos {

    private SaleDtos() {
    }

    // ---------- price check ----------

    /**
     * The cart lives in the browser, so it can be hours old by the time someone gets
     * back to it. Before anything is charged the counter re-asks the server what these
     * articles cost, sell for, and how many are left.
     */
    public record PriceCheckRequest(@NotNull List<Long> variantIds) {
    }

    public record CartArticle(
            Long variantId,
            String articleCode,
            String displayName,
            String colour,
            String colourHex,
            String size,
            BigDecimal sellingPrice,
            /** The floor. Shown at the counter so nobody haggles below it by accident. */
            BigDecimal avgCost,
            BigDecimal mrp,
            BigDecimal qtyOnHand,
            String status
    ) {
    }

    // ---------- checkout ----------

    /**
     * {@code unitPrice} is what the counter agreed, not what the catalogue says — the
     * whole point of the discount screen is that the two differ. The server takes the
     * price as given and records the margin it leaves, including a negative one:
     * clearing old stock at a loss is a decision the shop is allowed to make.
     */
    public record CheckoutRequest(
            @NotEmpty(message = "There is nothing in the cart") @Valid List<CheckoutLine> lines,
            @NotNull(message = "Choose who is billing this") Long staffId,
            /** Optional original bill number used by reviewed historical imports. */
            String billNo,
            String customerName,
            String customerPhone,
            Boolean whatsappOptIn,
            /** Off the whole bill — the round-off, or the last concession. */
            @DecimalMin(value = "0.00", message = "Discount cannot be negative") BigDecimal discount,
            @NotNull(message = "Choose how it was paid") PaymentMode paymentMode,
            String note,
            /** Used only for reviewed historical imports; normal checkout leaves it null. */
            Instant createdAt,
            /** Historical imports can be recorded without changing current stock. */
            Boolean affectInventory
    ) {
    }

    public record CheckoutLine(
            @NotNull Long variantId,
            @NotNull @Positive(message = "Quantity must be at least 1") BigDecimal qty,
            @NotNull @DecimalMin(value = "0.00", message = "Price cannot be negative") BigDecimal unitPrice,
            /** Only honored for an explicitly historical, stock-neutral import. */
            @DecimalMin(value = "0.00", message = "Historical cost cannot be negative") BigDecimal historicalUnitCost
    ) {
    }

    // ---------- the bill ----------

    public record Bill(
            Long id,
            String billNo,
            Instant createdAt,
            String staffName,
            String customerName,
            String customerPhone,
            Long customerId,

            BigDecimal subtotal,
            BigDecimal discount,
            BigDecimal total,

            /** Not for the customer's copy. What the shop made on it. */
            BigDecimal costTotal,
            BigDecimal profit,

            String paymentMode,
            String note,
            String status,
            String whatsappStatus,
            boolean whatsappOptIn,
            boolean profitEstimated,
            BigDecimal itemCount,
            List<BillLine> lines
    ) {
    }

    public record BillLine(
            Long variantId,
            String articleCode,
            String description,
            String colour,
            String size,
            BigDecimal qty,
            /** Sticker price at the time, so the discount given is still legible later. */
            BigDecimal listPrice,
            BigDecimal unitPrice,
            BigDecimal unitCost,
            BigDecimal lineTotal,
            boolean costEstimated
    ) {
    }

    // ---------- the day ----------

    /** What the counter wants on the wall: how the day is going, and every bill in it. */
    public record DaySummary(
            LocalDate date,
            int billCount,
            BigDecimal itemCount,
            BigDecimal takings,
            BigDecimal profit,
            BigDecimal discountGiven,
            List<BillSummary> bills
    ) {
    }

    public record BillSummary(
            Long id,
            String billNo,
            Instant createdAt,
            String customerName,
            String staffName,
            BigDecimal itemCount,
            BigDecimal total,
            BigDecimal profit,
            String paymentMode,
            boolean profitEstimated
    ) {
    }

    public record ReturnRequest(
            @NotNull Long staffId,
            @NotNull String returnType,
            String reason,
            PaymentMode refundPaymentMode,
            @NotEmpty @Valid List<ReturnLineRequest> lines,
            List<@Valid CheckoutLine> exchangeLines
    ) {}

    public record ReturnLineRequest(@NotNull Long saleLineId,
                                    @NotNull @Positive BigDecimal quantity,
                                    boolean restock) {}

    public record ReturnableBill(Bill bill, List<ReturnableLine> lines) {}
    public record ReturnableLine(Long saleLineId, Long variantId, String articleCode, String description,
                                 String colour, String size, BigDecimal soldQuantity,
                                 BigDecimal returnedQuantity, BigDecimal availableQuantity,
                                 BigDecimal unitPrice) {}

    public record ReturnLine(Long saleLineId, String articleCode, String description, String colour,
                             String size, BigDecimal quantity, BigDecimal refundTotal, boolean restocked) {}

    public record ReturnResult(Long id, String returnNo, String originalBillNo, String returnType,
                               BigDecimal refundAmount, BigDecimal exchangeTotal, BigDecimal settlementDue,
                               String refundPaymentMode, Instant createdAt, Bill exchangeBill,
                               List<ReturnLine> lines) {}

    public record SalesImportRequest(@NotEmpty List<@Valid CheckoutRequest> bills) {}
    public record SalesImportResponse(List<Bill> bills) {}
    public record WhatsAppConfirmationRequest(@NotNull Boolean sent) {}
}
