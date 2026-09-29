package com.clothshop.sales.service;

import com.clothshop.sales.repository.SaleRepository;
import org.springframework.stereotype.Component;

/**
 * Bill numbers come from a database sequence, not from {@code count(*) + 1}.
 * <p>
 * Two people billing at the same second must not be handed the same number, and a
 * sequence is the only way to promise that. Numbers are never reused and the series
 * never resets — a gap means a transaction rolled back, which is the truth.
 */
@Component
public class BillNumberGenerator {

    private static final String PREFIX = "B-";

    private final SaleRepository sales;

    public BillNumberGenerator(SaleRepository sales) {
        this.sales = sales;
    }

    /** {@code B-000001}. Zero-padded so bills sort the way they were written. */
    public String next() {
        return PREFIX + String.format("%06d", sales.nextBillSequence());
    }
}
