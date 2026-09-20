# install-offline.ps1 - set up a portable (offline) dsh-desktop release.
#
# Shipped inside the release zip next to dsh-desktop.exe. The package is
# PORTABLE: unzipping and running dsh-desktop.exe already works. This script is
# optional and only:
#   1. installs the bundled custom plugins into $DSH_HOME (idempotent)
#   2. (optional) copies the exe + bundled runtime into an "app area" directory
#
# Usage:
#   install-offline.cmd                        # double-click wrapper: asks which plugins
#   powershell -ExecutionPolicy Bypass -File install-offline.ps1
#   ... -Plugins all                           # install every bundled plugin (default)
#   ... -Plugins none                          # install none (shell only)
#   ... -Plugins ask                           # interactive menu (needs a console)
#   ... -Plugins explainer,core-version        # pick individually
#   ... -DSHome D:\dsh-home                    # target another harness home
#   ... -AppDir D:\dsh\app\current             # also copy exe+runtime there
#   ... -CheckOnly                             # dry run
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8
# scripts with non-ASCII content, which garbles text or breaks parsing).
param(
  [string]$DSHome = "",
  [string]$AppDir = "",
  [string]$Plugins = "all",
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
Write-Host "package  : $pkgRoot"
Write-Host "checkOnly: $CheckOnly"

if (-not $DSHome) { $DSHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" } }

# --- plugin selection ---------------------------------------------------------
function Get-BundledPluginNames {
  if (-not (Test-Path $pluginsDir)) { return @() }
  return @(Get-ChildItem $pluginsDir -Directory | Sort-Object Name |
    ForEach-Object { $_.Name -replace '^dsh-client-ui-plugin-', '' })
}

# Resolves -Plugins into a comma-separated short-name list for setup-plugins.mjs.
function Resolve-PluginSelection {
  param([string]$Value)
  $v = if ($null -eq $Value) { "all" } else { $Value.Trim() }
  if ($v -eq "" -or $v -ieq "all") { return "all" }
  if ($v -ieq "none") { return "none" }
  if ($v -ine "ask") { return $v }

  $names = @(Get-BundledPluginNames)
  if ($names.Count -eq 0) { return "none" }
  # Never block a non-interactive caller (agent / scheduled task / redirected stdin).
  if (-not [Environment]::UserInteractive -or [Console]::IsInputRedirected) {
    Warn "no interactive console available - installing all plugins"
    return "all"
  }

  Write-Host ""
  Write-Host "Which plugins should be installed into $DSHome ?" -ForegroundColor Cyan
  for ($i = 0; $i -lt $names.Count; $i++) {
    Write-Host ("  {0,2}) {1}" -f ($i + 1), $names[$i])
  }
  Write-Host "   a) all of them"
  Write-Host "   n) none (run the shell only)"
  $answer = Read-Host "Enter numbers separated by commas, or a / n [a]"
  if ([string]::IsNullOrWhiteSpace($answer) -or $answer -ieq "a") { return "all" }
  if ($answer -ieq "n") { return "none" }

  $picked = @()
  foreach ($token in ($answer -split ",")) {
    $t = $token.Trim()
    if ($t -eq "") { continue }
    $n = 0
    if ([int]::TryParse($t, [ref]$n) -and $n -ge 1 -and $n -le $names.Count) {
      if ($picked -notcontains $names[$n - 1]) { $picked += $names[$n - 1] }
    } else {
      Warn "ignoring invalid choice '$t'"
    }
  }
  if ($picked.Count -eq 0) { Warn "nothing valid picked - installing all"; return "all" }
  return ($picked -join ",")
}

# --- 1. layout ----------------------------------------------------------------
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
$bundledNames = @(Get-BundledPluginNames)
if ($bundledNames.Count -gt 0) {
  Ok ("$($bundledNames.Count) plugin package(s) bundled: " + ($bundledNames -join ", "))
} else {
  Warn "no plugins/ directory in this package"
}

# --- 2. plugins ---------------------------------------------------------------
Step "2/2 installing the custom plugins into DSH_HOME"
Write-Host "    DSH_HOME : $DSHome"
$selection = Resolve-PluginSelection -Value $Plugins

if ($SkipPlugins) {
  Warn "plugins skipped (-SkipPlugins)"
} elseif ($bundledNames.Count -eq 0) {
  Warn "nothing to install (no plugins/ directory)"
} elseif ($selection -eq "none") {
  Warn "no plugins selected - the shell will run without them"
} else {
  $nodeCmd = if (Test-Path $bundledNode) { $bundledNode } else { "node" }
  $nodeArgs = @($pluginScript, "--plugins", $selection)
  if ($CheckOnly) { $nodeArgs += "--check-only" }
  Write-Host "    running : $nodeCmd $($nodeArgs -join ' ')"
  $env:DSH_HOME = $DSHome
  & $nodeCmd @nodeArgs
  if ($LASTEXITCODE -ne 0) { throw "plugin installation failed (see output above)" }
}

# --- optional app-area deploy -------------------------------------------------
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
Write-Host "  * Re-run with -Plugins <list> to change which plugins are installed."
