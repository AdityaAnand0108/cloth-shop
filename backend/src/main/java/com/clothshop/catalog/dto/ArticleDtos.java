package com.clothshop.catalog.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
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
            BigDecimal defaultMarkup
    ) {
    }

    public record CreateBrandRequest(@NotNull String name, String code) {
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
            BigDecimal buyingPrice,
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
            @NotNull AddMode mode,
            /** When adding stock to an existing article at a new cost, whether to update its prices. */
            boolean updatePrices,
            String note
    ) {
    }

    public record AddArticleResponse(
            String outcome,          // CREATED | STOCK_ADDED
            Long variantId,
            String articleCode,
            String displayName,
            BigDecimal qtyOnHand,
            BigDecimal buyingPrice,
            BigDecimal sellingPrice,
            boolean pricesUpdated
    ) {
    }

    // ---------- list ----------

    public record ArticleListItem(
            Long variantId,
            String articleCode,
            String articleType,
            String brand,
            String material,
            String colour,
            String colourHex,
            String size,
            BigDecimal buyingPrice,
            BigDecimal sellingPrice,
            BigDecimal qtyOnHand
    ) {
    }
}
