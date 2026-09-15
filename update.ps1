# update.ps1 - bring an already-set-up machine to the latest shell build.
#
# For any machine that has this repo cloned (i.e. setup.ps1 ran at least once):
#   1. git pull --ff-only            get the newest shell source + plugins
#   2. refresh the custom plugins    scripts/setup-plugins.mjs (idempotent)
#   3. rebuild the shell exe         wails build, from THIS repo
#   4. deploy the exe                app area + dated archive + VERSION.txt
#
# The shell source lives in this repository. The old flow that cloned the
# FFaassdfs/deepseek-harness fork and built its desktop/ directory is retired:
# that directory was removed from the fork on 2026-09-15 (HANDOVER path L).
#
# Usage:
#   pwsh -File update.ps1                        # pull + plugins + full build + deploy
#   pwsh -File update.ps1 -SkipPull              # build whatever is checked out
#   pwsh -File update.ps1 -SkipFrontend          # only Go changed: wails build -s
#   pwsh -File update.ps1 -SkipPlugins           # do not touch $DSH_HOME
#   pwsh -File update.ps1 -NoDeploy              # build only, leave the app area alone
#   pwsh -File update.ps1 -AppDir D:\dsh\app\current
#   pwsh -File update.ps1 -CheckOnly             # dry run, writes nothing
#
# NOTE: this script is intentionally ASCII-only (English messages) because
# Windows PowerShell 5.1 misreads BOM-less UTF-8 and garbles CJK output.
param(
  [string]$AppDir = "D:\dsh\app\current",
  [switch]$SkipPull,
  [switch]$SkipPlugins,
  [switch]$SkipFrontend,
  [switch]$SkipBuild,
  [switch]$NoDeploy,
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Step($title) { Write-Host ""; Write-Host "==> $title" -ForegroundColor Cyan }
function Ok($msg)     { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Warn($msg)   { Write-Host "    [!!] $msg" -ForegroundColor Yellow }

Write-Host "dsh-desktop update" -ForegroundColor Magenta
Write-Host "repo root : $repoRoot"
Write-Host "app dir   : $(if ($NoDeploy) { '(no deploy)' } else { $AppDir })"
Write-Host "checkOnly : $CheckOnly"

# --- 1. pull ------------------------------------------------------------------
Step "1/4 pulling the latest source"
if ($SkipPull) {
  Warn "pull skipped (-SkipPull)"
} elseif (-not (Test-Path (Join-Path $repoRoot ".git"))) {
  Warn "not a git checkout - skipping pull (copy the repo manually instead)"
} elseif ($CheckOnly) {
  Warn "would run: git pull --ff-only"
} else {
  $before = (& git -C $repoRoot rev-parse HEAD).Trim()
  & git -C $repoRoot pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw "git pull failed - resolve local changes / branch divergence, then re-run" }
  $after = (& git -C $repoRoot rev-parse HEAD).Trim()
  if ($before -eq $after) {
    Ok "already up to date ($($after.Substring(0,7)))"
  } else {
    Ok "updated $($before.Substring(0,7)) -> $($after.Substring(0,7))"
    & git -C $repoRoot log --oneline "$before..$after" | Select-Object -First 15 | ForEach-Object { Write-Host "      $_" }
  }
}

# --- 2. plugins ---------------------------------------------------------------
Step "2/4 refreshing the custom plugins"
if ($SkipPlugins) {
  Warn "plugins skipped (-SkipPlugins)"
} else {
  $pluginArgs = @(Join-Path $repoRoot "scripts\setup-plugins.mjs")
  if ($CheckOnly) { $pluginArgs += "--check-only" }
  & node @pluginArgs
  if ($LASTEXITCODE -ne 0) { throw "plugin setup failed (see output above)" }
}

# --- 3. build -----------------------------------------------------------------
Step "3/4 building the shell from this repo"
if ($SkipBuild) {
  Warn "build skipped (-SkipBuild)"
} else {
  $wails = Get-Command wails -ErrorAction SilentlyContinue
  if (-not $wails) {
    throw "wails CLI not found. Install Go 1.26+ then: go install github.com/wailsapp/wails/v2/cmd/wails@latest"
  }
  if ($CheckOnly) {
    Warn "would run: wails build$(if ($SkipFrontend) { ' -s' }) in $repoRoot"
  } else {
    $frontendModules = Join-Path $repoRoot "frontend\node_modules"
    if (-not $SkipFrontend -and -not (Test-Path $frontendModules)) {
      Ok "frontend node_modules missing - running npm install"
      Push-Location (Join-Path $repoRoot "frontend")
      try {
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install (frontend) failed" }
      } finally { Pop-Location }
    }
    Push-Location $repoRoot
    try {
      if ($SkipFrontend) { & wails build -s } else { & wails build }
      if ($LASTEXITCODE -ne 0) { throw "wails build failed" }
    } finally { Pop-Location }
  }
}

$built = Join-Path $repoRoot "build\bin\dsh-desktop.exe"
if (-not $CheckOnly) {
  if (-not (Test-Path $built)) { throw "build output missing: $built" }
  $builtInfo = Get-Item $built
  if ($builtInfo.Length -lt 1MB) { throw "built exe suspiciously small: $($builtInfo.Length) bytes" }
  Ok "built $($builtInfo.Length) bytes at $($builtInfo.LastWriteTime)"
}

# --- 4. deploy ----------------------------------------------------------------
Step "4/4 deploying to the app area"
if ($NoDeploy) {
  Warn "deploy skipped (-NoDeploy); exe stays at $built"
} elseif ($CheckOnly) {
  Warn "would copy $built -> $AppDir\dsh-desktop.exe (+ dated archive + VERSION.txt)"
} else {
  $drive = Split-Path -Qualifier $AppDir
  if (-not (Test-Path $drive)) {
    Warn "drive $drive does not exist - skipping deploy; exe stays at $built"
  } else {
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    $target = Join-Path $AppDir "dsh-desktop.exe"
    $locked = $false
    if (Test-Path $target) {
      try {
        $fs = [System.IO.File]::Open($target, 'Open', 'ReadWrite', 'None')
        $fs.Close()
      } catch { $locked = $true }
    }

    $appRoot = Split-Path $AppDir -Parent
    $archiveDir = Join-Path $appRoot ("versions\" + (Get-Date -Format "yyyy-MM-dd"))
    New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null
    $archive = Join-Path $archiveDir ("dsh-desktop-" + (Get-Date -Format "HHmmss") + ".exe")
    Copy-Item $built $archive -Force
    Ok "archived -> $archive"

    $commit = "(unknown)"
    if (Test-Path (Join-Path $repoRoot ".git")) { $commit = (& git -C $repoRoot rev-parse --short HEAD).Trim() }
    $dshVer = (& cmd /c "dsh --version 2>nul")
    $versionText = @"
dsh-desktop launcher
built:    $($builtInfo.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
deployed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
source:   $repoRoot (commit $commit)
port:     43080
core:     @deepseek-ai/dsh $dshVer (global npm)
launch:   $target
"@

    if ($locked) {
      $staged = Join-Path $AppDir "dsh-desktop.new.exe"
      Copy-Item $built $staged -Force
      Warn "target exe is locked (the shell is running): staged as $staged"
      Warn "close the shell, then either rename it over dsh-desktop.exe or run .work\swap-desktop-exe.ps1"
      Set-Content -Path (Join-Path $AppDir "VERSION.new.txt") -Value $versionText -Encoding utf8
    } else {
      Copy-Item $built $target -Force
      $newInfo = Get-Item $target
      if ($newInfo.Length -ne $builtInfo.Length) { throw "size mismatch after copy ($($newInfo.Length) vs $($builtInfo.Length))" }
      Set-Content -Path (Join-Path $AppDir "VERSION.txt") -Value $versionText -Encoding utf8
      Remove-Item (Join-Path $AppDir "VERSION.new.txt") -Force -ErrorAction SilentlyContinue
      Remove-Item (Join-Path $AppDir "dsh-desktop.new.exe") -Force -ErrorAction SilentlyContinue
      Ok "deployed -> $target ($($newInfo.Length) bytes)"
    }
  }
}

# --- done ---------------------------------------------------------------------
Step "done"
Write-Host "Next: restart the shell so the new build takes effect."
Write-Host "  NOTE: the launcher owns the dsh web that serves the current GUI session,"
Write-Host "        so restarting it interrupts that session (reopen it afterwards)."
Write-Host "  Verify afterwards: Get-Process dsh-desktop | Select Id,Path  (must point at $AppDir)"
Write-Host "  Per-machine steps that are NOT synced: dsh API key / .env."
