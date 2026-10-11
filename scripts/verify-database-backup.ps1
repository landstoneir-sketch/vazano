param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedBackup = Resolve-Path -LiteralPath $BackupPath
$backup = Get-Item -LiteralPath $resolvedBackup.Path
if ($backup.PSIsContainer -or $backup.Length -le 0) { throw 'The backup path is invalid.' }

$suffix = ([Guid]::NewGuid().ToString('N')).Substring(0, 12)
$databaseName = "vazano_restore_verify_$suffix"
$containerPath = "/tmp/$($backup.Name)-$suffix.dump"
if ($databaseName -notmatch '^vazano_restore_verify_[a-f0-9]{12}$') { throw 'The temporary database name is invalid.' }
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
  Set-Location -LiteralPath $projectRoot
  & docker compose cp $backup.FullName "postgres:$containerPath"
  if ($LASTEXITCODE -ne 0) { throw 'Copying the backup for restore verification failed.' }

  $createCommand = 'PGPASSWORD="$POSTGRES_PASSWORD" createdb -U "$POSTGRES_USER" "{0}"' -f $databaseName
  & docker compose exec -T postgres sh -c $createCommand
  if ($LASTEXITCODE -ne 0) { throw 'Creating the temporary verification database failed.' }

  $restoreCommand = 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "{0}" --no-owner --no-privileges "{1}"' -f $databaseName, $containerPath
  & docker compose exec -T postgres sh -c $restoreCommand
  if ($LASTEXITCODE -ne 0) { throw 'Restoring the backup into the temporary database failed.' }

  $countCommand = 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "{0}" -Atc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ''public'';"' -f $databaseName
  $tableCountOutput = & docker compose exec -T postgres sh -c $countCommand
  if ($LASTEXITCODE -ne 0) { throw 'Inspecting the restored database failed.' }
  $tableCount = [int](($tableCountOutput | Select-Object -Last 1).Trim())
  if ($tableCount -lt 10) { throw "The restored table count is unexpectedly low: $tableCount" }

  Write-Output ([pscustomobject]@{ Verified = $true; BackupPath = $backup.FullName; RestoredTableCount = $tableCount; TemporaryDatabase = $databaseName })
}
finally {
  Set-Location -LiteralPath $projectRoot
  if ($databaseName -match '^vazano_restore_verify_[a-f0-9]{12}$') {
    $dropCommand = 'PGPASSWORD="$POSTGRES_PASSWORD" dropdb -U "$POSTGRES_USER" --if-exists --force "{0}"' -f $databaseName
    try { & docker compose exec -T postgres sh -c $dropCommand 2>$null | Out-Null } catch { }
  }
  try { & docker compose exec -T postgres rm -f $containerPath 2>$null | Out-Null } catch { }
  Set-Location -LiteralPath $originalLocation
}
