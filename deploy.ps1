# deploy.ps1 - guided bootstrap for the dsh-desktop environment (idempotent).
#
# Agent-friendly entry point (opencode / human): verifies prerequisites,
# prints the exact install command for anything missing, then hands off to
# setup.ps1. Safe to re-run; does NOT install anything by itself.
#
# Usage:
#   pwsh -File deploy.ps1                                  # check + full deploy
#   pwsh -File deploy.ps1 -HarnessVersion 0.1.0-rc.7       # pin dsh version
#   pwsh -File deploy.ps1 -SkipDesktopBuild                # plugins only
#   pwsh -File deploy.ps1 -CheckOnly                       # dry run, no writes
#
# NOTE: ASCII-only output on purpose (Windows PowerShell 5.1 misreads
# BOM-less UTF-8 and garbles CJK in scripts).
param(
  [string]$HarnessVersion = "0.1.0-rc.7",
  [switch]$SkipDesktopBuild,
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Step($title) { Write-Host ""; Write-Host "==> $title" -ForegroundColor Cyan }
function Ok($msg)     { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Miss($msg)   { Write-Host "    [missing] $msg" -ForegroundColor Yellow }

Write-Host "dsh-desktop deploy bootstrap" -ForegroundColor Magenta
Write-Host "repo root  : $repoRoot"
Write-Host "check only : $CheckOnly"
Write-Host "desktop    : $(if ($SkipDesktopBuild) { 'skipped' } else { 'enabled' })"

$missing = @()

# --- prerequisite check --------------------------------------------------------
Step "prerequisite check"

$gitv = git --version 2>$null
if ($LASTEXITCODE -eq 0 -and $gitv) { Ok("git: $gitv") }
else { Miss("git"); $missing += "winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements" }

$nodev = node --version 2>$null
if ($LASTEXITCODE -eq 0 -and $nodev) { Ok("node: $nodev") }
else { Miss("node"); $missing += "winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements" }

Ok("powershell: $($PSVersionTable.PSVersion)")

if (-not $SkipDesktopBuild) {
  $gov = go version 2>$null
  if ($LASTEXITCODE -eq 0 -and $gov) { Ok("go: $gov") }
  else { Miss("go"); $missing += "winget install --id GoLang.Go -e --accept-source-agreements --accept-package-agreements" }

  $wailsv = wails version 2>$null
  if ($LASTEXITCODE -eq 0 -and $wailsv) { Ok("wails: $wailsv") }
  elseif (Test-Path (Join-Path $env:USERPROFILE "go\bin\wails.exe")) {
    Ok("wails.exe present at $env:USERPROFILE\go\bin but not on PATH (will prepend)")
  }
  else {
    Miss("wails (after Go: go install github.com/wailsapp/wails/v2/cmd/wails@latest)")
    $missing += "go install github.com/wailsapp/wails/v2/cmd/wails@latest"
  }
}

if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Host "Prerequisites missing. Run these first, open a NEW terminal, then re-run this script:" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
  exit 1
}

# --- make wails reachable for setup.ps1 (go\bin may not be on PATH) -------------
$goBin = Join-Path $env:USERPROFILE "go\bin"
if ((Test-Path (Join-Path $goBin "wails.exe")) -and -not ($env:Path -split ';' | Where-Object { $_ -ieq $goBin })) {
  $env:Path = "$goBin;$env:Path"
  Ok("prepended $goBin to PATH for this session")
}

# --- hand off to setup.ps1 ------------------------------------------------------
# NOTE: hashtable splatting (named params). Array splatting would pass
# positional args and break "-Name value" pairs (PS 5.1 gotcha).
Step "handing off to setup.ps1"
$setupArgs = @{}
if ($HarnessVersion) { $setupArgs.HarnessVersion = $HarnessVersion }
if ($SkipDesktopBuild) { $setupArgs.SkipDesktopBuild = $true }
if ($CheckOnly) { $setupArgs.CheckOnly = $true }
& (Join-Path $repoRoot "setup.ps1") @setupArgs
exit $LASTEXITCODE
