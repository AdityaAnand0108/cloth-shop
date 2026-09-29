-- Module 3: selling at the counter.
--
-- A bill is written once and never edited. Correcting one is a return, which is its
-- own document (module 4) — so nothing here is updatable, and the money columns are
-- frozen copies rather than joins. A bill reprinted in six months must show what the
-- customer actually paid, not what the article costs by then.

create sequence bill_no_seq start with 1 increment by 1;

create table sale (
    id             bigserial     primary key,
    bill_no        varchar(24)   not null unique,
    location_id    bigint        not null references location (id),
    staff_id       bigint        references staff (id),
    customer_name  varchar(120),
    customer_phone varchar(20),

    -- subtotal - discount = total. Stored rather than recomputed: the arithmetic on a
    -- printed bill must never change, whatever the rounding rules become later.
    subtotal       numeric(12,2) not null,
    discount       numeric(12,2) not null default 0 check (discount >= 0),
    total          numeric(12,2) not null,

    -- What the goods cost, at the average in force when they went out the door.
    cost_total     numeric(12,2) not null,
    profit         numeric(12,2) not null,

    payment_mode   varchar(16)   not null,
    note           varchar(255),
    status         varchar(16)   not null default 'COMPLETED',
    created_by     varchar(64),
    created_at     timestamptz   not null default now()
);

create index idx_sale_created_at on sale (created_at desc);

create table sale_line (
    id           bigserial     primary key,
    sale_id      bigint        not null references sale (id),
    line_number  int           not null,
    variant_id   bigint        not null references product_variant (id),

    -- Copied, not joined. The article could be renamed or discontinued; the bill
    -- still has to read the way it was handed over.
    article_code varchar(16)   not null,
    description  varchar(160)  not null,
    colour       varchar(64)   not null,
    size         varchar(32)   not null,

    qty          numeric(12,3) not null check (qty > 0),
    list_price   numeric(12,2) not null,   -- the sticker price, before any haggling
    unit_price   numeric(12,2) not null check (unit_price >= 0),  -- what was actually charged
    unit_cost    numeric(12,4) not null,   -- avg_cost at the moment of sale
    line_total   numeric(12,2) not null,

    constraint uq_sale_line_number unique (sale_id, line_number)
);

create index idx_sale_line_variant on sale_line (variant_id);

-- What the customer paid, on movements that are sales. The mirror of unit_cost:
-- together they let an article's history answer both "what did each lot cost" and
-- "what did each sale fetch" without joining back to the bill.
alter table stock_ledger add column unit_price numeric(12,2);
