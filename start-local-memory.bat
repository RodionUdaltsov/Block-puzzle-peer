@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Block Puzzle — memory mode (no Postgres)
echo ============================================
echo   Block Puzzle — LOCAL MEMORY (no SQL)
echo   Progress is NOT saved between restarts
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\pg\package.json" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)

if not exist "vendor\ws\lib\websocket.js" (
  echo [ERROR] vendor\ws incomplete. Re-extract the full ZIP.
  pause
  exit /b 1
)

if not exist "public\dist\client.bundle.js" (
  echo Building client...
  node scripts\bundle-css.js
  node scripts\bundle-client.js
  if errorlevel 1 ( pause & exit /b 1 )
)

set "BP_STORE=memory"
set "PORT=9000"
echo Store: memory  Port: %PORT%
echo Starting http://127.0.0.1:%PORT%/
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:%PORT%/"
node server.js
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" echo [ERROR] Exit %EXITCODE%
pause
endlocal
exit /b %EXITCODE%
