# Cloth Shop

Inventory and billing for a single retail cloth shop.
React + TypeScript front end, Spring Boot 3 / Java 21 back end, PostgreSQL on Supabase.

Built module by module. **Module 1 — Add Article — is complete.**

```
cloth-shop/
  backend/     Spring Boot API + Flyway migrations
  frontend/    React (Vite) UI
```

---

## One-time setup

### 1. Create the Supabase database

1. Sign up at supabase.com and create a project.
2. **Choose region `ap-south-1` (Mumbai)** — every query crosses the internet, so the
   nearest region is the difference between a snappy form and a sluggish one.
3. Save the database password you set; it is shown only once.
4. Go to **Project Settings -> Database -> Connection string** and copy the
   **Session pooler** URI.

   > Use the **session** pooler on port **5432**, not the transaction pooler on 6543.
   > The transaction pooler does not support prepared statements and Hibernate will
   > fail against it.

### 2. Point the backend at it

```
copy backend\.env.example backend\.env
```

Edit `backend\.env`:

```
DB_URL=jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
DB_USER=postgres.abcdefghijklmnop        # the project ref from your pooler URI
DB_PASSWORD=your-database-password
```

`.env` is gitignored. Never commit it.

---

## Running it

Two terminals.

**Backend** (first run downloads Maven into `~/.m2/wrapper`, then applies all
migrations and seeds the lookup tables automatically):

```
.\run-backend.ps1
```

**Frontend:**

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Module 1 — Add Article

### The article code

```
  T-Shirt   Levis   Cotton   Black   M
     TS   +  LV   +   CT   +  BL  +  M   ->   TSLVCTBLM
  article  brand   material  colour  size
```

Each fragment comes from that lookup row's own `code` column, which is `UNIQUE` in
the database. Codes are **assigned, never derived from the name** — deriving the first
two letters collides immediately:

| | |
|---|---|
| BLACK -> `BL` | BLUE -> `BL` |
| LEVIS -> `LE` | LEE -> `LE` |
| COTTON -> `CO` | CORDUROY -> `CO` |

So BLACK is `BL` and BLUE is `BU`, set explicitly in `V5__seed_lookups.sql`.

**Two rules:**

1. A code is generated **once**, at creation, and then frozen. It is never recomputed —
   renaming a brand must not change a code already printed on tags in the shop.
2. Codes are never reused, even after an article is discontinued.

Change the seeded codes **before you print your first tag**. After that they are fixed.

### What happens when you press Add

1. The five dropdowns assemble the code (locally — no network call per keystroke).
2. The server checks whether that code exists.
3. **New** -> creates the article and writes an `OPENING_STOCK` ledger row.
4. **Exists** -> refuses to duplicate. Shows what is already there and asks whether to
   add the quantity to it.
5. **Exists at a different buying price** -> asks whether to update the price too.
   Supplier rates rise; this is the moment to catch it.

A double-tapped Add button cannot add stock twice — the client sends an
`Idempotency-Key` and a replay returns the original response.

### Stock is a ledger

`stock_ledger` is append-only and is the source of truth. `inventory_stock.qty_on_hand`
is a cache that can be rebuilt from it at any time.

**Nothing may change stock except `InventoryService.post()`.** If you need stock to move,
add a method there rather than writing an UPDATE elsewhere — otherwise the answer to
"how did it get to 37?" is lost.

### Size groups

A jean has no size M. `article_type` points at a `size_group`; the size dropdown filters
to that group, and the server rejects a mismatched pair.

---

## API

| Method | Path | |
|---|---|---|
| GET | `/api/v1/lookups` | all five dropdowns in one call |
| POST | `/api/v1/brands` | create a brand; suggests and validates its 2-letter code |
| POST | `/api/v1/articles/preview-code` | code + does it already exist |
| POST | `/api/v1/articles` | create, or add stock; idempotent |
| GET | `/api/v1/articles?q=` | inventory list, prefix-searchable by code |

---

## Conventions

- Money is `NUMERIC(12,2)` / `BigDecimal`. Never `double`.
- Quantity is `NUMERIC(12,3)` so fabric by the metre works later.
- Flyway owns the schema. `ddl-auto` is `validate` and must stay that way.
- Timestamps are `timestamptz`, stored UTC.
- Hikari pool is capped at 5 — Supabase's free tier is connection-limited.

## Roadmap

| | Module | Status |
|---|---|---|
| 1 | Add article to inventory | done |
| 2 | Article list, edit, tag printing | next |
| 3 | Billing / POS | |
| 4 | Returns and exchanges | |
| 5 | Purchase orders and suppliers | |
| 6 | Discounts and offers | |
| 7 | Customers and loyalty | |
| 8 | Reports | |
