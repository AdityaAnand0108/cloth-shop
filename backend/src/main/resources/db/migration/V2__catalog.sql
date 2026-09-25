-- product      = article type + brand + material  (the style)
-- variant      = that, plus colour + size         (the thing you actually stock)
-- The article code lives on the variant because it includes colour and size.

create table product (
    id              bigserial    primary key,
    article_type_id bigint       not null references article_type (id),
    brand_id        bigint       not null references brand (id),
    material_id     bigint       not null references material (id),
    display_name    varchar(160) not null,
    hsn_code        varchar(8),
    status          varchar(16)  not null default 'ACTIVE',
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz  not null default now(),
    constraint uq_product_combo unique (article_type_id, brand_id, material_id)
);

create table product_variant (
    id             bigserial     primary key,
    product_id     bigint        not null references product (id),
    article_code   varchar(16)   not null unique,
    colour_id      bigint        not null references colour (id),
    size_id        bigint        not null references clothing_size (id),
    buying_price   numeric(12,2) not null check (buying_price  >= 0),
    selling_price  numeric(12,2) not null check (selling_price >= 0),
    mrp            numeric(12,2) check (mrp >= 0),
    reorder_level  numeric(12,3) not null default 0,
    status         varchar(16)   not null default 'ACTIVE',
    version        bigint        not null default 0,
    created_at     timestamptz   not null default now(),
    updated_at     timestamptz   not null default now(),
    constraint uq_variant_combo unique (product_id, colour_id, size_id)
);

comment on column product_variant.article_code is
    'Generated ONCE at creation from the five lookups and then frozen. Never recomputed: tags are already printed.';

-- Prefix search: "TSLV%" finds every Levis t-shirt. Needed because the POS
-- entry box searches by partial code.
create index idx_variant_code_prefix on product_variant (article_code varchar_pattern_ops);
create index idx_variant_product on product_variant (product_id);
