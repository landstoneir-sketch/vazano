$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$lockFile = Join-Path $projectRoot 'package-lock.json'
$nodeModules = Join-Path $projectRoot 'node_modules'
$stampFile = Join-Path $nodeModules '.vazano-package-lock.sha256'

function Get-Sha256Hex {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
      return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    }
    finally {
      $algorithm.Dispose()
    }
  }
  finally {
    $stream.Dispose()
  }
}

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw 'Node.js was not found. Install the supported Node.js LTS release, then run START_VAZANO.bat again.'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw 'npm was not found. Repair the Node.js installation, then run START_VAZANO.bat again.'
}
if (-not (Test-Path -LiteralPath $lockFile -PathType Leaf)) {
  throw "package-lock.json was not found: $lockFile"
}

$expectedHash = Get-Sha256Hex -Path $lockFile
$installedHash = if (Test-Path -LiteralPath $stampFile -PathType Leaf) {
  (Get-Content -LiteralPath $stampFile -Raw).Trim().ToLowerInvariant()
}
else {
  ''
}

if ((Test-Path -LiteralPath $nodeModules -PathType Container) -and $installedHash -eq $expectedHash) {
  Write-Output '[Vazano] Project dependencies are current.'
  exit 0
}

Write-Output '[Vazano] Installing the exact dependencies recorded for this version...'
Push-Location -LiteralPath $projectRoot
try {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'Installing project dependencies failed.' }
  Set-Content -LiteralPath $stampFile -Value $expectedHash -Encoding ascii -NoNewline
}
finally {
  Pop-Location
}
