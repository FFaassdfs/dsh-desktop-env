# Swap the freshly built shell exe (fork desktop\build\bin) into the canonical
# launch path (D:\opencode\001\dsh-desktop\build\bin) and relaunch. Runs as a
# one-shot Scheduled Task so it survives the harness dying when the shell
# closes. Logs to .work/rebuild-desktop.log.
$ErrorActionPreference = "Continue"

$log    = "D:\opencode\001\dsh-desktop\.work\rebuild-desktop.log"
$oldExe = "D:\opencode\001\dsh-desktop\build\bin\dsh-desktop.exe"
$newExe = "D:\opencode\001\dsh-desktop\.work\deepseek-harness\desktop\build\bin\dsh-desktop.exe"

function Log($m) {
  Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m)
}

Log "=== swap task started ==="
Start-Sleep -Seconds 20

# close the running (old) shell gracefully; fallback force
$shell = Get-Process -Name "dsh-desktop" -ErrorAction SilentlyContinue
if ($shell) {
  Log "closing shell PID(s): $($shell.Id -join ',')"
  foreach ($p in $shell) { $null = $p.CloseMainWindow() }
  Start-Sleep -Seconds 6
  Get-Process -Name "dsh-desktop" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
} else {
  Log "no running shell found"
}

# make sure 3080 is free so the relaunched shell owns a fresh dsh web
try {
  Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Log "freeing 3080: killing PID $($_.OwningProcess)"
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
} catch {
  Log "3080 cleanup skipped: $_"
}

# wait for the old exe file lock to release
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
  try {
    $fs = [System.IO.File]::Open($oldExe, 'Open', 'ReadWrite', 'None')
    $fs.Close()
    break
  } catch {
    Start-Sleep -Seconds 2
  }
}
Log "old exe lock released"

# swap in the new exe
if (-not (Test-Path $newExe)) {
  Log "FATAL: new exe missing at $newExe"
  Start-Process -FilePath $oldExe
  exit 1
}
Copy-Item -Path $newExe -Destination $oldExe -Force
Log "copied new exe -> $oldExe"

# verify the copied exe carries the menu string
$bytes = [System.IO.File]::ReadAllBytes($oldExe)
$needle = [System.Text.Encoding]::UTF8.GetBytes("重新加载")
$found = $false
for ($i = 0; $i -le $bytes.Length - $needle.Length; $i++) {
  $match = $true
  for ($j = 0; $j -lt $needle.Length; $j++) {
    if ($bytes[$i + $j] -ne $needle[$j]) { $match = $false; break }
  }
  if ($match) { $found = $true; break }
}
Log "copied exe contains menu string: $found"

Start-Process -FilePath $oldExe
Log "shell relaunched"
Log "=== swap task finished ==="
