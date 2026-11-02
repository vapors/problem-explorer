# scripts/setup-local.ps1
# Complete local development environment setup script for FastAPI + React/Vite stack.
# Operating Scope: Local directories only. Leaves remote deployment hooks untouched.

$ErrorActionPreference = "Stop"
Clear-Host

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "    STARTING STACK SETUP (LOCAL DEVELOPMENT MODE)        " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# 1. Verification of Prerequisites
Write-Host "`n[STAGE 1/4] Auditing Local System Dependencies..." -ForegroundColor Yellow

$prereqsFailed = $false

if ((Get-Command node -ErrorAction SilentlyContinue) -eq $null) {
    Write-Host "❌ ERROR: Node.js binary was not found in your system PATH." -ForegroundColor Red
    Write-Host "   Please download and install Node.js (v18+) from https://nodejs.org" -ForegroundColor Gray
    $prereqsFailed = $true
} else {
    Write-Host "✔ Node.js: $(node -v) available." -ForegroundColor Green
}

if ((Get-Command python -ErrorAction SilentlyContinue) -eq $null) {
    Write-Host "❌ ERROR: Python binary was not found in your system PATH." -ForegroundColor Red
    Write-Host "   Please install Python (v3.10+) and ensure 'Add Python to PATH' is checked." -ForegroundColor Gray
    $prereqsFailed = $true
} else {
    Write-Host "✔ Python: $(python --version) available." -ForegroundColor Green
}

if ($prereqsFailed) {
    Write-Host "`nEnvironment initialization halted. Fix the missing dependencies above and retry." -ForegroundColor Red
    Exit 1
}

# 2. Virtual Environment Configuration (Backend Isolation)
Write-Host "`n[STAGE 2/4] Deploying Isolated Python Environment..." -ForegroundColor Yellow
try {
    if (-not (Test-Path "venv")) {
        Write-Host "Creating local virtual environment virtual space (.\venv)..." -ForegroundColor Gray
        python -m venv venv
        Write-Host "✔ Local virtual environment constructed successfully." -ForegroundColor Green
    } else {
        Write-Host "ℹ Existing virtual environment detected at .\venv. Skipping instantiation." -ForegroundColor Gray
    }

    Write-Host "Updating local pip infrastructure..." -ForegroundColor Gray
    & .\venv\Scripts\python.exe -m pip install --upgrade pip --quiet

    if (Test-Path "apps/api/requirements.txt") {
        Write-Host "Installing application dependencies from apps/api/requirements.txt..." -ForegroundColor Gray
        & .\venv\Scripts\pip install -r apps/api/requirements.txt
        Write-Host "✔ Backend library stack successfully generated." -ForegroundColor Green
    } else {
        Write-Host "❌ ERROR: Cannot trace apps/api/requirements.txt. Verify folder positioning." -ForegroundColor Red
        Exit 1
    }
}
catch {
    Write-Host "❌ ERROR: Python library population failed. Trace details below:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor DarkRed
    Exit 1
}

# 3. Node Modules Configuration (Frontend Isolation)
Write-Host "`n[STAGE 3/4] Fetching Node Modules Ecosystem..." -ForegroundColor Yellow
if (Test-Path "apps/web/package.json") {
    try {
        Push-Location apps/web
        Write-Host "Executing npm install within local scope of apps/web/..." -ForegroundColor Gray
        npm install
        Pop-Location
        Write-Host "✔ Frontend dependencies successfully deployed." -ForegroundColor Green
    }
    catch {
        Pop-Location
        Write-Host "❌ ERROR: Node dependency setup failed. Verify your npm registry connection access." -ForegroundColor Red
        Exit 1
    }
} else {
    Write-Host "❌ ERROR: apps/web/package.json missing. Frontend tree broken." -ForegroundColor Red
    Exit 1
}

# 4. Dotenv Configuration Safeguards
Write-Host "`n[STAGE 4/4] Aligning Local Parameter Ecosystems..." -ForegroundColor Yellow
if (Test-Path ".env.example") {
    if (-not (Test-Path ".env")) {
        Copy-Item .env.example .env
        Write-Host "✔ Local .env configuration generated natively from example mapping template." -ForegroundColor Green
    } else {
        Write-Host "ℹ Local active .env already present. Operational parameters preserved." -ForegroundColor Gray
    }
} else {
    Write-Host "⚠ WARNING: No .env.example blueprint discovered in workspace root root." -ForegroundColor Orange
}

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host " SUCCESS: Core environments decoupled and operational!    " -ForegroundColor Green
Write-Host " Run .\start-dev.cmd to spin up the local server clusters." -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
