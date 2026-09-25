-- Brand extends LookupEntity, which maps sort_order; V1 created brand without it,
-- so schema validation failed on startup.
alter table brand add column sort_order int not null default 0;
