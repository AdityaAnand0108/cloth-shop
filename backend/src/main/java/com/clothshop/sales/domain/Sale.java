package com.clothshop.sales.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * One bill, as handed to one customer. Written once; never edited.
 * <p>
 * Every money column is a frozen copy rather than something recomputed from the
 * catalogue. Reprinted a year later this must still read exactly as it did at the
 * counter, whatever has happened to the article's price since.
 */
@Entity
@Table(name = "sale")
@Getter
@Setter
public class Sale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "bill_no", nullable = false, unique = true, updatable = false, length = 24)
    private String billNo;

    @Column(name = "location_id", nullable = false, updatable = false)
    private Long locationId;

    /** Who rang it up. Nullable only so a bill survives a staff row being removed. */
    @Column(name = "staff_id", updatable = false)
    private Long staffId;

    @Column(name = "customer_name", updatable = false, length = 120)
    private String customerName;

    @Column(name = "customer_phone", updatable = false, length = 20)
    private String customerPhone;

    /** Sum of the line totals, before the bill-level discount. */
    @Column(nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    /** Taken off the whole bill — the round-off or the final concession. */
    @Column(nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(name = "cost_total", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal costTotal;

    @Column(nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal profit;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", nullable = false, updatable = false, length = 16)
    private PaymentMode paymentMode;

    @Column(updatable = false, length = 255)
    private String note;

    @Column(nullable = false, length = 16)
    private String status = "COMPLETED";

    @Column(name = "created_by", updatable = false, length = 64)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNumber asc")
    private List<SaleLine> lines = new ArrayList<>();

    public void addLine(SaleLine line) {
        line.setSale(this);
        line.setLineNumber(lines.size() + 1);
        lines.add(line);
    }
}
