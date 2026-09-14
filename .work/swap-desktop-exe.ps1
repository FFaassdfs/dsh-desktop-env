# swap-desktop-exe.ps1 - replace the running shell exe with a freshly built one
# and relaunch it.
#
# WHY a separate script: the launcher owns the `dsh web` process that serves the
# current GUI session, so closing/replacing it from inside a harness session kills
# the session that would be doing the swap. Run this as a one-shot Scheduled Task
# (its process is owned by Task Scheduler and survives the session dying), or from
# a terminal that is not a child of the shell.
#
# Usage:
#   pwsh -File .work\swap-desktop-exe.ps1                        # swap + relaunch
#   pwsh -File .work\swap-desktop-exe.ps1 -DelaySeconds 5        # shorter wait
#   pwsh -File .work\swap-desktop-exe.ps1 -NoRelaunch            # swap only
#
# ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8 scripts).
param(
  [string]$Source = "D:\dsh\dsh-desktop-env\build\bin\dsh-desktop.exe",
  [string]$Staged = "D:\dsh\app\current\dsh-desktop.new.exe",
  [string]$Target = "D:\dsh\app\current\dsh-desktop.exe",
  [int]$DelaySeconds = 20,
  [switch]$NoRelaunch
)
$ErrorActionPreference = "Continue"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$log = Join-Path $repoRoot ".work\swap-desktop.log"

function Log($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
  Write-Host $line
  try { Add-Content -Path $log -Value $line -ErrorAction SilentlyContinue } catch {}
}

# Prefer the freshly built artifact; fall back to the staged copy (used when the
# exe could not be staged because the running shell holds the lock).
if (-not (Test-Path $Source)) {
  if (Test-Path $Staged) {
    Log "source missing, using staged exe: $Staged"
    $Source = $Staged
  } else {
    Log "FATAL: neither source ($Source) nor staged ($Staged) exists"
    exit 1
  }
}
$newInfo = Get-Item $Source
Log "new exe: $($newInfo.FullName) ($($newInfo.Length) bytes, $($newInfo.LastWriteTime))"
if ($newInfo.Length -lt 1MB) {
  Log "FATAL: exe suspiciously small, refusing to swap"
  exit 1
}

Log "waiting $DelaySeconds s before closing the shell"
Start-Sleep -Seconds $DelaySeconds

# Close the running shell gracefully, then force if needed.
$shell = Get-Process -Name "dsh-desktop" -ErrorAction SilentlyContinue
if ($shell) {
  Log "closing shell PID(s): $($shell.Id -join ',')"
  foreach ($p in $shell) { $null = $p.CloseMainWindow() }
  Start-Sleep -Seconds 6
  $left = Get-Process -Name "dsh-desktop" -ErrorAction SilentlyContinue
  if ($left) {
    Log "force-stopping PID(s): $($left.Id -join ',')"
    $left | Stop-Process -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
} else {
  Log "no running shell found"
}

# Wait for the target exe lock to be released (Windows holds it while running).
$deadline = (Get-Date).AddSeconds(60)
$free = $false
while ((Get-Date) -lt $deadline) {
  try {
    $fs = [System.IO.File]::Open($Target, 'Open', 'ReadWrite', 'None')
    $fs.Close()
    $free = $true
    break
  } catch {
    Start-Sleep -Seconds 2
  }
}
if (-not $free) {
  Log "FATAL: target exe still locked after 60 s: $Target"
  if (-not $NoRelaunch) { Start-Process -FilePath $Target }
  exit 1
}
Log "target exe lock released"

# Keep a backup of the replaced build next to it.
try {
  Copy-Item -Path $Target -Destination ($Target + ".bak") -Force
  Log "backup written: $Target.bak"
} catch {
  Log "backup skipped: $_"
}

try {
  Copy-Item -Path $Source -Destination $Target -Force
  Log "swapped in: $Source -> $Target"
} catch {
  Log "FATAL: copy failed: $_"
  if (-not $NoRelaunch) { Start-Process -FilePath $Target }
  exit 1
}

$after = Get-Item $Target
if ($after.Length -ne $newInfo.Length) {
  Log "WARNING: size mismatch after copy ($($after.Length) vs $($newInfo.Length))"
} else {
  Log "size verified: $($after.Length) bytes"
}

if ($NoRelaunch) {
  Log "done (no relaunch requested)"
  exit 0
}
Start-Process -FilePath $Target
Log "shell relaunched; the new launcher will start (or adopt) dsh web on port 43080"
Log "=== swap finished ==="
