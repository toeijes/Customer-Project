@echo off
title PWA Area 6 System Launcher
set "PROJECT_ROOT=%~dp0"
if exist "%PROJECT_ROOT%.tools\node-v24.22.1-win-x64\node.exe" set "PATH=%PROJECT_ROOT%.tools\node-v24.22.1-win-x64;%PATH%"
echo ==================================================
echo   PWA Area 6 Expansion System Auto Launcher
echo ==================================================
echo.

set "MYSQL_EXE=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"

if exist "%MYSQL_EXE%" (
    echo [1/3] Starting Local MySQL Database Server...
    start "PWA MySQL Database" cmd /k ""%MYSQL_EXE%" --datadir="d:\Antigravity\Customer Project\database\data" --port=3306 --console"
    echo       Waiting for database to initialize - Backend has auto-retry logic if it takes longer...
    ping 127.0.0.1 -n 6 >nul
) else (
    echo [1/3] Local MySQL Database Server not found.
    echo       Using External Database Server configured in backend/.env
    ping 127.0.0.1 -n 3 >nul
)

echo [2/3] Starting Backend API Server...
start "PWA Backend Server" /D "%PROJECT_ROOT%backend" cmd /k node server.js

ping 127.0.0.1 -n 3 >nul

echo [3/3] Starting Frontend React/Vite Server...
start "PWA Frontend Server" /D "%PROJECT_ROOT%frontend" cmd /k npx vite --host ::1 --port 5173 --strictPort

ping 127.0.0.1 -n 2 >nul

echo [4/4] Opening Web Browser to Frontend...
start http://localhost:5173/

echo.
echo ==================================================
echo   All systems started successfully!
echo   - Frontend: http://localhost:5173
echo   - Backend API: http://localhost:5000
echo ==================================================
echo.
pause
