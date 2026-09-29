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
            String customerName,
            String customerPhone,
            /** Off the whole bill — the round-off, or the last concession. */
            @DecimalMin(value = "0.00", message = "Discount cannot be negative") BigDecimal discount,
            @NotNull(message = "Choose how it was paid") PaymentMode paymentMode,
            String note
    ) {
    }

    public record CheckoutLine(
            @NotNull Long variantId,
            @NotNull @Positive(message = "Quantity must be at least 1") BigDecimal qty,
            @NotNull @DecimalMin(value = "0.00", message = "Price cannot be negative") BigDecimal unitPrice
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

            BigDecimal subtotal,
            BigDecimal discount,
            BigDecimal total,

            /** Not for the customer's copy. What the shop made on it. */
            BigDecimal costTotal,
            BigDecimal profit,

            String paymentMode,
            String note,
            String status,
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
            BigDecimal lineTotal
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
            String paymentMode
    ) {
    }
}
