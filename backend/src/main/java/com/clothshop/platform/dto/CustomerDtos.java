package com.clothshop.platform.dto;

import java.math.BigDecimal;
import java.time.Instant;

public final class CustomerDtos {
    private CustomerDtos() {}
    public record CustomerSummary(Long id, String name, String phone, int visitCount,
                                  BigDecimal lifetimeSpend, Instant lastVisit,
                                  boolean whatsappOptIn) {}
}
