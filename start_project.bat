@echo off
title PWA Area 6 System Launcher
echo ==================================================
echo   PWA Area 6 Expansion System Auto Launcher
echo ==================================================
echo.

echo [1/3] Starting MySQL Database Server...
start "PWA MySQL Database" cmd /k ""C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --datadir="d:\Antigravity\Customer Project\database\data" --port=3306 --console"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Backend API Server...
start "PWA Backend Server" cmd /k "cd /d "d:\Antigravity\Customer Project\backend" && node server.js"

timeout /t 2 /nobreak >nul

echo [3/3] Starting Frontend React/Vite Server...
start "PWA Frontend Server" cmd /k "cd /d "d:\Antigravity\Customer Project\frontend" && npx vite"

timeout /t 1 /nobreak >nul

echo [4/4] Opening Web Browser to Frontend...
start http://localhost:5173/

echo.
echo ==================================================
echo   All systems started successfully!
echo   - Frontend: http://localhost:5173
echo   - Backend API: http://localhost:5000
echo   - Database: Port 3306 (pwa6_expansion)
echo ==================================================
echo.
pause
