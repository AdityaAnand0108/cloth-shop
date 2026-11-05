-- Shop operations: customer history, WhatsApp delivery state, returns and cost quality.
create table customer (
    id               bigserial primary key,
    normalized_phone varchar(20) not null unique,
    phone            varchar(32) not null,
    name             varchar(120) not null,
    whatsapp_opt_in  boolean not null default false,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

alter table sale add column customer_id bigint references customer(id);
alter table sale add column whatsapp_status varchar(16) not null default 'NOT_SENT';
alter table sale add column whatsapp_opt_in_snapshot boolean not null default false;
alter table sale add column whatsapp_message_id varchar(128);
alter table sale add column whatsapp_last_error varchar(255);
alter table sale add column whatsapp_sent_at timestamptz;
alter table sale_line add column cost_estimated boolean not null default false;

-- Link older bills with a usable phone into the searchable customer register.
with old_contacts as (
    select regexp_replace(customer_phone, '[^0-9]', '', 'g') as digits,
           customer_phone, customer_name, created_at
      from sale
     where customer_phone is not null and btrim(customer_phone) <> ''
), normalized as (
    select case
             when length(digits) = 10 then '91' || digits
             when length(digits) = 11 and left(digits, 1) = '0' then '91' || substring(digits from 2)
             else digits
           end as normalized_phone,
           customer_phone, coalesce(nullif(btrim(customer_name), ''), 'Customer') as name,
           created_at
      from old_contacts
     where length(digits) between 10 and 15
)
insert into customer (normalized_phone, phone, name)
select distinct on (normalized_phone) normalized_phone, customer_phone, name
  from normalized
 order by normalized_phone, created_at desc
on conflict (normalized_phone) do nothing;

update sale s
   set customer_id = c.id
  from customer c
 where s.customer_phone is not null
   and c.normalized_phone = case
       when length(regexp_replace(s.customer_phone, '[^0-9]', '', 'g')) = 10
         then '91' || regexp_replace(s.customer_phone, '[^0-9]', '', 'g')
       when length(regexp_replace(s.customer_phone, '[^0-9]', '', 'g')) = 11
            and left(regexp_replace(s.customer_phone, '[^0-9]', '', 'g'), 1) = '0'
         then '91' || substring(regexp_replace(s.customer_phone, '[^0-9]', '', 'g') from 2)
       else regexp_replace(s.customer_phone, '[^0-9]', '', 'g')
   end;

create index idx_sale_customer on sale (customer_id, created_at desc);
create index idx_customer_name on customer (lower(name));

create sequence return_no_seq start with 1 increment by 1;
create table sale_return (
    id                 bigserial primary key,
    return_no          varchar(24) not null unique,
    original_sale_id   bigint not null references sale(id),
    staff_id           bigint references staff(id),
    reason             varchar(255),
    return_type        varchar(16) not null check (return_type in ('REFUND', 'EXCHANGE')),
    refund_payment_mode varchar(16),
    refund_amount      numeric(12,2) not null default 0 check (refund_amount >= 0),
    exchange_sale_id   bigint references sale(id),
    settlement_due     numeric(12,2) not null default 0,
    created_by         varchar(80),
    created_at         timestamptz not null default now()
);

create table sale_return_line (
    id                 bigserial primary key,
    sale_return_id     bigint not null references sale_return(id),
    original_sale_line_id bigint not null references sale_line(id),
    variant_id         bigint not null references product_variant(id),
    article_code       varchar(16) not null,
    description        varchar(160) not null,
    colour             varchar(64) not null,
    size               varchar(32) not null,
    quantity           numeric(12,3) not null check (quantity > 0),
    unit_refund        numeric(12,2) not null check (unit_refund >= 0),
    refund_total       numeric(12,2) not null check (refund_total >= 0),
    restocked          boolean not null default true
);
create index idx_sale_return_original on sale_return (original_sale_id, created_at desc);
create index idx_sale_return_line_sale_line on sale_return_line (original_sale_line_id);
