package com.clothshop.dashboard.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class DashboardDtos {
    private DashboardDtos() {}

    public record Report(LocalDate from, LocalDate to, Sales sales, Inventory inventory,
                         List<PaymentTotal> paymentBreakdown, List<TopSeller> topSellers,
                         List<StockAlert> lowStock, List<SlowMover> slowMovers) {}
    public record Sales(int billCount, int returnCount, BigDecimal itemCount, BigDecimal takings,
                        BigDecimal profit, BigDecimal discountGiven, int estimatedProfitBills) {}
    public record Inventory(int variantCount, BigDecimal unitsOnHand, BigDecimal stockAtCost,
                            int outOfStockCount, int lowStockCount) {}
    public record PaymentTotal(String paymentMode, BigDecimal total) {}
    public record TopSeller(Long variantId, String articleCode, String description, String colour,
                            String size, BigDecimal quantity, BigDecimal sales) {}
    public record StockAlert(Long variantId, String articleCode, String description, String colour,
                             String size, BigDecimal quantity, BigDecimal reorderLevel) {}
    public record SlowMover(Long variantId, String articleCode, String description, String colour,
                            String size, BigDecimal quantity, BigDecimal stockAtCost,
                            Instant lastSoldAt, Integer daysSinceSale) {}
}
