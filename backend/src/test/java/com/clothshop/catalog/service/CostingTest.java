package com.clothshop.catalog.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class CostingTest {

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    @Test
    @DisplayName("blends a dearer lot into the running average")
    void blendsDearerLot() {
        // 10 @ 340 then 5 @ 380  ->  5300 / 15
        BigDecimal avg = Costing.weightedAverage(bd("10"), bd("340.0000"), bd("5"), bd("380.00"));
        assertThat(avg).isEqualByComparingTo("353.3333");
    }

    @Test
    @DisplayName("blends a cheaper lot too")
    void blendsCheaperLot() {
        BigDecimal avg = Costing.weightedAverage(bd("10"), bd("400.0000"), bd("10"), bd("300.00"));
        assertThat(avg).isEqualByComparingTo("350.0000");
    }

    @Test
    @DisplayName("same rate twice leaves the average untouched")
    void sameRateIsStable() {
        BigDecimal avg = Costing.weightedAverage(bd("7"), bd("249.0000"), bd("3"), bd("249.00"));
        assertThat(avg).isEqualByComparingTo("249.0000");
    }

    @Test
    @DisplayName("sold out before restocking: the new rate simply is the cost")
    void resetsWhenStockWasZero() {
        // Averaging against stock you no longer own would drag the cost toward a lot
        // that is already gone.
        assertThat(Costing.weightedAverage(BigDecimal.ZERO, bd("340.0000"), bd("5"), bd("380.00")))
                .isEqualByComparingTo("380.0000");
    }

    @Test
    @DisplayName("negative stock from an oversell also resets rather than inverting the maths")
    void resetsWhenStockNegative() {
        assertThat(Costing.weightedAverage(bd("-2"), bd("340.0000"), bd("5"), bd("380.00")))
                .isEqualByComparingTo("380.0000");
    }

    @Test
    @DisplayName("first ever lot has no average to blend into")
    void handlesNullAverage() {
        assertThat(Costing.weightedAverage(bd("0"), null, bd("12"), bd("155.50")))
                .isEqualByComparingTo("155.5000");
    }

    @Test
    @DisplayName("repeated small lots do not drift away from the true average")
    void staysAccurateOverManyLots() {
        // 4dp on the average is what keeps this honest; at 2dp the error compounds.
        BigDecimal avg = bd("100.0000");
        BigDecimal qty = bd("3");
        for (int i = 0; i < 40; i++) {
            avg = Costing.weightedAverage(qty, avg, bd("3"), bd("133.33"));
            qty = qty.add(bd("3"));
        }
        // True value tends to 133.33 as the opening 3 pieces are diluted.
        assertThat(avg).isCloseTo(bd("133.0581"), org.assertj.core.api.Assertions.within(bd("0.0100")));
    }

    @Test
    @DisplayName("suggested selling price keeps the markup and rounds up to whole rupees")
    void suggestsWholeRupeePrice() {
        // 353.3333 x 2 = 706.6666 -> nobody prices a shirt at 706.67
        assertThat(Costing.suggestedSellingPrice(bd("353.3333"), bd("2.0")))
                .isEqualByComparingTo("707.00");
    }
}
