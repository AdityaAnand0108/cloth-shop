# Cloth Shop

Inventory and billing for a single retail cloth shop.
React + TypeScript front end, Spring Boot 3 / Java 21 back end, PostgreSQL on Supabase.

Built module by module. **Module 1 (Add Article), Module 2 (Article list and detail) and
Module 3 (selling at the counter) are complete.**

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
5. **Exists at a different buying price** -> see *Cost when the rate changes* below.

A double-tapped Add button cannot add stock twice — the client sends an
`Idempotency-Key` and a replay returns the original response.

### Cost when the rate changes

Buying the same article again at a different rate is normal, and the article code cannot
split to accommodate it: at the counter the code is all the cashier has, so it must
resolve to exactly one row. Two black Levis t-shirts in M are also physically identical,
so no "which lot is this" rule survives contact with the shop floor.

One row, one cost, and that cost is the **weighted average of the stock on hand**:

```
10 on hand @ 340.00, buying 5 @ 380.00

  (10 x 340) + (5 x 380)     5300
  ----------------------  =  ----  =  353.3333
          10 + 5               15
```

- `avg_cost` is the cost basis. Margin and stock-valuation reports use this.
- `last_buying_price` is only what the most recent lot cost - a trend indicator.
- If stock was zero before the new lot, the average **resets** to the new rate rather
  than blending against stock no longer owned.
- Averages are `numeric(12,4)`: a computed rate, not an amount anyone pays, and the
  extra precision stops drift accumulating over many stock-ins.

**Averaging is not a question the user is asked.** You paid what you paid, and both
"keep the old rate" and "use the new rate" are false for some of the pieces on the
shelf. The only real decision when topping up stock is whether the **selling price**
moves, which is the one control in the dialog.

Nothing is lost. `stock_ledger.unit_cost` records every lot's actual purchase rate
permanently, so FIFO or per-lot margins remain computable later if the shop ever needs
them. The policy lives in one place - `Costing.java`, covered by `CostingTest`.

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
| POST | `/api/v1/wholesalers` | create a supplier mid-entry |
| POST | `/api/v1/articles/preview-code` | code + does it already exist |
| POST | `/api/v1/articles` | create, or add stock; idempotent |
| GET | `/api/v1/articles?q=` | inventory list, prefix-searchable by code |
| GET | `/api/v1/articles/{id}` | one article: prices, stock, full ledger, siblings |
| POST | `/api/v1/sales/price-check` | current price, cost and stock for a cart |
| POST | `/api/v1/sales` | ring up the cart; idempotent |
| GET | `/api/v1/sales/{id}` | one bill, for reprinting |
| GET | `/api/v1/sales/day?date=` | the day's takings, profit and every bill in it |

---

## Module 3 - Selling

### The flow

A customer walks in holding a shirt.

1. **All articles** - search by code, or narrow with the five dropdowns.
2. **Add to cart** sits beside **View** on every row, and on the article page itself
   (plus on each of its other colours and sizes, which is what you offer when this one
   does not fit).
3. A bar across the bottom follows you around with the count on it.
4. **Cart** - quantities, prices, customer, payment, done.
5. The bill appears, printable. `Ctrl+P` prints the paper and nothing else.

### The cart lives in the browser

Only three things are stored per line: the article, the count, and the price if someone
has typed one. Names, stock levels and shelf prices are deliberately *not* stored - the
cart re-asks the server for those every time it opens.

A cart written to `localStorage` can be a day old. Quoting a customer a price out of it
would be quoting them yesterday's price, and a refresh or a closed lid in the middle of
a sale must not mean asking someone to hand over their armful of clothes again. Storing
the identity and re-reading the money is the only arrangement that gets both.

### Prices are negotiable, costs are not

Every line price on the cart screen can be typed over, because that is what happens
across a counter. The server takes the price as given and never overrules it: handing
someone a bill they did not agree to is worse than any margin.

What the server *does* own is the cost. `unit_cost` on each bill line is the weighted
average in force at the moment the goods went out, written once and never editable.
That is what fixes the profit on the bill forever, whatever the article costs to
restock later.

So the counter is shown the floor while it haggles - what each piece cost, what the
line leaves, and what the whole bill leaves - in red once a price drops under cost.
**A price below cost is allowed.** Clearing old stock at a loss is a decision the shop
is entitled to make, and refusing it in software only teaches staff to work around the
till.

### A bill is written once

`sale` and `sale_line` are never updated. The article's name, colour and size are
*copied* onto the line rather than joined, so a bill reprinted in six months still
reads the way it was handed over - even if the brand has since been renamed or the
article discontinued. A correction is a return, which is its own document.

Bill numbers come from a database sequence, not `count(*) + 1`: two people billing in
the same second must not be handed the same number. Numbers are never reused, and a gap
means a transaction rolled back, which is the truth.

A double-tapped **Complete sale** cannot sell the same goods twice - one
`Idempotency-Key` is minted per cart and replayed until that cart is billed.

### What the sale leaves behind

Selling posts `SALE_OUT` through `InventoryService`, like everything else that moves
stock. Two numbers go on the ledger row:

- `unit_cost` - the cost basis as it left the shelf
- `unit_price` - what the customer actually paid

Together they let an article's own history answer both "what did each lot cost me" and
"what did each sale fetch", without going back to the bill. The article detail page
shows both columns, and the bill number beside them.

Selling never touches `avg_cost`. The average only moves when stock comes *in*.

### The day

`GET /api/v1/sales/day` is the dashboard: takings, profit, pieces, average bill, and
every bill with a link to reprint it. "Today" is the shop's own day
(`app.shop.zone`, `Asia/Kolkata`), not UTC's - a sale rung up at nine in the evening
belongs to the day the shutter came down on, and the number on the screen has to agree
with the till.

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
| 2 | Article list and detail | done |
| 3 | Selling: cart, bill, day summary | done |
| 4 | Returns and exchanges | next |
| 5 | Purchase orders and suppliers | |
| 6 | Discounts and offers | |
| 7 | Customers and loyalty | |
| 8 | Reports | |
