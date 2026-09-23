# pack-release.ps1 - build the portable (offline) dsh-desktop release package.
#
# Produces one zip that needs NOTHING on the target machine (no Node, no npm,
# no Go/Wails):
#
#   dsh-desktop-<shell>-dsh<dshver>-win-x64\
#     dsh-desktop.exe              the launcher (resolves .\runtime next to itself)
#     runtime.zip                  ONE file: node.exe + npm + the harness tree;
#                                  the shell unpacks it to runtime\ on first start
#     plugins\<all bundled>        the custom plugins (listed by --describe / README.txt)
#     scripts\setup-plugins.mjs    installer used by install-offline.ps1
#     install-offline.ps1 (+ .cmd) installs plugins into $DSH_HOME (+ optional app dir)
#     update-plugins.ps1 (+ .cmd)  refreshes ONLY the plugins already installed
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
#   pwsh -File scripts\pack-release.ps1 -NoRuntimeArchive      # keep runtime\ as loose files
#   pwsh -File scripts\pack-release.ps1 -CheckOnly             # plan only
#   pwsh -File scripts\pack-release.ps1 -KeepOldPackages       # do not prune older zips in -OutDir
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
  [switch]$NoRuntimeArchive,
  [switch]$SkipZip,
  [switch]$KeepStaging,
  [switch]$KeepOldPackages,
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
      # Hard failure on purpose: a package without npm silently loses the
      # self-update capability that the release promises (this shipped once,
      # 2026-09-20 - the CI only copied node.exe, so the packer skipped npm).
      throw "npm not found at $npmSrc - the package could not self-update. Stage npm next to node.exe, or pass -NoNpm to opt out explicitly."
    }
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
  } else {
    Warn "npm not bundled (-NoNpm): the portable shell will not self-update"
  }

  # Ship the whole runtime as ONE file. Copying an unpacked package means copying
  # ~27k tiny files (89% under 8 KB), which on Windows costs ~89 s with a
  # single-threaded copy vs ~14 s multithreaded - and much more over USB/network.
  # runtime.zip is extracted by the shell on first start (see HANDOVER §27.11).
  if (-not $NoRuntimeArchive) {
    $rtArchive = Join-Path $pkgDir "runtime.zip"
    if (Test-Path $rtArchive) { Remove-Item $rtArchive -Force }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    & tar.exe -a -cf $rtArchive -C $rt .
    if ($LASTEXITCODE -ne 0) { throw "tar (runtime.zip) failed with exit code $LASTEXITCODE" }
    $entries = @(& tar.exe -tf $rtArchive)
    if (-not ($entries | Where-Object { $_ -match 'node_modules[/\\]@deepseek-ai[/\\]dsh[/\\]lib[/\\]bin\.js$' })) {
      throw "runtime.zip does not contain the dsh entry - refusing to ship it"
    }
    if (-not $NoNpm -and -not ($entries | Where-Object { $_ -match 'node_modules[/\\]npm[/\\]bin[/\\]npm-cli\.js$' })) {
      throw "runtime.zip does not contain npm - refusing to ship it"
    }
    Ok "runtime.zip written in $([math]::Round($sw.Elapsed.TotalSeconds,1))s ($([math]::Round((Get-Item $rtArchive).Length/1MB,1)) MB, $($entries.Count) entries)"
    Remove-Item $rt -Recurse -Force
    Ok "runtime directory replaced by the single-file archive (first start unpacks it)"
  } else {
    Warn "runtime kept as a directory (-NoRuntimeArchive): slow to copy, shell extracts nothing"
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
# The standalone updater: refresh the plugins ALREADY installed in a DSH home
# (content-hash based, with backup + rollback) without running the full installer.
Copy-Item (Join-Path $repoRoot "scripts\update-plugins.ps1") (Join-Path $pkgDir "update-plugins.ps1") -Force
Copy-Item (Join-Path $repoRoot "scripts\update-plugins.cmd") (Join-Path $pkgDir "update-plugins.cmd") -Force
Ok "installer (install-offline.ps1 + .cmd wrapper) + update-plugins.ps1/.cmd + setup-plugins.mjs staged"

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
contents:  dsh-desktop.exe, runtime.zip (unpacked on first start), plugins\, scripts\, install-offline.ps1 (+ .cmd wrapper)
"@
Set-Content -Path (Join-Path $pkgDir "VERSION.txt") -Value $versionText -Encoding utf8

# Plugin descriptions come from scripts/setup-plugins.mjs --describe (single
# source of truth, shared with the installer menu and the repo README).
$catalogueText = ""
try {
  $describeNode = if (Test-Path $NodeExe) { $NodeExe } else { "node" }
  $rawCatalogue = (& $describeNode (Join-Path $repoRoot "scripts\setup-plugins.mjs") --describe --ascii 2>$null | Out-String)
  if ($LASTEXITCODE -eq 0 -and $rawCatalogue.Trim()) {
    # 5.1 hands back the JSON array as ONE object, 7 enumerates it; normalize so the
    # generated README.txt keeps its per-plugin descriptions on both engines (§34).
    $catalogue = @($rawCatalogue | ConvertFrom-Json) | ForEach-Object { $_ }
    $catalogueText = (($catalogue | ForEach-Object {
      "  {0}) {1}" -f $_.index, $_.short
      "       $($_.title) - $($_.summary)"
      if ($_.where) { "       位置：$($_.where)" }
    }) -join "`r`n")
    $global:LASTEXITCODE = 0
  }
} catch { $catalogueText = "" }
if (-not $catalogueText) { $catalogueText = "  (run: node scripts\setup-plugins.mjs --describe)" }

$readmeText = @"
dsh-desktop portable release ($pkgName)
=======================================

This package is self-contained: no Node.js, npm, Go or Wails needed.
There is NO installer - it is portable, just unzip and run.

Quick start
-----------
1. Unzip anywhere (for example D:\dsh-desktop-portable).
2. Run dsh-desktop.exe in that folder.
   The FIRST start unpacks the bundled runtime (runtime.zip -> runtime\, ~30-60 s,
   one time only; the status panel shows the progress). After that it starts fast.
   It then opens the Web UI in your browser.

Copying this package around
---------------------------
The runtime is a single file (runtime.zip) on purpose: an unpacked runtime is
~27,000 mostly tiny files and copying that on Windows costs minutes. So:
  * move the ZIP, not the unpacked folder; or
  * if you must copy the folder, use multithreaded robocopy, which is several
    times faster for many small files:
      robocopy <src> <dst> /E /MT:16 /NFL /NDL /NJH /NJS /NP /R:1 /W:1
  * extract with `tar -xf <pkg>.zip -C <dir>` (built into Windows 10+) or 7-Zip;
    Explorer's "Extract All" is the slowest option.

Optional: install the custom plugins into your DSH home
-------------------------------------------------------
The package ships these plugins (all are optional UI enhancements):

$catalogueText

Double-click install-offline.cmd      (recommended; it lists the descriptions above
                                       and asks which ones you want)
   or:  powershell -ExecutionPolicy Bypass -File install-offline.ps1
        add -Plugins all | none | ask | 2,4 | explainer,project-explorer
        Numbers are the ones listed above; separate several with commas (2,4).
        An invalid answer installs nothing (nothing is guessed).
        -CheckOnly lists the plugins and what would happen, without changing anything.
        -SkipPlugins skips this step entirely.

This copies the chosen plugins into %USERPROFILE%\.dsh and adds their entries
to the profile patch. Plugins that are already installed are never removed here -
the installer only adds/updates what you pick. Use -DSHome <dir> to target
another home, and -AppDir <dir> to also copy the shell into an app directory.

Updating plugins later (already-installed machines)
---------------------------------------------------
Double-click update-plugins.cmd    (or: powershell -ExecutionPolicy Bypass -File update-plugins.ps1)
It compares the bundled copies with what is installed (content hash, not version
numbers) and only rewrites what actually changed:

    update-plugins.cmd                     # update the plugins already installed
    update-plugins.cmd -CheckOnly           # just report 已是最新 / 待更新 / 未安装
    update-plugins.cmd -Plugins all         # also install any that are missing
    update-plugins.cmd -Plugins 2,4         # numbered multi-select (same numbers as above)
    update-plugins.cmd -DSHome <dir>        # a different DSH home

Before overwriting it keeps a backup of the old copies; if the new copy fails its
verification the previous one is restored automatically (the backup folder is
kept for inspection in that case). Restart the shell afterwards to load changes.

Requirements
------------
* Windows 10/11 with the WebView2 Runtime (shipped with Windows; if the window
  stays blank, install "Microsoft Edge WebView2 Runtime").
* Nothing else. The bundled runtime\ provides Node.js and the harness.

Notes
-----
* Keep the folder layout intact - the shell resolves runtime\ (or runtime.zip) next
  to the exe. Deleting runtime.zip after the first start is safe (runtime\ exists
  by then), but keep it if you want a copyable single-file package.
* The shell is SINGLE-INSTANCE per user: if another dsh-desktop (installed or
  older portable copy) is already running, this one exits and just shows that
  window. Close it first when trying the portable build next to an install.
* API keys / .env are NOT included; configure them per machine.
* The build is unsigned: Windows SmartScreen may warn on first run
  ("More info" -> "Run anyway").
* Plugin changes need a full shell restart to take effect.
* Port 43080 is fixed; a bare http://127.0.0.1:43080/ answers 401 by design.
* Logs: %APPDATA%\dsh-desktop\ (dsh.log, debug.log; rotated at 5 MiB / 1 MiB).
* First start only: `dsh-desktop.exe --extract-runtime` unpacks the runtime
  without opening the window (useful for scripts/installs).

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

  # Keep exactly ONE release package in the output folder (this build), so that
  # folder is always "the latest official build to copy" - see HANDOVER §32.
  if (-not $KeepOldPackages) {
    Get-ChildItem $OutDir -File -Filter "dsh-desktop-*.zip" |
      Where-Object { $_.FullName -ne (Get-Item $zipPath).FullName } |
      ForEach-Object { Remove-Item $_.FullName -Force; Ok "removed older package $($_.Name)" }
  }
  $latest = Join-Path $OutDir "LATEST.txt"
  @(
    "dsh-desktop portable release - latest local copy"
    "file    : $pkgName.zip"
    "version : $ShellVersion (harness @deepseek-ai/dsh $DshVersion)"
    "built   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    "size    : $([math]::Round((Get-Item $zipPath).Length/1MB,1)) MB"
    "sha256  : $hash"
    ""
    "Copy THIS zip to another machine, then unzip it and run dsh-desktop.exe."
    "(the output folder keeps only the newest package; -KeepOldPackages disables pruning)"
  ) | Set-Content -Path $latest -Encoding utf8
  Ok "LATEST.txt -> $latest"
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
