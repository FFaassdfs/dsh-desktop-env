# restore-dsh-home.ps1 - merge a backup-dsh-home.ps1 snapshot back into $DSH_HOME.
#
# version: 1.0   (2026-09-27)
# changelog:
#   1.0 (2026-09-27) first version. Written after $DSH_HOME was rebuilt from
#       scratch at 2026-09-27 08:38 (HANDOVER 46): sessions\ came back empty and
#       storages\workspace.json lost the D:\dsh\dsh-desktop-env workspace together
#       with every session in it. The daily task "dsh-desktop-backup-DSH_HOME"
#       (installed 2026-09-24, .work\backup-dsh-home.ps1) had already saved four
#       snapshots, so the history was intact - but there was no way to put it
#       back. This is the other half of that safety net.
#
# MERGE RULES (a restore must never destroy what is live right now):
#   * a session transcript that already exists in $DSH_HOME is LEFT ALONE. The
#     live copy is at least as new, and rolling a session back would lose turns.
#   * storages\workspace.json is MERGED, not replaced:
#       - restored session ids are added to the workspace whose path matches;
#       - a workspace that no longer exists is re-created under its ORIGINAL id;
#       - the current workspaces/sessions/archived/pinned ids are never removed.
#   * .anonymous-user-id is only restored with -IncludeIdentity (and only when
#     the live home has none).
#   * profiles\web\cordis.patch.yml (model + plugin config) is NOT touched unless
#     -IncludeConfig is given. After a rebuild the harness writes a fresh copy
#     itself; a stale one can reference plugins or endpoints you no longer use.
#   * the run always writes the merged document to $StageDir first, so a restart
#     helper can re-apply it cheaply (see .work\restore-on-service-restart.ps1).
#
# A SERVICE RESTART IS REQUIRED: dsh web loads storages\workspace.json once at
# boot, so restored sessions appear in the GUI only after the service restarts
# (shell status panel -> "Restart service"). To avoid losing the merge to the
# old process's exit-time flush, use .work\restore-on-service-restart.ps1, which
# re-applies the staged file while port 43080 is closed.
#
# Usage:
#   pwsh -File .work\restore-dsh-home.ps1 -CheckOnly     # show what would happen
#   pwsh -File .work\restore-dsh-home.ps1                # newest backup -> $DSH_HOME
#   pwsh -File .work\restore-dsh-home.ps1 -From D:\dsh\backups\dsh-home-20260926-120002
#   pwsh -File .work\restore-dsh-home.ps1 -StageOnly     # only write the staged file
#   pwsh -File .work\restore-dsh-home.ps1 -IncludeConfig -IncludeIdentity
#   pwsh -File .work\restore-dsh-home.ps1 -NoSnapshot    # skip the pre-restore backup
#   pwsh -File .work\restore-dsh-home.ps1 -DSHome D:\dsh-home
#
# Exit codes: 0 = ok (or nothing to do), 1 = failure.
#
# ASCII-only on purpose (Windows PowerShell 5.1 misreads BOM-less UTF-8 scripts
# with non-ASCII content).
param(
  [string]$DSHome = "",
  [string]$From = "",
  [string]$BackupRoot = "D:\dsh\backups",
  [string]$StageDir = "",
  [switch]$IncludeConfig,
  [switch]$IncludeIdentity,
  [switch]$NoSnapshot,
  [switch]$StageOnly,
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    [!!] $m" -ForegroundColor Yellow }
function Info($m) { Write-Host "    [--] $m" }

if (-not $DSHome) { $DSHome = Join-Path $env:USERPROFILE ".dsh" }
if (-not $StageDir) { $StageDir = Join-Path (Split-Path $PSScriptRoot -Parent) ".cache\dsh-restore-staged" }

Write-Host "dsh-desktop: restore DSH_HOME from a backup" -ForegroundColor Magenta
Write-Host "  DSH_HOME  : $DSHome"
Write-Host "  backup    : $(if ($From) { $From } else { "newest under $BackupRoot" })"
Write-Host "  stage dir : $StageDir"
Write-Host "  CheckOnly : $CheckOnly"
Write-Host "  IncludeCfg: $IncludeConfig   IncludeId: $IncludeIdentity"

if (-not (Test-Path $DSHome)) { throw "DSH_HOME not found: $DSHome" }

# --- pick the snapshot --------------------------------------------------------
Step "1/7 choosing the snapshot"
if (-not $From) {
  $cand = @(Get-ChildItem $BackupRoot -Directory -Filter "dsh-home-*" -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending)
  if ($cand.Count -eq 0) { throw "no dsh-home-* backup found under $BackupRoot" }
  $From = $cand[0].FullName
}
if (-not (Test-Path $From)) { throw "backup not found: $From" }
Ok "source: $From"
if (-not (Test-Path (Join-Path $From "sessions"))) { Warn "this backup has no sessions\ - nothing to restore from it" }

# --- pre-restore snapshot of the live home ------------------------------------
Step "2/7 snapshotting the live home (so this restore is reversible)"
if ($NoSnapshot -or $CheckOnly) {
  Info "skipped ($(if ($CheckOnly) { 'check only' } else { '-NoSnapshot' }))"
} else {
  $snapRoot = Join-Path $BackupRoot "pre-restore"
  $before = @(Get-ChildItem $snapRoot -Directory -Filter "dsh-home-*" -ErrorAction SilentlyContinue |
              Sort-Object Name -Descending)
  # NOTE: do NOT test $LASTEXITCODE here. backup-dsh-home.ps1 drives robocopy, and
  # robocopy's own exit code (1 = "files copied", still a success) leaks into
  # $LASTEXITCODE of the caller. A real failure inside that script throws, and the
  # terminating error propagates by itself - so the check is "did a NEW snapshot
  # directory appear".
  & (Join-Path $PSScriptRoot "backup-dsh-home.ps1") -DSHome $DSHome -OutDir $snapRoot -Keep 5 | Out-Null
  $after = @(Get-ChildItem $snapRoot -Directory -Filter "dsh-home-*" -ErrorAction SilentlyContinue |
             Sort-Object Name -Descending)
  if ($after.Count -eq 0) { throw "pre-restore snapshot produced nothing under $snapRoot" }
  if ($before.Count -gt 0 -and $after[0].Name -eq $before[0].Name) {
    throw "pre-restore snapshot did not create a new snapshot (newest is still $($after[0].Name))"
  }
  Ok "live home saved to $($after[0].FullName)"
}

# --- plan: which transcripts are missing --------------------------------------
Step "3/7 planning the session restore"
$srcSessions = Join-Path $From "sessions"
$dstSessions = Join-Path $DSHome "sessions"
$toCopy = @()      # [pscustomobject] Tag/SessionId/Src/Dst
$kept = 0
if (Test-Path $srcSessions) {
  foreach ($tag in Get-ChildItem $srcSessions -Directory) {
    foreach ($sdir in Get-ChildItem $tag.FullName -Directory) {
      $src = Join-Path $sdir.FullName "session.v4.jsonl.zstd"
      if (-not (Test-Path $src)) {
        $alt = @(Get-ChildItem $sdir.FullName -File -Filter "session.v4.*" -ErrorAction SilentlyContinue)
        if ($alt.Count -eq 0) { Warn "no transcript in $($sdir.FullName) - skipped"; continue }
        $src = $alt[0].FullName
      }
      $dst = Join-Path (Join-Path $dstSessions $tag.Name) $sdir.Name
      $dstFile = Join-Path $dst (Split-Path $src -Leaf)
      if (Test-Path $dstFile) { $kept++; continue }
      $toCopy += [pscustomobject]@{ Tag = $tag.Name; Id = $sdir.Name; Src = $src; Dst = $dst }
    }
  }
}
Ok ("{0} transcript(s) to restore, {1} already present (left untouched)" -f $toCopy.Count, $kept)
foreach ($c in $toCopy) { Info ("+ {0}  ({1:N0} bytes)" -f $c.Id, (Get-Item $c.Src).Length) }

# --- plan: projection cache ---------------------------------------------------
Step "4/7 planning the projection-cache restore"
$srcPc = Join-Path $From "storages\session_projcache\sessions"
$dstPc = Join-Path $DSHome "storages\session_projcache\sessions"
$pcCopy = @()
if (Test-Path $srcPc) {
  foreach ($f in Get-ChildItem $srcPc -File -Filter "*.json") {
    $dst = Join-Path $dstPc $f.Name
    # Derived cache: only fill gaps. A live file is rewritten by the harness and
    # may hold rows newer than the transcript we are restoring.
    if (Test-Path $dst) { continue }
    $pcCopy += [pscustomobject]@{ Src = $f.FullName; Dst = $dst; Name = $f.Name }
  }
}
Ok ("{0} cache file(s) to restore (existing ones are never overwritten)" -f $pcCopy.Count)

# --- plan: workspace index merge ----------------------------------------------
Step "5/7 planning the workspace index merge"
function ConvertTo-DeepHashtable($v) {
  if ($null -eq $v) { return $null }
  if ($v -is [System.Collections.IDictionary]) {
    $h = [ordered]@{}
    foreach ($k in $v.Keys) { $h[$k] = ConvertTo-DeepHashtable $v[$k] }
    return $h
  }
  if ($v -is [System.Management.Automation.PSCustomObject]) {
    $h = [ordered]@{}
    foreach ($p in $v.PSObject.Properties) { $h[$p.Name] = ConvertTo-DeepHashtable $p.Value }
    return $h
  }
  if ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])) {
    $a = @()
    foreach ($x in $v) { $a += ,(ConvertTo-DeepHashtable $x) }
    # Write-Output -NoEnumerate, NOT "return $a": a function return enumerates the
    # array, so a ONE-element list comes back as a bare string and the merged JSON
    # ends up as "sessionIds": "session-x" instead of ["session-x"] (found by the
    # round-trip check in step 7 on 2026-09-27).
    Write-Output -NoEnumerate $a
    return
  }
  return $v
}
function Normalize-Path($p) { if ($null -eq $p) { return "" } return ([string]$p).TrimEnd('\', '/').ToLowerInvariant() }

# Guards the exact bug this script shipped with for one dry run: a one-element id
# list serializing as a bare string ("sessionIds": "session-x") instead of a JSON
# array. Reading that back gives a string where the harness expects a list.
function Assert-IdArrayShape($d, $label) {
  $bad = @()
  if ($d.Contains("tables") -and $d["tables"].Contains("workspaces")) {
    foreach ($k in @($d["tables"]["workspaces"].Keys)) {
      $v = $d["tables"]["workspaces"][$k]["sessionIds"]
      if ($null -ne $v -and ($v -is [string])) { $bad += "workspace $k : sessionIds is a STRING, not a list" }
    }
  }
  if ($d.Contains("global")) {
    foreach ($k in @("workspaceIds", "archivedSessionIds", "pinnedSessionIds")) {
      if ($d["global"].Contains($k)) {
        $v = $d["global"][$k]
        if ($null -ne $v -and ($v -is [string])) { $bad += "global.$k is a STRING, not a list" }
      }
    }
  }
  if ($bad.Count -gt 0) { throw ("$label : " + ($bad -join "; ")) }
}

$liveWs = Join-Path $DSHome "storages\workspace.json"
$srcWs = Join-Path $From "storages\workspace.json"
$doc = $null
$wsNotes = @()
if ((Test-Path $liveWs) -and (Test-Path $srcWs)) {
  $doc = ConvertTo-DeepHashtable (Get-Content $liveWs -Raw | ConvertFrom-Json)
  $bak = ConvertTo-DeepHashtable (Get-Content $srcWs -Raw | ConvertFrom-Json)
  if (-not $doc.Contains("tables")) { $doc["tables"] = [ordered]@{} }
  if (-not $doc["tables"].Contains("workspaces")) { $doc["tables"]["workspaces"] = [ordered]@{} }
  if (-not $doc.Contains("global")) { $doc["global"] = [ordered]@{} }
  $g = $doc["global"]
  foreach ($k in @("workspaceIds", "archivedSessionIds", "pinnedSessionIds")) {
    if (-not $g.Contains($k) -or $null -eq $g[$k]) { $g[$k] = @() }
  }
  $bw = @{}
  if ($bak.Contains("tables") -and $bak["tables"].Contains("workspaces")) {
    foreach ($k in $bak["tables"]["workspaces"].Keys) { $bw[$k] = $bak["tables"]["workspaces"][$k] }
  }
  # index the live workspaces by path
  $byPath = @{}
  foreach ($k in @($doc["tables"]["workspaces"].Keys)) {
    $byPath[(Normalize-Path $doc["tables"]["workspaces"][$k]["path"])] = $k
  }
  foreach ($bkId in $bw.Keys) {
    $bws = $bw[$bkId]
    $restored = @()
    foreach ($sid in @($bws["sessionIds"])) { if ($sid) { $restored += [string]$sid } }
    $path = Normalize-Path $bws["path"]
    if ($byPath.ContainsKey($path)) {
      $liveId = $byPath[$path]
      $have = @($doc["tables"]["workspaces"][$liveId]["sessionIds"])
      $add = @($restored | Where-Object { $have -notcontains $_ })
      if ($add.Count -gt 0) {
        # restored (older) ids first, then what the live workspace already had
        $doc["tables"]["workspaces"][$liveId]["sessionIds"] = @($add + $have)
        $wsNotes += ("{0}: +{1} session(s) -> {2} total" -f $bws["title"], $add.Count, (@($doc["tables"]["workspaces"][$liveId]["sessionIds"]).Count))
      } else {
        $wsNotes += ("{0}: already complete" -f $bws["title"])
      }
    } else {
      # the workspace itself is gone (this is what happened on 2026-09-27)
      $doc["tables"]["workspaces"][$bkId] = $bws
      if ($doc["global"]["workspaceIds"] -notcontains $bkId) {
        $doc["global"]["workspaceIds"] = @($doc["global"]["workspaceIds"]) + $bkId
      }
      $wsNotes += ("{0}: re-created workspace {1} with {2} session(s)" -f $bws["title"], $bkId, $restored.Count)
    }
  }
  foreach ($k in @("archivedSessionIds", "pinnedSessionIds")) {
    if ($bak.Contains("global") -and $bak["global"].Contains($k)) {
      $union = @($doc["global"][$k])
      foreach ($sid in @($bak["global"][$k])) { if ($sid -and ($union -notcontains $sid)) { $union += $sid } }
      $doc["global"][$k] = $union
    }
  }
  if (-not $doc["global"].Contains("defaultWorkspaceId") -and $bak["global"].Contains("defaultWorkspaceId")) {
    $doc["global"]["defaultWorkspaceId"] = $bak["global"]["defaultWorkspaceId"]
  }
  foreach ($n in $wsNotes) { Info $n }
} elseif (-not (Test-Path $liveWs)) {
  Warn "live workspace.json is missing - it will be restored as-is from the backup"
} else {
  Warn "this backup has no storages\workspace.json - session ids cannot be re-linked"
}

New-Item -ItemType Directory -Force -Path $StageDir | Out-Null
$stageWs = Join-Path $StageDir "workspace.json"
if ($doc) {
  # Defensive: the stored lists MUST serialize as JSON arrays. A single-element
  # list that survives as a bare string would be read back as a string by the
  # harness and break the workspace table.
  foreach ($k in @($doc["tables"]["workspaces"].Keys)) {
    $doc["tables"]["workspaces"][$k]["sessionIds"] = [string[]]@($doc["tables"]["workspaces"][$k]["sessionIds"])
  }
  foreach ($k in @("workspaceIds", "archivedSessionIds", "pinnedSessionIds")) {
    $doc["global"][$k] = [string[]]@($doc["global"][$k])
  }
  ($doc | ConvertTo-Json -Depth 20) | Set-Content -Encoding UTF8 $stageWs
  Assert-IdArrayShape (ConvertTo-DeepHashtable (Get-Content $stageWs -Raw | ConvertFrom-Json)) "staged $stageWs"
  Ok "merged workspace index staged at $stageWs (array shapes verified)"
} elseif (Test-Path $srcWs) {
  Copy-Item $srcWs $stageWs -Force
  Ok "staged the backup's workspace.json at $stageWs"
}

# --- config / identity (opt-in only) ------------------------------------------
$cfgSrc = Join-Path $From "profiles\web\cordis.patch.yml"
$cfgDst = Join-Path $DSHome "profiles\web\cordis.patch.yml"
if ($IncludeConfig -and (Test-Path $cfgSrc)) {
  Info "cordis.patch.yml: $cfgDst will be REPLACED by the backup copy (live one is kept as .before-restore)"
} elseif (Test-Path $cfgSrc) {
  Info "cordis.patch.yml: left alone (use -IncludeConfig to force the backup copy)"
}
$idSrc = Join-Path $From ".anonymous-user-id"
$idDst = Join-Path $DSHome ".anonymous-user-id"
if ($IncludeIdentity -and (Test-Path $idSrc)) {
  if (Test-Path $idDst) {
    $same = ((Get-Content $idSrc -Raw).Trim() -eq (Get-Content $idDst -Raw).Trim())
    Info "anonymous-user-id: $(if ($same) { 'identical' } else { 'differs - will be replaced by the backup value' })"
  } else {
    Info "anonymous-user-id: missing in the live home - will be restored"
  }
}

if ($CheckOnly) {
  Step "check only - nothing written"
  Write-Host "    would restore $($toCopy.Count) transcript(s), $($pcCopy.Count) cache file(s)"
  Write-Host "    would merge the workspace index into $liveWs (staged at $stageWs)"
  Write-Host "    then: restart the service (shell panel) for the sessions to appear"
  exit 0
}

# --- apply --------------------------------------------------------------------
Step "6/7 applying"
if (-not $StageOnly) {
  $n = 0
  foreach ($c in $toCopy) {
    New-Item -ItemType Directory -Force -Path $c.Dst | Out-Null
    foreach ($f in Get-ChildItem (Split-Path $c.Src -Parent) -File) {
      Copy-Item $f.FullName (Join-Path $c.Dst $f.Name) -Force
    }
    $n++
  }
  Ok "restored $n transcript(s)"
  if ($pcCopy.Count -gt 0) {
    New-Item -ItemType Directory -Force -Path $dstPc | Out-Null
    foreach ($p in $pcCopy) { Copy-Item $p.Src $p.Dst -Force }
    Ok "restored $($pcCopy.Count) projection-cache file(s)"
  }
  if ($doc) {
    Copy-Item $liveWs "$liveWs.before-restore" -Force
    Copy-Item $stageWs $liveWs -Force
    Ok "workspace index merged into $liveWs (previous file kept as workspace.json.before-restore)"
  } elseif (Test-Path $srcWs) {
    Copy-Item $srcWs $liveWs -Force
    Ok "workspace index restored from the backup"
  }
  if ($IncludeIdentity -and (Test-Path $idSrc)) {
    $old = if (Test-Path $idDst) { Get-Content $idDst -Raw } else { $null }
    Copy-Item $idSrc $idDst -Force
    if ($old) { Set-Content -Path "$idDst.before-restore" -Value $old -NoNewline -Encoding ASCII }
    Ok "anonymous-user-id restored"
  }
  if ($IncludeConfig -and (Test-Path $cfgSrc)) {
    if (Test-Path $cfgDst) { Copy-Item $cfgDst "$cfgDst.before-restore" -Force }
    Copy-Item $cfgSrc $cfgDst -Force
    Ok "cordis.patch.yml replaced by the backup copy"
  }
} else {
  Info "-StageOnly: nothing written into $DSHome"
}

# --- verify -------------------------------------------------------------------
Step "7/7 verifying"
$problems = @()
foreach ($c in $toCopy) {
  $dstFile = Join-Path $c.Dst (Split-Path $c.Src -Leaf)
  if (-not $StageOnly) {
    if (-not (Test-Path $dstFile)) { $problems += "missing after copy: $dstFile"; continue }
    $a = (Get-Item $c.Src).Length; $b = (Get-Item $dstFile).Length
    if ($a -ne $b) { $problems += "size differs: $dstFile ($b of $a)" }
  }
}
if ($doc -and -not $StageOnly) {
  $check = ConvertTo-DeepHashtable (Get-Content $liveWs -Raw | ConvertFrom-Json)
  Assert-IdArrayShape $check "live $liveWs"
  foreach ($k in @($doc["tables"]["workspaces"].Keys)) {
    $want = @($doc["tables"]["workspaces"][$k]["sessionIds"])
    $got = @($check["tables"]["workspaces"][$k]["sessionIds"])
    foreach ($sid in $want) { if ($got -notcontains $sid) { $problems += "workspace $k lost session $sid" } }
  }
  $arch = @($check["global"]["archivedSessionIds"])
  Info ("index now: {0} workspace(s), {1} archived id(s)" -f @($check["tables"]["workspaces"].Keys).Count, $arch.Count)
}
if ($problems.Count -gt 0) {
  $problems | ForEach-Object { Warn $_ }
  throw "restore verification failed"
}
Ok "transcripts present, sizes match, session ids re-linked"

Write-Host ""
Write-Host "done. NEXT STEP: restart the service (shell status panel -> Restart service)." -ForegroundColor Green
Write-Host "  dsh web reads storages\workspace.json once at boot, so the restored sessions"
Write-Host "  are listed only after the restart. For a race-free restart use:"
Write-Host "    pwsh -File .work\restore-on-service-restart.ps1"
