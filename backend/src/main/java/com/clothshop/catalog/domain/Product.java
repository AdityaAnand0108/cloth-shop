package com.clothshop.catalog.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * The style: article type + brand + material, unique together.
 * <p>
 * The Add Article form never mentions this — the backend finds or creates it
 * silently. It exists so reports can group "all Levis cotton t-shirts" across
 * every colour and size.
 */
@Entity
@Table(name = "product")
@Getter
@Setter
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_type_id", nullable = false)
    private ArticleType articleType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "brand_id", nullable = false)
    private Brand brand;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    /** e.g. "Levis Cotton T-Shirt" — denormalised for list screens. */
    @Column(name = "display_name", nullable = false, length = 160)
    private String displayName;

    @Column(name = "hsn_code", length = 8)
    private String hsnCode;

    @Column(nullable = false, length = 16)
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }
}
