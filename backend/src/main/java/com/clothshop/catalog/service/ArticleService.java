package com.clothshop.catalog.service;

import com.clothshop.catalog.domain.*;
import com.clothshop.catalog.dto.ArticleDtos.*;
import com.clothshop.catalog.repository.*;
import com.clothshop.common.ApiException;
import com.clothshop.inventory.domain.Location;
import com.clothshop.inventory.domain.MovementType;
import com.clothshop.inventory.domain.StockLedger;
import com.clothshop.inventory.repository.StockLedgerRepository;
import com.clothshop.inventory.service.InventoryService;
import com.clothshop.platform.domain.Wholesaler;
import com.clothshop.platform.repository.StaffRepository;
import com.clothshop.platform.repository.WholesalerRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

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
    private final StockLedgerRepository ledger;
    private final WholesalerRepository wholesalers;
    private final StaffRepository staff;

    public ArticleService(ArticleTypeRepository articleTypes, BrandRepository brands,
                          MaterialRepository materials, ColourRepository colours,
                          ClothingSizeRepository sizes, ProductRepository products,
                          ProductVariantRepository variants, ArticleCodeGenerator codeGenerator,
                          InventoryService inventory, StockLedgerRepository ledger,
                          WholesalerRepository wholesalers, StaffRepository staff) {
        this.articleTypes = articleTypes;
        this.brands = brands;
        this.materials = materials;
        this.colours = colours;
        this.sizes = sizes;
        this.products = products;
        this.variants = variants;
        this.codeGenerator = codeGenerator;
        this.inventory = inventory;
        this.ledger = ledger;
        this.wholesalers = wholesalers;
        this.staff = staff;
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
    public AddArticleResponse add(AddArticleRequest request) {
        Selection sel = resolve(request.articleTypeId(), request.brandId(), request.materialId(),
                request.colourId(), request.sizeId());

        requireSizeMatchesArticle(sel);

        // Both are checked before anything is written: a stock movement that cannot say
        // where it came from or who entered it is worth less than no movement at all.
        Wholesaler wholesaler = wholesalers.findById(request.wholesalerId())
                .orElseThrow(() -> ApiException.notFound("Wholesaler"));
        String user = staff.findById(request.staffId())
                .orElseThrow(() -> ApiException.notFound("Staff member"))
                .getName();

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
                ? addStock(existing.get(), request, location, wholesaler, user)
                : createArticle(sel, code, request, location, wholesaler, user);
    }

    /** Add several size variants from one purchase, atomically. */
    @Transactional
    public AddArticleBatchResponse addBatch(AddArticleBatchRequest request) {
        Set<Long> seenSizeIds = new HashSet<>();
        List<Selection> selections = request.sizes().stream().map(line -> {
            if (!seenSizeIds.add(line.sizeId())) {
                throw ApiException.badRequest("DUPLICATE_SIZE", "Each size can be entered only once");
            }
            Selection selection = resolve(request.articleTypeId(), request.brandId(),
                    request.materialId(), request.colourId(), line.sizeId());
            requireSizeMatchesArticle(selection);
            return selection;
        }).toList();

        // Check every selected size before writing any stock, so a stale duplicate preview
        // cannot leave only part of a size run added.
        for (int i = 0; i < request.sizes().size(); i++) {
            AddArticleBatchLine line = request.sizes().get(i);
            Selection selection = selections.get(i);
            String code = codeGenerator.generate(selection.type(), selection.brand(),
                    selection.material(), selection.colour(), selection.size());
            Optional<ProductVariant> existing = variants.findByArticleCode(code);
            if (existing.isPresent() && line.mode() == AddMode.CREATE) {
                throw ApiException.conflict("ARTICLE_EXISTS",
                        "Article " + code + " already exists. Review the selected sizes and try again.",
                        Map.of("articleCode", code, "existing", describe(existing.get())));
            }
            if (existing.isEmpty() && line.mode() == AddMode.ADD_STOCK) {
                throw ApiException.conflict("ARTICLE_MISSING",
                        "Article " + code + " no longer exists. Review the selected sizes and try again.",
                        Map.of("articleCode", code));
            }
        }

        List<AddArticleResponse> added = new java.util.ArrayList<>();
        for (AddArticleBatchLine line : request.sizes()) {
            added.add(add(new AddArticleRequest(
                    request.articleTypeId(), request.brandId(), request.materialId(), request.colourId(),
                    line.sizeId(), request.buyingPrice(), request.sellingPrice(), line.quantity(),
                    request.wholesalerId(), request.staffId(), line.mode(),
                    line.updateSellingPrice(), request.note())));
        }
        return new AddArticleBatchResponse(added);
    }

    private AddArticleResponse createArticle(Selection sel, String code, AddArticleRequest request,
                                             Location location, Wholesaler wholesaler, String user) {
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
        variant.setLastBuyingPrice(request.buyingPrice());
        variant.setAvgCost(request.buyingPrice());   // first lot sets the average
        variant.setSellingPrice(request.sellingPrice());
        variants.save(variant);

        BigDecimal balance = inventory.post(variant.getId(), location.getId(),
                MovementType.OPENING_STOCK, request.quantity(), request.buyingPrice(),
                wholesaler.getId(), "ARTICLE", code, request.note(), user);

        return new AddArticleResponse("CREATED", variant.getId(), code, product.getDisplayName(),
                balance, variant.getAvgCost(), variant.getLastBuyingPrice(),
                variant.getSellingPrice(), false);
    }

    private AddArticleResponse addStock(ProductVariant variant, AddArticleRequest request,
                                        Location location, Wholesaler wholesaler, String user) {

        BigDecimal onHandBefore = inventory.onHand(variant.getId(), location.getId());

        // The cost is not a choice - you paid what you paid. Blend the new lot into the
        // average so the margin report stays honest, instead of pretending every piece
        // on the shelf cost whatever the last one did.
        variant.setAvgCost(Costing.weightedAverage(
                onHandBefore, variant.getAvgCost(), request.quantity(), request.buyingPrice()));
        variant.setLastBuyingPrice(request.buyingPrice());

        // The shelf price IS a choice, and the only one here.
        boolean sellingPriceChanged = false;
        if (request.updateSellingPrice()
                && request.sellingPrice().compareTo(variant.getSellingPrice()) != 0) {
            variant.setSellingPrice(request.sellingPrice());
            sellingPriceChanged = true;
        }
        variants.save(variant);

        // unit_cost records what THIS lot actually cost, so the averaging stays reversible.
        BigDecimal balance = inventory.post(variant.getId(), location.getId(),
                MovementType.PURCHASE_IN, request.quantity(), request.buyingPrice(),
                wholesaler.getId(), "ARTICLE", variant.getArticleCode(), request.note(), user);

        return new AddArticleResponse("STOCK_ADDED", variant.getId(), variant.getArticleCode(),
                variant.getProduct().getDisplayName(), balance,
                variant.getAvgCost(), variant.getLastBuyingPrice(),
                variant.getSellingPrice(), sellingPriceChanged);
    }

    // ------------------------------------------------------------------
    // List
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<ArticleListItem> list(ArticleFilter filter, Pageable pageable) {
        Page<ProductVariant> page = variants.search(
                filter.q(), filter.articleTypeId(), filter.brandId(),
                filter.materialId(), filter.colourId(), filter.sizeId(), pageable);

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
                v.getAvgCost(),
                v.getLastBuyingPrice(),
                v.getSellingPrice(),
                stock.getOrDefault(v.getId(), BigDecimal.ZERO)));
    }

    // ------------------------------------------------------------------
    // Detail
    // ------------------------------------------------------------------

    /**
     * One article, told completely: what it cost, what it sells for, what is left, and
     * every movement that got it there — plus its other colours and sizes, because
     * "not in your size" is a sale you can still save.
     *
     * <p>The whole ledger for one article is read rather than aggregated in SQL. A
     * garment accumulates a few dozen movements in a year, the screen shows them anyway,
     * and one small query beats two plus a hand-written aggregate.
     */
    @Transactional(readOnly = true)
    public ArticleDetail detail(Long variantId) {
        ProductVariant v = variants.findDetailById(variantId)
                .orElseThrow(() -> ApiException.notFound("Article"));
        Product product = v.getProduct();
        Location location = inventory.defaultLocation();

        List<StockLedger> history = ledger.findByVariantIdOrderByCreatedAtDesc(variantId);

        BigDecimal totalIn = BigDecimal.ZERO;
        BigDecimal totalOut = BigDecimal.ZERO;
        Instant lastSaleAt = null;
        for (StockLedger row : history) {
            if (row.getQtyDelta().signum() > 0) {
                totalIn = totalIn.add(row.getQtyDelta());
            } else {
                totalOut = totalOut.add(row.getQtyDelta().negate());
            }
            // history is newest first, so the first sale seen is the latest one
            if (lastSaleAt == null && row.getMovementType() == MovementType.SALE_OUT) {
                lastSaleAt = row.getCreatedAt();
            }
        }

        return new ArticleDetail(
                v.getId(),
                v.getArticleCode(),
                product.getDisplayName(),
                product.getArticleType().getName(),
                product.getBrand().getName(),
                product.getMaterial().getName(),
                v.getColour().getName(),
                v.getColour().getHex(),
                v.getSize().getName(),
                product.getHsnCode(),
                v.getStatus(),
                v.getCreatedAt(),
                v.getAvgCost(),
                v.getLastBuyingPrice(),
                v.getSellingPrice(),
                v.getMrp(),
                inventory.onHand(v.getId(), location.getId()),
                v.getReorderLevel(),
                totalIn,
                totalOut,
                history.isEmpty() ? null : history.get(history.size() - 1).getCreatedAt(),
                history.isEmpty() ? null : history.get(0).getCreatedAt(),
                lastSaleAt,
                toLedgerEntries(history),
                siblingsOf(v, location));
    }

    /** Supplier names are resolved in one lookup for the whole history, not one per row. */
    private List<LedgerEntry> toLedgerEntries(List<StockLedger> history) {
        List<Long> supplierIds = history.stream()
                .map(StockLedger::getWholesalerId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<Long, String> names = supplierIds.isEmpty()
                ? Map.of()
                : wholesalers.findAllById(supplierIds).stream()
                        .collect(Collectors.toMap(Wholesaler::getId, Wholesaler::getName));

        return history.stream()
                .map(row -> new LedgerEntry(
                        row.getId(),
                        row.getMovementType().name(),
                        row.getQtyDelta(),
                        row.getBalanceAfter(),
                        row.getUnitCost(),
                        row.getUnitPrice(),
                        row.getWholesalerId() == null ? null : names.get(row.getWholesalerId()),
                        "SALE".equals(row.getRefDocType()) ? row.getRefDocId() : null,
                        row.getNote(),
                        row.getCreatedBy(),
                        row.getCreatedAt()))
                .toList();
    }

    private List<SiblingVariant> siblingsOf(ProductVariant variant, Location location) {
        List<ProductVariant> others = variants.findSiblings(variant.getProduct().getId(), variant.getId());
        Map<Long, BigDecimal> stock = inventory.onHandByVariant(
                others.stream().map(ProductVariant::getId).toList());

        return others.stream()
                .map(s -> new SiblingVariant(
                        s.getId(),
                        s.getArticleCode(),
                        s.getColour().getName(),
                        s.getColour().getHex(),
                        s.getSize().getName(),
                        s.getSellingPrice(),
                        stock.getOrDefault(s.getId(), BigDecimal.ZERO)))
                .toList();
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
                v.getAvgCost(),
                v.getLastBuyingPrice(),
                v.getSellingPrice(),
                inventory.onHand(v.getId(), inventory.defaultLocation().getId()));
    }
}
