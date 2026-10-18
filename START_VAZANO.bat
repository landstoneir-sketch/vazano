@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

powershell.exe -NoProfile -Command "$active = @(3000, 3001 | Where-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue }); if ($active.Count -eq 2) { exit 10 }; if ($active.Count -gt 0) { exit 11 }"
if errorlevel 11 goto :partial_running
if errorlevel 10 goto :already_running
if errorlevel 1 goto :error

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-for-docker.ps1" -TimeoutSeconds 90
if errorlevel 1 goto :error

:docker_ready
echo [Vazano] Starting PostgreSQL, Redis, object storage and file security scanner...
docker compose up -d --wait --wait-timeout 240 postgres redis minio clamav
if errorlevel 1 goto :error

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-node-dependencies.ps1"
if errorlevel 1 goto :error

echo [Vazano] Preparing the database client...
call npm.cmd run prisma:generate
if errorlevel 1 goto :error

echo [Vazano] Applying database migrations...
call npm.cmd run prisma:deploy
if errorlevel 1 goto :error
echo [Vazano] Loading editable development data...
call npm.cmd run prisma:seed
if errorlevel 1 goto :error
echo [Vazano] Starting API and website...
echo [Vazano] Open http://localhost:3000 after both services report ready.
if not defined FILE_SCAN_MODE set "FILE_SCAN_MODE=clamav"
if not defined CLAMAV_HOST set "CLAMAV_HOST=127.0.0.1"
if not defined CLAMAV_PORT set "CLAMAV_PORT=54100"
call npm.cmd run dev
goto :eof

:already_running
echo [Vazano] The website and API are already running.
start "" "http://localhost:3000"
exit /b 0

:partial_running
echo.
echo [Vazano] Only part of the development environment is running on port 3000 or 3001.
echo Close the old Vazano command windows, then run START_VAZANO.bat again.
pause
exit /b 1

:error
echo.
echo Vazano could not start. Review the message above, then run this file again.
pause
exit /b 1
