# Repeatable tests/build without affecting SQLite or Neo4j data.
# From project root: powershell -ExecutionPolicy Bypass -File .\scripts\test-local.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$venv = Join-Path $root 'apps\api\.venv\Scripts\python.exe'
if (-not (Test-Path $venv)) { throw 'Backend venv missing. Run scripts/setup-local.ps1 first.' }
Push-Location $root
try {
  & $venv -m unittest discover -s tests -v
  if ($LASTEXITCODE -ne 0) { throw 'API tests failed.' }
} finally { Pop-Location }
Push-Location (Join-Path $root 'apps\web')
try {
  & npm.cmd run test:lenses
  if ($LASTEXITCODE -ne 0) { throw 'Frontend lens contract tests failed.' }
  & npm.cmd run test:onboarding
  if ($LASTEXITCODE -ne 0) { throw 'Frontend onboarding tests failed.' }
  & npm.cmd run test:research-ux
  if ($LASTEXITCODE -ne 0) { throw 'Frontend research UX tests failed.' }
  & npm.cmd run test:graph
  & npm.cmd run test:tooltips
  if ($LASTEXITCODE -ne 0) { throw 'Frontend graph continuity tests failed.' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend TypeScript/Vite build failed.' }
} finally { Pop-Location }
Write-Host 'Offline API tests and frontend build passed. Live services/browser flows are not tested.'
