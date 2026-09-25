create table app_setting (
    key        varchar(96) primary key,
    value      text        not null,
    updated_at timestamptz not null default now()
);

-- A double-tapped "Add" button must not add stock twice.
create table idempotency_record (
    key           varchar(80)  primary key,
    endpoint      varchar(120) not null,
    status_code   int          not null,
    response_body text         not null,
    created_at    timestamptz  not null default now()
);
