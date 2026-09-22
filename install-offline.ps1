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
$runtimeDir = Join-Path $pkgRoot "runtime"
$runtimeArchive = Join-Path $pkgRoot "runtime.zip"
$bundledNode = Join-Path $runtimeDir "node.exe"
$pluginsDir = Join-Path $pkgRoot "plugins"
$pluginScript = Join-Path $pkgRoot "scripts\setup-plugins.mjs"

Write-Host "dsh-desktop offline installer" -ForegroundColor Magenta
Write-Host "package  : $pkgRoot"
Write-Host "checkOnly: $CheckOnly"

if (-not $DSHome) { $DSHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" } }
# Normalise to an absolute path: the plugin installer resolves packages with
# createRequire(), which rejects relative paths - and that used to abort the
# install after the first plugin. Also expand a leading ~.
if ($DSHome.StartsWith("~")) { $DSHome = $env:USERPROFILE + $DSHome.Substring(1) }
if (-not [System.IO.Path]::IsPathRooted($DSHome)) {
  $DSHome = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $DSHome))
}

# --- plugin selection ---------------------------------------------------------
function Get-BundledPluginNames {
  if (-not (Test-Path $pluginsDir)) { return @() }
  return @(Get-ChildItem $pluginsDir -Directory | Sort-Object Name |
    ForEach-Object { $_.Name -replace '^dsh-client-ui-plugin-', '' })
}

$nodeCmd = if (Test-Path $bundledNode) { $bundledNode } else { "node" }
$script:PluginCatalogue = $null

# The catalogue (number, short name, Chinese title/summary) comes from
# scripts/setup-plugins.mjs --describe - single source of truth, so the menu and
# README can never drift apart. Falls back to plain names if node is unavailable.
function Get-PluginCatalogue {
  if ($null -ne $script:PluginCatalogue) { return $script:PluginCatalogue }
  $bundled = @(Get-BundledPluginNames)
  $catalogue = @()
  try {
    $raw = (& $nodeCmd $pluginScript --describe 2>$null | Out-String)
    if ($LASTEXITCODE -eq 0 -and $raw.Trim()) {
      $parsed = @($raw | ConvertFrom-Json)
      $catalogue = @($parsed | Where-Object { $bundled -contains $_.short })
    }
  } catch { $catalogue = @() }
  if ($catalogue.Count -eq 0) {
    $i = 0
    $catalogue = @($bundled | ForEach-Object {
      $i++
      [pscustomobject]@{ index = $i; short = $_; name = "dsh-client-ui-plugin-$_"; title = ""; summary = ""; where = ""; writes = "" }
    })
  }
  $script:PluginCatalogue = $catalogue
  return $catalogue
}

function Show-PluginCatalogue {
  $catalogue = @(Get-PluginCatalogue)
  if ($catalogue.Count -eq 0) { Warn "no plugins bundled in this package"; return }
  Write-Host ""
  Write-Host "Plugins bundled in this package:" -ForegroundColor Cyan
  foreach ($p in $catalogue) {
    $title = if ($p.title) { "  $($p.title)" } else { "" }
    Write-Host ("  {0,2}) {1,-18}{2}" -f $p.index, $p.short, $title)
    if ($p.summary) { Write-Host ("        $($p.summary)") -ForegroundColor DarkGray }
    if ($p.where)  { Write-Host ("        在哪看：$($p.where)") -ForegroundColor DarkGray }
  }
}

# Pure parser (unit-tested by .work\plugin-selection.test.ps1).
# Numbers are the catalogue indexes; names/patch ids/package names also work.
# ANY invalid token -> Selection "none" plus a message (never a silent fallback).
function ConvertFrom-PluginAnswer {
  param([string]$Answer, $Catalogue)
  $result = [pscustomobject]@{ Selection = "none"; Error = "" }
  $catalogue = @($Catalogue)
  if ($catalogue.Count -eq 0) { return $result }

  $a = if ($null -eq $Answer) { "" } else { $Answer.Trim() }
  if ($a -eq "" -or $a -ieq "a" -or $a -ieq "all") {
    $result.Selection = ($catalogue | ForEach-Object { $_.short }) -join ","
    return $result
  }
  if ($a -ieq "n" -or $a -ieq "none") { return $result }   # Selection stays "none"

  $picked = @()
  $invalid = @()
  # Split on commas AND whitespace: `-Plugins 2,4` is the documented form, but
  # PowerShell turns that into the array 2,4 in -Command mode (ending up as
  # "2 4"), so accept both.
  foreach ($token in ($a -split '[,\s]+')) {
    $t = $token.Trim()
    if ($t -eq "") { continue }
    $hit = $null
    if ($t -match '^\d+$') {
      $hit = $catalogue | Where-Object { $_.index -eq [int]$t } | Select-Object -First 1
    } else {
      $hit = $catalogue | Where-Object {
        $_.short -ieq $t -or $_.name -ieq $t -or $_.patchId -ieq $t -or
        $_.name -imatch ("-" + [regex]::Escape($t) + "$")
      } | Select-Object -First 1
    }
    if ($null -eq $hit) { $invalid += $t; continue }
    if ($picked -notcontains $hit.short) { $picked += $hit.short }
  }
  if ($invalid.Count -gt 0) {
    $result.Error = ("invalid choice: " + ($invalid -join ", ") +
      " -- valid numbers are " + (($catalogue | ForEach-Object { $_.index }) -join "/") +
      ", or names: " + (($catalogue | ForEach-Object { $_.short }) -join ", "))
    return $result
  }
  if ($picked.Count -eq 0) {
    $result.Error = "nothing picked"
    return $result
  }
  $result.Selection = ($picked -join ",")
  return $result
}

# Resolves -Plugins into a comma-separated short-name list for setup-plugins.mjs.
function Resolve-PluginSelection {
  param([string]$Value)
  $v = if ($null -eq $Value) { "all" } else { $Value.Trim() }
  if ($v -eq "" -or $v -ieq "all") { return "all" }
  if ($v -ieq "none") { return "none" }
  if ($v -ine "ask") {
    # Numbers or names straight from the command line; fail loudly on typos.
    $auto = ConvertFrom-PluginAnswer -Answer $v -Catalogue (Get-PluginCatalogue)
    if ($auto.Error) { throw "-Plugins $v : $($auto.Error)" }
    return $auto.Selection
  }

  $catalogue = @(Get-PluginCatalogue)
  if ($catalogue.Count -eq 0) { return "none" }
  # Never block a non-interactive caller (agent / scheduled task / redirected
  # stdin) - unless the caller explicitly forces the prompt (tests, or piping an
  # answer in, e.g. `echo 2,4 | install-offline.cmd`).
  $forcePrompt = ($env:DSH_INSTALL_FORCE_PROMPT -eq "1")
  if (-not $forcePrompt -and (-not [Environment]::UserInteractive -or [Console]::IsInputRedirected)) {
    Warn "no interactive console available - installing all plugins (pass -Plugins <list> to choose)"
    return "all"
  }

  Write-Host ""
  Write-Host "Which plugins should be installed into $DSHome ?" -ForegroundColor Cyan
  Write-Host "  多选请用逗号隔开（multi-select: separate numbers with commas, e.g. 2,4）" -ForegroundColor DarkGray
  Write-Host ""
  foreach ($p in $catalogue) {
    $title = if ($p.title) { "  $($p.title)" } else { "" }
    Write-Host ("  {0,2}) {1,-18}{2}" -f $p.index, $p.short, $title)
    if ($p.summary) { Write-Host ("        $($p.summary)") -ForegroundColor DarkGray }
  }
  Write-Host ""
  Write-Host "   a) all of them (全部安装)"
  Write-Host "   n) none - run the shell only (都不装)"
  $answer = Read-Host "Numbers, comma-separated (e.g. 2,4), or a / n   [default a]"

  $parsed = ConvertFrom-PluginAnswer -Answer $answer -Catalogue $catalogue
  if ($parsed.Error) {
    Warn "invalid input '$answer' -> $($parsed.Error)"
    Warn "nothing will be installed (re-run the installer to try again)"
    return "none"
  }
  return $parsed.Selection
}

# --- 1. layout ----------------------------------------------------------------
Step "1/2 checking the package layout"
foreach ($p in @($exe, $pluginScript)) {
  if (-not (Test-Path $p)) { throw "package is incomplete, missing: $p" }
}
Ok "dsh-desktop.exe present"

# The runtime ships as one file (runtime.zip) and is normally unpacked by the
# shell on first start. This script needs it NOW (to run the plugin installer
# with the bundled node), so unpack it via the shell's own CLI mode.
if (-not (Test-Path $bundledNode) -and (Test-Path $runtimeArchive)) {
  Ok "runtime.zip found - unpacking it first (same code the shell uses)"
  if ($CheckOnly) {
    Warn "would run: dsh-desktop.exe --extract-runtime"
  } else {
    $proc = Start-Process -FilePath $exe -ArgumentList "--extract-runtime" -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ne 0 -or -not (Test-Path $bundledNode)) {
      Warn "shell extraction failed (exit $($proc.ExitCode)) - falling back to tar.exe"
      if (Test-Path $runtimeDir) { Remove-Item $runtimeDir -Recurse -Force -ErrorAction SilentlyContinue }
      New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
      & tar.exe -xf $runtimeArchive -C $runtimeDir
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path $bundledNode)) { throw "cannot unpack $runtimeArchive" }
    }
    Ok "runtime unpacked -> $runtimeDir"
  }
}

if (Test-Path $bundledNode) {
  $nodeVersion = (& $bundledNode --version) 2>$null
  Ok "bundled runtime node $nodeVersion"
  $runtimeRoot = $runtimeDir
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
  if ($CheckOnly) {
    Show-PluginCatalogue
    Write-Host ("    would install : " + $selection)
  }
  $nodeArgs = @($pluginScript, "--plugins", $selection)
  if ($CheckOnly) { $nodeArgs += "--check-only" }
  Write-Host "    running : $nodeCmd $($nodeArgs -join ' ')"
  $env:DSH_HOME = $DSHome
  & $nodeCmd @nodeArgs
  $pluginExit = $LASTEXITCODE
  if ($pluginExit -ne 0) {
    if ($CheckOnly) {
      # A dry run verifies the CURRENT state; on a fresh machine nothing is
      # installed yet, so this is expected - never fail a dry run over it.
      Warn "dry run: the current installation does not verify (exit $pluginExit) - normal on a fresh machine"
    } else {
      throw "plugin installation failed (see output above)"
    }
  }
}

# --- optional app-area deploy -------------------------------------------------
if ($AppDir) {
  Step "optional: deploying exe + runtime to $AppDir"
  if ($CheckOnly) {
    Warn "would copy dsh-desktop.exe (+ runtime.zip or runtime\) to $AppDir"
  } else {
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Copy-Item $exe (Join-Path $AppDir "dsh-desktop.exe") -Force
    Ok "exe copied -> $AppDir\dsh-desktop.exe"
    if (Test-Path $runtimeArchive) {
      # Preferred: one file, and the shell unpacks it in the app dir on first start.
      Copy-Item $runtimeArchive (Join-Path $AppDir "runtime.zip") -Force
      Ok "runtime.zip copied -> $AppDir\runtime.zip (unpacked on first start)"
    } elseif ($runtimeRoot) {
      $dstRuntime = Join-Path $AppDir "runtime"
      New-Item -ItemType Directory -Force -Path $dstRuntime | Out-Null
      $rc = Start-Process -FilePath "robocopy" -ArgumentList @($runtimeRoot, $dstRuntime, "/MIR", "/MT:16", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1") -Wait -PassThru -NoNewWindow
      if ($rc.ExitCode -ge 8) { throw "robocopy failed with exit code $($rc.ExitCode)" }
      Ok "runtime copied (multithreaded) -> $dstRuntime"
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
Write-Host "  * Re-run with -Plugins <list> to change which plugins are installed,"
Write-Host "    e.g. -Plugins 2,4  (numbers as listed above) or -Plugins explainer,project-explorer"
Write-Host "  * Already-installed plugins are never removed by this installer: it only"
Write-Host "    adds/updates the ones you pick. Use the 插件说明 panel (explainer plugin)"
Write-Host "    to disable one, or delete its package + cordis.patch.yml entry."
Write-Host "  * To refresh plugins on a machine that already has them, use the dedicated"
Write-Host "    updater (content-hash based, with backup + rollback):"
Write-Host "      update-plugins.cmd             (update what is already installed)"
Write-Host "      update-plugins.cmd -CheckOnly   (only report, write nothing)"
