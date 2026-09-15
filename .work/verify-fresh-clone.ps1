# verify-fresh-clone.ps1 - prove that a FRESH CLONE of this repo can build the shell.
#
# Why: the shell source lives in this repository (app.go / frontend/ / build/).
# Another machine only gets what git tracks, so this script simulates that
# machine: clone HEAD into a temp dir, install the frontend deps, run
# `wails build`, and check the produced exe.
#
# Usage:
#   pwsh -File .work\verify-fresh-clone.ps1                 # clone + build + verify
#   pwsh -File .work\verify-fresh-clone.ps1 -SkipBuild      # only check tracked files
#   pwsh -File .work\verify-fresh-clone.ps1 -Keep           # keep the clone for inspection
#
# Exit code 0 = a fresh clone builds. Non-zero = the sync path is broken.
param(
  [string]$WorkDir = "",
  [switch]$SkipBuild,
  [switch]$Keep
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $WorkDir) { $WorkDir = Join-Path $repoRoot ".cache\fresh-clone" }

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    [!!] $m" -ForegroundColor Yellow }

Step "1/4 cloning HEAD (what another machine would get)"
if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
& git clone --quiet $repoRoot $WorkDir
if ($LASTEXITCODE -ne 0) { throw "git clone failed" }
$commit = (& git -C $WorkDir rev-parse --short HEAD).Trim()
Ok "cloned $commit -> $WorkDir"

Step "2/4 checking that every shell source a build needs is tracked"
$required = @(
  "app.go", "main.go", "dsh_windows.go", "dsh_other.go",
  "windowstate.go", "logutil.go", "go.mod", "go.sum", "wails.json",
  "frontend\index.html", "frontend\package.json", "frontend\package-lock.json",
  "frontend\src\main.js",
  "build\appicon.png", "build\windows\icon.ico", "build\windows\info.json",
  "build\windows\wails.exe.manifest", "build\windows\installer\project.nsi",
  "scripts\setup-plugins.mjs", "update.ps1", "setup.ps1"
)
$missing = @()
foreach ($f in $required) {
  if (-not (Test-Path (Join-Path $WorkDir $f))) { $missing += $f }
}
if ($missing.Count -gt 0) {
  Warn "MISSING from the clone (not tracked by git?):"
  $missing | ForEach-Object { Warn "  $_" }
  throw "$($missing.Count) file(s) required for a build are not in the repository"
}
Ok "all $($required.Count) required files present in the clone"
$tracked = (& git -C $WorkDir ls-files | Measure-Object).Count
Ok "$tracked tracked files total"

if ($SkipBuild) {
  Warn "build skipped (-SkipBuild)"
  if (-not $Keep) { Remove-Item $WorkDir -Recurse -Force }
  Write-Host "`nFRESH CLONE CHECK OK (no build)" -ForegroundColor Green
  exit 0
}

Step "3/4 installing frontend deps + wails build (this is the slow part)"
if (-not $env:npm_config_cache) { $env:npm_config_cache = Join-Path $repoRoot ".cache\npm" }
Push-Location (Join-Path $WorkDir "frontend")
try {
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install failed in the clone" }
} finally { Pop-Location }
Ok "frontend deps installed"

$wails = Get-Command wails -ErrorAction SilentlyContinue
if (-not $wails) { throw "wails CLI not found (go install github.com/wailsapp/wails/v2/cmd/wails@latest)" }
Push-Location $WorkDir
try {
  & wails build
  if ($LASTEXITCODE -ne 0) { throw "wails build failed in the clone" }
} finally { Pop-Location }

Step "4/4 verifying the built exe"
$exe = Join-Path $WorkDir "build\bin\dsh-desktop.exe"
if (-not (Test-Path $exe)) { throw "no exe produced at $exe" }
$info = Get-Item $exe
if ($info.Length -lt 1MB) { throw "exe suspiciously small: $($info.Length) bytes" }
Ok "built $($info.Length) bytes at $($info.LastWriteTime)"

# The P0-3 hardening marker: only builds made after 2026-09-14 contain it.
$bytes = [System.IO.File]::ReadAllBytes($exe)
$marker = -join @([char]0x540e, [char]0x81ea, [char]0x52a8, [char]0x91cd, [char]0x542f)  # "后自动重启"
$needle = [System.Text.Encoding]::UTF8.GetBytes($marker)
$found = $false
for ($i = 0; $i -le $bytes.Length - $needle.Length; $i++) {
  if ($bytes[$i] -eq $needle[0]) {
    $m = $true
    for ($j = 1; $j -lt $needle.Length; $j++) { if ($bytes[$i + $j] -ne $needle[$j]) { $m = $false; break } }
    if ($m) { $found = $true; break }
  }
}
if ($found) { Ok "exe contains the P0-3 restart-backoff string" }
else { Warn "exe does NOT contain the P0-3 marker (older source built?)" }

if (-not $Keep) {
  Remove-Item $WorkDir -Recurse -Force
  Ok "removed the test clone"
} else {
  Warn "kept the test clone at $WorkDir"
}
Write-Host "`nFRESH CLONE CHECK OK - another machine can build the latest shell from this repo" -ForegroundColor Green
