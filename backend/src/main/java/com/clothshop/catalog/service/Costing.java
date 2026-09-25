package com.clothshop.catalog.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * How the cost of an article is decided when the same article is bought again at a
 * different rate.
 *
 * <p>The article code has to stay unique, because at the billing counter the code is
 * the only thing the cashier has — two rows sharing a code would be unanswerable. And
 * two black Levis t-shirts in M are physically identical, so no rule based on "which
 * one is this" can work on the shop floor.
 *
 * <p>So one row holds one cost, and that cost is the weighted average of the stock
 * actually on hand. Overwriting with the latest rate claims the old pieces cost more
 * than they did; keeping the old rate claims the new ones cost less. Both lie to the
 * margin report. The average does not.
 *
 * <p>Averaging loses nothing: {@code stock_ledger.unit_cost} records every lot's real
 * purchase rate permanently, so FIFO or per-lot margins remain computable later.
 */
public final class Costing {

    /** Averages are rates, not amounts anyone pays, so they carry extra precision. */
    public static final int COST_SCALE = 4;

    private Costing() {
    }

    /**
     * Blend an incoming lot into the running average.
     *
     * <pre>
     *   10 on hand @ 340.00, buying 5 @ 380.00
     *   (10 x 340) + (5 x 380)     5300
     *   ----------------------  =  ----  =  353.3333
     *           10 + 5               15
     * </pre>
     *
     * @param qtyOnHand  stock held immediately before this movement
     * @param currentAvg the running average for that stock, ignored when there is none
     * @param incomingQty quantity arriving, must be positive
     * @param incomingCost rate paid for the arriving quantity
     */
    public static BigDecimal weightedAverage(BigDecimal qtyOnHand,
                                             BigDecimal currentAvg,
                                             BigDecimal incomingQty,
                                             BigDecimal incomingCost) {

        // Sold out before the new lot arrived, so there is nothing to blend against.
        // The new rate simply is the cost — averaging it with stock you no longer own
        // would drag the figure toward a lot that is already gone.
        if (qtyOnHand == null || qtyOnHand.signum() <= 0 || currentAvg == null) {
            return incomingCost.setScale(COST_SCALE, RoundingMode.HALF_UP);
        }

        BigDecimal heldValue = qtyOnHand.multiply(currentAvg);
        BigDecimal incomingValue = incomingQty.multiply(incomingCost);
        BigDecimal totalQty = qtyOnHand.add(incomingQty);

        return heldValue.add(incomingValue)
                .divide(totalQty, COST_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * Selling price that preserves the shop's markup against a given cost, rounded up
     * to the next whole rupee — nobody prices a shirt at 706.67.
     */
    public static BigDecimal suggestedSellingPrice(BigDecimal cost, BigDecimal markup) {
        if (cost == null || markup == null) {
            return null;
        }
        return cost.multiply(markup).setScale(0, RoundingMode.CEILING).setScale(2, RoundingMode.UNNECESSARY);
    }
}
