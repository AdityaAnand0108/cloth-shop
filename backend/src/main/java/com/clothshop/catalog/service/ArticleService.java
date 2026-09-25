package com.clothshop.catalog.service;

import com.clothshop.catalog.domain.*;
import com.clothshop.catalog.dto.ArticleDtos.*;
import com.clothshop.catalog.repository.*;
import com.clothshop.common.ApiException;
import com.clothshop.inventory.domain.Location;
import com.clothshop.inventory.domain.MovementType;
import com.clothshop.inventory.service.InventoryService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

@Service
public class ArticleService {

    private final ArticleTypeRepository articleTypes;
    private final BrandRepository brands;
    private final MaterialRepository materials;
    private final ColourRepository colours;
    private final ClothingSizeRepository sizes;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final ArticleCodeGenerator codeGenerator;
    private final InventoryService inventory;

    public ArticleService(ArticleTypeRepository articleTypes, BrandRepository brands,
                          MaterialRepository materials, ColourRepository colours,
                          ClothingSizeRepository sizes, ProductRepository products,
                          ProductVariantRepository variants, ArticleCodeGenerator codeGenerator,
                          InventoryService inventory) {
        this.articleTypes = articleTypes;
        this.brands = brands;
        this.materials = materials;
        this.colours = colours;
        this.sizes = sizes;
        this.products = products;
        this.variants = variants;
        this.codeGenerator = codeGenerator;
        this.inventory = inventory;
    }

    // ------------------------------------------------------------------
    // Preview - what the form calls as each dropdown is picked
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PreviewResponse preview(PreviewRequest request) {
        Selection sel = resolve(request.articleTypeId(), request.brandId(), request.materialId(),
                request.colourId(), request.sizeId());
        String code = codeGenerator.generate(sel.type(), sel.brand(), sel.material(), sel.colour(), sel.size());

        return variants.findByArticleCode(code)
                .map(v -> new PreviewResponse(code, true, describe(v)))
                .orElseGet(() -> new PreviewResponse(code, false, null));
    }

    // ------------------------------------------------------------------
    // Add - the whole point of the module
    // ------------------------------------------------------------------

    /**
     * Create the article, or add stock to the one that already exists. Never both,
     * and never a duplicate.
     *
     * <p>The client tells us which case it expects in {@code mode}, based on the preview
     * it already ran. If reality disagrees - someone else added the same article in the
     * meantime, or the form was left open for an hour - we refuse with 409 and hand back
     * the current state, so the UI can ask the user instead of guessing.
     */
    @Transactional
    public AddArticleResponse add(AddArticleRequest request, String user) {
        Selection sel = resolve(request.articleTypeId(), request.brandId(), request.materialId(),
                request.colourId(), request.sizeId());

        requireSizeMatchesArticle(sel);

        String code = codeGenerator.generate(sel.type(), sel.brand(), sel.material(), sel.colour(), sel.size());
        Optional<ProductVariant> existing = variants.findByArticleCode(code);
        Location location = inventory.defaultLocation();

        if (existing.isPresent() && request.mode() == AddMode.CREATE) {
            throw ApiException.conflict("ARTICLE_EXISTS",
                    "Article " + code + " already exists. Add stock to it instead of creating a duplicate.",
                    Map.of("articleCode", code, "existing", describe(existing.get())));
        }
        if (existing.isEmpty() && request.mode() == AddMode.ADD_STOCK) {
            throw ApiException.conflict("ARTICLE_MISSING",
                    "Article " + code + " no longer exists. Reload the form and try again.",
                    Map.of("articleCode", code));
        }

        return existing.isPresent()
                ? addStock(existing.get(), request, location, user)
                : createArticle(sel, code, request, location, user);
    }

    private AddArticleResponse createArticle(Selection sel, String code, AddArticleRequest request,
                                             Location location, String user) {
        // The form never mentions "product" - find or create it behind the scenes, so
        // reports can group every colour and size of the same style together.
        Product product = products
                .findByArticleTypeIdAndBrandIdAndMaterialId(
                        sel.type().getId(), sel.brand().getId(), sel.material().getId())
                .orElseGet(() -> {
                    Product fresh = new Product();
                    fresh.setArticleType(sel.type());
                    fresh.setBrand(sel.brand());
                    fresh.setMaterial(sel.material());
                    fresh.setDisplayName(sel.brand().getName() + " " + sel.material().getName()
                            + " " + sel.type().getName());
                    return products.save(fresh);
                });

        ProductVariant variant = new ProductVariant();
        variant.setProduct(product);
        variant.setArticleCode(code);          // generated once, frozen from here on
        variant.setColour(sel.colour());
        variant.setSize(sel.size());
        variant.setBuyingPrice(request.buyingPrice());
        variant.setSellingPrice(request.sellingPrice());
        variants.save(variant);

        BigDecimal balance = inventory.post(variant.getId(), location.getId(),
                MovementType.OPENING_STOCK, request.quantity(), request.buyingPrice(),
                "ARTICLE", code, request.note(), user);

        return new AddArticleResponse("CREATED", variant.getId(), code, product.getDisplayName(),
                balance, variant.getBuyingPrice(), variant.getSellingPrice(), false);
    }

    private AddArticleResponse addStock(ProductVariant variant, AddArticleRequest request,
                                        Location location, String user) {
        boolean pricesUpdated = false;

        // The supplier raised his rate. Catch it now, not three months later when the
        // margin report looks wrong - but only change it if the user actually said so.
        if (request.updatePrices()) {
            variant.setBuyingPrice(request.buyingPrice());
            variant.setSellingPrice(request.sellingPrice());
            variants.save(variant);
            pricesUpdated = true;
        }

        BigDecimal balance = inventory.post(variant.getId(), location.getId(),
                MovementType.PURCHASE_IN, request.quantity(), request.buyingPrice(),
                "ARTICLE", variant.getArticleCode(), request.note(), user);

        return new AddArticleResponse("STOCK_ADDED", variant.getId(), variant.getArticleCode(),
                variant.getProduct().getDisplayName(), balance,
                variant.getBuyingPrice(), variant.getSellingPrice(), pricesUpdated);
    }

    // ------------------------------------------------------------------
    // List
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<ArticleListItem> list(String query, Pageable pageable) {
        String q = (query == null) ? "" : query.trim();   // "" matches everything through the LIKE
        Page<ProductVariant> page = variants.search(q, pageable);

        Map<Long, BigDecimal> stock = inventory.onHandByVariant(
                page.getContent().stream().map(ProductVariant::getId).toList());

        return page.map(v -> new ArticleListItem(
                v.getId(),
                v.getArticleCode(),
                v.getProduct().getArticleType().getName(),
                v.getProduct().getBrand().getName(),
                v.getProduct().getMaterial().getName(),
                v.getColour().getName(),
                v.getColour().getHex(),
                v.getSize().getName(),
                v.getBuyingPrice(),
                v.getSellingPrice(),
                stock.getOrDefault(v.getId(), BigDecimal.ZERO)));
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private record Selection(ArticleType type, Brand brand, Material material,
                             Colour colour, ClothingSize size) {
    }

    private Selection resolve(Long typeId, Long brandId, Long materialId, Long colourId, Long sizeId) {
        return new Selection(
                articleTypes.findById(typeId).orElseThrow(() -> ApiException.notFound("Article type")),
                brands.findById(brandId).orElseThrow(() -> ApiException.notFound("Brand")),
                materials.findById(materialId).orElseThrow(() -> ApiException.notFound("Material")),
                colours.findById(colourId).orElseThrow(() -> ApiException.notFound("Colour")),
                sizes.findById(sizeId).orElseThrow(() -> ApiException.notFound("Size")));
    }

    /** A jean has no size M. Stops a mismatched pair reaching the code generator. */
    private void requireSizeMatchesArticle(Selection sel) {
        Long expected = sel.type().getSizeGroup().getId();
        Long actual = sel.size().getSizeGroup().getId();
        if (!expected.equals(actual)) {
            throw ApiException.badRequest("SIZE_GROUP_MISMATCH",
                    "Size " + sel.size().getName() + " is not valid for " + sel.type().getName());
        }
    }

    private ExistingArticle describe(ProductVariant v) {
        return new ExistingArticle(
                v.getId(),
                v.getArticleCode(),
                v.getProduct().getDisplayName(),
                v.getColour().getName(),
                v.getSize().getName(),
                v.getBuyingPrice(),
                v.getSellingPrice(),
                inventory.onHand(v.getId(), inventory.defaultLocation().getId()));
    }
}
