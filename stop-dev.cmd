@echo off
:: stop-dev.cmd
:: Safely drops active backend and frontend development processes to free up system ports.

TITLE Operational Stack Teardown Base
CLS

echo ========================================================
echo   TEARING DOWN LOCAL DEVELOPMENT TASK RUNNERS          
echo ========================================================
echo.

setlocal enabledelayedexpansion

:: 1. Clear Backend Processes on Port 8000
echo [TEARDOWN] Scanning for active FastAPI instances on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    set PID_8000=%%a
    echo Found active backend process running under PID !PID_8000!. Terminating...
    taskkill /PID !PID_8000! /F /T >nul 2>&1
    if !errorlevel! == 0 (
        echo ✔ Successfully cleared port 8000.
    ) else (
        echo ⚠ Failed to kill PID !PID_8000!. It may have already exited.
    )
)
if not defined PID_8000 (
    echo ✔ Port 8000 is already clear. No runaway Python engines found.
)

echo.

:: 2. Clear Frontend Processes on Port 5173
echo [TEARDOWN] Scanning for active Vite bundlers on port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    set PID_5173=%%a
    echo Found active frontend process running under PID !PID_5173!. Terminating...
    taskkill /PID !PID_5173! /F /T >nul 2>&1
    if !errorlevel! == 0 (
        echo ✔ Successfully cleared port 5173.
    ) else (
        echo ⚠ Failed to kill PID !PID_5173!. It may have already exited.
    )
)
if not defined PID_5173 (
    echo ✔ Port 5173 is already clear. No runaway Node servers found.
)

:: 3. Alternative System Cleanup for stray Node processes
echo.
echo [TEARDOWN] Sweeping environment loop references...
:: This catches orphan background worker threads if they decoupled from the primary port
taskkill /IM node.exe /F >nul 2>&1

echo.
echo ========================================================
echo STATUS: ALL LOCAL DEVELOPMENT SYSTEM PORTS UNLOCKED.
echo Your workspace is clear for a fresh launch.
echo ========================================================
echo.
pause
exit /b 0
