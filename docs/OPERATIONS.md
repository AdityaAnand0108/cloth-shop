# Phase 0 operations runbook

## Database backups

Run `./scripts/backup-db.ps1` from the repository root on a trusted machine with
PostgreSQL client tools installed and `backend/.env` populated. The script uses the
direct Neon connection where configured, creates a custom-format dump under `backups/`,
and prints its SHA-256. `backups/` is ignored by Git. Encrypt the dump before copying it
to a separate, access-controlled storage account; do not leave the only copy on the
same machine or database provider.

Keep at least one recent encrypted dump and periodically check its hash after transfer.
The app audit table tracks API mutations but is not a backup and must not be treated as
one.

## Restore and validate

1. In Neon, create a temporary branch using point-in-time restore when the required
   timestamp is within the project's configured retention. For recovery outside that
   window, use an encrypted `pg_dump` copy.
2. Decrypt a copy into a restricted temporary directory. Restore only into an isolated
   database/branch, never over the live shop as the first step:

   ```powershell
   $env:PGPASSWORD = 'target-branch-password'
   pg_restore --host=TARGET_HOST --username=TARGET_USER --dbname=TARGET_DB --no-owner --no-acl --clean --if-exists .\cloth-shop.dump
   Remove-Item Env:PGPASSWORD
   ```

3. Start a temporary backend against that branch and confirm Flyway state, article and
   stock totals, recent bills, returns, and the `/health` endpoint. Compare key totals
   with the expected recovery point.
4. Only after validation, point the API at the recovered branch using the provider's
   connection settings and verify a signed-in read and a controlled test transaction.
   Keep the old branch unchanged until normal operation is confirmed.
5. Record the recovery timestamp and any transactions that must be reconciled after it.

Neon point-in-time recovery availability and retention depend on the project's current
plan/settings. A restored branch should be tested before changing production traffic.

## Access and audit

Migration V12 adds `staff.auth_subject`, staff roles and `audit_event`. Link Auth
subjects using the procedure in `HOSTING.md`. Keep at least one owner login active.
Owner role assignment is currently a controlled SQL operation. Audit records include
actor subject, staff ID, HTTP method/path, response status and time; they exclude request
bodies and authorization tokens. Rate limits are per backend process and reset on
restart; for multiple API instances use a shared/distributed limiter before raising
traffic limits.

Rotate Neon credentials and Auth sessions if an account is compromised. Deactivate the
staff row immediately to deny future API calls, then remove/rotate its Auth account and
review the audit trail.
