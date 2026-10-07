@echo off
setlocal
cd /d "%~dp0"
echo [Vazano] Starting PostgreSQL, Redis and object storage...
docker compose up -d postgres redis minio
if errorlevel 1 goto :error
echo [Vazano] Applying database migrations...
call npm.cmd run prisma:deploy
if errorlevel 1 goto :error
echo [Vazano] Loading editable development data...
call npm.cmd run prisma:seed
if errorlevel 1 goto :error
echo [Vazano] Starting API and website...
call npm.cmd run dev
goto :eof
:error
echo.
echo Vazano could not start. Review the message above.
pause
exit /b 1
