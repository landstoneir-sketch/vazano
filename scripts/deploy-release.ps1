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

function Get-EnvironmentValue {
  param([string]$Path, [string]$Key)
  $escapedKey = [Regex]::Escape($Key)
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^\s*$escapedKey\s*=" } | Select-Object -Last 1
  if (-not $line) { throw "$Key is missing from the production environment file." }
  $value = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
  if (-not $value) { throw "$Key must not be empty in the production environment file." }
  return $value
}

function Assert-ImmutableReleaseImage {
  param([string]$Key, [string]$Reference, [switch]$DigestOnly)
  if ($Reference -match '(?i)(replace|change[_-]?me|placeholder|example|your[_-])') {
    throw "$Key contains a placeholder and must be replaced before deployment."
  }
  if ($Reference -match '(?i)(^|:)latest($|@)') {
    throw "$Key must not use the mutable latest tag."
  }
  $hasDigest = $Reference -match '(?i)@sha256:[0-9a-f]{64}$'
  $hasFullGitSha = $Reference -match '(?i):[0-9a-f]{40}$'
  if ($DigestOnly -and -not $hasDigest) {
    throw "$Key must use an immutable sha256 digest."
  }
  if (-not $DigestOnly -and -not ($hasDigest -or $hasFullGitSha)) {
    throw "$Key must use a full Git SHA tag or sha256 digest."
  }
}

foreach ($key in @('VAZANO_API_IMAGE', 'VAZANO_WEB_IMAGE', 'VAZANO_MIGRATION_IMAGE')) {
  Assert-ImmutableReleaseImage -Key $key -Reference (Get-EnvironmentValue -Path $resolvedEnvironmentFile -Key $key)
}
Assert-ImmutableReleaseImage -Key 'VAZANO_GATEWAY_IMAGE' -Reference (Get-EnvironmentValue -Path $resolvedEnvironmentFile -Key 'VAZANO_GATEWAY_IMAGE') -DigestOnly

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
  $gatewayBaseUrl = $GatewayUrl.TrimEnd('/')
  $readinessUrl = "$gatewayBaseUrl/v1/health/ready"
  $isReady = $false
  do {
    try {
      $response = Invoke-WebRequest -Uri $readinessUrl -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        $isReady = $true
        break
      }
    } catch { }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  if (-not $isReady) { throw "Release readiness check failed: $readinessUrl" }

  $smokePaths = @('/healthz', '/', '/login', '/v1/catalog/categories', '/v1/locations/provinces')
  foreach ($path in $smokePaths) {
    $url = "$gatewayBaseUrl$path"
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
      if ($response.StatusCode -ne 200) { throw "Unexpected HTTP status $($response.StatusCode)." }
    } catch {
      throw "Post-deployment smoke check failed for $path. $($_.Exception.Message)"
    }
  }

  $categories = @(Invoke-RestMethod -Uri "$gatewayBaseUrl/v1/catalog/categories" -Method Get -TimeoutSec 10)
  if ($categories.Count -lt 1) { throw 'Post-deployment smoke check found no active product category.' }
  $provinces = @(Invoke-RestMethod -Uri "$gatewayBaseUrl/v1/locations/provinces" -Method Get -TimeoutSec 10)
  if ($provinces.Count -lt 31) { throw "Post-deployment smoke check found only $($provinces.Count) active provinces." }

  Write-Output ([pscustomobject]@{
    Deployed = $true
    ReadinessUrl = $readinessUrl
    SmokeChecks = $smokePaths.Count
    ActiveCategories = $categories.Count
    ActiveProvinces = $provinces.Count
    CheckedAt = (Get-Date).ToUniversalTime().ToString('o')
  })
}
finally {
  Set-Location -LiteralPath $originalLocation
}
