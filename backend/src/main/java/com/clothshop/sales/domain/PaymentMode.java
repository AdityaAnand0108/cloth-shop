package com.clothshop.sales.domain;

/** How the counter was settled. Split payments are a module 3.1 problem, not this one. */
public enum PaymentMode {
    CASH,
    UPI,
    CARD
}
