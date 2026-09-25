-- Module 1: lookup tables behind the five dropdowns on the Add Article form.
-- Every lookup carries its OWN 2-character code with a UNIQUE constraint.
-- Codes are assigned, never derived from the name: deriving "first two letters"
-- collides (BLACK/BLUE -> BL, LEVIS/LEE -> LE, COTTON/CORDUROY -> CO).

create table size_group (
    id          bigserial primary key,
    code        varchar(16) not null unique,
    name        varchar(64) not null,
    created_at  timestamptz not null default now()
);
comment on table size_group is 'Letter sizes for tops, waist sizes for jeans/trousers, etc.';

create table clothing_size (
    id            bigserial primary key,
    size_group_id bigint      not null references size_group (id),
    code          varchar(4)  not null check (code ~ '^[A-Z0-9]{1,4}$'),
    name          varchar(32) not null,
    sort_order    int         not null default 0,
    active        boolean     not null default true,
    constraint uq_size_code unique (size_group_id, code)
);
comment on column clothing_size.sort_order is 'Display order: S,M,L,XL,XXL — not alphabetical.';

create table article_type (
    id            bigserial   primary key,
    code          varchar(2)  not null unique check (code ~ '^[A-Z]{2}$'),
    name          varchar(64) not null unique,
    size_group_id bigint      not null references size_group (id),
    sort_order    int         not null default 0,
    active        boolean     not null default true
);
comment on column article_type.size_group_id is 'Which size list this article offers. A jean has no size M.';

create table material (
    id         bigserial   primary key,
    code       varchar(2)  not null unique check (code ~ '^[A-Z]{2}$'),
    name       varchar(64) not null unique,
    sort_order int         not null default 0,
    active     boolean     not null default true
);

create table colour (
    id         bigserial   primary key,
    code       varchar(2)  not null unique check (code ~ '^[A-Z]{2}$'),
    name       varchar(64) not null unique,
    hex        varchar(7),
    sort_order int         not null default 0,
    active     boolean     not null default true
);

create table brand (
    id         bigserial   primary key,
    code       varchar(2)  not null unique check (code ~ '^[A-Z]{2}$'),
    name       varchar(96) not null unique,
    active     boolean     not null default true,
    created_at timestamptz not null default now()
);
comment on table brand is 'Open-ended: staff add brands. The API suggests a 2-letter code and rejects duplicates.';
