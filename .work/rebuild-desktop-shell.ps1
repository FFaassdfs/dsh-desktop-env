# Rebuild the dsh-desktop shell from the fork source (menu feature, commit ed06b47)
# and relaunch it. Runs as a one-shot Scheduled Task so it survives the harness
# process dying when the shell closes (the shell owns the dsh web process).
#
# Timeline: sleep 25s (let the user read the final message) -> close the shell
# gracefully -> wait for the exe file lock to release -> wails build -s (Go-only,
# reuses the existing frontend dist) with Go caches redirected into the
# workspace -> relaunch the shell. Every step is logged to .work/rebuild-desktop.log.
$ErrorActionPreference = "Continue"

$log     = "D:\opencode\001\dsh-desktop\.work\rebuild-desktop.log"
$exe     = "D:\opencode\001\dsh-desktop\build\bin\dsh-desktop.exe"
$desktop = "D:\opencode\001\dsh-desktop\.work\deepseek-harness\desktop"
$wails   = "C:\Users\veken\go\bin\wails.exe"
$goBin   = "C:\Users\veken\sdk\go\bin"
$cache   = "D:\opencode\001\dsh-desktop\.cache"

function Log($m) {
  Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m)
}

Log "=== rebuild script started (scheduled task) ==="
Log "old exe: $exe modified=$(if (Test-Path $exe) { (Get-Item $exe).LastWriteTime } else { 'MISSING' })"

# 0. give the user time to read the final message before the app closes
Start-Sleep -Seconds 25

# 1. close the running shell gracefully (its quit path kills the dsh web it owns)
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

# 1b. make sure 3080 is free so the relaunched shell owns a fresh dsh web
try {
  $conn = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conn) {
    Log "freeing 3080: killing PID $($c.OwningProcess)"
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  }
} catch {
  Log "3080 cleanup skipped: $_"
}

# 2. wait for the exe file lock to release (running image locks the file)
$deadline = (Get-Date).AddSeconds(90)
$lockFree = $false
while ((Get-Date) -lt $deadline) {
  try {
    $fs = [System.IO.File]::Open($exe, 'Open', 'ReadWrite', 'None')
    $fs.Close()
    $lockFree = $true
    break
  } catch {
    Start-Sleep -Seconds 2
  }
}
Log "exe lock released: $lockFree"

# 3. build (Go-only, skip frontend; redirect Go caches into the workspace)
$env:Path    = "$goBin;$env:Path"
$env:GOCACHE = "$cache\go-build"
$env:GOTMPDIR = "$cache\go-tmp"
New-Item -ItemType Directory -Force -Path "$cache\go-build", "$cache\go-tmp" | Out-Null

Push-Location $desktop
try {
  Log "running: $wails build -s"
  & $wails build -s 2>&1 | ForEach-Object { Log "  $_" }
  Log "wails build exit code: $LASTEXITCODE"
} catch {
  Log "wails build threw: $_"
}
Pop-Location

# 4. copy the built exe into the canonical launch path, verify + relaunch
$builtExe = Join-Path $desktop "build\bin\dsh-desktop.exe"
if (Test-Path $builtExe) {
  Copy-Item -Path $builtExe -Destination $exe -Force
  Log "copied built exe -> $exe"
} else {
  Log "built exe missing at $builtExe"
}
if (Test-Path $exe) {
  $item = Get-Item $exe
  Log "new exe: modified=$($item.LastWriteTime) size=$($item.Length)"
  $bytes = [System.IO.File]::ReadAllBytes($exe)
  $needle = [System.Text.Encoding]::UTF8.GetBytes("重新加载")
  $found = $false
  for ($i = 0; $i -le $bytes.Length - $needle.Length; $i++) {
    $match = $true
    for ($j = 0; $j -lt $needle.Length; $j++) {
      if ($bytes[$i + $j] -ne $needle[$j]) { $match = $false; break }
    }
    if ($match) { $found = $true; break }
  }
  Log "new exe contains menu string '重新加载': $found"
  Start-Process -FilePath $exe
  Log "shell relaunched"
} else {
  Log "EXE MISSING — cannot relaunch"
}
Log "=== rebuild script finished ==="
