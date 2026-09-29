package com.clothshop.catalog.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Request and response shapes for the Add Article form. Grouped so they read together. */
public final class ArticleDtos {

    private ArticleDtos() {
    }

    // ---------- lookups ----------

    public record LookupItem(Long id, String code, String name, String hex, Long sizeGroupId) {
    }

    public record LookupsResponse(
            List<LookupItem> articleTypes,
            List<LookupItem> materials,
            List<LookupItem> colours,
            List<LookupItem> sizes,
            List<LookupItem> brands,
            List<WholesalerItem> wholesalers,
            List<StaffItem> staff,
            BigDecimal defaultMarkup
    ) {
    }

    /** Carries the phone and address too, so the form can show who it is about to credit. */
    public record WholesalerItem(Long id, String name, String phone, String address) {
    }

    public record StaffItem(Long id, String name) {
    }

    public record CreateBrandRequest(@NotNull String name, String code) {
    }

    public record CreateWholesalerRequest(
            @NotNull String name,
            @NotNull String phone,
            @NotNull String address
    ) {
    }

    // ---------- code preview ----------

    /** Drives the live code preview under the form and the duplicate warning. */
    public record PreviewRequest(
            @NotNull Long articleTypeId,
            @NotNull Long brandId,
            @NotNull Long materialId,
            @NotNull Long colourId,
            @NotNull Long sizeId
    ) {
    }

    public record PreviewResponse(
            String articleCode,
            boolean exists,
            ExistingArticle existing
    ) {
    }

    public record ExistingArticle(
            Long variantId,
            String articleCode,
            String displayName,
            String colourName,
            String sizeName,
            /** Cost basis of the stock on hand. What the dialog blends the new lot into. */
            BigDecimal avgCost,
            BigDecimal lastBuyingPrice,
            BigDecimal sellingPrice,
            BigDecimal qtyOnHand
    ) {
    }

    // ---------- add ----------

    /**
     * {@code mode} is what the client believes the situation is, based on the preview
     * it already ran. The server checks that belief against reality and refuses if they
     * disagree — that is what stops a duplicate slipping through a stale form.
     */
    public enum AddMode {CREATE, ADD_STOCK}

    public record AddArticleRequest(
            @NotNull Long articleTypeId,
            @NotNull Long brandId,
            @NotNull Long materialId,
            @NotNull Long colourId,
            @NotNull Long sizeId,
            @NotNull @DecimalMin(value = "0.00", message = "Buying price cannot be negative") BigDecimal buyingPrice,
            @NotNull @DecimalMin(value = "0.00", message = "Selling price cannot be negative") BigDecimal sellingPrice,
            @NotNull @Positive(message = "Quantity must be at least 1") BigDecimal quantity,
            /** Who this lot was bought from. Recorded against the movement, not the article. */
            @NotNull(message = "Choose where this was bought from") Long wholesalerId,
            /** Who is entering it. Their name becomes the ledger row's created_by. */
            @NotNull(message = "Choose who is adding this") Long staffId,
            @NotNull AddMode mode,
            /**
             * Whether to move the shelf price to {@code sellingPrice}. The buying price is
             * never a choice - it is averaged into the cost regardless, because you paid
             * what you paid. This flag is the only real decision when stock is topped up.
             */
            boolean updateSellingPrice,
            String note
    ) {
    }

    public record AddArticleResponse(
            String outcome,          // CREATED | STOCK_ADDED
            Long variantId,
            String articleCode,
            String displayName,
            BigDecimal qtyOnHand,
            BigDecimal avgCost,
            BigDecimal lastBuyingPrice,
            BigDecimal sellingPrice,
            boolean sellingPriceChanged
    ) {
    }

    // ---------- list ----------

    /**
     * What the browse screen is asking for. Every field is optional: a null lookup id
     * means "any", and a blank {@code q} matches everything through the LIKE.
     */
    public record ArticleFilter(
            String q,
            Long articleTypeId,
            Long brandId,
            Long materialId,
            Long colourId,
            Long sizeId
    ) {
        /** Null and blank are the same thing to the query, so normalise once here. */
        public ArticleFilter {
            q = (q == null) ? "" : q.trim();
        }
    }

    public record ArticleListItem(
            Long variantId,
            String articleCode,
            String articleType,
            String brand,
            String material,
            String colour,
            String colourHex,
            String size,
            BigDecimal avgCost,
            BigDecimal lastBuyingPrice,
            BigDecimal sellingPrice,
            BigDecimal qtyOnHand
    ) {
    }

    // ---------- detail ----------

    /**
     * Everything one article can tell you, assembled for the person deciding what to
     * charge for it. Money arithmetic (margin, break-even, what a discount leaves)
     * is deliberately not here — those are what-ifs the screen recomputes as the user
     * looks, not facts the server owns.
     */
    public record ArticleDetail(
            // identity
            Long variantId,
            String articleCode,
            String displayName,
            String articleType,
            String brand,
            String material,
            String colour,
            String colourHex,
            String size,
            String hsnCode,
            String status,
            Instant createdAt,

            // what it cost and what it sells for
            BigDecimal avgCost,
            BigDecimal lastBuyingPrice,
            BigDecimal sellingPrice,
            BigDecimal mrp,

            // what is on the shelf
            BigDecimal qtyOnHand,
            BigDecimal reorderLevel,

            // how it has moved, over its whole life
            BigDecimal totalIn,
            BigDecimal totalOut,
            Instant firstMovementAt,
            Instant lastMovementAt,
            Instant lastSaleAt,

            List<LedgerEntry> ledger,
            List<SiblingVariant> siblings
    ) {
    }

    /** One row of the article's history. The ledger is append-only, so this is the truth. */
    public record LedgerEntry(
            Long id,
            String movementType,
            BigDecimal qtyDelta,
            BigDecimal balanceAfter,
            /** What this particular lot cost — not the running average. */
            BigDecimal unitCost,
            /** What the customer paid, on sales. Null on everything else. */
            BigDecimal unitPrice,
            /** Null for movements recorded before suppliers were tracked. */
            String wholesaler,
            /** The bill this row came from, when it came from one. */
            String reference,
            String note,
            String createdBy,
            Instant createdAt
    ) {
    }

    /** Another colour or size of the same style, to offer when this one does not fit. */
    public record SiblingVariant(
            Long variantId,
            String articleCode,
            String colour,
            String colourHex,
            String size,
            BigDecimal sellingPrice,
            BigDecimal qtyOnHand
    ) {
    }
}
