# pack-release.ps1 - build the portable (offline) dsh-desktop release package.
#
# Produces one zip that needs NOTHING on the target machine (no Node, no npm,
# no Go/Wails):
#
#   dsh-desktop-<shell>-dsh<dshver>-win-x64\
#     dsh-desktop.exe              the launcher (resolves .\runtime next to itself)
#     runtime\node.exe             portable Node.js (with its LICENSE)
#     runtime\node_modules\@deepseek-ai\dsh\...   the harness + all its deps
#     plugins\<4 packages>         the custom plugins
#     scripts\setup-plugins.mjs    installer used by install-offline.ps1
#     install-offline.ps1          installs plugins into $DSH_HOME (+ optional app dir)
#     VERSION.txt / README.txt
#
# Verified on 2026-09-20: dsh keeps ALL of its dependencies nested inside its own
# node_modules (190 entries; commander/open/zod/@deepseek-ai-cordis are NOT
# hoisted to the npm root), so copying the single @deepseek-ai/dsh tree plus a
# node.exe is a complete runtime.
#
# Usage:
#   pwsh -File scripts\pack-release.ps1                        # full package
#   pwsh -File scripts\pack-release.ps1 -NoNode                # without the bundled Node (needs Node on target)
#   pwsh -File scripts\pack-release.ps1 -RuntimeMode full-node-modules   # force copying the whole node_modules
#   pwsh -File scripts\pack-release.ps1 -SkipZip               # stage only
#   pwsh -File scripts\pack-release.ps1 -CheckOnly             # plan only
#
# -RuntimeMode: auto (default) | dsh-tree | full-node-modules
#   auto picks by layout: nested deps inside @deepseek-ai/dsh -> dsh-tree;
#   hoisted deps (npm install --prefix) -> full-node-modules. Either way the
#   staged runtime is executed once as a gate, so a wrong layout cannot ship.
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8
# scripts with non-ASCII content).
param(
  [string]$OutDir = "",
  [string]$ShellExe = "",
  [string]$RuntimeSource = "",
  [string]$NodeExe = "",
  [string]$NodeLicense = "",
  [string]$RuntimeMode = "auto",
  [string]$ShellVersion = "",
  [string]$DshVersion = "",
  [switch]$NoNode,
  [switch]$NoNpm,
  [switch]$SkipZip,
  [switch]$KeepStaging,
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    [!!] $m" -ForegroundColor Yellow }
function DirSize($p) {
  if (-not (Test-Path $p)) { return 0 }
  return (Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
}

# --- resolve inputs -----------------------------------------------------------
if (-not $OutDir) { $OutDir = Join-Path $repoRoot ".cache\release" }
if (-not $ShellExe) { $ShellExe = Join-Path $repoRoot "build\bin\dsh-desktop.exe" }
if (-not (Test-Path $ShellExe)) { throw "shell exe not found: $ShellExe (run wails build first)" }
$shellInfo = Get-Item $ShellExe
if ($shellInfo.Length -lt 1MB) { throw "shell exe suspiciously small: $($shellInfo.Length) bytes" }

if (-not $RuntimeSource) {
  $shim = Get-Command dsh.cmd -ErrorAction SilentlyContinue
  if (-not $shim) { $shim = Get-Command dsh -ErrorAction SilentlyContinue }
  if (-not $shim) { throw "cannot locate the global dsh install (dsh.cmd not on PATH); pass -RuntimeSource" }
  $RuntimeSource = Split-Path -Parent $shim.Source
}
$dshTree = Join-Path $RuntimeSource "node_modules\@deepseek-ai\dsh"
if (-not (Test-Path $dshTree)) { throw "harness tree not found: $dshTree (pass -RuntimeSource <dir containing node_modules>)" }

if (-not $DshVersion) {
  $manifest = Join-Path $dshTree "package.json"
  $DshVersion = (Get-Content $manifest -Raw | ConvertFrom-Json).version
}
if (-not $ShellVersion) {
  if (Test-Path (Join-Path $repoRoot ".git")) {
    $ShellVersion = (& git -C $repoRoot rev-parse --short HEAD).Trim()
  } else { $ShellVersion = "nogit" }
}

if (-not $NoNode) {
  if (-not $NodeExe) { $NodeExe = Join-Path $RuntimeSource "node.exe" }
  if (-not (Test-Path $NodeExe)) { throw "node executable not found: $NodeExe (pass -NodeExe, or use -NoNode)" }
  if (-not $NodeLicense) { $NodeLicense = Join-Path $RuntimeSource "LICENSE" }
}
$nodeVersion = if ($NoNode) { "(none)" } else { (& $NodeExe --version) }

$pkgName = "dsh-desktop-$ShellVersion-dsh$DshVersion-win-x64"
$staging = Join-Path $OutDir "staging"
$pkgDir = Join-Path $staging $pkgName
$zipPath = Join-Path $OutDir "$pkgName.zip"

Step "plan"
Write-Host "  repo        : $repoRoot"
Write-Host "  shell exe   : $ShellExe ($([math]::Round($shellInfo.Length/1MB,1)) MB, commit $ShellVersion)"
Write-Host "  harness tree: $dshTree (dsh $DshVersion)"
Write-Host "  node        : $(if ($NoNode) { 'not bundled (-NoNode)' } else { "$NodeExe ($nodeVersion, $([math]::Round((Get-Item $NodeExe).Length/1MB,1)) MB)" })"
Write-Host "  output      : $(if ($SkipZip) { $pkgDir } else { $zipPath })"

if ($CheckOnly) {
  Warn "check only - nothing written"
  exit 0
}

# --- stage --------------------------------------------------------------------
Step "1/4 staging the package"
if (Test-Path $pkgDir) { Remove-Item $pkgDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $pkgDir | Out-Null

Copy-Item $ShellExe (Join-Path $pkgDir "dsh-desktop.exe") -Force
Ok "shell exe staged"

if (-not $NoNode) {
  $rt = Join-Path $pkgDir "runtime"
  New-Item -ItemType Directory -Force -Path $rt | Out-Null
  Copy-Item $NodeExe (Join-Path $rt "node.exe") -Force
  if (Test-Path $NodeLicense) { Copy-Item $NodeLicense (Join-Path $rt "LICENSE") -Force }
  Ok "node.exe staged ($([math]::Round((Get-Item $NodeExe).Length/1MB,1)) MB)"

  # npm lays the dependency graph out differently depending on how it installed:
  #   * `npm install -g`      -> deps NESTED in @deepseek-ai/dsh/node_modules
  #   * `npm install --prefix` -> deps HOISTED to <root>/node_modules siblings
  # Copying only the dsh directory is correct for the first layout and produces a
  # broken runtime for the second (this shipped a broken 37.7 MB package in the
  # first CI release, 2026-09-20). Resolve the mode automatically, then VERIFY the
  # staged runtime really starts.
  $nestedDeps = Join-Path $dshTree "node_modules"
  $effectiveMode = $RuntimeMode
  if ($effectiveMode -eq "auto") {
    $effectiveMode = if (Test-Path $nestedDeps) { "dsh-tree" } else { "full-node-modules" }
    Ok "runtime layout: $effectiveMode (auto: nested deps $(if (Test-Path $nestedDeps) { 'present' } else { 'ABSENT -> hoisted' }))"
  }

  if ($effectiveMode -eq "full-node-modules") {
    # Copy the whole node_modules so hoisted siblings come along. RuntimeSource is
    # expected to be a dedicated prefix (its node_modules is exactly the closure).
    $rc = Start-Process -FilePath "robocopy" -ArgumentList @(
      (Join-Path $RuntimeSource "node_modules"), (Join-Path $rt "node_modules"),
      "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1"
    ) -Wait -PassThru -NoNewWindow
    if ($rc.ExitCode -ge 8) { throw "robocopy (node_modules) failed with exit code $($rc.ExitCode)" }
  } else {
    New-Item -ItemType Directory -Force -Path (Join-Path $rt "node_modules\@deepseek-ai") | Out-Null
    $rc = Start-Process -FilePath "robocopy" -ArgumentList @(
      $dshTree, (Join-Path $rt "node_modules\@deepseek-ai\dsh"),
      "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1"
    ) -Wait -PassThru -NoNewWindow
    if ($rc.ExitCode -ge 8) { throw "robocopy (harness tree) failed with exit code $($rc.ExitCode)" }
  }
  Ok "harness staged ($([math]::Round((DirSize (Join-Path $rt 'node_modules'))/1MB,1)) MB, $((Get-ChildItem (Join-Path $rt 'node_modules') -Recurse -File | Measure-Object).Count) files)"

  # GATE: the packaged runtime must actually load the harness. A layout mistake
  # (missing hoisted deps) fails here instead of shipping a broken release.
  # Strict check: exit code 0 AND the first output line is exactly the version
  # (matching the version anywhere in the output is not enough - the staging path
  # itself contains the version string, which once let an error stack pass).
  $rtEntry = Join-Path $rt "node_modules\@deepseek-ai\dsh\lib\bin.js"
  if (-not (Test-Path $rtEntry)) { throw "staged runtime is missing $rtEntry" }
  $probeRaw = (& (Join-Path $rt "node.exe") $rtEntry --version 2>&1 | Out-String)
  $probeExit = $LASTEXITCODE
  $probeFirst = (($probeRaw -split "`r?`n") | Where-Object { $_.Trim() -ne "" } | Select-Object -First 1)
  if ($null -eq $probeFirst) { $probeFirst = "" }
  $probeFirst = $probeFirst.Trim()
  if ($probeExit -ne 0 -or $probeFirst -ne $DshVersion) {
    throw ("staged runtime is NOT runnable (exit=$probeExit, first line='$probeFirst', expected='$DshVersion'). " +
      "Check -RuntimeMode / -RuntimeSource: hoisted layouts need -RuntimeMode full-node-modules.")
  }
  Ok "runtime self-check passed: bundled dsh reports $probeFirst"
  $global:LASTEXITCODE = 0

  # Bundle npm as well, so the portable shell can self-update into its own runtime
  # (same user-visible behaviour as the script install: check the registry, fetch
  # the newer harness, ask for a restart). npm is ~11 MB and is driven directly by
  # the bundled node: node runtime\node_modules\npm\bin\npm-cli.js ...
  if (-not $NoNpm) {
    $npmSrc = Join-Path (Split-Path $NodeExe -Parent) "node_modules\npm"
    if (-not (Test-Path $npmSrc)) {
      Warn "npm not found next to $NodeExe - package will not be able to self-update (pass -NoNpm to silence)"
    } else {
      $rc = Start-Process -FilePath "robocopy" -ArgumentList @(
        $npmSrc, (Join-Path $rt "node_modules\npm"),
        "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1"
      ) -Wait -PassThru -NoNewWindow
      if ($rc.ExitCode -ge 8) { throw "robocopy (npm) failed with exit code $($rc.ExitCode)" }
      $npmProbeRaw = (& (Join-Path $rt "node.exe") (Join-Path $rt "node_modules\npm\bin\npm-cli.js") --version 2>&1 | Out-String)
      $npmProbeExit = $LASTEXITCODE
      $npmProbe = (($npmProbeRaw -split "`r?`n") | Where-Object { $_.Trim() -ne "" } | Select-Object -First 1)
      if ($npmProbeExit -ne 0 -or -not ("$npmProbe".Trim() -match '^\d+\.\d+\.\d+')) {
        throw "bundled npm is not runnable (exit=$npmProbeExit, first line='$npmProbe')"
      }
      Ok "npm bundled and runnable ($($npmProbe.Trim()), $([math]::Round((DirSize (Join-Path $rt 'node_modules\npm'))/1MB,1)) MB)"
      $global:LASTEXITCODE = 0
    }
  } else {
    Warn "npm not bundled (-NoNpm): the portable shell will not self-update"
  }
}

$pluginsSrc = Join-Path $repoRoot "plugins"
$pluginsDst = Join-Path $pkgDir "plugins"
New-Item -ItemType Directory -Force -Path $pluginsDst | Out-Null
Get-ChildItem $pluginsSrc -Directory | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $pluginsDst $_.Name) -Recurse -Force
}
$pluginCount = (Get-ChildItem $pluginsDst -Directory | Measure-Object).Count
Ok "$pluginCount plugin package(s) staged"

New-Item -ItemType Directory -Force -Path (Join-Path $pkgDir "scripts") | Out-Null
Copy-Item (Join-Path $repoRoot "scripts\setup-plugins.mjs") (Join-Path $pkgDir "scripts\setup-plugins.mjs") -Force
Copy-Item (Join-Path $repoRoot "install-offline.ps1") (Join-Path $pkgDir "install-offline.ps1") -Force
Copy-Item (Join-Path $repoRoot "install-offline.cmd") (Join-Path $pkgDir "install-offline.cmd") -Force
Ok "installer (install-offline.ps1 + .cmd wrapper) + setup-plugins.mjs staged"

# --- metadata -----------------------------------------------------------------
Step "2/4 writing VERSION.txt / README.txt"
$versionText = @"
dsh-desktop portable release
package:   $pkgName
built:     $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
shell:     commit $ShellVersion (from $repoRoot)
harness:   @deepseek-ai/dsh $DshVersion (bundled, offline)
node:      $(if ($NoNode) { 'not bundled' } else { "$nodeVersion (bundled)" })
npm:       $(if ($NoNode -or $NoNpm) { 'not bundled (no self-update)' } else { 'bundled (enables in-package self-update)' })
plugins:   $pluginCount package(s)
port:      43080 (fixed; bare URL answers 401 until the token URL is opened)
contents:  dsh-desktop.exe, runtime\, plugins\, scripts\, install-offline.ps1 (+ .cmd wrapper)
"@
Set-Content -Path (Join-Path $pkgDir "VERSION.txt") -Value $versionText -Encoding utf8

$readmeText = @"
dsh-desktop portable release ($pkgName)
=======================================

This package is self-contained: no Node.js, npm, Go or Wails needed.
There is NO installer - it is portable, just unzip and run.

Quick start
-----------
1. Unzip anywhere (for example D:\dsh-desktop-portable).
2. Run dsh-desktop.exe in that folder.
   It starts (or reuses) the harness and opens the Web UI in your browser.

Optional: install the 4 custom plugins into your DSH home
--------------------------------------------------------
Double-click install-offline.cmd      (recommended; it asks which plugins)
   or:  powershell -ExecutionPolicy Bypass -File install-offline.ps1
        add -Plugins all | none | ask | explainer,core-version to choose.

This copies the bundled plugins into %USERPROFILE%\.dsh and adds their entries
to the profile patch. Use -DSHome <dir> to target another home, and
-AppDir <dir> to also copy the shell into an app directory.

Requirements
------------
* Windows 10/11 with the WebView2 Runtime (shipped with Windows; if the window
  stays blank, install "Microsoft Edge WebView2 Runtime").
* Nothing else. The bundled runtime\ provides Node.js and the harness.

Notes
-----
* Keep the folder layout intact - the shell resolves runtime\ next to the exe.
* The shell is SINGLE-INSTANCE per user: if another dsh-desktop (installed or
  older portable copy) is already running, this one exits and just shows that
  window. Close it first when trying the portable build next to an install.
* API keys / .env are NOT included; configure them per machine.
* The build is unsigned: Windows SmartScreen may warn on first run
  ("More info" -> "Run anyway").
* Plugin changes need a full shell restart to take effect.
* Port 43080 is fixed; a bare http://127.0.0.1:43080/ answers 401 by design.
* Logs: %APPDATA%\dsh-desktop\ (dsh.log, debug.log; rotated at 5 MiB / 1 MiB).

Update
------
The shell checks the npm registry at startup and every 24 h - exactly like the
source/script install - and downloads a newer harness with the bundled npm. The
new version is installed into a staging folder and swapped in on the next start
("check for updates" -> restart), so nothing is replaced while dsh is running.
You can always unzip a newer package over this folder instead; your $DSH_HOME
(sessions, settings, plugins) is kept separately and is not touched.
"@
Set-Content -Path (Join-Path $pkgDir "README.txt") -Value $readmeText -Encoding utf8
Ok "metadata written"

# --- zip ----------------------------------------------------------------------
Step "3/4 zipping"
if ($SkipZip) {
  Warn "zip skipped (-SkipZip); staged at $pkgDir"
} else {
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  & tar.exe -a -cf $zipPath -C $staging $pkgName
  if ($LASTEXITCODE -ne 0) { throw "tar failed with exit code $LASTEXITCODE" }
  Ok "zip written in $([math]::Round($sw.Elapsed.TotalSeconds,1))s: $zipPath ($([math]::Round((Get-Item $zipPath).Length/1MB,1)) MB)"
}

Step "4/4 checksums"
$rawSize = DirSize $pkgDir
if (-not $SkipZip) {
  $hash = (Get-FileHash $zipPath -Algorithm SHA256).Hash
  $sums = Join-Path $OutDir "SHA256SUMS.txt"
  "$hash  $pkgName.zip" | Set-Content -Path $sums -Encoding ascii
  Ok "SHA256 -> $sums"
}
Write-Host ""
Write-Host "package : $pkgName"
Write-Host "raw     : $([math]::Round($rawSize/1MB,1)) MB ($((Get-ChildItem $pkgDir -Recurse -File | Measure-Object).Count) files)"
if (-not $SkipZip) { Write-Host "zipped  : $([math]::Round((Get-Item $zipPath).Length/1MB,1)) MB" }

if (-not $KeepStaging) {
  Remove-Item $pkgDir -Recurse -Force
  Ok "staging removed (use -KeepStaging to inspect)"
} else {
  Warn "staging kept at $pkgDir"
}
