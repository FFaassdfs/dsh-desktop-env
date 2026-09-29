# core-plugin-boot.test.ps1 - boot a harness core WITH the bundled plugins installed.
#
# WHY THIS EXISTS
#   The release pipeline already boots the packaged runtime twice (the CI step
#   "Verify the staged runtime boots" and .work/verify-release.mjs step 10), but BOTH
#   of them boot against an EMPTY DSH_HOME. That is exactly the hole that let the
#   0.1.5-rc.2 disaster ship in 13 consecutive packages (HANDOVER 42): "core + an
#   installed plugin patch layer" aborted on start-up while "core alone" was fine.
#   This suite closes the hole: install the plugin set into a throwaway DSH_HOME,
#   boot the core against it, and assert it stays alive, serves HTTP and still
#   accepts the patch layer.
#
#   Use it before pinning a NEW core version into a release (HANDOVER 51).
#
# Usage:
#   pwsh -File .work/core-plugin-boot.test.ps1 -CorePrefix D:\tmp\core-0.2.0rc1
#   pwsh -File .work/core-plugin-boot.test.ps1 -CoreEntry <...\dsh\lib\bin.js> -NodeExe <node.exe>
#   pwsh -File .work/core-plugin-boot.test.ps1          # the global npm install (dsh shim)
#
# Scratch lives in .cache\core-plugin-boot\ (gitignored). Exit code 0 = all good.
# ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8).
param(
  [string]$CorePrefix = "",
  [string]$CoreEntry = "",
  [string]$NodeExe = "",
  [int]$TimeoutSeconds = 150,
  [switch]$Keep
)
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$repo = Split-Path -Parent $PSScriptRoot
$pass = 0
$fail = 0
$skip = 0
function Check($name, $ok, $detail = "") {
  if ($ok) { $script:pass++; Write-Host "  present  $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "  MISSING  $name$(if ($detail) { "  ($detail)" })" -ForegroundColor Red }
}
function Skipped($name, $why) {
  $script:skip++
  Write-Host "  skipped  $name  ($why)" -ForegroundColor Yellow
}

# --- resolve the core under test ------------------------------------------------
if (-not $CoreEntry) {
  if (-not $CorePrefix) {
    $shim = Get-Command dsh.cmd -ErrorAction SilentlyContinue
    if (-not $shim) { $shim = Get-Command dsh -ErrorAction SilentlyContinue }
    if (-not $shim) { Write-Host "cannot find a global dsh install; pass -CorePrefix or -CoreEntry"; exit 2 }
    $CorePrefix = Split-Path -Parent $shim.Source
  }
  $CoreEntry = Join-Path $CorePrefix "node_modules\@deepseek-ai\dsh\lib\bin.js"
}
if (-not (Test-Path $CoreEntry)) { Write-Host "core entry not found: $CoreEntry"; exit 2 }
$coreRoot = Split-Path -Parent (Split-Path -Parent $CoreEntry)   # ...\node_modules\@deepseek-ai\dsh
$coreVersion = ""
try {
  $manifest = Join-Path $coreRoot "package.json"
  if (Test-Path $manifest) { $coreVersion = (Get-Content $manifest -Raw | ConvertFrom-Json).version }
} catch { }

if (-not $NodeExe) {
  $NodeExe = "node"
  if ($CorePrefix -and (Test-Path (Join-Path $CorePrefix "node.exe"))) { $NodeExe = Join-Path $CorePrefix "node.exe" }
  elseif ($CorePrefix -and (Test-Path (Join-Path $CorePrefix "runtime\node.exe"))) { $NodeExe = Join-Path $CorePrefix "runtime\node.exe" }
}

Write-Host ""
Write-Host "==> core-plugin-boot gate" -ForegroundColor Cyan
Write-Host "    core   : $CoreEntry"
Write-Host "    version: $coreVersion"
Write-Host "    node   : $NodeExe"

# --- throwaway home with the plugins installed ----------------------------------
$root = Join-Path $repo ".cache\core-plugin-boot"
$home_ = Join-Path $root ("home-" + ($coreVersion -replace '[^\w\.\-]', '_') + "-" + (Get-Date -Format 'HHmmss'))
if (Test-Path $home_) { Remove-Item $home_ -Recurse -Force }
New-Item -ItemType Directory -Force -Path $home_ | Out-Null

$entryOk = (& $NodeExe $CoreEntry --version 2>&1 | Out-String).Trim()
Check "core reports a version ($coreVersion)" ($entryOk -ne "")

Write-Host ""
Write-Host "1) install the bundled plugins into a throwaway DSH_HOME"
# Call setup-plugins.mjs DIRECTLY, not install-offline.ps1: the latter is the PACKAGE
# installer and validates the package layout first, so it refuses to run inside the
# source tree ("package is incomplete, missing: <repo>\dsh-desktop.exe"). The mjs is
# the same primitive the installer uses and takes its home from $env:DSH_HOME.
$env:DSH_HOME = $home_
$installOut = & $NodeExe (Join-Path $repo "scripts\setup-plugins.mjs") --plugins all 2>&1 | Out-String
$installCode = $LASTEXITCODE
Check "plugin install exits 0" ($installCode -eq 0) "exit=$installCode"
$patchFile = Join-Path $home_ "profiles\web\cordis.patch.yml"
$modules = Join-Path $home_ "profiles\node_modules"
$wanted = @()
try {
  $raw = (& $NodeExe (Join-Path $repo "scripts\setup-plugins.mjs") --describe --ascii 2>$null | Out-String)
  $wanted = @(($raw | ConvertFrom-Json) | ForEach-Object { $_.patchId })
} catch { }
$patchText = if (Test-Path $patchFile) { Get-Content $patchFile -Raw } else { "" }
$missingPatch = @($wanted | Where-Object { $_ -and ($patchText -notmatch [regex]::Escape($_)) })
Check "patch layer carries all $($wanted.Count) plugin ids" ($wanted.Count -gt 0 -and $missingPatch.Count -eq 0) ("missing: " + ($missingPatch -join ","))
$installed = if (Test-Path $modules) { @(Get-ChildItem $modules -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'dsh-client-ui-plugin-*' }).Count } else { 0 }
Check "plugin packages present in the home ($installed)" ($installed -ge 1)
if ($installCode -ne 0) { Write-Host ($installOut -split "`r?`n" | Select-Object -Last 12) }

# --- boot against that home -----------------------------------------------------
Write-Host ""
Write-Host "2) boot the core against that home (fresh profile + patch layer)"
$outFile = Join-Path $root "boot-out.txt"
$errFile = Join-Path $root "boot-err.txt"
$env:DSH_HOME = $home_
$args = @($CoreEntry, "web", "--no-open", "--port", "0")
$p = Start-Process -FilePath $NodeExe -ArgumentList $args -RedirectStandardOutput $outFile `
  -RedirectStandardError $errFile -PassThru -NoNewWindow
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$url = ""
$code = ""
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  if ($p.HasExited) { break }
  if (-not (Test-Path $outFile)) { continue }
  $text = Get-Content $outFile -Raw -ErrorAction SilentlyContinue
  if ([string]::IsNullOrEmpty($text)) { continue }
  $m = [regex]::Match($text, 'dsh web: http://127\.0\.0\.1:(\d+)/')
  if (-not $m.Success) { continue }
  $url = "http://127.0.0.1:$($m.Groups[1].Value)/"
  $code = (& curl.exe -s -o NUL -w "%{http_code}" --max-time 5 $url) 2>$null
  if ("$code" -match '^\d+$' -and [int]"$code" -gt 0) { break }
}
$alive = -not $p.HasExited
$errText = if (Test-Path $errFile) { Get-Content $errFile -Raw } else { "" }
$outText = if (Test-Path $outFile) { Get-Content $outFile -Raw } else { "" }
if ($alive) { try { $p.Kill() } catch { } }

Check "core stays alive with the plugins installed (no boot crash)" $alive ("exit=" + $p.ExitCode)
Check "core serves HTTP on its announced port" ("$code" -match '^\d+$' -and [int]"$code" -gt 0) $(if ($url) { "$url -> $code" } else { "no URL captured" })
$hmr = 'user patch-layer watching requires the Cordis HMR service'
Check "no HMR patch-layer abort (HANDOVER 42 signature)" (-not ($errText -match [regex]::Escape($hmr)) -and -not ($outText -match [regex]::Escape($hmr)))
$profilePkg = Join-Path $home_ "profiles\web\package.json"
$profileText = if (Test-Path $profilePkg) { Get-Content $profilePkg -Raw } else { "" }
Check "profile does not opt into live patch reload" (-not ($profileText -match '"patchReload"\s*:\s*"live"'))

if (-not $alive -or [string]::IsNullOrEmpty($code)) {
  Write-Host "  --- stderr tail ---"
  ($errText -split "`r?`n" | Where-Object { $_ } | Select-Object -Last 25) | ForEach-Object { Write-Host "  $_" }
  Write-Host "  --- stdout tail ---"
  ($outText -split "`r?`n" | Where-Object { $_ } | Select-Object -Last 15) | ForEach-Object { Write-Host "  $_" }
}

# --- the patch layer must still be accepted by the new core ---------------------
Write-Host ""
Write-Host "3) core still accepts the patch layer (--dump-config)"
# Direct call with captured output: `Start-Process -Wait -PassThru` hands back a NULL
# process in this environment (the documented "silent Start-Process" trap, HANDOVER 49.4).
# `--dump-config` needs the profile name we patch (profiles\web).
$dumpText = (& $NodeExe $CoreEntry --profile web --dump-config 2>&1 | Out-String)
if ([string]::IsNullOrWhiteSpace($dumpText) -or $dumpText -match '(?i)unknown option|usage:|not a valid|no such') {
  Skipped "--dump-config lists the $($wanted.Count) patch ids" "this core has no usable --dump-config"
} else {
  $missingDump = @($wanted | Where-Object { $_ -and ($dumpText -notmatch [regex]::Escape($_)) })
  Check "--dump-config lists all $($wanted.Count) patch ids" ($missingDump.Count -eq 0) ("missing: " + ($missingDump -join ","))
}

# --- cleanup / summary ----------------------------------------------------------
if (-not $Keep) { Remove-Item $home_ -Recurse -Force -ErrorAction SilentlyContinue }
else { Write-Host "    kept: $home_" }

Write-Host ""
Write-Host "RESULT: $pass passed, $fail failed, $skip skipped  (core $coreVersion)"
if ($fail -eq 0) { exit 0 } else { exit 1 }
