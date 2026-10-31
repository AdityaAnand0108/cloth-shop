package com.clothshop.sales.web;

import com.clothshop.sales.dto.SaleDtos.Bill;
import com.clothshop.sales.dto.SaleDtos.CartArticle;
import com.clothshop.sales.dto.SaleDtos.CheckoutRequest;
import com.clothshop.sales.dto.SaleDtos.DaySummary;
import com.clothshop.sales.dto.SaleDtos.PriceCheckRequest;
import com.clothshop.sales.service.SaleService;
import com.clothshop.platform.service.IdempotencyService;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/sales")
@Tag(name = "Sales", description = "Cart price checks, checkout, bills, and daily summary")
@SecurityRequirement(name = "bearerAuth")
public class SaleController {

    private final SaleService sales;
    private final IdempotencyService idempotency;

    public SaleController(SaleService sales, IdempotencyService idempotency) {
        this.sales = sales;
        this.idempotency = idempotency;
    }

    /** What the cart re-asks before a price is agreed: current price, cost and stock. */
    @PostMapping("/price-check")
    public List<CartArticle> priceCheck(@Valid @RequestBody PriceCheckRequest request) {
        return sales.priceCheck(request.variantIds());
    }

    /**
     * Ring up the cart. A replayed Idempotency-Key returns the bill that was already
     * written instead of selling the same goods twice — the counter is exactly where a
     * button gets pressed again because nothing seemed to happen.
     */
    @PostMapping
    public Bill checkout(@Valid @RequestBody CheckoutRequest request,
                         @RequestHeader(value = "Idempotency-Key", required = false) String key) {

        return idempotency.replay(key, Bill.class).orElseGet(() -> {
            Bill bill = sales.checkout(request);
            idempotency.remember(key, "POST /api/v1/sales", bill);
            return bill;
        });
    }

    /** One bill, for reprinting or for looking up what a customer was charged. */
    @GetMapping("/{id}")
    public Bill bill(@PathVariable Long id) {
        return sales.bill(id);
    }

    /** How the day is going. Defaults to today in the shop's own time zone. */
    @GetMapping("/day")
    public DaySummary day(@RequestParam(required = false)
                          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return sales.day(date);
    }
}
