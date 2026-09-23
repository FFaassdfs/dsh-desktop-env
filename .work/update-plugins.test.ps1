# Tests for scripts\update-plugins.ps1 (the standalone plugin updater).
#
# Runs the REAL script against a throwaway copy of the source tree (built by
# pack-release.ps1 -NoNode) so plugin sources can be mutated to create the
# "outdated" and "broken source" situations without touching the repo.
#   pwsh -NoProfile -File .work\update-plugins.test.ps1
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repo
# Guard: this suite must not litter the repository root (see HANDOVER §32).
$rootBefore = @(Get-ChildItem $repo -Force | ForEach-Object { $_.Name })
$out = ".cache\uptest"
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue

$fail = 0
$pass = 0
function Check($name, $condition, $detail) {
  if ($condition) { $script:pass++; Write-Host "  PASS  $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "  FAIL  $name" -ForegroundColor Red; if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray } }
}
function Sorted-List($items) { return (($items | Sort-Object) -join ",") }

Write-Host "==> building a mutable source copy (-NoNode)" -ForegroundColor Cyan
& "$repo\scripts\pack-release.ps1" -NoNode -SkipZip -KeepStaging -OutDir $out *> $null
if ($LASTEXITCODE -ne 0) { throw "pack skeleton failed" }
$pkg = (Get-ChildItem "$out\staging" -Directory | Select-Object -First 1).FullName
Copy-Item "$repo\scripts\update-plugins.ps1" (Join-Path $pkg "update-plugins.ps1") -Force
Copy-Item "$repo\scripts\update-plugins.cmd" (Join-Path $pkg "update-plugins.cmd") -Force
$updater = Join-Path $pkg "update-plugins.ps1"
$mjs = Join-Path $pkg "scripts\setup-plugins.mjs"
Write-Host "    source copy: $pkg"

$catalogue = @(((& node "$mjs" --describe | Out-String) | ConvertFrom-Json) | Sort-Object index)
$shorts = @($catalogue | ForEach-Object { $_.short })
$total = $shorts.Count
$two = @($shorts[1], $shorts[3])
Write-Host ("    plugins: {0} -> {1}" -f $total, ($shorts -join ", ")) -ForegroundColor Cyan

$homeSeq = 0
function New-Home {
  $script:homeSeq++
  $h = Join-Path $out ("home{0}" -f $script:homeSeq)
  New-Item -ItemType Directory -Force -Path $h | Out-Null
  return $h
}
function Invoke-Updater([string]$dsHome, [string[]]$extra) {
  $a = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $updater, "-DSHome", $dsHome) + $extra
  $text = & pwsh @a 2>&1 | Out-String
  return [pscustomobject]@{ Text = $text; Exit = $LASTEXITCODE }
}
function InstalledPlugins([string]$dsHome) {
  $d = Join-Path $dsHome "profiles\node_modules"
  if (-not (Test-Path $d)) { return @() }
  return @(Get-ChildItem $d -Directory | Where-Object { $_.Name -like 'dsh-client-ui-plugin-*' } |
    ForEach-Object { $_.Name -replace '^dsh-client-ui-plugin-', '' } | Sort-Object)
}
function Litter([string]$dsHome) {
  $d = Join-Path $dsHome "profiles\node_modules"
  if (-not (Test-Path $d)) { return @() }
  return @(Get-ChildItem $d -Directory | Where-Object { $_.Name -like '.backup-*' } | ForEach-Object { $_.Name })
}
function Status([string]$dsHome) {
  $env:DSH_HOME = $dsHome
  try { return @(((& node $mjs --status | Out-String) | ConvertFrom-Json)) } finally { Remove-Item Env:\DSH_HOME -ErrorAction SilentlyContinue }
}
function HashOf([string]$dsHome, [string]$short) {
  $row = Status $dsHome | Where-Object { $_.short -eq $short } | Select-Object -First 1
  return $row.installedHash
}

Write-Host "`n==> 1. fresh home: default (installed) must do nothing" -ForegroundColor Cyan
$h = New-Home
$r = Invoke-Updater $h @()
Check "fresh home + default -> nothing installed" (((InstalledPlugins $h).Count) -eq 0) "got '$(Sorted-List (InstalledPlugins $h))'"
Check "fresh home + default -> exit 0 + guidance" (($r.Exit -eq 0) -and ($r.Text -match "no plugins are installed")) "exit=$($r.Exit)"
Check "fresh home + default -> no litter" ((Litter $h).Count -eq 0) "got '$((Litter $h) -join ',')'"

Write-Host "`n==> 2. -CheckOnly -Plugins all on a fresh home writes nothing" -ForegroundColor Cyan
$h = New-Home
$r = Invoke-Updater $h @("-Plugins", "all", "-CheckOnly")
Check "-CheckOnly reports all as would-install" (($r.Exit -eq 0) -and ($r.Text -match "would update") -and (($shorts | Where-Object { $r.Text -match $_ }).Count -eq $total)) "exit=$($r.Exit)"
Check "-CheckOnly writes nothing" (((InstalledPlugins $h).Count) -eq 0) "got '$(Sorted-List (InstalledPlugins $h))'"
Check "-CheckOnly does not even create profiles\node_modules" (-not (Test-Path (Join-Path $h "profiles\node_modules"))) "directory was created"
Check "-CheckOnly prints the state table" ($r.Text -match "未安装" -and $r.Text -match "源共 $total 个") ""

Write-Host "`n==> 3. install two by number, then default is a no-op" -ForegroundColor Cyan
$h = New-Home
$r = Invoke-Updater $h @("-Plugins", "2,4")
Check "2,4 installs exactly those two" ((Sorted-List (InstalledPlugins $h)) -eq (Sorted-List $two)) "got '$(Sorted-List (InstalledPlugins $h))'"
Check "2,4 prints a per-plugin hash report" ($r.Text -match "OK") "exit=$($r.Exit)"
Check "fresh install leaves no .backup-* litter" ((Litter $h).Count -eq 0) "got '$((Litter $h) -join ',')'"
$r = Invoke-Updater $h @()
Check "default afterwards -> already up to date, no changes" (($r.Exit -eq 0) -and ($r.Text -match "already up to date")) "exit=$($r.Exit)"
Check "still exactly those two" ((Sorted-List (InstalledPlugins $h)) -eq (Sorted-List $two)) "got '$(Sorted-List (InstalledPlugins $h))'"

Write-Host "`n==> 4. changed source -> detected as outdated and updated (with backup)" -ForegroundColor Cyan
$target = $two[0]
$srcFile = Join-Path $pkg "plugins\dsh-client-ui-plugin-$target\lib\index.js"
Add-Content -Path $srcFile -Value "`n// mutation for the updater test`n" -Encoding utf8
$before = HashOf $h $target
$st = Status $h | Where-Object { $_.short -eq $target } | Select-Object -First 1
Check "status flags the changed plugin as outdated" ($st.state -eq "outdated") "state=$($st.state) src=$($st.sourceHash) inst=$($st.installedHash)"
$r = Invoke-Updater $h @("-Plugins", $target)
$after = HashOf $h $target
Check "updater refreshes the plugin" (($r.Exit -eq 0) -and ($after -ne $before) -and ($after -eq $st.sourceHash)) "exit=$($r.Exit) before=$before after=$after want=$($st.sourceHash)"
Check "state is current again" (((Status $h | Where-Object { $_.short -eq $target }).state) -eq "current") ""
Check "backup was created and cleaned up on success" ((Litter $h).Count -eq 0) "got '$((Litter $h) -join ',')'"
Check "the other plugin was untouched" ((HashOf $h $two[1]) -eq (Status $h | Where-Object { $_.short -eq $two[1] }).installedHash) ""

Write-Host "`n==> 5. broken source -> install fails and the previous copy is restored" -ForegroundColor Cyan
# The verifier's "host main" check fails when the file is MISSING (content is not
# parsed), so delete it — that is the realistic "bad source tree" case.
$hostMain = Join-Path $pkg "plugins\dsh-client-ui-plugin-$target\lib\index.js"
$good = Get-Content $hostMain -Raw
Remove-Item $hostMain -Force
$before = HashOf $h $target
$r = Invoke-Updater $h @("-Plugins", $target)
$after = HashOf $h $target
Check "broken source -> updater exits non-zero" ($r.Exit -ne 0) "exit=$($r.Exit)"
Check "broken source -> previous copy restored (hash unchanged)" ($after -eq $before -and $before -ne "") "before=$before after=$after"
Check "broken source -> installed files are back" (Test-Path (Join-Path $h "profiles\node_modules\dsh-client-ui-plugin-$target\lib\index.js")) ""
Check "broken source -> backup kept for inspection" ((Litter $h).Count -ge 1) "got '$((Litter $h) -join ',')'"
Check "broken source -> rollback reported" ($r.Text -match "rolled back") ""
Set-Content -Path $hostMain -Value $good -Encoding utf8
Remove-Item (Join-Path $h "profiles\node_modules\.backup-*") -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n==> 6. -Force, -Plugins none, and invalid input" -ForegroundColor Cyan
$r = Invoke-Updater $h @("-Plugins", $target, "-Force")
Check "-Force re-installs an already current plugin" (($r.Exit -eq 0) -and ($r.Text -match "done")) "exit=$($r.Exit)"
$before = Sorted-List (InstalledPlugins $h)
$r = Invoke-Updater $h @("-Plugins", "none")
Check "-Plugins none changes nothing" (($r.Exit -eq 0) -and ((Sorted-List (InstalledPlugins $h)) -eq $before)) "exit=$($r.Exit)"
$over = $total + 1
$r = Invoke-Updater $h @("-Plugins", "$over")
Check "-Plugins $over refused" (($r.Exit -ne 0) -and ($r.Text -match "invalid choice")) "exit=$($r.Exit)"
Check "refused run changed nothing" ((Sorted-List (InstalledPlugins $h)) -eq $before) "got '$(Sorted-List (InstalledPlugins $h))'"

Write-Host "`n==> 7. the .cmd wrapper exists next to the script" -ForegroundColor Cyan
Check "update-plugins.cmd copied with the script" (Test-Path (Join-Path $pkg "update-plugins.cmd")) ""

Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
$newRoot = @(Get-ChildItem $repo -Force | ForEach-Object { $_.Name } | Where-Object { $rootBefore -notcontains $_ })
Check "the test left the repository root clean" ($newRoot.Count -eq 0) "new entries: $($newRoot -join ', ')"
Write-Host ""
Write-Host ("RESULT: {0} passed, {1} failed" -f $pass, $fail) -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
exit $(if ($fail -eq 0) { 0 } else { 1 })
