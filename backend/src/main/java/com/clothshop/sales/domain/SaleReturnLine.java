package com.clothshop.sales.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "sale_return_line")
@Getter @Setter
public class SaleReturnLine {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_return_id", nullable = false)
    private SaleReturn saleReturn;

    @Column(name = "original_sale_line_id", nullable = false)
    private Long originalSaleLineId;

    @Column(name = "variant_id", nullable = false)
    private Long variantId;

    @Column(name = "article_code", nullable = false, length = 16)
    private String articleCode;

    @Column(nullable = false, length = 160)
    private String description;

    @Column(nullable = false, length = 64)
    private String colour;

    @Column(nullable = false, length = 32)
    private String size;

    @Column(name = "quantity", nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;

    @Column(name = "unit_refund", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitRefund;

    @Column(name = "refund_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundTotal;

    @Column(name = "restocked", nullable = false)
    private boolean restocked;
}
