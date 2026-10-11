param(
  [ValidateRange(1, 600)]
  [int]$TimeoutSeconds = 90,
  [switch]$DoNotStart
)

$ErrorActionPreference = 'Stop'

function Test-DockerEngine {
  $docker = Get-Command docker.exe -ErrorAction SilentlyContinue
  if (-not $docker) { return $false }
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
    if (-not $process.WaitForExit(5000)) {
      $process.Kill()
      return $false
    }
    return $process.ExitCode -eq 0
  }
  finally {
    $process.Dispose()
  }
}

if (Test-DockerEngine) { exit 0 }
if (-not $DoNotStart) {
  $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (-not (Test-Path -LiteralPath $desktop -PathType Leaf)) {
    Write-Error 'Docker Desktop was not found on this computer.'
    exit 1
  }
  if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $desktop -WindowStyle Hidden
  }
}

$timer = [System.Diagnostics.Stopwatch]::StartNew()
while ($timer.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
  if (Test-DockerEngine) { exit 0 }
  Start-Sleep -Seconds 2
}

Write-Error "Docker Desktop did not become ready within $TimeoutSeconds seconds. Open Docker Desktop and review its status, then run START_VAZANO.bat again."
exit 1
