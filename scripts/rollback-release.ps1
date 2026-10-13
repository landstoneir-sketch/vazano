param(
  [Parameter(Mandatory = $true)]
  [string]$PreviousEnvironmentFile,
  [string]$GatewayUrl = 'http://127.0.0.1:8080',
  [ValidateRange(30, 600)]
  [int]$ReadinessTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$composeFile = Join-Path $projectRoot 'compose.production.yml'
$resolvedEnvironmentFile = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $PreviousEnvironmentFile))
$originalLocation = Get-Location
$originalVazanoEnvironmentFile = [Environment]::GetEnvironmentVariable('VAZANO_ENV_FILE', 'Process')
. (Join-Path $PSScriptRoot 'release-common.ps1')

if (-not (Test-Path -LiteralPath $resolvedEnvironmentFile -PathType Leaf)) {
  throw "Previous release environment file was not found: $resolvedEnvironmentFile"
}

Assert-VazanoReleaseImages -EnvironmentFile $resolvedEnvironmentFile

try {
  Set-Location -LiteralPath $projectRoot
  $env:VAZANO_ENV_FILE = $resolvedEnvironmentFile
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'wait-for-docker.ps1') -TimeoutSeconds 60 -DoNotStart
  if ($LASTEXITCODE -ne 0) { throw 'Docker Engine is not ready.' }

  $composeArguments = @('compose', '--env-file', $resolvedEnvironmentFile, '-f', $composeFile)
  & docker @composeArguments config --quiet
  if ($LASTEXITCODE -ne 0) { throw 'Previous release Compose configuration is invalid.' }

  & docker @composeArguments pull api web gateway
  if ($LASTEXITCODE -ne 0) { throw 'Pulling previous immutable release images failed.' }

  & docker @composeArguments --profile operations run --rm config-check
  if ($LASTEXITCODE -ne 0) { throw 'Previous release environment validation failed; rollback was not started.' }

  & docker @composeArguments up -d --remove-orphans --wait --wait-timeout $ReadinessTimeoutSeconds api web gateway
  if ($LASTEXITCODE -ne 0) { throw 'Rolled-back application containers did not become healthy.' }

  $readinessUrl = Wait-VazanoGatewayReadiness -GatewayUrl $GatewayUrl -TimeoutSeconds $ReadinessTimeoutSeconds
  $smokeResult = Invoke-VazanoReleaseSmokeChecks -GatewayUrl $GatewayUrl

  Write-Output ([pscustomobject]@{
    RolledBack = $true
    DatabaseRolledBack = $false
    PreviousEnvironmentFile = $resolvedEnvironmentFile
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
