# deploy-shell.ps1 - put a freshly built shell exe into the app area.
#
# Shared by setup.ps1 (first install) and update.ps1 (later updates) so that both
# land in the SAME place: <AppDir>\dsh-desktop.exe, with a dated archive and a
# VERSION.txt next to it. Before 2026-09-15 setup.ps1 left the exe in
# <repo>\build\bin and only update.ps1 deployed to the app area, which produced
# two candidate launch paths on a fresh machine (see HANDOVER path N).
#
# Usage (normally called by setup.ps1 / update.ps1, runnable on its own too):
#   pwsh -File scripts\deploy-shell.ps1 -BuiltExe build\bin\dsh-desktop.exe
#   pwsh -File scripts\deploy-shell.ps1 -BuiltExe ... -AppDir D:\dsh\app\current
#   pwsh -File scripts\deploy-shell.ps1 -BuiltExe ... -CheckOnly
#
# Behaviour:
#   * archives the previous/current build to <appRoot>\versions\<date>\dsh-desktop-<HHmmss>.exe
#   * copies the new exe over <AppDir>\dsh-desktop.exe, verifying the size
#   * when the target exe is LOCKED (the shell is running), stages it as
#     <AppDir>\dsh-desktop.new.exe + VERSION.new.txt instead of failing
#   * writes VERSION.txt (built/deployed time, source commit, port, core version)
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8
# scripts with non-ASCII content; keeping it ASCII sidesteps that entirely).
param(
  [Parameter(Mandatory = $true)][string]$BuiltExe,
  [string]$AppDir = "D:\dsh\app\current",
  [string]$RepoRoot = "",
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path) }

function Ok($m)   { Write-Host "    [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    [!!] $m" -ForegroundColor Yellow }

$target = Join-Path $AppDir "dsh-desktop.exe"

if ($CheckOnly) {
  Warn "would deploy $BuiltExe -> $target (+ dated archive + VERSION.txt)"
  exit 0
}

if (-not (Test-Path $BuiltExe)) { throw "built exe not found: $BuiltExe" }
$builtInfo = Get-Item $BuiltExe
if ($builtInfo.Length -lt 1MB) { throw "built exe suspiciously small: $($builtInfo.Length) bytes" }

$drive = Split-Path -Qualifier $AppDir
if (-not (Test-Path $drive)) {
  Warn "drive $drive does not exist - deploy skipped; exe stays at $BuiltExe"
  exit 0
}

New-Item -ItemType Directory -Force -Path $AppDir | Out-Null

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
Copy-Item $BuiltExe $archive -Force
Ok "archived -> $archive"

$commit = "(unknown)"
if (Test-Path (Join-Path $RepoRoot ".git")) {
  $commit = (& git -C $RepoRoot rev-parse --short HEAD).Trim()
}
$dshVer = (& cmd /c "dsh --version 2>nul")
$versionText = @"
dsh-desktop launcher
built:    $($builtInfo.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
deployed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
source:   $RepoRoot (commit $commit)
port:     43080
core:     @deepseek-ai/dsh $dshVer (global npm)
launch:   $target
"@

if ($locked) {
  $staged = Join-Path $AppDir "dsh-desktop.new.exe"
  Copy-Item $BuiltExe $staged -Force
  Set-Content -Path (Join-Path $AppDir "VERSION.new.txt") -Value $versionText -Encoding utf8
  Warn "target exe is locked (the shell is running): staged as $staged"
  Warn "close the shell, then rename dsh-desktop.new.exe over dsh-desktop.exe"
  Warn "(or run: pwsh -File .work\swap-desktop-exe.ps1 -NoRelaunch / as a one-shot Scheduled Task)"
  exit 0
}

Copy-Item $BuiltExe $target -Force
$newInfo = Get-Item $target
if ($newInfo.Length -ne $builtInfo.Length) {
  throw "size mismatch after copy ($($newInfo.Length) vs $($builtInfo.Length))"
}
Set-Content -Path (Join-Path $AppDir "VERSION.txt") -Value $versionText -Encoding utf8
Remove-Item (Join-Path $AppDir "VERSION.new.txt") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $AppDir "dsh-desktop.new.exe") -Force -ErrorAction SilentlyContinue
Ok "deployed -> $target ($($newInfo.Length) bytes)"
Write-Host "    launch this exe (it is the single launch entry): $target"
exit 0
