# setup.ps1 - one-shot environment replica for dsh-desktop (idempotent).
#
# Run on a fresh Windows machine right after `git clone` of this repo to get
# the same harness + shell environment as the dev machine:
#   1. check Node.js / npm
#   2. check (and optionally pin/install) the global dsh version
#   3. install the two custom plugins into $DSH_HOME/profiles/node_modules
#      and merge cordis.patch.yml (via scripts/setup-plugins.mjs)
#   4. clone the desktop-shell fork and build dsh-desktop.exe (optional)
#
# Usage:
#   pwsh -File setup.ps1                                # full setup
#   pwsh -File setup.ps1 -HarnessVersion 0.1.0-rc.7     # pin dsh version
#   pwsh -File setup.ps1 -SkipDesktopBuild              # plugins only
#   pwsh -File setup.ps1 -CheckOnly                     # dry run, writes nothing
#
# NOTE: this script is intentionally ASCII-only (comments/messages in English)
# to stay safe on Windows PowerShell 5.1, which misreads BOM-less UTF-8.
param(
  [string]$HarnessVersion = "",
  [switch]$SkipHarnessInstall,
  [switch]$SkipDesktopBuild,
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Step($title) { Write-Host ""; Write-Host "==> $title" -ForegroundColor Cyan }
function Ok($msg)    { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "    [!!] $msg" -ForegroundColor Yellow }

Write-Host "dsh-desktop environment setup" -ForegroundColor Magenta
Write-Host "repo root : $repoRoot"
Write-Host "checkOnly : $CheckOnly"

# --- 1. Node.js / npm ----------------------------------------------------------
Step "1/4 checking Node.js and npm"
$node = node --version 2>$null
if ($LASTEXITCODE -ne 0 -or -not $node) {
  throw "Node.js not found. Install Node.js 22.19+ or 24.x from https://nodejs.org"
}
Ok("node $node")
$npm = npm --version 2>$null
Ok("npm $npm")

# --- 2. global dsh -------------------------------------------------------------
Step "2/4 checking global dsh"
$dsh = (& cmd /c "dsh --version 2>nul") 2>$null
if ($LASTEXITCODE -ne 0 -or -not $dsh) {
  if ($CheckOnly) {
    Warn "dsh not installed (would run: npm i -g @deepseek-ai/dsh@<version>)"
  } else {
    $target = if ($HarnessVersion) { "@deepseek-ai/dsh@$HarnessVersion" } else { "@deepseek-ai/dsh" }
    npm install -g $target
    if ($LASTEXITCODE -ne 0) { throw "npm install -g $target failed" }
    Ok("dsh installed ($target)")
  }
} else {
  Ok("dsh $dsh")
  if ($HarnessVersion -and $dsh.Trim() -ne $HarnessVersion) {
    if ($SkipHarnessInstall -or $CheckOnly) {
      Warn "dsh version is '$dsh', target is '$HarnessVersion' (install skipped)")
    } else {
      npm install -g "@deepseek-ai/dsh@$HarnessVersion"
      if ($LASTEXITCODE -ne 0) { throw "npm install -g @deepseek-ai/dsh@$HarnessVersion failed" }
      Ok("dsh updated to $HarnessVersion")
    }
  }
}

# --- 3. custom plugins ---------------------------------------------------------
Step "3/4 installing custom plugins"
$pluginArgs = @(Join-Path $repoRoot "scripts\setup-plugins.mjs")
if ($CheckOnly) { $pluginArgs += "--check-only" }
node @pluginArgs
if ($LASTEXITCODE -ne 0) { throw "plugin setup failed (see output above)" }

# --- 4. desktop shell (fork clone + wails build) -------------------------------
if ($SkipDesktopBuild) {
  Ok("desktop build skipped (-SkipDesktopBuild)")
} else {
  Step "4/4 desktop shell (fork clone + wails build)"
  $forkDir = Join-Path $repoRoot ".work\deepseek-harness"
  if (-not (Test-Path (Join-Path $forkDir ".git"))) {
    if ($CheckOnly) {
      Warn "fork not cloned (would run: git clone https://github.com/FFaassdfs/deepseek-harness.git)"
    } else {
      git clone "https://github.com/FFaassdfs/deepseek-harness.git" $forkDir
      if ($LASTEXITCODE -ne 0) { throw "git clone failed" }
      Ok("fork cloned -> $forkDir")
    }
  } else {
    Ok("fork already cloned")
  }

  $wails = Get-Command wails -ErrorAction SilentlyContinue
  if (-not $wails) {
    if ($CheckOnly) {
      Warn "wails CLI not found (install with: go install github.com/wailsapp/wails/v2/cmd/wails@latest)"
    } else {
      throw "wails CLI not found. Install Go 1.26+ then: go install github.com/wailsapp/wails/v2/cmd/wails@latest"
    }
  } elseif (-not $CheckOnly) {
    Push-Location (Join-Path $forkDir "desktop")
    try {
      wails build
      if ($LASTEXITCODE -ne 0) { throw "wails build failed" }
    } finally {
      Pop-Location
    }
    $exe = Join-Path $forkDir "desktop\build\bin\dsh-desktop.exe"
    if (-not (Test-Path $exe)) { throw "build output missing: $exe" }
    $outDir = Join-Path $repoRoot "build\bin"
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    Copy-Item $exe (Join-Path $outDir "dsh-desktop.exe") -Force
    Ok("dsh-desktop.exe copied to $outDir")
  }
}

# --- done ----------------------------------------------------------------------
Step "done"
Write-Host "Manual per-machine steps (NOT synced on purpose):"
Write-Host "  1. configure dsh API key / .env for this machine"
Write-Host "  2. start: $repoRoot\build\bin\dsh-desktop.exe   (or: dsh web)"
