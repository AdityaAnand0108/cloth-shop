-- Bind Neon Auth subjects to active shop staff and keep a compact mutation audit trail.
alter table staff add column auth_subject varchar(128);
alter table staff add column role varchar(16) not null default 'CASHIER';
alter table staff add constraint ck_staff_role check (role in ('OWNER', 'CASHIER'));
create unique index ux_staff_auth_subject on staff (auth_subject) where auth_subject is not null;

create table audit_event (
    id           bigserial primary key,
    auth_subject varchar(128),
    staff_id     bigint references staff(id) on delete set null,
    staff_name   varchar(80),
    role         varchar(16),
    http_method  varchar(10) not null,
    request_path varchar(255) not null,
    status_code  smallint not null,
    created_at   timestamptz not null default now()
);
create index idx_audit_event_created_at on audit_event (created_at desc);
create index idx_audit_event_staff_created on audit_event (staff_id, created_at desc);
