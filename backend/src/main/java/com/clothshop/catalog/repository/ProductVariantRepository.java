package com.clothshop.catalog.repository;

import com.clothshop.catalog.domain.ProductVariant;
import com.clothshop.catalog.dto.ArticleDtos.ArticleSummaryRow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    Optional<ProductVariant> findByArticleCode(String articleCode);

    /** The detail screen, with every lookup it displays pulled in one round trip. */
    @Query("""
            select v from ProductVariant v
              join fetch v.product p
              join fetch p.articleType
              join fetch p.brand
              join fetch p.material
              join fetch v.colour
              join fetch v.size
            where v.id = :id
            """)
    Optional<ProductVariant> findDetailById(@Param("id") Long id);

    /**
     * Every other colour and size of the same style. This is what you offer when the
     * customer wants this shirt but not in this size — so it is ordered the way a rack
     * is, by size then colour, not alphabetically.
     */
    @Query("""
            select v from ProductVariant v
              join fetch v.colour
              join fetch v.size
            where v.product.id = :productId and v.id <> :excludeVariantId
            order by v.size.sortOrder, v.colour.sortOrder
            """)
    List<ProductVariant> findSiblings(@Param("productId") Long productId,
                                      @Param("excludeVariantId") Long excludeVariantId);

    /**
     * The articles behind a cart, with everything a bill line has to print. One query
     * for the whole cart: the counter should not pay a round trip per garment while a
     * customer stands there.
     */
    @Query("""
            select v from ProductVariant v
              join fetch v.product p
              join fetch v.colour
              join fetch v.size
            where v.id in :ids
            """)
    List<ProductVariant> findAllForSale(@Param("ids") Collection<Long> ids);

    /**
     * One query for the whole browse screen. Every filter is optional and a null one
     * drops out of the predicate, so the five dropdowns narrow the result in the
     * database rather than the browser. The fetch joins keep it a single round trip:
     * the list renders names from five lookups without an N+1 behind it.
     */
    @Query(value = """
            select v from ProductVariant v
              join fetch v.product p
              join fetch p.articleType
              join fetch p.brand
              join fetch p.material
              join fetch v.colour
              join fetch v.size
            where (upper(v.articleCode) like upper(concat(:q, '%'))
                or upper(p.displayName)  like upper(concat('%', :q, '%')))
              and (:articleTypeId is null or p.articleType.id = :articleTypeId)
              and (:brandId       is null or p.brand.id       = :brandId)
              and (:materialId    is null or p.material.id    = :materialId)
              and (:colourId      is null or v.colour.id      = :colourId)
              and (:sizeId        is null or v.size.id        = :sizeId)
            """,
            countQuery = """
            select count(v) from ProductVariant v
              join v.product p
            where (upper(v.articleCode) like upper(concat(:q, '%'))
                or upper(p.displayName)  like upper(concat('%', :q, '%')))
              and (:articleTypeId is null or p.articleType.id = :articleTypeId)
              and (:brandId       is null or p.brand.id       = :brandId)
              and (:materialId    is null or p.material.id    = :materialId)
              and (:colourId      is null or v.colour.id      = :colourId)
              and (:sizeId        is null or v.size.id        = :sizeId)
            """)
    Page<ProductVariant> search(@Param("q") String q,
                                @Param("articleTypeId") Long articleTypeId,
                                @Param("brandId") Long brandId,
                                @Param("materialId") Long materialId,
                                @Param("colourId") Long colourId,
                                @Param("sizeId") Long sizeId,
                                Pageable pageable);

    @Query("""
            select new com.clothshop.catalog.dto.ArticleDtos$ArticleSummaryRow(
              v.id, v.size.name, v.colour.id, v.colour.name, v.colour.hex)
            from ProductVariant v
              join v.product p
            where (upper(v.articleCode) like upper(concat(:q, '%'))
                or upper(p.displayName) like upper(concat('%', :q, '%')))
              and (:articleTypeId is null or p.articleType.id = :articleTypeId)
              and (:brandId is null or p.brand.id = :brandId)
              and (:materialId is null or p.material.id = :materialId)
              and (:colourId is null or v.colour.id = :colourId)
              and (:sizeId is null or v.size.id = :sizeId)
            order by v.size.sortOrder, v.colour.sortOrder
            """)
    List<ArticleSummaryRow> summarizeSearch(@Param("q") String q,
                                            @Param("articleTypeId") Long articleTypeId,
                                            @Param("brandId") Long brandId,
                                            @Param("materialId") Long materialId,
                                            @Param("colourId") Long colourId,
                                            @Param("sizeId") Long sizeId);
}
