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

The website uses Neon Auth for its sign-in page. The Spring API endpoints are public
and do not require a bearer token. Anyone who can reach the API can read or change
shop data. `APP_CORS_ALLOWED_ORIGINS` controls browser cross-origin access; it does not
authenticate API callers.

## Local development

The API is public in local development too. `frontend/vite.config.ts` continues to
proxy `/api` to the local backend; leave `VITE_API_BASE_URL` unset when running locally.

## Before using real shop records

- Confirm the production Render environment has both Neon JDBC URLs, database
  credentials, and the exact Pages origin. Configure `VITE_NEON_AUTH_URL` in Cloudflare
  Pages for the sign-in page.
- Verify the HTTPS site can sign in, browse inventory, and complete a small test sale.
- Keep an independent backup/export of the database. The free hosting setup does not
  provide a complete business continuity plan.
