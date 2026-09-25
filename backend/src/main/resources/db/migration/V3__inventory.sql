-- Stock is an append-only ledger. inventory_stock is a rebuildable cache.
-- Nothing in the application may UPDATE qty_on_hand except InventoryService.

create table location (
    id     bigserial   primary key,
    code   varchar(16) not null unique,
    name   varchar(64) not null,
    type   varchar(16) not null default 'FLOOR',
    active boolean     not null default true
);

create table inventory_stock (
    id          bigserial     primary key,
    variant_id  bigint        not null references product_variant (id),
    location_id bigint        not null references location (id),
    qty_on_hand numeric(12,3) not null default 0,
    version     bigint        not null default 0,
    updated_at  timestamptz   not null default now(),
    constraint uq_stock_variant_location unique (variant_id, location_id)
);

create table stock_ledger (
    id            bigserial     primary key,
    variant_id    bigint        not null references product_variant (id),
    location_id   bigint        not null references location (id),
    movement_type varchar(24)   not null,
    qty_delta     numeric(12,3) not null,
    balance_after numeric(12,3) not null,
    unit_cost     numeric(12,2),
    ref_doc_type  varchar(24),
    ref_doc_id    varchar(64),
    note          varchar(255),
    created_by    varchar(64),
    created_at    timestamptz   not null default now()
);

create index idx_ledger_variant on stock_ledger (variant_id, created_at desc);
