# One-time or repeatable Windows setup. Does not reset/seed/delete databases.
# From project root: powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$api = Join-Path $root 'apps\api'
$web = Join-Path $root 'apps\web'
$venv = Join-Path $api '.venv\Scripts\python.exe'
if (-not (Get-Command py.exe -ErrorAction SilentlyContinue)) { throw 'Python launcher py.exe not found. Install Python 3.12.' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd not found. Install supported Node.js and npm.' }
& py.exe -3.12 -c 'import sys; assert sys.version_info[:2] == (3,12)'
if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 is required (not Python 3.14).' }
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $root '.env.example') $envFile
  Write-Host 'Created .env from .env.example. Configure local Neo4j credentials before running.'
}
if (-not (Test-Path $venv)) {
  Push-Location $api
  try { & py.exe -3.12 -m venv .venv; if ($LASTEXITCODE -ne 0) { throw 'Unable to create Python 3.12 venv.' } }
  finally { Pop-Location }
}
& $venv -m pip install -r (Join-Path $api 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
& $venv -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency check failed.' }
Push-Location $web
try {
  if (Test-Path 'package-lock.json') { & npm.cmd ci --no-audit --no-fund }
  else { & npm.cmd install --no-audit --no-fund }
  if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
Write-Host 'Local dependencies and build ready. Review .env, ensure Neo4j is running, then run start-dev.cmd.'
