# push-via-api.ps1 - fast-forward a branch on GitHub through the REST API.
#
# WHY THIS EXISTS (2026-09-27, HANDOVER 46.4-5): the SSH private key under
# ~/.ssh was destroyed with the rest of the home directory, so `git push` over
# SSH cannot authenticate; and github.com's HTTPS git endpoint is not reachable
# from this machine at all (curl https://github.com/ -> 000). api.github.com IS
# reachable and Windows Credential Manager still holds a valid token, so the only
# way to publish the local commits is the git-data API.
#
# HOW IT STAYS SAFE - every object is proved identical before the ref moves:
#   * blob   : content is read as raw BYTES, and `git hash-object --no-filters`
#              must reproduce the local blob sha BEFORE anything is uploaded;
#              after POST /git/blobs the sha GitHub computed must equal it too.
#   * tree   : POST /git/trees with base_tree = the parent tree; the returned sha
#              must equal `git rev-parse <commit>^{tree}` (and the same for any
#              one-level subdirectory).
#   * commit : author / committer / date / message are copied verbatim from
#              `git cat-file commit`; the returned sha must equal the local
#              commit sha. If it does not, the ref is NOT moved.
#   * the branch only moves when the remote head is an ancestor of the local head
#     (a true fast-forward; force is never used).
#
# Usage:
#   pwsh -File push-via-api.ps1 -Token <tok> -CheckOnly
#   pwsh -File push-via-api.ps1 -Token <tok>
#
# Exit codes: 0 = ok, 1 = refused/failed (the ref was not moved).

param(
  # Prefer the environment variable: a token on the command line would be visible
  # in the process list while the script runs.
  [string]$Token = $env:GH_TOKEN,
  [string]$Repo = "FFaassdfs/dsh-desktop-env",
  [string]$Branch = "main",
  [string]$GitDir = "D:\dsh\dsh-desktop-env",
  [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
if (-not $Token) { throw "no token: set `$env:GH_TOKEN or pass -Token" }

$api = "https://api.github.com/repos/$Repo"
$tmp = Join-Path $env:TEMP ("pushviaapi-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# Every step is timestamped into a log file: this script hung twice with no
# output (stdout of a nested pwsh is buffered), and the log is what located it.
$logFile = Join-Path $env:TEMP "push-via-api.log"
function Log($m) { Add-Content -Path $logFile -Value ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss.fff'), $m) }
Log "== start (CheckOnly=$CheckOnly, repo=$Repo, branch=$Branch) =="

# HTTP goes through curl.exe, NOT Invoke-RestMethod. Measured 2026-09-27: on this
# machine Invoke-RestMethod hangs (>2 min, .NET/schannel + proxy auto-discovery)
# while curl.exe answers api.github.com in well under a second. The token is kept
# in a curl config file so it never shows up in the process list.
$curlCfg = Join-Path $tmp "curl.cfg"
@(
  "header = `"Authorization: Bearer $Token`""
  "header = `"Accept: application/vnd.github+json`""
  "header = `"X-GitHub-Api-Version: 2022-11-28`""
  "header = `"User-Agent: dsh-desktop-recovery`""
  "silent"
  "show-error"
  "max-time = 60"
) | Set-Content -Path $curlCfg -Encoding ascii

# NEVER name these functions `Git`/`git`, and always call `git.exe`: PowerShell
# resolves FUNCTIONS before external commands, so `& git ...` inside a function
# called Git calls ITSELF. Measured 2026-09-27: the argument list grew by
# "-C <dir> --no-pager" per recursion level until git looked like it had hung
# (the log showed the command line doubling for hundreds of lines).
function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  Log ("git: " + ($GitArgs -join ' '))
  $out = & git.exe -C $GitDir --no-pager @GitArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw "git $($GitArgs -join ' ') failed ($LASTEXITCODE): $out" }
  Log ("  -> {0} line(s) in {1} ms" -f @($out).Count, $sw.ElapsedMilliseconds)
  return @($out)
}
function Get-GitLine {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  # @() around the call is essential: a one-line result comes back from a
  # function as a bare string, and indexing that yields the first CHARACTER
  # (measured: `rev-parse HEAD` returned "6" instead of "6e2b7fe...").
  $lines = @(Invoke-Git @GitArgs)
  # Trim() removes the CR that git emits on Windows: a "\r" in a sha or a file
  # name silently corrupts every tree we build (measured 2026-09-30).
  return ([string]$lines[0]).Trim()
}
function Api {
  param([string]$Method, [string]$Uri, $Body)
  $outFile = Join-Path $tmp ("resp-" + [guid]::NewGuid().ToString("N") + ".json")
  # NOT $args: that is the automatic argument array and would collide with splatting.
  $cargs = @("--config", $curlCfg, "-X", $Method, "-o", $outFile, "-w", "%{http_code}")
  if ($null -ne $Body) {
    $bodyFile = Join-Path $tmp ("req-" + [guid]::NewGuid().ToString("N") + ".json")
    $json = $Body | ConvertTo-Json -Depth 8 -Compress
    # ConvertTo-Json escapes non-ASCII as \uXXXX by default, which is fine, but it
    # also escapes a few characters in a way curl's --data-binary does not care
    # about. What DOES matter: the payload must be bytes-exact, so write it
    # ourselves without a BOM.
    [IO.File]::WriteAllBytes($bodyFile, [Text.Encoding]::UTF8.GetBytes($json))
    if ($env:DSH_PUSH_DEBUG) {
      # Diagnostic aid: dump the exact request body. Used to find the 2026-09-30
      # tree mismatch (GitHub computed a different sha than `git mktree` from what
      # looked like the same entries).
      Copy-Item $bodyFile (Join-Path $tmp ("dump-" + [guid]::NewGuid().ToString("N") + ".json"))
      Log ("request body: " + $json.Substring(0, [Math]::Min(400, $json.Length)))
    }
    $cargs += @("-H", "Content-Type: application/json; charset=utf-8", "--data-binary", "@$bodyFile")
  }
  $cargs += $Uri
  Log "API $Method $Uri"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $code = (& curl.exe @cargs | Out-String).Trim()
  Log ("  -> HTTP {0} in {1} ms" -f $code, $sw.ElapsedMilliseconds)
  if ($code -notmatch '^2\d\d$') {
    $detail = if (Test-Path $outFile) { Get-Content $outFile -Raw } else { "" }
    throw "API $Method $Uri -> HTTP $code`n$detail"
  }
  return (Get-Content $outFile -Raw -Encoding UTF8 | ConvertFrom-Json)
}
# Raw bytes of a git object. .NET Process + BaseStream (NOT a PowerShell
# pipeline, which decodes text and would change CRLF / encoding and therefore
# the blob sha).
function ObjectBytes {
  param([string]$Type, [string]$Spec)
  $psi = [Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = "git"
  $psi.ArgumentList.Add("-C"); $psi.ArgumentList.Add($GitDir)
  $psi.ArgumentList.Add("cat-file"); $psi.ArgumentList.Add($Type); $psi.ArgumentList.Add($Spec)
  $psi.RedirectStandardOutput = $true
  $psi.UseShellExecute = $false
  $proc = [Diagnostics.Process]::Start($psi)
  $ms = [IO.MemoryStream]::new()
  $proc.StandardOutput.BaseStream.CopyTo($ms)
  $proc.WaitForExit()
  if ($proc.ExitCode -ne 0) { throw "cat-file $Type $Spec failed (exit $($proc.ExitCode))" }
  return $ms.ToArray()
}
function ParseIdent {
  param([string]$Line, [string]$What)
  if ($Line -notmatch '^(.*) <(.*)> (\d+) ([+-]\d{4})$') { throw "cannot parse $What ident: $Line" }
  $off = [TimeSpan]::FromHours([int]$Matches[4].Substring(0, 3))
  return @{
    name  = $Matches[1]
    email = $Matches[2]
    date  = [DateTimeOffset]::FromUnixTimeSeconds([long]$Matches[3]).ToOffset($off).ToString("yyyy-MM-ddTHH:mm:sszzz")
  }
}

Write-Host "== push via GitHub API (fast-forward only) ==" -ForegroundColor Magenta
Write-Host "  repo   : $Repo"
Write-Host "  branch : $Branch"
Write-Host "  git dir: $GitDir"
Write-Host "  mode   : $(if ($CheckOnly) { 'CHECK ONLY (no writes)' } else { 'REAL' })"

$ref = Api GET "$api/git/ref/heads/$Branch"
$remoteSha = $ref.object.sha
$localHead = Get-GitLine rev-parse HEAD
Write-Host "  remote head : $remoteSha"
Write-Host "  local  head : $localHead"

& git.exe -C $GitDir merge-base --is-ancestor $remoteSha $localHead
if ($LASTEXITCODE -ne 0) { throw "remote $remoteSha is NOT an ancestor of local $localHead - refusing (not a fast-forward)" }

$commits = @(Invoke-Git rev-list --reverse "$remoteSha..HEAD")
if ($commits.Count -eq 0) { Write-Host "nothing to push (already in sync)" -ForegroundColor Green; exit 0 }
Write-Host "  commits to publish: $($commits.Count)"
foreach ($c in $commits) { Write-Host ("    {0}  {1}" -f $c.Substring(0, 7), (Get-GitLine log -1 --format=%s $c)) }

# --- build the plan, reading every object and self-checking the blob shas ----
$plan = @()
foreach ($c in $commits) {
  $parent = Get-GitLine rev-parse "$c^"
  $raw = [Text.Encoding]::UTF8.GetString((ObjectBytes commit $c))
  $idx = $raw.IndexOf("`n`n")
  if ($idx -lt 0) { throw "cannot split commit object $c" }
  $hdr = $raw.Substring(0, $idx) -split "`n"
  $message = $raw.Substring($idx + 2)
  $author = ParseIdent (($hdr | Where-Object { $_ -like "author *" }) -replace "^author ", "") "author"
  $committer = ParseIdent (($hdr | Where-Object { $_ -like "committer *" }) -replace "^committer ", "") "committer"

  $changed = @()
  foreach ($line in @(Invoke-Git diff-tree -r --no-commit-id --name-status "$c^" $c)) {
    # Trim FIRST: `git diff-tree` output arrives with CRLF line endings on this
    # machine, so the trailing "\r" survives into the file name and the path.
    # Uploading "app.go\r" makes GitHub build a tree whose entries do not match
    # git's, which surfaced as 422 "tree.sha ... is not a valid blob" and then as
    # a subtree sha mismatch (measured 2026-09-30, the S1 commit).
    $line = ([string]$line).Trim()
    if ($line -notmatch "^([A-Z])\s+(.+)$") { continue }
    $path = $Matches[2].Trim()
    $dir = Split-Path $path -Parent
    # Normalize to forward slashes HERE, so ".dir" (used to group a directory's
    # files) and "$dirSet" (used to enumerate the directories) are the same
    # strings. Mixing them silently produced empty file lists - see the note on
    # the $blobs entry below.
    if ($dir) { $dir = ($dir -replace "\\", "/").Trim() }
    # An EMPTY $dir is handled below as "top level". Anything deeper than one
    # level is now supported by walking the path components and creating each
    # subtree in turn (2026-09-30: the first commit to add a nested directory -
    # assistant/frontend/src/*, assistant/build/windows/*, internal/officialdetect/*
    # - hit the old "path deeper than one level not supported" guard, which was
    # written when every commit happened to touch at most one level).
    $changed += [pscustomobject]@{ status = $Matches[1]; path = $path; dir = $dir; name = (Split-Path $path -Leaf).Trim() }
  }

  $blobs = @()
  foreach ($f in $changed) {
    $blobSha = Get-GitLine rev-parse "$($c):$($f.path)"
    $mode = ((Get-GitLine ls-tree $c -- $f.path) -split "\s+")[0]
    $bytes = ObjectBytes blob "$($c):$($f.path)"
    $bf = Join-Path $tmp ("b-" + [guid]::NewGuid().ToString("N"))
    [IO.File]::WriteAllBytes($bf, $bytes)
    $localHash = Get-GitLine hash-object -t blob --no-filters $bf
    if ($localHash -ne $blobSha) { throw "byte extraction is wrong for $($f.path): hash-object $localHash != $blobSha" }
    $blobs += [pscustomobject]@{
      path = $f.path
      name = $f.name
      # Normalized to FORWARD SLASHES: $dirSet (and every tree path) uses "/",
      # and PowerShell's -eq does not treat "\" and "/" as equal, so keeping the
      # backslash Split-Path returns made `$_.dir -eq $d` match NOTHING - every
      # directory was built with an empty file list and no child trees, which
      # GitHub answered with a 422 or a silently different tree sha
      # (measured 2026-09-30 on the S1 commit).
      dir = $f.dir
      mode = $mode
      sha = $blobSha
      b64 = [Convert]::ToBase64String($bytes)
    }
  }

  # Every directory that contains a changed file, at any depth, including the
  # ancestors of those directories.
  $dirSet = New-Object System.Collections.Generic.HashSet[string]
  foreach ($b in $blobs) {
    if (-not $b.dir) { continue }
    $parts = $b.dir -split "/"
    for ($i = 0; $i -lt $parts.Count; $i++) {
      [void]$dirSet.Add(($parts[0..$i] -join "/"))
    }
  }
  # Planning order is irrelevant to correctness (the build loop below re-sorts
  # deepest-first); this is just a stable, readable sequence.
  $dirs = @($dirSet | Sort-Object { ($_ -split "/").Count }, { $_ })

  $entries = @()
  foreach ($d in $dirs) {
    # Depth is computed inline rather than stored: `depth = ($d -split "/").Count`
    # inside a hashtable literal is parsed as an expression over an ARRAY key, not
    # as an assignment of the count, which silently produced nested arrays for the
    # later sort. Keep it as a plain expression.
    $depth = @($d -split "/").Count
    $entries += [pscustomobject]@{
      kind = "tree"; path = $d; mode = "040000"
      depth = $depth
      sha  = Get-GitLine rev-parse "$($c):$d"
      # The parent commit may not contain this directory at all (brand new, or a
      # nested path whose ancestors are new); git then reports the EMPTY TREE sha,
      # which GitHub rejects as a base - see the build loop below.
      base = $(try { Get-GitLine rev-parse "$($parent):$d" } catch { "" })
      files = @($blobs | Where-Object { $_.dir -eq $d })
    }
  }
  foreach ($b in @($blobs | Where-Object { -not $_.dir })) {
    $entries += [pscustomobject]@{ kind = "blob"; path = $b.name; mode = $b.mode; sha = $b.sha; b64 = $b.b64 }
  }
  $plan += [pscustomobject]@{
    commit = $c; parent = $parent; message = $message; author = $author; committer = $committer
    entries = $entries; treeSha = Get-GitLine rev-parse "$($c)^{tree}"; baseTree = Get-GitLine rev-parse "$($parent)^{tree}"
  }
  Write-Host ("  {0}: {1} file(s) -> tree {2} (all blob bytes verified locally)" -f $c.Substring(0, 7), $blobs.Count, $plan[-1].treeSha.Substring(0, 7))
}

if ($CheckOnly) {
  Write-Host ""
  Write-Host "CHECK ONLY: nothing created, nothing pushed. Plan is complete and every local object was read successfully." -ForegroundColor Green
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  exit 0
}

# --- replay the objects -------------------------------------------------------
$newParent = $remoteSha
foreach ($p in $plan) {
  if ($p.parent -ne $newParent) { throw "parent chain broken at $($p.commit): expected $newParent, git says $($p.parent)" }
  # Subtree shas created during THIS commit, keyed by repo-relative path: a
  # parent tree references its children by sha, so they must exist first.
  $createdTrees = @{}
  $rootEntries = @()
  # (1) root-level blobs, then (2) subtrees DEEPEST-FIRST. A tree entry is
  # validated by GitHub against objects that already exist, so a blob must be
  # uploaded before any tree names it, and a CHILD tree must exist before its
  # PARENT names it — i.e. depth 5, 4, 3, 2, 1. Getting this backwards (shallow
  # first) is what made `assistant` build without its subdirectories and produce
  # a different sha (measured 2026-09-30 on the S1 commit; the debug run printed
  # the processing order and settled it).
  foreach ($e in @($p.entries | Where-Object { $_.kind -eq "blob" })) {
    $created = Api POST "$api/git/blobs" @{ content = $e.b64; encoding = "base64" }
    if ($created.sha -ne $e.sha) { throw "blob sha mismatch for $($e.path): github $($created.sha) != local $($e.sha)" }
    Write-Host "    blob ok  $($e.path)  $($e.sha.Substring(0,7))"
    $rootEntries += @{ path = $e.path; mode = $e.mode; type = "blob"; sha = $created.sha }
  }
  # EVERY directory is rebuilt from its full entry list: its changed files AND its
  # child trees. A directory with no changed files of its own still has to be
  # rebuilt when a descendant changed (git keeps the SAME sha there, and the POST
  # returns it again - that is the check that the reconstruction is correct).
  # Skipping those directories is what produced
  # 'tree.sha a8da6fd... is not a valid tree' for assistant/cmd on 2026-09-30.
  $dirsToBuild = @($p.entries | Where-Object { $_.kind -eq "tree" } | Sort-Object -Property @{ Expression = { $_.depth }; Descending = $true }, @{ Expression = { $_.path } })
  if ($env:DSH_PUSH_DEBUG) {
    # One line per directory IN PROCESSING ORDER: path, the depth value AS STORED
    # (with its type — a nested array here is exactly the kind of silent bug this
    # debug run exists to catch), file count, and the child trees already built.
    Write-Host ("DEBUG build order ({0}):" -f $dirsToBuild.Count)
    foreach ($d in $dirsToBuild) {
      Write-Host ("DEBUG   {0}  depth={1} [{2}]  files={3}" -f $d.path, $d.depth, $d.depth.GetType().Name, @($d.files).Count)
    }
  }
  foreach ($e in $dirsToBuild) {
    if ($env:DSH_PUSH_DEBUG) {
      $kids = @($createdTrees.Keys | Where-Object { $_ -like "$($e.path)/*" -and $_ -notlike "$($e.path)/*/*" })
      Write-Host ("DEBUG   building {0}: files={1} childrenBuilt=[{2}]" -f $e.path, @($e.files).Count, ($kids -join ","))
    }
    $subEntries = @()
    foreach ($file in $e.files) {
      $createdSub = Api POST "$api/git/blobs" @{ content = $file.b64; encoding = "base64" }
      if ($createdSub.sha -ne $file.sha) { throw "blob sha mismatch for $($file.path): github $($createdSub.sha) != local $($file.sha)" }
      Write-Host "    blob ok  $($file.path)  $($file.sha.Substring(0,7))"
      $subEntries += @{ path = $file.name; mode = $file.mode; type = "blob"; sha = $createdSub.sha }
    }
    foreach ($child in @($createdTrees.Keys | Where-Object { $_ -like "$($e.path)/*" -and $_ -notlike "$($e.path)/*/*" })) {
      $subEntries += @{ path = ($child.Substring($e.path.Length + 1)); mode = "040000"; type = "tree"; sha = $createdTrees[$child] }
    }
    # base_tree = the parent commit's version of THIS directory, i.e. "start from
    # what was there and apply the entries above". A brand-new directory has no
    # base ("" is rejected by GitHub with "Invalid tree info", measured), and a
    # parent commit that is EMPTY ("" sha) means the same thing - both cases post
    # the entries with no base at all.
    $sub = $null
    if ($e.base -and $e.base -ne "4b825dc642cb6eb9a060e54bf8d69288fbee4904") {
      $sub = Api POST "$api/git/trees" @{ base_tree = $e.base; tree = $subEntries }
    } else {
      $sub = Api POST "$api/git/trees" @{ tree = $subEntries }
    }
    if ($sub.sha -ne $e.sha) { throw "subtree sha mismatch for $($e.path): github $($sub.sha) != local $($e.sha)" }
    Write-Host "    tree ok  $($e.path)/  $($e.sha.Substring(0,7))"
    $createdTrees[$e.path] = $sub.sha
  }
  # Root-level directories are attached after the walk above.
  foreach ($e in @($p.entries | Where-Object { $_.kind -eq "tree" -and $_.path -notmatch "/" })) {
    $rootEntries += @{ path = $e.path; mode = $e.mode; type = "tree"; sha = $createdTrees[$e.path] }
  }
  $rootTree = Api POST "$api/git/trees" @{ base_tree = $p.baseTree; tree = $rootEntries }
  if ($rootTree.sha -ne $p.treeSha) { throw "root tree sha mismatch at $($p.commit): github $($rootTree.sha) != local $($p.treeSha)" }
  Write-Host "    tree ok  <root>  $($p.treeSha.Substring(0,7))"

  $newCommit = Api POST "$api/git/commits" @{
    message = $p.message; tree = $rootTree.sha; parents = @($p.parent); author = $p.author; committer = $p.committer
  }
  if ($newCommit.sha -ne $p.commit) {
    throw "COMMIT SHA MISMATCH: github $($newCommit.sha) != local $($p.commit) - ref NOT moved."
  }
  Write-Host "  commit ok  $($p.commit.Substring(0,7))  (sha identical to local)" -ForegroundColor Green
  $newParent = $newCommit.sha
}

# --- move the ref (fast-forward only) ----------------------------------------
$updated = Api PATCH "$api/git/refs/heads/$Branch" @{ sha = $newParent; force = $false }
if ($updated.object.sha -ne $localHead) { throw "ref is $($updated.object.sha) but local HEAD is $localHead" }
Write-Host ""
Write-Host "PUSHED: $Branch is now $($updated.object.sha) (== local HEAD)" -ForegroundColor Green
& git.exe -C $GitDir update-ref "refs/remotes/origin/$Branch" $updated.object.sha
Write-Host "local remote-tracking ref updated too."
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
exit 0
