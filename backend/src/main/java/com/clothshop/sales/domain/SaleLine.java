package com.clothshop.sales.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * One line of one bill. The article's name, colour and size are copied in rather than
 * joined: the garment may be renamed or discontinued, but the bill must not change.
 */
@Entity
@Table(name = "sale_line")
@Getter
@Setter
public class SaleLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_id", nullable = false)
    private Sale sale;

    @Column(name = "line_number", nullable = false, updatable = false)
    private Integer lineNumber;

    /** Kept so an article's own history can find the bills it appeared on. */
    @Column(name = "variant_id", nullable = false, updatable = false)
    private Long variantId;

    @Column(name = "article_code", nullable = false, updatable = false, length = 16)
    private String articleCode;

    @Column(nullable = false, updatable = false, length = 160)
    private String description;

    @Column(nullable = false, updatable = false, length = 64)
    private String colour;

    @Column(nullable = false, updatable = false, length = 32)
    private String size;

    @Column(nullable = false, updatable = false, precision = 12, scale = 3)
    private BigDecimal qty;

    /** The shelf price at the time. What the discount on this line is measured against. */
    @Column(name = "list_price", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal listPrice;

    @Column(name = "unit_price", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    /** Weighted average cost at the moment it went out. Fixes the margin forever. */
    @Column(name = "unit_cost", nullable = false, updatable = false, precision = 12, scale = 4)
    private BigDecimal unitCost;

    @Column(name = "cost_estimated", nullable = false, updatable = false)
    private boolean costEstimated;

    @Column(name = "line_total", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal lineTotal;
}
