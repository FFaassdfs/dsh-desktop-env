# restore-on-service-restart.ps1 - re-apply a staged workspace.json across a restart.
#
# version: 1.0   (2026-09-27)
# changelog:
#   1.0 (2026-09-27) first version, written together with .work\restore-dsh-home.ps1
#       (HANDOVER 46).
#
# WHY: dsh web loads storages\workspace.json exactly once, at boot. A restore that
# only edits the file therefore shows up only after the service restarts - and the
# running process may still flush its own (stale, restored-session-free) copy on
# the way out. This helper removes that race: it waits for the port to close, then
# re-applies the staged file every 150 ms until the port is serving again, i.e.
# until the restarted harness has read it.
#
# It is meant to be started DETACHED before the user clicks "Restart service" in
# the shell status panel, so that it outlives the service it is watching:
#   Start-Process pwsh -ArgumentList '-NoProfile','-File','.work\restore-on-service-restart.ps1' -WindowStyle Hidden
#
# It never kills or starts anything itself - the shell owns the service lifecycle
# (app.go restartOwned/bootstrap), so this script only watches port 43080.
#
# Usage:
#   pwsh -File .work\restore-on-service-restart.ps1                       # watch + apply
#   pwsh -File .work\restore-on-service-restart.ps1 -WaitCloseSec 60 -Port 43080
#   pwsh -File .work\restore-on-service-restart.ps1 -VerifyOnly           # report state
#
# Exit codes:
#   0 = staged index applied and the service is serving again
#   1 = failure (staged file missing / cannot write)
#   2 = service came back but it rewrote workspace.json (restore it again + restart)
#   3 = no restart observed within -WaitCloseSec (nothing was changed)
#
# ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8 scripts
# with non-ASCII content).
param(
  [string]$StagedWorkspace = "",
  [string]$DSHome = "",
  [int]$Port = 43080,
  [int]$WaitCloseSec = 900,
  [int]$MaxApplySec = 180,
  [int]$WaitOpenSec = 180,
  [string]$Log = "",
  [switch]$VerifyOnly
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$repo = Split-Path $PSScriptRoot -Parent
if (-not $StagedWorkspace) { $StagedWorkspace = Join-Path $repo ".cache\dsh-restore-staged\workspace.json" }
if (-not $DSHome) { $DSHome = Join-Path $env:USERPROFILE ".dsh" }
if (-not $Log) { $Log = Join-Path (Split-Path $StagedWorkspace -Parent) "restore-on-restart.log" }
$liveWs = Join-Path $DSHome "storages\workspace.json"
$url = "http://127.0.0.1:$Port/"

function Say($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
  Write-Host $line
  try { Add-Content -Path $Log -Value $line -Encoding UTF8 } catch { }
}
# 401 = running (browser auth gate), 200 = running with a token, 000 = down.
# curl.exe, not Get-NetTCPConnection: the sandbox reports false negatives (AGENTS.md).
function PortState {
  $code = (& curl.exe -s -o NUL -w "%{http_code}" --max-time 2 $url 2>$null | Out-String).Trim()
  if ($code -eq "" ) { return "000" }
  return $code
}
function HashOf($p) { if (Test-Path $p) { return (Get-FileHash $p -Algorithm SHA256).Hash } return "" }
function Apply {
  $a = HashOf $StagedWorkspace
  $b = HashOf $liveWs
  if ($a -eq "" ) { throw "staged index not found: $StagedWorkspace" }
  if ($a -eq $b) { return $false }
  Copy-Item $StagedWorkspace $liveWs -Force
  return $true
}

Say "watch start: staged=$StagedWorkspace live=$liveWs port=$Port"
if (-not (Test-Path $StagedWorkspace)) { Say "FATAL staged index missing"; exit 1 }

$state = PortState
Say "initial port state: $state (401/200 = serving, 000 = down)"

if ($VerifyOnly) {
  $same = (HashOf $StagedWorkspace) -eq (HashOf $liveWs)
  Say ("verify: live workspace.json {0} the staged index" -f $(if ($same) { "matches" } else { "DIFFERS from" }))
  exit $(if ($same) { 0 } else { 2 })
}

# If the service is already down, this is the window: apply immediately.
if ($state -eq "000") {
  if (Apply) { Say "service already down: staged index applied" } else { Say "service already down: live index already current" }
}

# --- phase 1: wait for the restart to begin -----------------------------------
$deadline = (Get-Date).AddSeconds($WaitCloseSec)
$sawClose = ($state -eq "000")
while (-not $sawClose -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  if ((PortState) -eq "000") { $sawClose = $true }
}
if (-not $sawClose) {
  Say "no restart observed within $WaitCloseSec s - the staged index is on disk already, but the RUNNING service still has the old table in memory"
  Say "=> click Restart service in the shell status panel, or re-run .work\restore-dsh-home.ps1 after stopping it"
  exit 3
}
Say "port closed - restart detected, holding the index in place"

# --- phase 2: keep it applied until the new process is serving -----------------
$applied = 0
$applyDeadline = (Get-Date).AddSeconds($MaxApplySec)
while ((Get-Date) -lt $applyDeadline) {
  if (Apply) { $applied++; Say "applied staged index (attempt $applied) while the service is down" }
  if ((PortState) -ne "000") { break }
  Start-Sleep -Milliseconds 150
}

# --- phase 3: verify what the restarted service read --------------------------
$openDeadline = (Get-Date).AddSeconds($WaitOpenSec)
$up = $false
while (-not $up -and (Get-Date) -lt $openDeadline) {
  if ((PortState) -ne "000") { $up = $true; break }
  Start-Sleep -Milliseconds 250
}
if (-not $up) {
  Say "the service did not come back within $WaitOpenSec s (the index is in place; a later start will read it)"
  exit 0
}
Start-Sleep -Seconds 2
if ((HashOf $StagedWorkspace) -eq (HashOf $liveWs)) {
  Say "OK: service is serving and workspace.json still holds the restored session ids"
  exit 0
}
Say "WARNING: the restarted service rewrote workspace.json (it now differs from the staged index)."
Say "         Re-run .work\restore-dsh-home.ps1 and restart once more; the sessions are on disk either way."
exit 2
