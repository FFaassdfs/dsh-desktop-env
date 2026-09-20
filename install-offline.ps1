# install-offline.ps1 - set up a portable (offline) dsh-desktop release.
#
# Shipped inside the release zip next to dsh-desktop.exe. The package already
# contains everything the harness needs, so this script only has to:
#   1. install the 4 custom plugins into $DSH_HOME (idempotent)
#   2. (optional) copy the exe + bundled runtime into an "app area" directory
#
# The shell itself is portable: unzip anywhere and run dsh-desktop.exe from that
# folder - it resolves the runtime next to itself (<exeDir>\runtime). No Node,
# no npm, no Go/Wails needed on the target machine.
#
# Usage:
#   powershell -File install-offline.ps1                  # plugins only, run in place
#   powershell -File install-offline.ps1 -DSHome D:\dsh-home
#   powershell -File install-offline.ps1 -AppDir D:\dsh\app\current   # also copy exe+runtime
#   powershell -File install-offline.ps1 -CheckOnly       # dry run
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8
# scripts with non-ASCII content).
param(
  [string]$DSHome = "",
  [string]$AppDir = "",
  [switch]$SkipPlugins,
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    [!!] $m" -ForegroundColor Yellow }

$pkgRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $pkgRoot "dsh-desktop.exe"
$bundledNode = Join-Path $pkgRoot "runtime\node.exe"
$pluginsDir = Join-Path $pkgRoot "plugins"
$pluginScript = Join-Path $pkgRoot "scripts\setup-plugins.mjs"

Write-Host "dsh-desktop offline installer" -ForegroundColor Magenta
Write-Host "package : $pkgRoot"
Write-Host "checkOnly: $CheckOnly"

Step "1/2 checking the package layout"
foreach ($p in @($exe, $pluginScript)) {
  if (-not (Test-Path $p)) { throw "package is incomplete, missing: $p" }
}
Ok "dsh-desktop.exe present"
if (Test-Path $bundledNode) {
  $nodeVersion = (& $bundledNode --version) 2>$null
  Ok "bundled runtime node $nodeVersion"
  $runtimeRoot = Join-Path $pkgRoot "runtime"
} else {
  Warn "no bundled runtime next to the exe - the shell will fall back to the global dsh install"
  $runtimeRoot = ""
}
if (Test-Path $pluginsDir) {
  $count = (Get-ChildItem $pluginsDir -Directory | Measure-Object).Count
  Ok "$count plugin package(s) bundled"
} else {
  Warn "no plugins/ directory in this package"
}

Step "2/2 installing the custom plugins into DSH_HOME"
if (-not $DSHome) { $DSHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" } }
Write-Host "    DSH_HOME : $DSHome"
if ($SkipPlugins) {
  Warn "plugins skipped (-SkipPlugins)"
} elseif (-not (Test-Path $pluginsDir)) {
  Warn "nothing to install (no plugins/ directory)"
} else {
  $nodeCmd = if (Test-Path $bundledNode) { $bundledNode } else { "node" }
  if ($CheckOnly) {
    Warn "would run: `"$nodeCmd`" `"$pluginScript`" --check-only (DSH_HOME=$DSHome)"
    & $nodeCmd $pluginScript --check-only
  } else {
    $env:DSH_HOME = $DSHome
    & $nodeCmd $pluginScript
    if ($LASTEXITCODE -ne 0) { throw "plugin installation failed (see output above)" }
  }
}

if ($AppDir) {
  Step "optional: deploying exe + runtime to $AppDir"
  if ($CheckOnly) {
    Warn "would copy dsh-desktop.exe and runtime\ to $AppDir"
  } else {
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Copy-Item $exe (Join-Path $AppDir "dsh-desktop.exe") -Force
    Ok "exe copied -> $AppDir\dsh-desktop.exe"
    if ($runtimeRoot) {
      $dstRuntime = Join-Path $AppDir "runtime"
      New-Item -ItemType Directory -Force -Path $dstRuntime | Out-Null
      $rc = Start-Process -FilePath "robocopy" -ArgumentList @($runtimeRoot, $dstRuntime, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1") -Wait -PassThru -NoNewWindow
      if ($rc.ExitCode -ge 8) { throw "robocopy failed with exit code $($rc.ExitCode)" }
      Ok "runtime copied -> $dstRuntime"
    }
  }
}

Step "done"
$launch = if ($AppDir) { Join-Path $AppDir "dsh-desktop.exe" } else { $exe }
Write-Host "Launch the shell with:" -ForegroundColor Green
Write-Host "  $launch"
Write-Host ""
Write-Host "Notes:"
Write-Host "  * The first launch opens the dsh Web UI in your default browser."
Write-Host "  * The shell is single-instance per user: close any other dsh-desktop first."
Write-Host "  * API keys / .env are NOT part of this package - configure them per machine."
Write-Host "  * This build is unsigned: Windows SmartScreen may warn on first run."
Write-Host "  * Plugin changes take effect after a full shell restart."
