@echo off
chcp 65001 >nul
cd /d "C:\Users\Родион\Desktop\тесты"
echo Starting Block Puzzle server...
start "" http://localhost:9000
node server.js
pause
