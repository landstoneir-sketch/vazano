@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

docker info >nul 2>&1
if errorlevel 1 (
  echo [Vazano] Docker Desktop is not running. Starting it now...
  if not exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    echo Docker Desktop was not found on this computer.
    goto :error
  )
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" --accept-license
  for /L %%I in (1,1,45) do (
    docker info >nul 2>&1 && goto :docker_ready
    timeout /t 2 /nobreak >nul
  )
  echo Docker Desktop did not become ready within 90 seconds.
  goto :error
)

:docker_ready
echo [Vazano] Starting PostgreSQL, Redis and object storage...
docker compose up -d --wait --wait-timeout 90 postgres redis minio
if errorlevel 1 goto :error

if not exist "node_modules" (
  echo [Vazano] Installing locked project dependencies for the first run...
  call npm.cmd ci
  if errorlevel 1 goto :error
)

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
call npm.cmd run dev
goto :eof
:error
echo.
echo Vazano could not start. Review the message above, then run this file again.
pause
exit /b 1
