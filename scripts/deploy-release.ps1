param(
  [string]$EnvironmentFile = '.env.production',
  [string]$GatewayUrl = 'http://127.0.0.1:8080',
  [ValidateRange(30, 600)]
  [int]$ReadinessTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$composeFile = Join-Path $projectRoot 'compose.production.yml'
$resolvedEnvironmentFile = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $EnvironmentFile))
$originalLocation = Get-Location

if (-not (Test-Path -LiteralPath $resolvedEnvironmentFile -PathType Leaf)) {
  throw "Production environment file was not found: $resolvedEnvironmentFile"
}

try {
  Set-Location -LiteralPath $projectRoot
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'wait-for-docker.ps1') -TimeoutSeconds 60 -DoNotStart
  if ($LASTEXITCODE -ne 0) { throw 'Docker Engine is not ready.' }

  $composeArguments = @('compose', '--env-file', $resolvedEnvironmentFile, '-f', $composeFile)
  & docker @composeArguments config --quiet
  if ($LASTEXITCODE -ne 0) { throw 'Production Compose configuration is invalid.' }

  & docker @composeArguments --profile operations pull
  if ($LASTEXITCODE -ne 0) { throw 'Pulling immutable release images failed.' }

  & docker @composeArguments --profile operations run --rm config-check
  if ($LASTEXITCODE -ne 0) { throw 'Production environment validation failed; database migration was not started.' }

  & docker @composeArguments --profile operations run --rm migration
  if ($LASTEXITCODE -ne 0) { throw 'Database migration failed; application rollout was not started.' }

  & docker @composeArguments --profile operations run --rm bootstrap
  if ($LASTEXITCODE -ne 0) { throw 'Production reference-data bootstrap failed; application rollout was not started.' }

  & docker @composeArguments up -d --remove-orphans --wait --wait-timeout $ReadinessTimeoutSeconds api web gateway
  if ($LASTEXITCODE -ne 0) { throw 'Application containers did not become healthy.' }

  $deadline = (Get-Date).AddSeconds($ReadinessTimeoutSeconds)
  $readinessUrl = "$($GatewayUrl.TrimEnd('/'))/v1/health/ready"
  do {
    try {
      $response = Invoke-WebRequest -Uri $readinessUrl -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        Write-Output ([pscustomobject]@{ Deployed = $true; ReadinessUrl = $readinessUrl; CheckedAt = (Get-Date).ToUniversalTime().ToString('o') })
        exit 0
      }
    } catch { }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "Release readiness check failed: $readinessUrl"
}
finally {
  Set-Location -LiteralPath $originalLocation
}
