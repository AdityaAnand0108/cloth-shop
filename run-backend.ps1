# Loads backend/.env into the environment and starts Spring Boot.
#   .\run-backend.ps1
$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot 'backend\.env'
if (-not (Test-Path $envFile)) {
    Write-Host "backend\.env not found." -ForegroundColor Red
    Write-Host "Copy backend\.env.example to backend\.env and fill in your Supabase details."
    exit 1
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
        $name, $value = $line.Split('=', 2)
        [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
    }
}

Write-Host "Starting backend against $($env:DB_URL)" -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot 'backend')
try { & .\mvnw.cmd spring-boot:run } finally { Pop-Location }
