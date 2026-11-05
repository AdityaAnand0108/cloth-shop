# Free online setup for one shop user

This project uses Spring Boot, PostgreSQL and a Vite/React frontend. The intended
zero-monthly-cost starter setup is:

- **Database:** Neon PostgreSQL on its free plan. The app uses Neon's pooled endpoint
  for requests and the direct endpoint for Flyway migrations. Neon suspends idle compute
  and resumes it on the next query.
- **API:** Render free web service, defined in `render.yaml`. It sleeps after 15
  minutes without a request, so the first request after a quiet period may take about
  a minute to wake.
- **Website:** Cloudflare Pages, connected to this GitHub repository with the
  `frontend` directory as the project root.

Free plans and quotas can change. This setup is intended to keep initial hosting at
zero cost; it does not promise uninterrupted service or backups.

## One-time provider setup

### 1. Create the Neon database

1. Create a free Neon project and choose the AWS Singapore region so it is near the
   Render service region.
2. In **Connect**, copy both connection details: the pooled connection for app traffic
   (hostname contains `-pooler`) and the direct connection for migrations (hostname
   without `-pooler`). Neon recommends pooled connections for web app traffic and direct
   connections for schema migrations.
3. Use the same Neon database role and password for both URLs. Neon requires SSL; keep
   `sslmode=require` on both JDBC URLs.

### 2. Create the API on Render

1. Sign in to Render and create a Blueprint from this GitHub repository.
2. Select the `simplify-dashboard-and-inventory-ui` branch (or the branch containing
   the release you want to use). Render reads `render.yaml` and uses the Dockerfile.
3. Enter these private environment values from Neon's **Connect** dialog:
   - `DB_URL`: JDBC URL for Neon's pooled endpoint, with `?sslmode=require`.
   - `DB_MIGRATION_URL`: JDBC URL for the direct endpoint, without `-pooler`, with
     `?sslmode=require`.
   - `DB_USER`: Neon role name.
   - `DB_PASSWORD`: Neon role password.
4. Set `APP_CORS_ALLOWED_ORIGINS` to the exact Cloudflare Pages origin after creating
   the site (for the first API deploy, a temporary `http://localhost:5173` value is OK).
5. Wait for the service to deploy and copy its HTTPS address, such as
   `https://bflex-api.onrender.com`.
5. Set `NEON_AUTH_JWKS_URL` to the JWKS URL for the same Neon Auth branch and
   `NEON_AUTH_ISSUER` to the exact `iss` value in a token from that branch. Enable
   Neon Auth JWT/JWKS support for the project before deploying.

The `/health` endpoint is used by Render to check that the service has started. Flyway
applies any pending database migrations at startup.

### 3. Create the website on Cloudflare Pages

Create a Pages project connected to this repository and configure:

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/v1`
- Environment variable: `VITE_NEON_AUTH_URL` set to the Neon Auth base URL for the
  same Neon project and branch.

Use the real Render service address, then deploy. Copy the Pages HTTPS address,
typically `https://YOUR-PROJECT.pages.dev`.

### 4. Allow the website to call the API

In Render → the `bflex-api` service → Environment, change
`APP_CORS_ALLOWED_ORIGINS` to the exact Cloudflare Pages origin, for example
`https://bflex-cloth-shop.pages.dev` (no trailing slash). Save and redeploy.

The website sends a Neon Auth bearer token on API calls. Active Neon Auth users must
be linked to a `staff` row before access is granted. `APP_CORS_ALLOWED_ORIGINS` only
controls browser cross-origin access; API authentication and staff roles are enforced
independently by Spring Security.

### Link the first shop accounts

After migration V12 has run, obtain each Neon Auth user's subject (`sub`) from its
verified session/JWT and link it to the intended staff row. Run this as the database
owner in Neon SQL Editor (replace values with the actual values):

```sql
UPDATE staff SET auth_subject = 'NEON_AUTH_SUBJECT', role = 'OWNER' WHERE name = 'Aditya';
UPDATE staff SET auth_subject = 'CASHIER_SUBJECT', role = 'CASHIER' WHERE name = 'Ashwini';
```

Link every active staff login. Unlinked accounts have no API access. The first linked
owner can assign roles by updating this table; there is intentionally no public
bootstrap or role-management endpoint. Brand/wholesaler creation, sales imports and
reorder-level changes are owner-only.

## Local development

The API requires a signed-in, linked staff account in local development too.
Configure `NEON_AUTH_JWKS_URL` and `NEON_AUTH_ISSUER` in `backend/.env`, and
`VITE_NEON_AUTH_URL` in `frontend/.env.local`; the Vite proxy still handles `/api`.

## Before using real shop records

- Confirm production has both Neon JDBC URLs, database credentials, the exact Pages
  origin, and matching Neon Auth JWKS/issuer values. Configure `VITE_NEON_AUTH_URL`.
- Verify the HTTPS site can sign in, browse inventory, and complete a small test sale.
- Keep an independent backup/export of the database. The free hosting setup does not
  provide a complete business continuity plan.
