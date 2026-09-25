-- Buying the same article again at a different rate is normal. The code must stay
-- unique (at the counter the code is all the cashier has), so one row holds one cost:
-- the weighted average of the stock actually on hand.
--
-- Nothing is lost by averaging. stock_ledger.unit_cost keeps every lot's real purchase
-- rate forever, so FIFO or per-lot margins can still be computed retrospectively.

alter table product_variant
    rename column buying_price to last_buying_price;

comment on column product_variant.last_buying_price is
    'What the most recent lot cost. Informational - shows the trend. NOT the cost basis.';

-- 4 decimal places: this is a computed rate, not an amount anyone pays. The extra
-- precision stops rounding drift accumulating over many stock-ins.
alter table product_variant
    add column avg_cost numeric(12,4);

update product_variant set avg_cost = last_buying_price where avg_cost is null;

alter table product_variant
    alter column avg_cost set not null;

alter table product_variant
    add constraint chk_avg_cost_non_negative check (avg_cost >= 0);

comment on column product_variant.avg_cost is
    'Weighted average cost of stock on hand, recomputed on every stock-in. '
    'Margin and stock-valuation reports use THIS, never last_buying_price.';
