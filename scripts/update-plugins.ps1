# update-plugins.ps1 — install/refresh ONLY the custom dsh plugins.
#
# Purpose: a machine that already has plugins installed can pull the newest copies
# without running the whole package installer. Works both in the repo
# (plugins\ + scripts\ next to this file) and inside a portable release package.
#
#   pwsh -File scripts\update-plugins.ps1                 # update the plugins already installed
#   pwsh -File scripts\update-plugins.ps1 -CheckOnly       # only report, write nothing
#   pwsh -File scripts\update-plugins.ps1 -Plugins all     # ensure every bundled plugin
#   pwsh -File scripts\update-plugins.ps1 -Plugins 2,4     # numbered multi-select
#   pwsh -File scripts\update-plugins.ps1 -DSHome D:\h     # a different DSH home
#
# Guarantees:
#   * "已是最新" is decided by CONTENT HASH of the install payload
#     (package.json + lib/**), computed by setup-plugins.mjs --status — one place.
#   * Before touching anything, the current copies are backed up; if the install
#     or its verification fails, the previous copies are restored (rollback).
#   * -CheckOnly never writes (not even a backup).
param(
  [string]$Plugins = "installed",
  [string]$DSHome = "",
  [switch]$CheckOnly,
  [switch]$Force,
  [switch]$NoBackup
)
$ErrorActionPreference = "Stop"

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    [!!] $m" -ForegroundColor Yellow }

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)   # repo root or package root
if (-not (Test-Path (Join-Path $root "plugins"))) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
$pluginsDir = Join-Path $root "plugins"
$pluginScript = Join-Path $root "scripts\setup-plugins.mjs"
$runtimeDir = Join-Path $root "runtime"
$runtimeArchive = Join-Path $root "runtime.zip"
$exe = Join-Path $root "dsh-desktop.exe"

Write-Host "dsh-desktop plugin updater" -ForegroundColor Magenta
Write-Host "source   : $root"
Write-Host "checkOnly: $CheckOnly   force: $Force   backup: $(-not $NoBackup)"

if (-not $DSHome) { $DSHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" } }
if ($DSHome.StartsWith("~")) { $DSHome = $env:USERPROFILE + $DSHome.Substring(1) }
if (-not [System.IO.Path]::IsPathRooted($DSHome)) { $DSHome = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $DSHome)) }
$packagesDir = Join-Path $DSHome "profiles\node_modules"
# Must be set BEFORE asking setup-plugins.mjs about the state: otherwise --status
# would report the default ~/.dsh instead of the home the caller asked for.
$env:DSH_HOME = $DSHome

# --- node ---------------------------------------------------------------------
function Resolve-Node {
  $bundled = Join-Path $runtimeDir "node.exe"
  if (Test-Path $bundled) { return $bundled }
  if ((Test-Path $runtimeArchive) -and (Test-Path $exe)) {
    Warn "no runtime\ yet - unpacking runtime.zip with the shell's own CLI"
    if (-not $CheckOnly) {
      $p = Start-Process -FilePath $exe -ArgumentList "--extract-runtime" -Wait -PassThru -NoNewWindow
      if ($p.ExitCode -eq 0 -and (Test-Path $bundled)) { return $bundled }
      Warn "shell extraction failed (exit $($p.ExitCode))"
    }
  }
  $onPath = Get-Command node -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  return ""
}

Step "1/3 checking the layout"
foreach ($p in @($pluginsDir, $pluginScript)) {
  if (-not (Test-Path $p)) { throw "not a plugin source tree, missing: $p" }
}
if (-not (Test-Path $packagesDir)) {
  if ($CheckOnly) {
    # -CheckOnly must not touch the disk at all, not even to create directories.
    Warn "no plugins installed yet ($packagesDir does not exist) - would be created"
  } else {
    New-Item -ItemType Directory -Force -Path $packagesDir | Out-Null
    Ok "created $packagesDir"
  }
}
$nodeCmd = Resolve-Node
if (-not $nodeCmd) {
  throw "no node available: expected runtime\node.exe next to this script (or run install-offline.ps1 once), or node on PATH"
}
Ok "node: $nodeCmd"
Ok "DSH_HOME: $DSHome"

# --- state --------------------------------------------------------------------
Step "2/3 current state (source vs installed)"
function Get-Status {
  $raw = (& $nodeCmd $pluginScript --status 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "setup-plugins.mjs --status failed: $raw" }
  return @($raw | ConvertFrom-Json)
}
$status = @(Get-Status | Sort-Object index)
$total = $status.Count
$installedRows = @($status | Where-Object { $_.installed })
$outdated = @($status | Where-Object { $_.state -eq "outdated" })
$missing = @($status | Where-Object { $_.state -eq "missing" })

$stateText = { param($r) switch ($r.state) { "current" { "已是最新" } "outdated" { "待更新" } default { "未安装" } } }
foreach ($r in $status) {
  $mark = & $stateText $r
  $color = switch ($r.state) { "current" { "DarkGray" } "outdated" { "Yellow" } default { "DarkGray" } }
  Write-Host ("  {0,2}) {1,-18} {2,-10} {3}" -f $r.index, $r.short, $mark, $r.title) -ForegroundColor $color
}
Write-Host ("     -> 已安装 {0} / 待更新 {1} / 未安装 {2}（源共 {3} 个）" -f $installedRows.Count, $outdated.Count, $missing.Count, $total)

# --- selection ----------------------------------------------------------------
function Resolve-Selection {
  param([string]$Value, $Rows)
  $v = if ($null -eq $Value) { "" } else { $Value.Trim() }
  if ($v -eq "" -or $v -ieq "installed") { return @($Rows | Where-Object { $_.installed }) }
  if ($v -ieq "all") { return @($Rows) }
  if ($v -ieq "none") { return @() }
  if ($v -ieq "ask") {
    if (-not [Environment]::UserInteractive -or [Console]::IsInputRedirected) {
      Warn "no interactive console - using the installed plugins"
      return @($Rows | Where-Object { $_.installed })
    }
    Write-Host ""
    Write-Host "Which plugins should be updated in $DSHome ?" -ForegroundColor Cyan
    Write-Host "  多选请用逗号隔开（multi-select: separate numbers with commas, e.g. 2,4）" -ForegroundColor DarkGray
    foreach ($r in $Rows) { Write-Host ("  {0,2}) {1,-18} {2,-10} {3}" -f $r.index, $r.short, (& $stateText $r), $r.title) }
    Write-Host "   a) all of them (全部)   n) none (取消)"
    $answer = Read-Host "Numbers, comma-separated (e.g. 2,4), or a / n   [default a]"
    if ([string]::IsNullOrWhiteSpace($answer) -or $answer -ieq "a") { return @($Rows) }
    if ($answer -ieq "n") { return @() }
    $picked = @()
    $bad = @()
    foreach ($token in ($answer -split '[,\s]+')) {
      $t = $token.Trim(); if ($t -eq "") { continue }
      $hit = $null
      if ($t -match '^\d+$') { $hit = $Rows | Where-Object { $_.index -eq [int]$t } | Select-Object -First 1 }
      else { $hit = $Rows | Where-Object { $_.short -ieq $t -or $_.name -ieq $t -or $_.patchId -ieq $t } | Select-Object -First 1 }
      if ($null -eq $hit) { $bad += $t; continue }
      if (-not ($picked | Where-Object { $_.short -eq $hit.short })) { $picked += $hit }
    }
    if ($bad.Count -gt 0) {
      Warn "invalid choice: $($bad -join ', ') -- valid numbers are $(($Rows | ForEach-Object { $_.index }) -join '/')"
      Warn "nothing will be updated"
      return @()
    }
    return $picked
  }
  # numbers / names
  $picked = @()
  $bad = @()
  foreach ($token in ($v -split '[,\s]+')) {
    $t = $token.Trim(); if ($t -eq "") { continue }
    $hit = $null
    if ($t -match '^\d+$') { $hit = $Rows | Where-Object { $_.index -eq [int]$t } | Select-Object -First 1 }
    else { $hit = $Rows | Where-Object { $_.short -ieq $t -or $_.name -ieq $t -or $_.patchId -ieq $t } | Select-Object -First 1 }
    if ($null -eq $hit) { $bad += $t; continue }
    if (-not ($picked | Where-Object { $_.short -eq $hit.short })) { $picked += $hit }
  }
  if ($bad.Count -gt 0) { throw "-Plugins $v : invalid choice: $($bad -join ', ') (valid: $(($Rows | ForEach-Object { $_.index }) -join '/') or names)" }
  return $picked
}

$selection = @(Resolve-Selection -Value $Plugins -Rows $status)
if ($selection.Count -eq 0) {
  if ($installedRows.Count -eq 0) {
    Warn "no plugins are installed in this DSH home - use -Plugins all (or run install-offline.cmd)"
  } else {
    Warn "nothing selected"
  }
  Write-Host ""
  Write-Host "done (nothing changed)" -ForegroundColor Green
  exit 0
}

$todo = if ($Force) { $selection } else { @($selection | Where-Object { $_.state -ne "current" }) }
$skipped = @($selection | Where-Object { $_.state -eq "current" -and -not $Force })
if ($CheckOnly) {
  Write-Host ""
  Write-Host "would update:" -ForegroundColor Cyan
  if ($todo.Count -eq 0) { Write-Host "  (nothing - all selected plugins are already current)" -ForegroundColor DarkGray }
  foreach ($r in $todo) {
    $want = switch ($r.state) { "outdated" { "更新（内容已变化）" } default { "安装（当前未装）" } }
    Write-Host ("  {0,-18} {1}" -f $r.short, $want)
  }
  if ($skipped.Count -gt 0) { Write-Host ("  (skipped, already current: " + (($skipped | ForEach-Object { $_.short }) -join ", ") + ")") -ForegroundColor DarkGray }
  Write-Host ""
  Write-Host "CHECK ONLY - nothing written." -ForegroundColor Green
  exit 0
}

if ($todo.Count -eq 0) {
  Write-Host ""
  Ok "all selected plugins are already up to date"
  Write-Host "done (nothing changed)" -ForegroundColor Green
  exit 0
}

# --- backup -------------------------------------------------------------------
Step "3/3 updating $(($todo | ForEach-Object { $_.short }) -join ', ')"
$backupRoot = Join-Path $packagesDir (".backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$backedUp = @()
$toBackup = @($todo | Where-Object { $_.installed })
if ($NoBackup) {
  Ok "backup disabled (-NoBackup)"
} elseif ($toBackup.Count -eq 0) {
  Ok "nothing to back up (fresh install of all selected plugins)"
} else {
  # Create the backup folder lazily: a fresh install must not litter node_modules.
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  foreach ($r in $toBackup) {
    $src = Join-Path $packagesDir $r.name
    if (Test-Path $src) {
      Copy-Item $src (Join-Path $backupRoot $r.name) -Recurse -Force
      $backedUp += $r
    }
  }
  if ($backedUp.Count -gt 0) { Ok "backed up $($backedUp.Count) plugin(s) -> $backupRoot" }
  else { Ok "nothing to back up (fresh install)" }
}

$list = ($todo | ForEach-Object { $_.short }) -join ","
Write-Host "    running : $nodeCmd $pluginScript --plugins $list"
& $nodeCmd $pluginScript "--plugins" $list
$installExit = $LASTEXITCODE

if ($installExit -ne 0) {
  Warn "plugin install failed (exit $installExit)"
  if ($backedUp.Count -gt 0) {
    foreach ($r in $backedUp) {
      $dst = Join-Path $packagesDir $r.name
      Remove-Item $dst -Recurse -Force -ErrorAction SilentlyContinue
      Copy-Item (Join-Path $backupRoot $r.name) $dst -Recurse -Force
    }
    Ok "rolled back $($backedUp.Count) plugin(s) to the previous copies"
    Warn "backup kept for inspection: $backupRoot"
  }
  throw "update failed - see the output above"
}

if ($backedUp.Count -gt 0) { Remove-Item $backupRoot -Recurse -Force -ErrorAction SilentlyContinue }

$after = @(Get-Status | Sort-Object index)
Write-Host ""
foreach ($r in $todo) {
  $now = $after | Where-Object { $_.short -eq $r.short } | Select-Object -First 1
  $was = if ($r.installed) { $r.installedHash } else { "(未安装)" }
  Write-Host ("  {0,-18} {1} -> {2}  {3}" -f $r.short, $was, $now.installedHash, $(if ($now.state -eq "current") { "OK" } else { "仍不一致！" })) -ForegroundColor $(if ($now.state -eq "current") { "Green" } else { "Red" })
}
Write-Host ""
Write-Host "done" -ForegroundColor Green
Write-Host "  * 重启壳（完全退出再打开）后新版本才生效；client bundle 改动刷新页面即可。"
Write-Host "  * 只加不减：没选的插件不会被移除（要停用请用「插件说明」面板的开关）。"
