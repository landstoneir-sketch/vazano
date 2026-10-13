param(
  [string]$EnvironmentFile = '.env.production',
  [Parameter(Mandatory = $true)]
  [string]$VerifiedBackupPath,
  [string]$GatewayUrl = 'http://127.0.0.1:8080',
  [ValidateRange(1, 168)]
  [int]$MaximumBackupAgeHours = 24,
  [ValidateRange(30, 600)]
  [int]$ReadinessTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$composeFile = Join-Path $projectRoot 'compose.production.yml'
$resolvedEnvironmentFile = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $EnvironmentFile))
$originalLocation = Get-Location
$originalVazanoEnvironmentFile = [Environment]::GetEnvironmentVariable('VAZANO_ENV_FILE', 'Process')
. (Join-Path $PSScriptRoot 'release-common.ps1')

if (-not (Test-Path -LiteralPath $resolvedEnvironmentFile -PathType Leaf)) {
  throw "Production environment file was not found: $resolvedEnvironmentFile"
}

function Assert-VerifiedBackup {
  param([string]$Path, [int]$MaximumAgeHours)
  $resolvedPath = Resolve-Path -LiteralPath $Path -ErrorAction Stop
  $backup = Get-Item -LiteralPath $resolvedPath.Path
  if ($backup.PSIsContainer -or $backup.Length -le 0) { throw 'The verified production backup path is invalid.' }
  $checksumPath = "$($backup.FullName).sha256"
  $verificationPath = "$($backup.FullName).verified.json"
  if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) { throw 'The production backup checksum file is missing.' }
  if (-not (Test-Path -LiteralPath $verificationPath -PathType Leaf)) { throw 'The production backup restore-verification receipt is missing.' }

  $expectedHash = ((Get-Content -LiteralPath $checksumPath -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
  if ($expectedHash -notmatch '^[0-9a-f]{64}$') { throw 'The production backup checksum is invalid.' }
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $backup.FullName).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) { throw 'The production backup checksum does not match the backup file.' }

  $verification = Get-Content -LiteralPath $verificationPath -Raw | ConvertFrom-Json
  if ($verification.Version -ne 1 -or $verification.BackupSha256 -ne $actualHash) {
    throw 'The production backup restore-verification receipt does not match the backup.'
  }
  if ([int]$verification.RestoredTableCount -lt 10) { throw 'The verified production backup contains too few restored tables.' }
  try {
    if ($verification.VerifiedAtUtc -is [DateTime]) {
      $verifiedAt = [DateTimeOffset]::new(([DateTime]$verification.VerifiedAtUtc).ToUniversalTime())
    } elseif ($verification.VerifiedAtUtc -is [DateTimeOffset]) {
      $verifiedAt = ([DateTimeOffset]$verification.VerifiedAtUtc).ToUniversalTime()
    } else {
      $verifiedAt = [DateTimeOffset]::Parse(
        [string]$verification.VerifiedAtUtc,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::RoundtripKind
      ).ToUniversalTime()
    }
  }
  catch { throw 'The production backup verification timestamp is invalid.' }
  $verificationAge = [DateTimeOffset]::UtcNow - $verifiedAt
  if ($verificationAge.TotalMinutes -lt -5) { throw 'The production backup verification timestamp is in the future.' }
  if ($verificationAge.TotalHours -gt $MaximumAgeHours) {
    throw "The production backup verification is older than $MaximumAgeHours hours."
  }
  return [pscustomobject]@{ Path = $backup.FullName; Sha256 = $actualHash; VerifiedAtUtc = $verifiedAt.ToString('o') }
}

$verifiedBackup = Assert-VerifiedBackup -Path $VerifiedBackupPath -MaximumAgeHours $MaximumBackupAgeHours

Assert-VazanoReleaseImages -EnvironmentFile $resolvedEnvironmentFile

try {
  Set-Location -LiteralPath $projectRoot
  $env:VAZANO_ENV_FILE = $resolvedEnvironmentFile
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

  $readinessUrl = Wait-VazanoGatewayReadiness -GatewayUrl $GatewayUrl -TimeoutSeconds $ReadinessTimeoutSeconds
  $smokeResult = Invoke-VazanoReleaseSmokeChecks -GatewayUrl $GatewayUrl

  Write-Output ([pscustomobject]@{
    Deployed = $true
    VerifiedBackup = $verifiedBackup.Path
    BackupSha256 = $verifiedBackup.Sha256
    ReadinessUrl = $readinessUrl
    SmokeChecks = $smokeResult.Paths.Count
    ActiveCategories = $smokeResult.ActiveCategories
    ActiveUnits = $smokeResult.ActiveUnits
    ActiveProvinces = $smokeResult.ActiveProvinces
    CheckedAt = (Get-Date).ToUniversalTime().ToString('o')
  })
}
finally {
  if ($null -eq $originalVazanoEnvironmentFile) {
    Remove-Item Env:VAZANO_ENV_FILE -ErrorAction SilentlyContinue
  }
  else {
    $env:VAZANO_ENV_FILE = $originalVazanoEnvironmentFile
  }
  Set-Location -LiteralPath $originalLocation
}
