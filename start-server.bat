@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting Block Puzzle server...
if not exist "public\dist\client.bundle.js" (
  echo Building client bundle...
  node scripts\bundle-client.js
)
start "" http://localhost:9000
node server.js
pause
