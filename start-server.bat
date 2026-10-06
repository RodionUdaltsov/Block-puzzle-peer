@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

title Block Puzzle — local server
echo ============================================
echo   Block Puzzle — local start
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install Node 18+ from https://nodejs.org/ and reopen this window.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODEVER=%%v
echo Node: %NODEVER%

REM ---- npm deps ----
if not exist "node_modules\pg\package.json" (
  echo Installing dependencies (npm install^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

REM Critical: vendored WebSocket library
if not exist "vendor\ws\lib\websocket.js" (
  echo [ERROR] vendor\ws is incomplete (missing lib\websocket.js^).
  echo Re-download / re-extract the project ZIP completely.
  pause
  exit /b 1
)

if not defined DATABASE_URL set "DATABASE_URL=postgres://bp:bp@127.0.0.1:5432/blockpuzzle"
if not defined PORT set "PORT=9000"
set "BP_STORE=postgres"

echo.
echo DATABASE_URL=%DATABASE_URL%
echo PORT=%PORT%
echo.

REM ---- Try Docker Postgres ----
where docker >nul 2>&1
if not errorlevel 1 (
  if exist "docker-compose.yml" (
    echo [docker] Starting postgres service...
    docker compose up -d postgres 2>nul
    if errorlevel 1 docker-compose up -d postgres 2>nul
    echo [docker] Waiting for Postgres...
    set /a _tries=0
    :wait_pg
    set /a _tries+=1
    docker compose exec -T postgres pg_isready -U bp -d blockpuzzle >nul 2>&1
    if not errorlevel 1 goto pg_ready
    docker-compose exec -T postgres pg_isready -U bp -d blockpuzzle >nul 2>&1
    if not errorlevel 1 goto pg_ready
    if !_tries! GEQ 25 (
      echo [WARN] Docker Postgres not ready after ~50s.
      goto after_docker
    )
    timeout /t 2 /nobreak >nul
    goto wait_pg
    :pg_ready
    echo [docker] Postgres is ready.
  )
) else (
  echo [INFO] Docker not found — expecting Postgres already running.
)

:after_docker

REM ---- Probe connection ----
echo Probing PostgreSQL...
node scripts\probe-postgres.js
if errorlevel 1 (
  echo.
  echo ============================================================
  echo  PostgreSQL is not reachable.
  echo.
  echo  Options:
  echo   1^) Install Docker Desktop, then run this bat again
  echo      (it will start postgres via docker compose^)
  echo   2^) Install PostgreSQL locally and create DB:
  echo        user=bp  password=bp  database=blockpuzzle
  echo      then:  psql %%DATABASE_URL%% -f docs\schema.sql
  echo   3^) For a quick offline test without DB, use:
  echo        start-local-memory.bat
  echo ============================================================
  echo.
  pause
  exit /b 1
)
echo PostgreSQL OK.
echo.

REM ---- Build client ----
echo Building client bundle...
node scripts\bundle-html.js
node scripts\bundle-css.js
if errorlevel 1 echo [WARN] CSS bundle failed
node scripts\bundle-client.js
if errorlevel 1 (
  echo [ERROR] Client bundle failed.
  pause
  exit /b 1
)

if not exist "public\dist\client.bundle.js" (
  echo [ERROR] public\dist\client.bundle.js missing after build.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Server:  http://127.0.0.1:%PORT%/
echo  WebSocket: /ws
echo  Store: postgres
echo  Press Ctrl+C to stop
echo ============================================
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:%PORT%/"
node server.js
set EXITCODE=%ERRORLEVEL%
echo.
if not "%EXITCODE%"=="0" (
  echo [ERROR] Server exited with code %EXITCODE%
  echo Check the messages above (Postgres / port in use / missing files^).
)
pause
endlocal
exit /b %EXITCODE%
