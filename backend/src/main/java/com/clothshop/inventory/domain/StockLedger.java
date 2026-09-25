package com.clothshop.inventory.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Append-only. Every quantity change in the whole system writes one of these,
 * inside the same transaction as the document that caused it.
 * <p>
 * This is what answers "how did it get to 37?". Rows are never updated or deleted.
 */
@Entity
@Table(name = "stock_ledger")
@Getter
@Setter
public class StockLedger {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "variant_id", nullable = false, updatable = false)
    private Long variantId;

    @Column(name = "location_id", nullable = false, updatable = false)
    private Long locationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, updatable = false, length = 24)
    private MovementType movementType;

    @Column(name = "qty_delta", nullable = false, updatable = false, precision = 12, scale = 3)
    private BigDecimal qtyDelta;

    @Column(name = "balance_after", nullable = false, updatable = false, precision = 12, scale = 3)
    private BigDecimal balanceAfter;

    @Column(name = "unit_cost", updatable = false, precision = 12, scale = 2)
    private BigDecimal unitCost;

    @Column(name = "ref_doc_type", updatable = false, length = 24)
    private String refDocType;

    @Column(name = "ref_doc_id", updatable = false, length = 64)
    private String refDocId;

    @Column(updatable = false, length = 255)
    private String note;

    @Column(name = "created_by", updatable = false, length = 64)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
