package com.clothshop.catalog.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * The thing you actually stock: a style in one colour and one size.
 * Carries the article code, the prices, and (via inventory) the count.
 */
@Entity
@Table(name = "product_variant")
@Getter
@Setter
public class ProductVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /**
     * Generated ONCE from the five lookups and then frozen.
     * Never recomputed — by the time anyone renames a brand, tags are already
     * hanging on garments in the shop.
     */
    @Column(name = "article_code", nullable = false, unique = true, updatable = false, length = 16)
    private String articleCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "colour_id", nullable = false)
    private Colour colour;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "size_id", nullable = false)
    private ClothingSize size;

    @Column(name = "buying_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal buyingPrice;

    @Column(name = "selling_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal sellingPrice;

    @Column(precision = 12, scale = 2)
    private BigDecimal mrp;

    @Column(name = "reorder_level", nullable = false, precision = 12, scale = 3)
    private BigDecimal reorderLevel = BigDecimal.ZERO;

    @Column(nullable = false, length = 16)
    private String status = "ACTIVE";

    @Version
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }
}
