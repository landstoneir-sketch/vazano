param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\backups')
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$fileName = "vazano-postgres-$timestamp.dump"
$backupPath = Join-Path $outputRoot $fileName
$containerPath = "/tmp/$fileName"
$originalLocation = Get-Location

function Assert-DockerEngine {
  $docker = Get-Command docker.exe -ErrorAction Stop
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $docker.Source
  $startInfo.Arguments = 'info --format "{{.ServerVersion}}"'
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo

  try {
    [void]$process.Start()
    if (-not $process.WaitForExit(10000)) {
      $process.Kill()
      throw 'Docker Desktop did not become ready within 10 seconds.'
    }
    if ($process.ExitCode -ne 0) { throw 'Docker Desktop is not running.' }
  }
  finally {
    $process.Dispose()
  }
}

Assert-DockerEngine

try {
  New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
  Set-Location -LiteralPath $projectRoot
  & docker compose exec -T postgres sh -c "PGPASSWORD=`"`$POSTGRES_PASSWORD`" pg_dump -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" --format=custom --compress=9 --no-owner --no-privileges --file=$containerPath"
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL backup creation failed.' }
  & docker compose cp "postgres:$containerPath" $backupPath
  if ($LASTEXITCODE -ne 0) { throw 'Copying the backup from the container failed.' }

  $backup = Get-Item -LiteralPath $backupPath
  if ($backup.Length -le 0) { throw 'The backup file is empty.' }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $backup.FullName).Hash.ToLowerInvariant()
  Set-Content -LiteralPath "$($backup.FullName).sha256" -Value "$hash  $($backup.Name)" -Encoding ascii
  Write-Output ([pscustomobject]@{ Path = $backup.FullName; SizeBytes = $backup.Length; Sha256 = $hash })
}
finally {
  Set-Location -LiteralPath $projectRoot
  try { & docker compose exec -T postgres rm -f $containerPath 2>$null | Out-Null } catch { }
  Set-Location -LiteralPath $originalLocation
}
