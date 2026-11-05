package com.clothshop.sales.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "sale_return")
@Getter @Setter
public class SaleReturn {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "return_no", nullable = false, unique = true, length = 24)
    private String returnNo;

    @Column(name = "original_sale_id", nullable = false)
    private Long originalSaleId;

    @Column(name = "staff_id")
    private Long staffId;

    @Column(length = 255)
    private String reason;

    @Column(name = "return_type", nullable = false, length = 16)
    private String returnType;

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Column(name = "refund_payment_mode", length = 16)
    private String refundPaymentMode;

    @Column(name = "exchange_sale_id")
    private Long exchangeSaleId;

    @Column(name = "settlement_due", nullable = false, precision = 12, scale = 2)
    private BigDecimal settlementDue = BigDecimal.ZERO;

    @Column(name = "created_by", length = 80)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "saleReturn", cascade = CascadeType.ALL)
    private List<SaleReturnLine> lines = new ArrayList<>();
}
