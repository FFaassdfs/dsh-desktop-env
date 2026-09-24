# backup-dsh-home.ps1 - back up the irreplaceable parts of $DSH_HOME.
#
# WHY THIS EXISTS (2026-09-24, HANDOVER 42.6/42.9):
#   A rebuild of $DSH_HOME silently wiped every session, the model-provider
#   config (settings.yaml) and the SSH keys. Nothing under %USERPROFILE%\.dsh
#   is version-controlled or backed up anywhere, so "reinstall and unzip again"
#   - the natural reaction to a broken shell - can destroy months of history.
#   This is the only important data in this project with no safety net.
#
# WHAT IT COPIES (user data, not reproducible):
#   sessions\                     conversation history
#   storages\                     workspace / project cache
#   .credentials.yaml             API keys            <-- most painful to lose
#   settings.yaml                 model providers, default model
#   AGENTS.md                     global preset
#   profiles\web\cordis.patch.yml which plugins are enabled
#   .anonymous-user-id            stable anonymous id
#
# WHAT IT DELIBERATELY SKIPS (large / reproducible):
#   profiles\node_modules\   (the installed plugins - reinstall with setup-plugins.mjs)
#   .update\, caches, logs
#
# Usage:
#   pwsh -File .work\backup-dsh-home.ps1                    # back up to D:\dsh\backups
#   pwsh -File .work\backup-dsh-home.ps1 -OutDir E:\dshbak  # somewhere else
#   pwsh -File .work\backup-dsh-home.ps1 -Keep 30           # keep 30 newest (default 20)
#   pwsh -File .work\backup-dsh-home.ps1 -CheckOnly         # show what would happen
#   pwsh -File .work\backup-dsh-home.ps1 -DSHome D:\dsh-home
#
# Exit codes: 0 = ok (or nothing to do), 1 = failure.
#
# NOTE: ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8
# scripts with non-ASCII content).
param(
  [string]$DSHome = "",
  [string]$OutDir = "D:\dsh\backups",
  [int]$Keep = 20,
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    [!!] $m" -ForegroundColor Yellow }

if (-not $DSHome) { $DSHome = Join-Path $env:USERPROFILE ".dsh" }

Write-Host "dsh-desktop: back up DSH_HOME" -ForegroundColor Magenta
Write-Host "  DSH_HOME : $DSHome"
Write-Host "  OutDir   : $OutDir"
Write-Host "  Keep     : $Keep"
Write-Host "  CheckOnly: $CheckOnly"

if (-not (Test-Path $DSHome)) { throw "DSH_HOME not found: $DSHome" }

# --- what to back up (relative paths inside DSH_HOME) -------------------------
# Only user data: everything here is either impossible or painful to recreate.
$targets = @(
  "sessions",
  "storages",
  ".credentials.yaml",
  "settings.yaml",
  "AGENTS.md",
  ".anonymous-user-id",
  "profiles\web\cordis.patch.yml"
)

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $OutDir "dsh-home-$stamp"

# --- report what exists, and refuse to call an empty backup a success ---------
Step "1/4 inspecting the sources"
$found = @()
foreach ($rel in $targets) {
  $src = Join-Path $DSHome $rel
  if (Test-Path $src) {
    $n = if ((Get-Item $src).PSIsContainer) { (Get-ChildItem $src -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count } else { 1 }
    Ok ("{0,-34} {1} file(s)" -f $rel, $n)
    $found += $rel
  } else {
    Warn ("{0,-34} absent (skipped)" -f $rel)
  }
}
if ($found.Count -eq 0) { throw "nothing to back up - is $DSHome really a DSH_HOME?" }

# sessions\ is the whole point of this script; if it is missing the backup is
# not doing its job, and a silent success would be worse than a loud failure.
if ($found -notcontains "sessions") { Warn "sessions\ is missing - the backup will not contain any conversation history" }

if ($CheckOnly) {
  Step "check only - nothing written"
  Write-Host "    would create: $dest"
  exit 0
}

# --- copy ---------------------------------------------------------------------
Step "2/4 copying"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($rel in $found) {
  $src = Join-Path $DSHome $rel
  $dst = Join-Path $dest $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
  if ((Get-Item $src).PSIsContainer) {
    # robocopy is far faster than Copy-Item on many small files; /NFL /NDL /NJH
    # /NJS keep its output quiet, and exit codes < 8 mean success.
    $null = robocopy $src $dst /E /NFL /NDL /NJH /NJS /NP /R:2 /W:1
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $rel (exit $LASTEXITCODE)" }
  } else {
    Copy-Item $src $dst -Force
  }
}
$sizeMB = [math]::Round((Get-ChildItem $dest -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 2)
$nFiles = (Get-ChildItem $dest -Recurse -File | Measure-Object).Count
Ok "backed up $nFiles file(s), $sizeMB MB -> $dest"

# --- verify (a backup nobody checked is not a backup) --------------------------
Step "3/4 verifying"
$problems = @()
foreach ($rel in $found) {
  $dst = Join-Path $dest $rel
  if (-not (Test-Path $dst)) { $problems += "missing: $rel"; continue }
  $srcCount = if ((Get-Item (Join-Path $DSHome $rel)).PSIsContainer) { (Get-ChildItem (Join-Path $DSHome $rel) -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count } else { 1 }
  $dstCount = if ((Get-Item $dst).PSIsContainer) { (Get-ChildItem $dst -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count } else { 1 }
  if ($srcCount -ne $dstCount) { $problems += "$rel : $dstCount of $srcCount file(s)" }
}
if ($problems.Count -gt 0) {
  $problems | ForEach-Object { Warn $_ }
  throw "backup verification failed - the copy is incomplete"
}
Ok "every selected item copied with the same file count"

# Reads a credential file back so a truncated/corrupt copy is caught now rather
# than on the day it is needed.
$credSrc = Join-Path $DSHome ".credentials.yaml"
if (Test-Path $credSrc) {
  $orig = (Get-Content $credSrc -Raw)
  $copy = (Get-Content (Join-Path $dest ".credentials.yaml") -Raw)
  if ($orig -ne $copy) { throw ".credentials.yaml differs between source and backup" }
  Ok ".credentials.yaml byte-identical"
}

# --- prune --------------------------------------------------------------------
Step "4/4 pruning old backups"
$all = @(Get-ChildItem $OutDir -Directory -Filter "dsh-home-*" -ErrorAction SilentlyContinue |
         Sort-Object Name -Descending)
if ($all.Count -gt $Keep) {
  $all[$Keep..($all.Count - 1)] | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    Ok "pruned $($_.Name)"
  }
} else {
  Ok "kept all $($all.Count) backup(s) (limit $Keep)"
}

Write-Host ""
Write-Host "done. latest backup:" -ForegroundColor Green
Write-Host "  $dest"
