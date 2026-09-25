-- Where a lot came from, and who keyed it in.
--
-- Both belong to the MOVEMENT, not to the article. The same shirt gets bought from
-- whichever wholesaler had it that week, so "supplier" is a fact about the lot: put it
-- on the article and the next purchase would overwrite the last one's history.
-- Who entered it is the same kind of fact, and stock_ledger.created_by already exists
-- to hold it.

create table wholesaler (
    id         bigserial    primary key,
    name       varchar(120) not null unique,
    phone      varchar(20)  not null,
    address    varchar(255) not null,
    active     boolean      not null default true,
    created_at timestamptz  not null default now()
);
comment on table wholesaler is 'Open-ended: staff add them from the Add Article form.';

create table staff (
    id         bigserial   primary key,
    name       varchar(80) not null unique,
    sort_order int         not null default 0,
    active     boolean     not null default true
);
comment on table staff is 'Who is standing at the counter. A row, not a constant, so a fourth person needs no deploy.';

insert into staff (name, sort_order) values ('Ashwini', 1), ('Aditya', 2), ('Mahesh', 3);

-- Nullable on purpose: movements recorded before this column existed have no
-- supplier on record, and inventing one for them would be a lie.
alter table stock_ledger add column wholesaler_id bigint references wholesaler (id);
