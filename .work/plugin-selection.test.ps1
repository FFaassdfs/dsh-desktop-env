# Plugin-selection tests for install-offline.ps1 + scripts/setup-plugins.mjs.
#
# Everything is derived from `setup-plugins.mjs --describe`, so adding a plugin
# never breaks this suite (only the counted assertions that must scale).
#
# Phase A installs FOR REAL into throwaway DSH homes (the new-machine scenario),
# Phase A2 drives the interactive menu, Phase B checks the dry run, Phase C drives
# setup-plugins.mjs directly.
#   pwsh -NoProfile -File .work\plugin-selection.test.ps1
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repo
# Guard: this suite must not litter the repository root (a stray positional arg
# once created folders named "2, 4" there - see HANDOVER §32).
$rootBefore = @(Get-ChildItem $repo -Force | ForEach-Object { $_.Name })
$out = ".cache\seltest"
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue

$fail = 0
$pass = 0
function Check($name, $condition, $detail) {
  if ($condition) { $script:pass++; Write-Host "  PASS  $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "  FAIL  $name" -ForegroundColor Red; if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray } }
}
function Sorted-List($items) { return (($items | Sort-Object) -join ",") }

# --- the catalogue drives every expectation ----------------------------------
$catalogue = @(((& node "$repo\scripts\setup-plugins.mjs" --describe | Out-String) | ConvertFrom-Json) | Sort-Object index)
$shorts = @($catalogue | ForEach-Object { $_.short })
$titles = @($catalogue | ForEach-Object { $_.title })
$total = $shorts.Count
$bundled = @(Get-ChildItem "$repo\plugins" -Directory | Where-Object { $_.Name -like 'dsh-client-ui-plugin-*' })
Write-Host ("==> catalogue: {0} plugins -> {1}" -f $total, ($shorts -join ", ")) -ForegroundColor Cyan
if ($total -lt 4) { throw "expected at least 4 plugins, found $total" }

Write-Host "==> building a package skeleton (-NoNode: node comes from PATH here)" -ForegroundColor Cyan
& "$repo\scripts\pack-release.ps1" -NoNode -SkipZip -KeepStaging -OutDir $out *> $null
if ($LASTEXITCODE -ne 0) { throw "pack skeleton failed" }
$pkg = (Get-ChildItem "$out\staging" -Directory | Select-Object -First 1).FullName
$installer = Join-Path $pkg "install-offline.ps1"
Write-Host "    package: $pkg"

$homeSeq = 0
function New-Home {
  $script:homeSeq++
  $h = Join-Path $out ("home{0}" -f $script:homeSeq)
  New-Item -ItemType Directory -Force -Path $h | Out-Null
  return $h
}
function Invoke-Installer([string]$dsHome, [string[]]$extra) {
  $a = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $installer, "-DSHome", $dsHome) + $extra
  $text = & pwsh @a 2>&1 | Out-String
  return [pscustomobject]@{ Text = $text; Exit = $LASTEXITCODE }
}
function InstalledPlugins([string]$dsHome) {
  $d = Join-Path $dsHome "profiles\node_modules"
  if (-not (Test-Path $d)) { return @() }
  return @(Get-ChildItem $d -Directory | Where-Object { $_.Name -like 'dsh-client-ui-plugin-*' } |
    ForEach-Object { $_.Name -replace '^dsh-client-ui-plugin-', '' } | Sort-Object)
}
function PatchIds([string]$dsHome) {
  $p = Join-Path $dsHome "profiles\web\cordis.patch.yml"
  if (-not (Test-Path $p)) { return @() }
  return @((Get-Content $p) | ForEach-Object { if ($_ -match '^\s+- id:\s*(\S+)') { $Matches[1] } } | Sort-Object)
}

Write-Host "`n==> 0. catalogue sanity (menu numbering + descriptions)" -ForegroundColor Cyan
Check "catalogue covers every bundled plugin" ($total -eq $bundled.Count) "catalogue=$total bundled=$($bundled.Count)"
Check "numbering is contiguous 1..N" ((($catalogue | ForEach-Object { $_.index }) -join ",") -eq ((1..$total) -join ",")) "got $(($catalogue | ForEach-Object { $_.index }) -join ',')"
Check "catalogue order is alphabetical (keeps numbers stable)" (($shorts -join ",") -eq (Sorted-List $shorts)) "catalogue order: $($shorts -join ',') ; alphabetical: $(Sorted-List $shorts)"
Check "every plugin has a Chinese title" ((@($titles | Where-Object { $_ }).Count) -eq $total) "titles: $($titles -join ' / ')"
Check "every plugin has a summary" ((@($catalogue | Where-Object { $_.summary }).Count) -eq $total) ""

Write-Host "`n==> A. real installs into a fresh DSH home (the new-machine flow)" -ForegroundColor Cyan
$two = @($shorts[1], $shorts[3])
$expectTwo = Sorted-List $two
$expectAll = Sorted-List $shorts

$h = New-Home
$r = Invoke-Installer $h @("-Plugins", "2,4")
Check "2,4 -> exactly those two installed" ((Sorted-List (InstalledPlugins $h)) -eq $expectTwo) "got '$(Sorted-List (InstalledPlugins $h))', want '$expectTwo' (exit $($r.Exit))"
Check "2,4 -> exactly two patch entries" ((PatchIds $h).Count -eq 2) "got $((PatchIds $h).Count)"
Check "2,4 -> installer exits 0" ($r.Exit -eq 0) "exit=$($r.Exit)"
if ($r.Exit -ne 0) {
  Write-Host "        --- installer output (tail) ---" -ForegroundColor DarkGray
  ($r.Text -split "`r?`n" | Select-Object -Last 8) | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkGray }
}

# A relative -DSHome used to break createRequire() inside setup-plugins.mjs and
# abort the install after the first plugin, so keep this case.
$hRel = ".cache\seltest\relhome"
Remove-Item $hRel -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $hRel | Out-Null
$r = Invoke-Installer $hRel @("-Plugins", "2,4")
Check "relative -DSHome installs both" ((Sorted-List (InstalledPlugins $hRel)) -eq $expectTwo) "got '$(Sorted-List (InstalledPlugins $hRel))' (exit $($r.Exit))"
Check "relative -DSHome exits 0" ($r.Exit -eq 0) "exit=$($r.Exit)"
Remove-Item $hRel -Recurse -Force -ErrorAction SilentlyContinue

foreach ($variant in @(@("-Plugins", "2, 4"), @("-Plugins", "2 4"), @("-Plugins", "4,2"), @("-Plugins", "2,2,4"), @("-Plugins", ($two -join ",")), @("-Plugins", (($two | ForEach-Object { "dsh-client-ui-plugin-$_" }) -join ",")), @("-Plugins", (($two | ForEach-Object { "plugin-$_" }) -join ",")))) {
  $hv = New-Home
  $null = Invoke-Installer $hv $variant
  Check ("variant " + $variant[1] + " -> same two") ((Sorted-List (InstalledPlugins $hv)) -eq $expectTwo) "got '$(Sorted-List (InstalledPlugins $hv))'"
}

# every plugin must be selectable by its short name, alone
foreach ($short in $shorts) {
  $hs = New-Home
  $null = Invoke-Installer $hs @("-Plugins", $short)
  Check "name '$short' installs exactly it" ((Sorted-List (InstalledPlugins $hs)) -eq $short) "got '$(Sorted-List (InstalledPlugins $hs))'"
}

$h = New-Home
$null = Invoke-Installer $h @("-Plugins", "2,4")
$r = Invoke-Installer $h @("-Plugins", "1")
$expectThree = Sorted-List (@($shorts[0]) + $two)
Check "adding 1 keeps the previous two (installer only adds)" ((Sorted-List (InstalledPlugins $h)) -eq $expectThree) "got '$(Sorted-List (InstalledPlugins $h))', want '$expectThree'"

$over = $total + 1
foreach ($bad in @("$over", "2,$over", "0", "2,x")) {
  $hb = New-Home
  $r = Invoke-Installer $hb @("-Plugins", $bad)
  $refused = ($r.Exit -ne 0) -and ($r.Text -match "invalid choice") -and ((InstalledPlugins $hb).Count -eq 0)
  Check "-Plugins $bad refused, nothing installed" $refused "exit=$($r.Exit) installed='$(Sorted-List (InstalledPlugins $hb))'"
}

$h = New-Home
$r = Invoke-Installer $h @("-Plugins", "none")
Check "-Plugins none installs nothing, exit 0" (($r.Exit -eq 0) -and ((InstalledPlugins $h).Count -eq 0)) "exit=$($r.Exit) count=$((InstalledPlugins $h).Count)"

$h = New-Home
$r = Invoke-Installer $h @("-Plugins", "all")
Check "-Plugins all installs every plugin" ((Sorted-List (InstalledPlugins $h)) -eq $expectAll) "got '$(Sorted-List (InstalledPlugins $h))'"

$h = New-Home
$r = Invoke-Installer $h @()
Check "default (no -Plugins) installs every plugin" ((Sorted-List (InstalledPlugins $h)) -eq $expectAll) "got '$(Sorted-List (InstalledPlugins $h))'"

$h = New-Home
$r = Invoke-Installer $h @("-Plugins", "ask")
Check "-Plugins ask non-interactive -> all, no hang" (($r.Exit -eq 0) -and ($r.Text -match "no interactive console") -and ((InstalledPlugins $h).Count -eq $total)) "exit=$($r.Exit) count=$((InstalledPlugins $h).Count)"

$h = New-Home
$r = Invoke-Installer $h @("-SkipPlugins")
Check "-SkipPlugins installs nothing" (($r.Exit -eq 0) -and ((InstalledPlugins $h).Count -eq 0)) "exit=$($r.Exit)"

Write-Host "`n==> A2. the interactive menu itself (prompt forced, answer piped in)" -ForegroundColor Cyan
function Invoke-InstallerPiped([string]$dsHome, [string]$answer, [string[]]$extra) {
  $a = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $installer, "-DSHome", $dsHome) + $extra
  $text = $answer | & pwsh @a 2>&1 | Out-String
  return [pscustomobject]@{ Text = $text; Exit = $LASTEXITCODE }
}
$env:DSH_INSTALL_FORCE_PROMPT = "1"
try {
  $h = New-Home
  $r = Invoke-InstallerPiped $h "2,4" @("-Plugins", "ask")
  Check "menu: answer 2,4 installs exactly those two" ((Sorted-List (InstalledPlugins $h)) -eq $expectTwo) "got '$(Sorted-List (InstalledPlugins $h))' (exit $($r.Exit))"
  Check "menu: heading shown" ($r.Text -match "Which plugins should be installed into") ""
  Check "menu: multi-select hint shown" ($r.Text -match "多选请用逗号隔开") ""
  Check "menu: first and last numbered lines shown" ($r.Text -match ("1\) " + [regex]::Escape($shorts[0])) -and $r.Text -match ("$total\) " + [regex]::Escape($shorts[$total - 1]))) ""
  Check "menu: Chinese summaries shown" (($titles | Where-Object { $r.Text -match [regex]::Escape($_) }).Count -eq $total) ""
  Check "menu: a/n shortcuts listed" ($r.Text -match "all of them" -and $r.Text -match "run the shell only") ""

  $h = New-Home
  $r = Invoke-InstallerPiped $h "$over" @("-Plugins", "ask")
  Check "menu: invalid answer installs nothing and says so" (((InstalledPlugins $h).Count -eq 0) -and ($r.Text -match "invalid input '$over'") -and ($r.Text -match "nothing will be installed")) "exit=$($r.Exit) count=$((InstalledPlugins $h).Count)"

  $h = New-Home
  $r = Invoke-InstallerPiped $h "a" @("-Plugins", "ask")
  Check "menu: answer a installs every plugin" (((InstalledPlugins $h).Count) -eq $total) "count=$((InstalledPlugins $h).Count)"

  $h = New-Home
  $r = Invoke-InstallerPiped $h "n" @("-Plugins", "ask")
  Check "menu: answer n installs nothing" (((InstalledPlugins $h).Count) -eq 0) "count=$((InstalledPlugins $h).Count)"
} finally {
  $env:DSH_INSTALL_FORCE_PROMPT = $null
}

Write-Host "`n==> B. dry run (-CheckOnly) shows the catalogue and never fails on a fresh machine" -ForegroundColor Cyan
$h = New-Home
$r = Invoke-Installer $h @("-Plugins", "2,4", "-CheckOnly")
Check "-CheckOnly exits 0 on a fresh machine" ($r.Exit -eq 0) "exit=$($r.Exit)"
Check "-CheckOnly prints the catalogue" ($r.Text -match "Plugins bundled in this package") ""
Check "-CheckOnly reports what it would install" ($r.Text -match ("would install : " + [regex]::Escape(($two -join ",")))) "want 'would install : $($two -join ',')'"
Check "-CheckOnly catalogue lists every title" (($titles | Where-Object { $r.Text -match [regex]::Escape($_) }).Count -eq $total) ""
Check "-CheckOnly writes nothing" ((InstalledPlugins $h).Count -eq 0) "count=$((InstalledPlugins $h).Count)"

Write-Host "`n==> C. setup-plugins.mjs directly" -ForegroundColor Cyan
$describe = (& node "$repo\scripts\setup-plugins.mjs" --describe | Out-String)
$json = $null
try { $json = $describe | ConvertFrom-Json } catch { }
Check "--describe returns N numbered entries" ($json -and @($json).Count -eq $total -and ((@($json) | ForEach-Object { $_.index }) -join "," -eq ((1..$total) -join ","))) ""
Check "--describe carries Chinese titles" (($titles | Where-Object { $describe -match [regex]::Escape($_) }).Count -eq $total) ""

$bad = & node "$repo\scripts\setup-plugins.mjs" --plugins $over --check-only 2>&1 | Out-String
Check "mjs --plugins $over fails with the number hint" (($LASTEXITCODE -ne 0) -and ($bad -match "use numbers \(1-$total\)")) "exit=$LASTEXITCODE"
$nums = "2,4"
$ok2 = & node "$repo\scripts\setup-plugins.mjs" --plugins $nums --check-only 2>&1 | Out-String
Check "mjs accepts numbers (2,4)" (($two | Where-Object { $ok2 -match [regex]::Escape("$_ (") }).Count -eq 2) ""
$spaced = & node "$repo\scripts\setup-plugins.mjs" --plugins "2 4" --check-only 2>&1 | Out-String
Check "mjs accepts space-separated numbers (2 4)" (($two | Where-Object { $spaced -match [regex]::Escape("$_ (") }).Count -eq 2) ""

# A dry run against a home where NOTHING is installed must still succeed: it is
# the state a first install starts from, so "not installed yet" is not a failure
# (it used to abort with MODULE_NOT_FOUND / "cordis.patch.yml missing").
$fresh = New-Home
$env:DSH_HOME = $fresh
$freshOut = & node "$repo\scripts\setup-plugins.mjs" --plugins $shorts[0] --check-only 2>&1 | Out-String
$freshExit = $LASTEXITCODE
Remove-Item Env:\DSH_HOME -ErrorAction SilentlyContinue
Check "mjs --check-only exits 0 on a home with nothing installed" ($freshExit -eq 0) "exit=$freshExit"
Check "mjs --check-only verifies the source payload when not installed" ($freshOut -match "verifying the source payload") ""
Check "mjs --check-only says the patch file would be created" ($freshOut -match "cordis.patch.yml missing .* would be created with the plugin-") ""
Check "mjs --check-only still writes nothing" ((InstalledPlugins $fresh).Count -eq 0) "count=$((InstalledPlugins $fresh).Count)"

# A CRLF checkout must hash the same as an LF source tree. This repo has
# core.autocrlf=true and no .gitattributes, so a plugin installed from a released
# package (CRLF: CI checks it out that way) is byte-different-but-content-identical
# to a locally built LF tree; a byte hash made the updater report "待更新" forever
# and rewrite it on every run.
$crlfHome = New-Home
$crlfShort = $shorts[0]
$crlfDst = Join-Path $crlfHome ("profiles\node_modules\dsh-client-ui-plugin-" + $crlfShort)
New-Item -ItemType Directory -Force (Join-Path $crlfDst "lib") | Out-Null
$crlfSrc = Join-Path $repo ("plugins\dsh-client-ui-plugin-" + $crlfShort)
Copy-Item (Join-Path $crlfSrc "package.json") $crlfDst -Force
Copy-Item (Join-Path $crlfSrc "lib\*") (Join-Path $crlfDst "lib") -Recurse -Force
$latin1 = [Text.Encoding]::GetEncoding(28591)
foreach ($f in @(Get-ChildItem $crlfDst -Recurse -File)) {
  # byte-level LF -> CRLF (latin1 maps one byte to one code unit), BOM preserved
  $t = $latin1.GetString([IO.File]::ReadAllBytes($f.FullName))
  $t = $t.Replace("`r`n", "`n").Replace("`n", "`r`n")
  [IO.File]::WriteAllBytes($f.FullName, $latin1.GetBytes($t))
}
$crlfBytes = (Get-ChildItem $crlfDst -Recurse -File | ForEach-Object { [IO.File]::ReadAllBytes($_.FullName) } | Where-Object { $_ -contains 13 }).Count
$env:DSH_HOME = $crlfHome
$crlfRow = @(((& node "$repo\scripts\setup-plugins.mjs" --status --ascii | Out-String) | ConvertFrom-Json) | Where-Object { $_.short -eq $crlfShort })
Remove-Item Env:\DSH_HOME -ErrorAction SilentlyContinue
Check "the CRLF fixture really has CRLF bytes" ($crlfBytes -gt 0) "files containing CR: $crlfBytes"
Check "a CRLF payload with identical content reads as current" ($crlfRow.state -eq "current") "state=$($crlfRow.state) sourceHash=$($crlfRow.sourceHash) installedHash=$($crlfRow.installedHash)"

Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n==> G. --profile: inject ours into the OFFICIAL app's reserved profile" -ForegroundColor Cyan
# WHY THIS SUITE OWNS THIS: the official Electron desktop app boots the reserved
# profile "desktop" ($DSH_HOME/profiles/desktop) and shares the same $DSH_HOME and
# the same profiles/node_modules as our frozen web shell (HANDOVER 56/57), but its
# own cli refuses to manage that profile ("managed exclusively by the Electron
# application", dsh/lib/bin.js), so writing its patch layer is ours to do. This is
# the contract the assistant's Go injector (S2) must reproduce, driven through the
# two entry points users actually have: scripts/setup-plugins.mjs and, on a
# portable package, install-offline.ps1 -Profile.
$profileStatus = {
  param($homePath, $profileName)
  $prev = $env:DSH_HOME
  $env:DSH_HOME = $homePath
  $raw = @((& node "$repo\scripts\setup-plugins.mjs" --status --profile $profileName --ascii | Out-String) | ConvertFrom-Json)
  $env:DSH_HOME = $prev
  return $raw
}

$hDesk = New-Home
# The official app initializes the profile with its own patch layer on first start;
# mimic that so we also prove we never disturb the app's own entries.
$deskDir = Join-Path $hDesk "profiles\desktop"
New-Item -ItemType Directory -Force -Path $deskDir | Out-Null
$appPatch = Join-Path $deskDir "cordis.patch.yml"
@(
  "# Your patch layer for this dsh profile, applied after every bundle layer:",
  "- id: agent-default-model",
  '  name: "@deepseek-ai/dsh-agent-default-model"',
  "  config:",
  "    provider: deepseek-account",
  ""
) | Set-Content -Encoding UTF8 $appPatch
$appByteCount = (Get-Item $appPatch).Length
# Sanity-check the FIXTURE before asserting anything about the installer: the first
# version of this section wrote the file with Set-Content -Encoding UTF8 (which
# emits a BOM under Windows PowerShell) and then matched ids with a regex that
# requires whitespace before "- id:", so a first-line entry was invisible. The
# suite reported "the app's own entry survives: FAIL" while the installer had in
# fact preserved it - a false alarm that cost a debugging round. Assert the fixture
# instead, so a future edit cannot silently weaken the check.
$fixtureIds = @((Get-Content $appPatch) | ForEach-Object { if ($_ -match '^\s*-?\s*id:\s*(\S+)') { $Matches[1] } })
Check "fixture: the app's own entry is really in the file" ($fixtureIds -contains "agent-default-model") "fixture ids: $($fixtureIds -join ', ')"

$env:DSH_HOME = $hDesk
$deskOut = & node "$repo\scripts\setup-plugins.mjs" --plugins all --profile desktop 2>&1 | Out-String
$deskExit = $LASTEXITCODE
Remove-Item Env:\DSH_HOME -ErrorAction SilentlyContinue
Check "--profile desktop -> exits 0" ($deskExit -eq 0) "exit=$deskExit"
$deskIds = @((Get-Content $appPatch) | ForEach-Object { if ($_ -match '^\s*-?\s*id:\s*(\S+)') { $Matches[1] } } | Sort-Object)
Check "--profile desktop -> all $total insert ids present" (($deskIds | Where-Object { $_ -like 'plugin-*' }).Count -eq $total) "got $(($deskIds | Where-Object { $_ -like 'plugin-*' }) -join ',')"
Check "--profile desktop -> the app's own entry survives" ($deskIds -contains "agent-default-model") "ids: $($deskIds -join ', ')"
Check "--profile desktop -> the app's own config lines survive" ((Get-Content $appPatch -Raw) -match 'provider: deepseek-account') ""
Check "--profile desktop -> the patch file only grew" ((Get-Item $appPatch).Length -gt $appByteCount) "was $appByteCount, now $((Get-Item $appPatch).Length)"
Check "--profile desktop -> web profile untouched by default" (-not (Test-Path (Join-Path $hDesk "profiles\web\cordis.patch.yml"))) "the default profile must stay web"

$env:DSH_HOME = $hDesk
$null = & node "$repo\scripts\setup-plugins.mjs" --plugins all --profile desktop 2>&1 | Out-String
$rerunExit = $LASTEXITCODE
Remove-Item Env:\DSH_HOME -ErrorAction SilentlyContinue
$deskIds2 = @((Get-Content $appPatch) | ForEach-Object { if ($_ -match '^\s+- id:\s*(\S+)') { $Matches[1] } })
Check "--profile desktop is idempotent (no duplicate inserts)" (($deskIds2 | Where-Object { $_ -like 'plugin-*' }).Count -eq $total) "ours now: $(($deskIds2 | Where-Object { $_ -like 'plugin-*' }).Count), all: $($deskIds2.Count)"
Check "--profile desktop re-run exits 0" ($rerunExit -eq 0) "exit=$rerunExit"

# --status must report the per-profile picture the assistant's panel renders.
$rows = & $profileStatus $hDesk desktop
Check "--status --profile desktop reports patchEntries.desktop = true for all" ((@($rows | Where-Object { $_.patchEntries.desktop }).Count) -eq $total) "got $(@($rows | Where-Object { $_.patchEntries.desktop }).Count)"
Check "--status --profile desktop reports patchEntries.web = false" ((@($rows | Where-Object { $_.patchEntries.web }).Count) -eq 0) "web entries must not be claimed"

$hAll = New-Home
New-Item -ItemType Directory -Force -Path (Join-Path $hAll "profiles\desktop") | Out-Null
$env:DSH_HOME = $hAll
$null = & node "$repo\scripts\setup-plugins.mjs" --plugins all --profile all 2>&1 | Out-String
$allExit = $LASTEXITCODE
Remove-Item Env:\DSH_HOME -ErrorAction SilentlyContinue
Check "--profile all -> exits 0" ($allExit -eq 0) "exit=$allExit"
Check "--profile all -> web profile gets the entries" ((PatchIds $hAll).Count -eq $total) "got $((PatchIds $hAll).Count)"
$allDesk = @((Get-Content (Join-Path $hAll "profiles\desktop\cordis.patch.yml")) | ForEach-Object { if ($_ -match '^\s+- id:\s*(\S+)') { $Matches[1] } })
Check "--profile all -> desktop profile gets the entries too" (($allDesk | Where-Object { $_ -like 'plugin-*' }).Count -eq $total) "got $(($allDesk | Where-Object { $_ -like 'plugin-*' }) -join ',')"

$env:DSH_HOME = $hAll
$badProfile = & node "$repo\scripts\setup-plugins.mjs" --plugins all --profile nope 2>&1 | Out-String
$badProfileExit = $LASTEXITCODE
Remove-Item Env:\DSH_HOME -ErrorAction SilentlyContinue
Check "--profile rejects an unknown name" ($badProfileExit -ne 0 -and $badProfile -match "unknown profile") "exit=$badProfileExit"

# install-offline.ps1 is what a portable-package user runs; it must forward the
# profile flag (the release ships this script, so a missing forward would make the
# official-app path unusable exactly where it is needed most).
$hPkg = New-Home
New-Item -ItemType Directory -Force -Path (Join-Path $hPkg "profiles\desktop") | Out-Null
$offline = & pwsh -NoProfile -ExecutionPolicy Bypass -File "$repo\install-offline.ps1" -DSHome $hPkg -Plugins all -Profile desktop 2>&1 | Out-String
$offlineExit = $LASTEXITCODE
Check "install-offline.ps1 forwards -Profile to the official profile" ($offlineExit -eq 0) "exit=$offlineExit"
$offlineIds = @((Get-Content (Join-Path $hPkg "profiles\desktop\cordis.patch.yml") -ErrorAction SilentlyContinue) | ForEach-Object { if ($_ -match '^\s+- id:\s*(\S+)') { $Matches[1] } })
Check "install-offline.ps1 -> desktop profile got all $total entries" (($offlineIds | Where-Object { $_ -like 'plugin-*' }).Count -eq $total) "got $(($offlineIds | Where-Object { $_ -like 'plugin-*' }).Count)"

$newRoot = @(Get-ChildItem $repo -Force | ForEach-Object { $_.Name } | Where-Object { $rootBefore -notcontains $_ })
Check "the test left the repository root clean" ($newRoot.Count -eq 0) "new entries: $($newRoot -join ', ')"
Write-Host ""
Write-Host ("RESULT: {0} passed, {1} failed" -f $pass, $fail) -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
exit $(if ($fail -eq 0) { 0 } else { 1 })
