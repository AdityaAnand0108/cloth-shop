param([string]$EnvFile = "backend/.env")
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $EnvFile)) { throw "Environment file not found: $EnvFile" }
foreach ($line in Get-Content -LiteralPath $EnvFile) {
  if ($line -match '^\s*([A-Z_]+)=(.*)\s*$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), 'Process') }
}
$jdbc = $env:DB_MIGRATION_URL
if (-not $jdbc) { $jdbc = $env:DB_URL }
if (-not $jdbc -or $jdbc -notmatch '^jdbc:postgresql://([^/:?]+)(?::\d+)?/([^?]+)') { throw 'DB_URL or DB_MIGRATION_URL must be a PostgreSQL JDBC URL.' }
if (-not $env:DB_USER -or -not $env:DB_PASSWORD) { throw 'DB_USER and DB_PASSWORD must be configured.' }
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw 'Install PostgreSQL client tools so pg_dump is available.' }

$env:PGHOST = $Matches[1]
$env:PGDATABASE = [uri]::UnescapeDataString($Matches[2])
$env:PGUSER = $env:DB_USER
$env:PGPASSWORD = $env:DB_PASSWORD
$env:PGSSLMODE = 'require'
$backupDir = Join-Path (Get-Location) 'backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$file = Join-Path $backupDir ("cloth-shop-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
try {
  & pg_dump --format=custom --no-owner --no-acl --file=$file
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -eq 0) {
    throw 'pg_dump failed or produced an empty backup.'
  }
  Get-FileHash -Algorithm SHA256 -LiteralPath $file
  Write-Output "Backup created: $file"
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
