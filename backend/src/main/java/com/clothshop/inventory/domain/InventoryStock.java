package com.clothshop.inventory.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Cached on-hand quantity. NOT the source of truth — {@link StockLedger} is.
 * Rebuildable at any time with SUM(qty_delta) per (variant, location).
 */
@Entity
@Table(name = "inventory_stock")
@Getter
@Setter
public class InventoryStock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "variant_id", nullable = false)
    private Long variantId;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "qty_on_hand", nullable = false, precision = 12, scale = 3)
    private BigDecimal qtyOnHand = BigDecimal.ZERO;

    @Version
    private Long version;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }
}
