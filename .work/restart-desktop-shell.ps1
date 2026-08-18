# Restart the dsh-desktop shell so the host half of the project-explorer plugin
# re-applies (the running instance hot-loads NEW plugins but does not re-read
# files of already-active host modules — /open needs a fresh dsh web). Runs as
# a one-shot Scheduled Task so it survives the harness dying when the shell
# closes. Logs to .work/rebuild-desktop.log.
$ErrorActionPreference = "Continue"

$log = "D:\opencode\001\dsh-desktop\.work\rebuild-desktop.log"
$exe = "D:\opencode\001\dsh-desktop\build\bin\dsh-desktop.exe"

function Log($m) {
  Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m)
}

Log "=== restart task started ==="
Start-Sleep -Seconds 15

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

try {
  Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Log "freeing 3080: killing PID $($_.OwningProcess)"
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
} catch {
  Log "3080 cleanup skipped: $_"
}

Start-Process -FilePath $exe
Log "shell relaunched"

# poll for the fresh dsh web, then verify the /open route is live
$up = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:3080/plugin-project-explorer/open" -Method POST -Body '{}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 3
    Log "open route probe: status $($resp.StatusCode) body $($resp.Content)"
    $up = $true
    break
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 400) {
      Log "open route probe: 400 (route live, missing path) — HOST RELOADED OK"
      $up = $true
      break
    }
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 200) {
      Log "open route probe: 200 — route live"
      $up = $true
      break
    }
    # 405/404/connection refused: not live yet
  }
}
Log "dsh web up: $up"
Log "=== restart task finished ==="
