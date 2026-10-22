@echo off
setlocal
REM Locate the project using this script's directory (supports moving the project).
for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "NEO4J=C:\Tools\neo4j-community-2026.10.0"

if not exist "%NEO4J%\bin\neo4j.bat" (
  echo ERROR: Neo4j not found at "%NEO4J%".
  pause
  exit /b 1
)
if not exist "%ROOT%\apps\api\.venv\Scripts\python.exe" (
  echo ERROR: Python virtual environment not found.
  pause
  exit /b 1
)
if not exist "%ROOT%\.env" (
  echo ERROR: Missing "%ROOT%\.env".
  pause
  exit /b 1
)
if not exist "%ROOT%\apps\web\package.json" (
  echo ERROR: React frontend not found.
  pause
  exit /b 1
)

REM Check whether Bolt is already listening (native Neo4j or otherwise).
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 7687 -State Listen -ErrorAction SilentlyContinue) {exit 0} else {exit 1}"
if errorlevel 1 (
  echo Starting native Neo4j...
  start "Neo4j - Problem Explorer" /D "%NEO4J%" cmd /k "bin\neo4j.bat console"
  echo Waiting for Neo4j to open port 7687...
  powershell -NoProfile -Command "$ready=$false; for($i=0;$i -lt 90;$i++){if(Get-NetTCPConnection -LocalPort 7687 -State Listen -ErrorAction SilentlyContinue){$ready=$true;break};Start-Sleep -Seconds 1};if(-not $ready){Write-Host 'Neo4j did not become ready within 90 seconds.';exit 1}"
  if errorlevel 1 (
    echo Check the Neo4j terminal for errors.
    pause
    exit /b 1
  )
) else (
  echo Port 7687 is already listening. Not starting another Neo4j instance.
)

REM Start API only if its configured port is available.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {exit 0} else {exit 1}"
if errorlevel 1 (
  echo Starting FastAPI...
  start "FastAPI - Problem Explorer" /D "%ROOT%\apps\api" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --env-file ..\..\.env"
) else (
  echo Port 8000 is already in use. Not starting another API process.
)

REM Start Vite only if its default port is available.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {exit 0} else {exit 1}"
if errorlevel 1 (
  echo Starting React / Vite...
  start "React Vite - Problem Explorer" /D "%ROOT%\apps\web" cmd /k "npm run dev -- --strictPort"
) else (
  echo Port 5173 is already in use. Not starting another Vite process.
)

echo.
echo Problem Explorer development services are starting.
echo Frontend: http://localhost:5173
echo Backend:  http://127.0.0.1:8000/api/health
echo Neo4j:   http://localhost:7474
echo.
start "" "http://localhost:5173"
endlocal
