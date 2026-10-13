function Get-VazanoEnvironmentValue {
  param([string]$Path, [string]$Key)

  $escapedKey = [Regex]::Escape($Key)
  $line = Get-Content -LiteralPath $Path |
    Where-Object { $_ -match "^\s*$escapedKey\s*=" } |
    Select-Object -Last 1
  if (-not $line) { throw "$Key is missing from the production environment file." }

  $value = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
  if (-not $value) { throw "$Key must not be empty in the production environment file." }
  return $value
}

function Assert-VazanoImmutableReleaseImage {
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

function Assert-VazanoReleaseImages {
  param([string]$EnvironmentFile)

  foreach ($key in @('VAZANO_API_IMAGE', 'VAZANO_WEB_IMAGE', 'VAZANO_MIGRATION_IMAGE')) {
    Assert-VazanoImmutableReleaseImage `
      -Key $key `
      -Reference (Get-VazanoEnvironmentValue -Path $EnvironmentFile -Key $key)
  }
  Assert-VazanoImmutableReleaseImage `
    -Key 'VAZANO_GATEWAY_IMAGE' `
    -Reference (Get-VazanoEnvironmentValue -Path $EnvironmentFile -Key 'VAZANO_GATEWAY_IMAGE') `
    -DigestOnly
}

function Wait-VazanoGatewayReadiness {
  param(
    [string]$GatewayUrl,
    [ValidateRange(30, 600)]
    [int]$TimeoutSeconds
  )

  $gatewayBaseUrl = $GatewayUrl.TrimEnd('/')
  $readinessUrl = "$gatewayBaseUrl/v1/health/ready"
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  do {
    try {
      $response = Invoke-WebRequest -Uri $readinessUrl -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) { return $readinessUrl }
    }
    catch { }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "Release readiness check failed: $readinessUrl"
}

function Invoke-VazanoReleaseSmokeChecks {
  param([string]$GatewayUrl)

  $gatewayBaseUrl = $GatewayUrl.TrimEnd('/')
  $smokePaths = @('/healthz', '/', '/login', '/v1/catalog/categories', '/v1/catalog/units', '/v1/locations/provinces')
  foreach ($path in $smokePaths) {
    $url = "$gatewayBaseUrl$path"
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
      if ($response.StatusCode -ne 200) { throw "Unexpected HTTP status $($response.StatusCode)." }
    }
    catch {
      throw "Post-deployment smoke check failed for $path. $($_.Exception.Message)"
    }
  }

  $categories = @(Invoke-RestMethod -Uri "$gatewayBaseUrl/v1/catalog/categories" -Method Get -TimeoutSec 10)
  if ($categories.Count -lt 1) { throw 'Post-deployment smoke check found no active product category.' }

  $units = @(Invoke-RestMethod -Uri "$gatewayBaseUrl/v1/catalog/units" -Method Get -TimeoutSec 10)
  if ($units.Count -lt 1) { throw 'Post-deployment smoke check found no active unit of measure.' }

  $provinces = @(Invoke-RestMethod -Uri "$gatewayBaseUrl/v1/locations/provinces" -Method Get -TimeoutSec 10)
  if ($provinces.Count -lt 31) {
    throw "Post-deployment smoke check found only $($provinces.Count) active provinces."
  }

  return [pscustomobject]@{
    Paths = $smokePaths
    ActiveCategories = $categories.Count
    ActiveUnits = $units.Count
    ActiveProvinces = $provinces.Count
  }
}
