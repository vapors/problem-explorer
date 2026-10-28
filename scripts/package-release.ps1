# Generate a sanitized, canonical ZIP from a reviewed source tree (Windows PowerShell 5.1+).
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\package-release.ps1
param([string] $OutputDirectory = '')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$config = Join-Path $root 'deploy\release.env'
if (-not (Test-Path $config)) { throw "Missing $config" }
$versionLines = @(Get-Content $config | Where-Object { $_ -match '^RELEASE_VERSION=([0-9]+\.[0-9]+\.[0-9]+)$' })
if ($versionLines.Count -ne 1) { throw 'Expected exactly one RELEASE_VERSION=X.Y.Z in deploy/release.env' }
$version = $versionLines[0].Substring('RELEASE_VERSION='.Length)
if (-not $OutputDirectory) { $OutputDirectory = (Resolve-Path (Join-Path $root '..')).Path }
if (-not (Test-Path $OutputDirectory)) { New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null }
$output = Join-Path $OutputDirectory "Problem-Explorer-v$version.zip"
if (Test-Path $output) { throw "Refusing to overwrite an existing release: $output" }

$temp = Join-Path ([IO.Path]::GetTempPath()) ("pe-release-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp -Force | Out-Null
$excludeDirs = @('.git', '.venv', '.testvenv', '.build', 'node_modules', 'dist', '__pycache__', '.cache', '.pytest_cache', '.npm-cache', '.npm')
$excludedFiles = @('.env', '.DS_Store')

function Copy-ReleaseDirectory([string] $sourceDir) {
  $relative = $sourceDir.Substring($root.Length).TrimStart('\', '/')
  if ($relative -eq 'apps\api\data' -or $relative -eq 'apps/api/data') { return }
  $destDir = Join-Path $temp $relative
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  foreach ($entry in (Get-ChildItem -LiteralPath $sourceDir -Force)) {
    if ($entry.PSIsContainer) {
      if ($excludeDirs -contains $entry.Name) { continue }
      Copy-ReleaseDirectory $entry.FullName
    } else {
      if ($excludedFiles -contains $entry.Name) { continue }
      if ($entry.Name -like '.env.*' -and $entry.Name -ne '.env.example') { continue }
      if ($entry.Name -match '(?i)\.(sqlite3|sqlite|db|dump|pyc|log|zip|tar|gz)$') { continue }
      if ($entry.Name -match '(?i)\.sqlite3-(wal|shm)$') { continue }
      Copy-Item -LiteralPath $entry.FullName -Destination (Join-Path $destDir $entry.Name) -Force
    }
  }
}

try {
  foreach ($folder in @('apps', 'data', 'deploy', 'docs', 'scripts', 'tests')) {
    $dir = Join-Path $root $folder
    if (Test-Path $dir) { Copy-ReleaseDirectory $dir }
  }
  foreach ($file in @('.env.example', '.gitignore', 'README.md', 'LOCAL-DEVELOPMENT.md', 'start-dev.cmd',
      'RELEASE-v0.7.0-INTEGRATION.md', 'RELEASE-v0.8.0-NETWORK-WORKSPACE.md', 'RELEASE-v0.8.1-TARGET-EXPLORER.md')) {
    $path = Join-Path $root $file
    if (Test-Path $path) { Copy-Item -LiteralPath $path -Destination (Join-Path $temp $file) }
  }
  foreach ($path in @('deploy\release.env', 'apps\web\package.json', 'apps\api\requirements.txt')) {
    if (-not (Test-Path (Join-Path $temp $path))) { throw "Required release file missing: $path" }
  }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::CreateFromDirectory($temp, $output, [IO.Compression.CompressionLevel]::Optimal, $false)
  $hash = Get-FileHash -LiteralPath $output -Algorithm SHA256
  Write-Host "Created $output"
  Write-Host "SHA256: $($hash.Hash)"
  Write-Host 'Contains source/docs/scripts only; excludes .env, SQLite, Neo4j, venv, node_modules, and dist.'
} finally {
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
