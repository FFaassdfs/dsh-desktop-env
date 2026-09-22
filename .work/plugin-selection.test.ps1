# Plugin-selection tests for install-offline.ps1 + scripts/setup-plugins.mjs.
#
# Phase A installs FOR REAL into throwaway DSH homes (that is the new-machine
# scenario), Phase B checks the dry run, Phase C drives setup-plugins.mjs directly.
#   pwsh -NoProfile -File .work\plugin-selection.test.ps1
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repo
$out = ".cache\seltest"
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue

$fail = 0
$pass = 0
function Check($name, $condition, $detail) {
  if ($condition) { $script:pass++; Write-Host "  PASS  $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "  FAIL  $name" -ForegroundColor Red; if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray } }
}

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

Write-Host "`n==> A. real installs into a fresh DSH home (the new-machine flow)" -ForegroundColor Cyan

$h = New-Home
$r = Invoke-Installer $h @("-Plugins", "2,4")
Check "2,4 -> exactly those two installed" (((InstalledPlugins $h) -join ",") -eq "explainer,project-explorer") "got '$((InstalledPlugins $h) -join ',')' (exit $($r.Exit))"
Check "2,4 -> exactly two patch entries" (((PatchIds $h) -join ",") -eq "plugin-explainer,plugin-project-explorer") "got '$((PatchIds $h) -join ',')'"
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
Check "relative -DSHome installs both" (((InstalledPlugins $hRel) -join ",") -eq "explainer,project-explorer") "got '$((InstalledPlugins $hRel) -join ',')' (exit $($r.Exit))"
Check "relative -DSHome exits 0" ($r.Exit -eq 0) "exit=$($r.Exit)"
Remove-Item $hRel -Recurse -Force -ErrorAction SilentlyContinue

foreach ($variant in @(@("-Plugins", "2, 4"), @("-Plugins", "2 4"), @("-Plugins", "4,2"), @("-Plugins", "2,2,4"), @("-Plugins", "explainer,project-explorer"), @("-Plugins", "plugin-explainer,plugin-project-explorer"))) {
  $hv = New-Home
  $null = Invoke-Installer $hv $variant
  Check ("variant " + $variant[1] + " -> same two") (((InstalledPlugins $hv) -join ",") -eq "explainer,project-explorer") "got '$((InstalledPlugins $hv) -join ',')'"
}

$h = New-Home
$null = Invoke-Installer $h @("-Plugins", "2,4")
$r = Invoke-Installer $h @("-Plugins", "1")
Check "adding 1 keeps the previous two (installer only adds)" (((InstalledPlugins $h) -join ",") -eq "core-version,explainer,project-explorer") "got '$((InstalledPlugins $h) -join ',')'"

foreach ($bad in @("9", "2,9", "0", "2,x")) {
  $hb = New-Home
  $r = Invoke-Installer $hb @("-Plugins", $bad)
  $refused = ($r.Exit -ne 0) -and ($r.Text -match "invalid choice") -and ((InstalledPlugins $hb).Count -eq 0)
  Check "-Plugins $bad refused, nothing installed" $refused "exit=$($r.Exit) installed='$((InstalledPlugins $hb) -join ',')'"
}

$h = New-Home
$r = Invoke-Installer $h @("-Plugins", "none")
Check "-Plugins none installs nothing, exit 0" (($r.Exit -eq 0) -and ((InstalledPlugins $h).Count -eq 0)) "exit=$($r.Exit) count=$((InstalledPlugins $h).Count)"

$h = New-Home
$r = Invoke-Installer $h @("-Plugins", "all")
Check "-Plugins all installs all four" (((InstalledPlugins $h) -join ",") -eq "core-version,explainer,model-capabilities,project-explorer") "got '$((InstalledPlugins $h) -join ',')'"

$h = New-Home
$r = Invoke-Installer $h @()
Check "default (no -Plugins) installs all four" (((InstalledPlugins $h) -join ",") -eq "core-version,explainer,model-capabilities,project-explorer") "got '$((InstalledPlugins $h) -join ',')'"

$h = New-Home
$r = Invoke-Installer $h @("-Plugins", "ask")
Check "-Plugins ask non-interactive -> all, no hang" (($r.Exit -eq 0) -and ($r.Text -match "no interactive console") -and ((InstalledPlugins $h).Count -eq 4)) "exit=$($r.Exit) count=$((InstalledPlugins $h).Count)"

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
  Check "menu: answer 2,4 installs exactly those two" (((InstalledPlugins $h) -join ",") -eq "explainer,project-explorer") "got '$((InstalledPlugins $h) -join ',')' (exit $($r.Exit))"
  Check "menu: heading shown" ($r.Text -match "Which plugins should be installed into") ""
  Check "menu: multi-select hint shown" ($r.Text -match "多选请用逗号隔开") ""
  Check "menu: number/name lines shown" ($r.Text -match "1\) core-version" -and $r.Text -match "4\) project-explorer") ""
  Check "menu: Chinese summaries shown" ($r.Text -match "核心版本徽标" -and $r.Text -match "项目文件树") ""
  Check "menu: a/n shortcuts listed" ($r.Text -match "all of them" -and $r.Text -match "run the shell only") ""

  $h = New-Home
  $r = Invoke-InstallerPiped $h "9" @("-Plugins", "ask")
  Check "menu: invalid answer installs nothing and says so" (((InstalledPlugins $h).Count -eq 0) -and ($r.Text -match "invalid input '9'") -and ($r.Text -match "nothing will be installed")) "exit=$($r.Exit) count=$((InstalledPlugins $h).Count)"

  $h = New-Home
  $r = Invoke-InstallerPiped $h "a" @("-Plugins", "ask")
  Check "menu: answer a installs all four" (((InstalledPlugins $h).Count) -eq 4) "count=$((InstalledPlugins $h).Count)"

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
Check "-CheckOnly reports what it would install" ($r.Text -match "would install : explainer,project-explorer") ""
foreach ($needle in @("核心版本徽标", "插件说明面板", "模型能力清单", "项目文件树")) {
  Check "-CheckOnly catalogue mentions $needle" ($r.Text -match [regex]::Escape($needle)) ""
}
Check "-CheckOnly writes nothing" ((InstalledPlugins $h).Count -eq 0) "count=$((InstalledPlugins $h).Count)"

Write-Host "`n==> C. setup-plugins.mjs directly" -ForegroundColor Cyan
$describe = (& node "$repo\scripts\setup-plugins.mjs" --describe | Out-String)
$json = $null
try { $json = $describe | ConvertFrom-Json } catch { }
Check "--describe returns 4 numbered entries" ($json -and @($json).Count -eq 4 -and ((@($json) | ForEach-Object { $_.index }) -join "," -eq "1,2,3,4")) ""
Check "--describe carries Chinese titles" ($describe -match "插件说明面板") ""
Check "--describe has no side effects (no DSH writes)" (-not (Test-Path ".cache\seltest\describe-home")) ""

$bad = & node "$repo\scripts\setup-plugins.mjs" --plugins 9 --check-only 2>&1 | Out-String
Check "mjs --plugins 9 fails with the number hint" (($LASTEXITCODE -ne 0) -and ($bad -match "use numbers \(1-4\)")) "exit=$LASTEXITCODE"
$bad = & node "$repo\scripts\setup-plugins.mjs" --plugins 2,4 --check-only 2>&1 | Out-String
Check "mjs accepts numbers (2,4)" ($bad -match "explainer \(插件说明面板\)" -and $bad -match "project-explorer \(项目文件树\)") ""
$spaced = & node "$repo\scripts\setup-plugins.mjs" --plugins "2 4" --check-only 2>&1 | Out-String
Check "mjs accepts space-separated numbers (2 4)" ($spaced -match "explainer \(插件说明面板\)" -and $spaced -match "project-explorer \(项目文件树\)") ""

Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
Write-Host ""
Write-Host ("RESULT: {0} passed, {1} failed" -f $pass, $fail) -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
exit $(if ($fail -eq 0) { 0 } else { 1 })
