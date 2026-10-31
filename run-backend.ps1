# Loads backend/.env into the environment and starts Spring Boot.
#   .\run-backend.ps1
$ErrorActionPreference = 'Stop'

$backendEnvFile = Join-Path $PSScriptRoot 'backend\.env'
if (-not (Test-Path $backendEnvFile)) {
    Write-Host "backend\.env not found." -ForegroundColor Red
    Write-Host "Copy backend\.env.example to backend\.env and fill in your Neon settings."
    exit 1
}

function Import-DotEnv([string] $path) {
    if (-not (Test-Path $path)) { return }
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $name, $value = $line.Split('=', 2)
            $value = $value.Trim()
            if ($value.Length -ge 2 -and
                (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                 ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            [Environment]::SetEnvironmentVariable($name.Trim(), $value, 'Process')
        }
    }
}

# Keep app-specific values in backend/.env; Neon CLI-managed values in the root
# .env.local take precedence. DATABASE_URL values are translated to the JDBC
# variables Spring expects without printing credentials.
Import-DotEnv $backendEnvFile
$neonEnvFile = Join-Path $PSScriptRoot '.env.local'
Import-DotEnv $neonEnvFile

if ($env:DATABASE_URL) {
    $databaseUri = [Uri] $env:DATABASE_URL
    $env:DB_URL = "jdbc:postgresql://$($databaseUri.Authority)$($databaseUri.PathAndQuery)"
    $userInfo = [Uri]::UnescapeDataString($databaseUri.UserInfo)
    $separator = $userInfo.IndexOf(':')
    if ($separator -ge 0) {
        $env:DB_USER = $userInfo.Substring(0, $separator)
        $env:DB_PASSWORD = $userInfo.Substring($separator + 1)
    }
}

if ($env:DATABASE_URL_UNPOOLED) {
    $migrationUri = [Uri] $env:DATABASE_URL_UNPOOLED
    $env:DB_MIGRATION_URL = "jdbc:postgresql://$($migrationUri.Authority)$($migrationUri.PathAndQuery)"
}

Write-Host "Starting backend against $($env:DB_URL)" -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot 'backend')
try { & .\mvnw.cmd spring-boot:run } finally { Pop-Location }
