# Regression suite for the Windows PowerShell 5.1 + GBK-codepage bugs (HANDOVER §34).
#
# WHY THIS SUITE EXISTS: every other suite in .work runs under pwsh (PowerShell 7).
# A clean Windows has ONLY Windows PowerShell 5.1, and there two things differ in
# ways that broke the shipped installer and updater on real machines while every
# suite stayed green:
#
#   1. DECODING   PowerShell 5.1 decodes a native child process's stdout with the
#                 CONSOLE codepage -- 936/GBK on a zh-CN box -- not the UTF-8 node
#                 wrote. Mojibake in the middle of a JSON string can even swallow
#                 the closing quote, so ConvertFrom-Json dies with a message that
#                 names a plugin title.
#   2. ARRAY SHAPE ConvertFrom-Json hands back a top-level JSON array as ONE object
#                 under 5.1 and as N objects under 7, so "@(... | ConvertFrom-Json)"
#                 yields 1 row instead of N -- which silently degraded the installer
#                 menu to bare plugin names (the -contains filter matched nothing)
#                 and made the updater print "System.Object[]" rows.
#
# So this suite drives the REAL scripts through real 5.1 with the console pinned to
# 936, and asserts the things a user sees: the menu keeps its Chinese descriptions,
# the updater lists every plugin, and neither dies on JSON.
#
#   pwsh -NoProfile -File .work\ps51-encoding.test.ps1
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repo
$rootBefore = @(Get-ChildItem $repo -Force | ForEach-Object { $_.Name })
$out = ".cache\ps51test"
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $out | Out-Null

$fail = 0
$pass = 0
function Check($name, $condition, $detail) {
  if ($condition) { $script:pass++; Write-Host "  PASS  $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "  FAIL  $name" -ForegroundColor Red; if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray } }
}

# This suite itself runs under 7: pin ITS decoder so the UTF-8 that the fixed
# children emit is read back correctly regardless of the host console.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$ps51 = Get-Command powershell.exe -ErrorAction SilentlyContinue
if (-not $ps51) {
  Write-Host "SKIP ps51-encoding: Windows PowerShell 5.1 (powershell.exe) not available." -ForegroundColor Yellow
  exit 0
}
Write-Host "==> Windows PowerShell 5.1 harness: $($ps51.Source)" -ForegroundColor Cyan

# The catalogue drives expectations, exactly like the other suites.
$catalogue = @(((& node "$repo\scripts\setup-plugins.mjs" --describe | Out-String) | ConvertFrom-Json) | Sort-Object index)
$shorts = @($catalogue | ForEach-Object { $_.short })
$titles = @($catalogue | ForEach-Object { $_.title })
$total = $shorts.Count
if ($total -lt 4) { throw "expected at least 4 plugins, found $total" }
Write-Host ("    catalogue: {0} plugins" -f $total)

# --- the 5.1 launcher ---------------------------------------------------------
# A wrapper that pins the console codepage to 936 BEFORE invoking the target, which
# is what a zh-CN console does at process start. Done in-process (no cmd/chcp) so
# the encoding state the target observes is exactly the realistic one.
# The target is invoked through a command STRING: splatting an array would pass the
# parameters positionally and bind "-DSHome" as the home path (see HANDOVER §12.6).
$wrapper = Join-Path $out "run51.ps1"
@'
param([string]$Command)
[Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding(936)
Invoke-Expression $Command
exit $LASTEXITCODE
'@ | Set-Content -Path $wrapper -Encoding UTF8

function Invoke-In51([string]$target, [string]$argLine) {
  $command = "& '$target' $argLine"
  $text = & $ps51.Source -NoProfile -ExecutionPolicy Bypass -File $wrapper -Command $command 2>&1 | Out-String
  return [pscustomobject]@{ Text = $text; Exit = $LASTEXITCODE }
}

# --- A. the machine-readable payload survives a GBK decoder -------------------
Write-Host "`n==> A. node JSON under a 5.1 + CP936 decoder" -ForegroundColor Cyan
$statusAscii = (& node "$repo\scripts\setup-plugins.mjs" --status --ascii | Out-String)
$nonAscii = ([regex]::Matches($statusAscii, '[^\x00-\x7F]')).Count
Check "--status --ascii is pure ASCII" ($nonAscii -eq 0) "non-ascii chars: $nonAscii"

$describeDefault = (& node "$repo\scripts\setup-plugins.mjs" --describe | Out-String)
$defaultNonAscii = ([regex]::Matches($describeDefault, '[^\x00-\x7F]')).Count
Check "--describe default stays human-readable (not escaped)" ($defaultNonAscii -gt 0) "non-ascii chars: $defaultNonAscii"

# The decisive one: 5.1 + 936 must still parse it, and see N rows (not one array).
# The Chinese title is reported as CODE POINTS: the probe's own stdout is encoded
# with the GBK console codepage, so printing the characters would mojibake them in
# this harness and tell us nothing about what the parser actually produced.
$probe = Join-Path $out "probe.ps1"
@'
param([string]$Script)
[Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding(936)
$raw = (& node $Script --status --ascii 2>&1 | Out-String)
try {
  $rows = @($raw | ConvertFrom-Json) | ForEach-Object { $_ }
  "ROWS=$(@($rows).Count)"
  "TITLE4HEX=" + (($rows[4].title.ToCharArray() | ForEach-Object { [int]$_ }) -join '-')
} catch {
  "PARSEFAIL=$($_.Exception.Message)"
}
'@ | Set-Content -Path $probe -Encoding UTF8
$probeOut = & $ps51.Source -NoProfile -ExecutionPolicy Bypass -File $probe -Script "$repo\scripts\setup-plugins.mjs" 2>&1 | Out-String
Check "5.1 parses the status JSON (no ConvertFrom-Json failure)" ($probeOut -notmatch "PARSEFAIL") ($probeOut.Trim())
Check "5.1 sees every plugin row, not one array" ($probeOut -match "ROWS=$total") ($probeOut.Trim())
$expectedHex = (($catalogue[4].title.ToCharArray() | ForEach-Object { [int]$_ }) -join '-')
Check "5.1 decodes the Chinese title correctly (code points)" ($probeOut -match ("TITLE4HEX=" + [regex]::Escape($expectedHex))) ("want $expectedHex in: " + $probeOut.Trim())

# --- B. the shipped updater under 5.1 ----------------------------------------
Write-Host "`n==> B. update-plugins.ps1 under 5.1 (real script, -CheckOnly)" -ForegroundColor Cyan
$home1 = Join-Path $out "home1"
New-Item -ItemType Directory -Force $home1 | Out-Null
$env:DSH_HOME = $home1
& node "$repo\scripts\setup-plugins.mjs" --plugins all *> $null
Remove-Item Env:\DSH_HOME -ErrorAction SilentlyContinue

$upd = Invoke-In51 "$repo\scripts\update-plugins.ps1" "-DSHome '$home1' -CheckOnly"
Check "updater exits 0 under 5.1" ($upd.Exit -eq 0) "exit=$($upd.Exit)"
Check "updater does not fail on JSON" ($upd.Text -notmatch "ConvertFrom-Json") ($upd.Text.Trim())
Check "updater prints no System.Object[] row" ($upd.Text -notmatch "System\.Object\[\]") ($upd.Text.Trim())
Check "updater lists one row per plugin" ((@($shorts | Where-Object { $upd.Text -match ("\d+\)\s+" + [regex]::Escape($_) + "\s") })).Count -eq $total) ($upd.Text.Trim())
Check "updater reports N installed in the summary" ($upd.Text -match ("已安装\s+$total\s+/")) ($upd.Text.Trim())
Check "updater keeps every Chinese title" ((@($titles | Where-Object { $upd.Text -match [regex]::Escape($_) })).Count -eq $total) ($upd.Text.Trim())

# --- C. the shipped installer menu under 5.1 ---------------------------------
Write-Host "`n==> C. install-offline.ps1 catalogue under 5.1" -ForegroundColor Cyan
$shellExe = Join-Path $repo "build\bin\dsh-desktop.exe"
if (-not (Test-Path $shellExe)) {
  Write-Host "  SKIP  no built shell exe (build\bin\dsh-desktop.exe) - package skeleton not built" -ForegroundColor Yellow
} else {
  $stage = Join-Path $out "pkg"
  & "$repo\scripts\pack-release.ps1" -NoNode -SkipZip -KeepStaging -OutDir $stage *> $null
  if ($LASTEXITCODE -ne 0) { throw "package skeleton failed" }
  $pkg = (Get-ChildItem (Join-Path $stage "staging") -Directory | Select-Object -First 1).FullName
  $home2 = Join-Path $out "home2"
  New-Item -ItemType Directory -Force $home2 | Out-Null
  # -Plugins all (+ -CheckOnly) is the path that prints the catalogue; `ask` would
  # emit the "no interactive console" warning here and `none` skips the catalogue.
  $ins = Invoke-In51 "$pkg\install-offline.ps1" "-DSHome '$home2' -Plugins all -CheckOnly"
  Check "installer exits 0 under 5.1" ($ins.Exit -eq 0) "exit=$($ins.Exit)"
  # The regression: an unparsed catalogue silently degrades to bare names with no
  # description, which is exactly what a 5.1 user saw (empty title -> no lines).
  Check "installer menu keeps every Chinese title" ((@($titles | Where-Object { $ins.Text -match [regex]::Escape($_) })).Count -eq $total) ($ins.Text.Trim())
  Check "installer menu keeps the per-plugin description lines" ($ins.Text -match "在哪看：") ($ins.Text.Trim())
  Check "installer did not fall back to names-only" ($ins.Text -notmatch "no interactive console") ($ins.Text.Trim())
}

# --- D. every non-ASCII .ps1 still carries its BOM ---------------------------
Write-Host "`n==> D. BOM guard (5.1 reads a BOM-less UTF-8 .ps1 as ANSI)" -ForegroundColor Cyan
$bomMissing = @()
foreach ($file in @(Get-ChildItem $repo -Filter *.ps1 -Recurse -File |
    Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.cache\\|\\.git\\|\\build\\' })) {
  $bytes = [IO.File]::ReadAllBytes($file.FullName)
  $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  $text = [Text.Encoding]::UTF8.GetString($bytes)
  $hasNonAscii = $text -match '[^\x00-\x7F]'
  if ($hasNonAscii -and -not $hasBom) { $bomMissing += $file.Name }
}
Check "every non-ASCII .ps1 has a UTF-8 BOM" ($bomMissing.Count -eq 0) ("missing BOM: " + ($bomMissing -join ", "))

# --- E. which engine do the .cmd wrappers pick? ------------------------------
# `powershell` is ALWAYS 5.1 (PowerShell 7 ships as pwsh.exe only), so the wrapper
# decides 5.1-vs-7 by NAME. It must prefer the standard PS7 install location, then
# PATH, then 5.1 — including when PATH is stale (a cmd window opened before PS7 was
# installed does not see the new PATH entry), which is exactly how a user ends up on
# 5.1 without meaning to.
Write-Host "`n==> E. .cmd wrapper engine resolution" -ForegroundColor Cyan
$picker = Join-Path $out "which.cmd"
@'
@echo off
setlocal
set "ProgramFiles=%~1"
set "ProgramW6432=%~1"
if /i "%~3"=="nops7" set "PATH=C:\Windows\System32\WindowsPowerShell\v1.0"
call "%~2" --which-shell
'@ | Set-Content -Path $picker -Encoding ASCII

function Get-ChosenEngine([string]$fakePf, [string]$wrapper, [string]$mode) {
  $line = & cmd /c "`"$picker`" `"$fakePf`" `"$wrapper`" $mode" 2>&1 |
    Where-Object { $_ -match '\S' } | Select-Object -First 1
  return "$line".Trim()
}

$pfWith = Join-Path $out "pf-with"      # pretends PowerShell 7 lives here
$pfWithout = Join-Path $out "pf-without"
New-Item -ItemType Directory -Force (Join-Path $pfWith "PowerShell\7") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $pfWithout "PowerShell\7") | Out-Null
# existence is all the wrapper checks in --which-shell mode, so a stub is enough
Copy-Item "$env:SystemRoot\System32\where.exe" (Join-Path $pfWith "PowerShell\7\pwsh.exe") -Force

$wrappers = @(
  @{ name = "install-offline.cmd"; path = Join-Path $repo "install-offline.cmd" },
  @{ name = "update-plugins.cmd"; path = Join-Path $repo "scripts\update-plugins.cmd" }
)
foreach ($w in $wrappers) {
  Check "$($w.name) exists" (Test-Path $w.path) $w.path
  if (-not (Test-Path $w.path)) { continue }
  $chosenInstall = Get-ChosenEngine $pfWith $w.path "normal"
  Check "$($w.name) prefers the PS7 install location over PATH" `
    ($chosenInstall -eq (Join-Path $pfWith "PowerShell\7\pwsh.exe")) "chose: $chosenInstall"
  $chosenFallback = Get-ChosenEngine $pfWithout $w.path "nops7"
  Check "$($w.name) falls back to PowerShell 5.1 with no PS7 anywhere" `
    ($chosenFallback -eq "powershell") "chose: $chosenFallback"
  # only meaningful where PS7 is actually installed
  if (Get-Command pwsh -ErrorAction SilentlyContinue) {
    $chosenPath = Get-ChosenEngine $pfWithout $w.path "normal"
    Check "$($w.name) uses pwsh from PATH when Program Files has none" `
      ($chosenPath -eq "pwsh") "chose: $chosenPath"
  } else {
    Write-Host "  SKIP  $($w.name) PATH branch: no pwsh on this machine" -ForegroundColor Yellow
  }
  # the wrappers ARE the 5.1 entry point, so they must stay pure ASCII: non-ASCII
  # in a .cmd is decoded with the console codepage and can garble or break parsing.
  $cmdBytes = [IO.File]::ReadAllBytes($w.path)
  $nonAsciiBytes = @($cmdBytes | Where-Object { $_ -gt 127 }).Count
  Check "$($w.name) is pure ASCII" ($nonAsciiBytes -eq 0) "non-ascii bytes: $nonAsciiBytes"
}

# --- F. every shipped .ps1 parses under BOTH engines -------------------------
# A parse error is fatal and silent until something runs the file. This session
# broke scripts/pack-release.ps1 exactly that way: a backtick inside a
# double-quoted here-string is an ESCAPE in PowerShell (`u... is a Unicode escape),
# so the README text made the whole script unparseable — and three suites failed
# with a ParserError instead of a useful message. One second of parsing would have
# caught it, so it is now a permanent check on both engines.
Write-Host "`n==> F. parse every shipped .ps1 (PS7 in-process + 5.1 child)" -ForegroundColor Cyan
$ps1Files = @(Get-ChildItem $repo -Filter *.ps1 -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.cache\\|\\.git\\|\\build\\' })
Check "there are .ps1 files to check" ($ps1Files.Count -gt 0) "found $($ps1Files.Count)"
$ps7Bad = @()
foreach ($f in $ps1Files) {
  try { [void][ScriptBlock]::Create([IO.File]::ReadAllText($f.FullName)) }
  catch { $ps7Bad += "$($f.Name): $($_.Exception.Message)" }
}
Check "every .ps1 parses under PowerShell 7" ($ps7Bad.Count -eq 0) ($ps7Bad -join " | ")

$parseProbe = Join-Path $out "parsecheck.ps1"
@'
param([string]$Repo)
$bad = @()
$files = @(Get-ChildItem $Repo -Filter *.ps1 -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.cache\\|\\.git\\|\\build\\' })
foreach ($f in $files) {
  try { [void][ScriptBlock]::Create([IO.File]::ReadAllText($f.FullName)) }
  catch { $bad += "$($f.Name): $($_.Exception.Message)" }
}
if ($bad.Count -gt 0) { "PARSEFAIL " + ($bad -join " | "); exit 1 }
"PARSEOK $($files.Count) file(s)"
'@ | Set-Content -Path $parseProbe -Encoding UTF8
$parsed51 = Invoke-In51 $parseProbe "-Repo '$repo'"
Check "every .ps1 parses under Windows PowerShell 5.1" ($parsed51.Exit -eq 0 -and $parsed51.Text -notmatch "PARSEFAIL") ($parsed51.Text.Trim())
Check "the 5.1 parse probe saw the same file count" ($parsed51.Text -match "PARSEOK $($ps1Files.Count) file") ($parsed51.Text.Trim())

# --- G. the repo root stayed clean -------------------------------------------
$newRoot = @(Get-ChildItem $repo -Force | ForEach-Object { $_.Name } | Where-Object { $rootBefore -notcontains $_ })
Check "the test left the repository root clean" ($newRoot.Count -eq 0) "new entries: $($newRoot -join ', ')"

Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
Write-Host ""
Write-Host ("RESULT: {0} passed, {1} failed" -f $pass, $fail) -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
exit $(if ($fail -eq 0) { 0 } else { 1 })
