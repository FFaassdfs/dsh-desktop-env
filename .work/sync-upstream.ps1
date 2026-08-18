# sync-upstream.ps1 - sync official deepseek-ai/deepseek-harness into the local clone and FFaassdfs/deepseek-harness
#
# Usage:
#   pwsh -File sync-upstream.ps1               # check only: report upstream new commits + local commits pending push
#   pwsh -File sync-upstream.ps1 -Apply        # merge upstream/master into master and push
#   pwsh -File sync-upstream.ps1 -Repo <path>  # explicit clone path (default: ./deepseek-harness next to this script)
#
# Push uses the system Git credential helper (Git Credential Manager).
# The upstream remote is added automatically on first run.
param(
    [switch]$Apply,
    [string]$Repo = (Join-Path $PSScriptRoot "deepseek-harness")
)

if (-not (Test-Path (Join-Path $Repo ".git"))) {
    throw "git repo not found: $Repo"
}
Set-Location $Repo

$remotes = @(git remote)
if ($remotes -notcontains "upstream") {
    Write-Host "==> adding upstream remote ..."
    git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git 2>&1 | Out-Null
}

Write-Host "==> fetching upstream + origin ..."
$out = git fetch upstream master 2>&1
if ($LASTEXITCODE -ne 0) {
    $out | ForEach-Object { Write-Host $_ }
    throw "git fetch upstream failed"
}
$out = git fetch origin master 2>&1
if ($LASTEXITCODE -ne 0) {
    $out | ForEach-Object { Write-Host $_ }
    throw "git fetch origin failed"
}

$upstream = git rev-parse upstream/master
$base = git merge-base master upstream/master
$new = @(git log --oneline "$base..upstream/master")

if ($new.Count -eq 0) {
    Write-Host "==> in sync: no new upstream commits (upstream/master = $($upstream.Substring(0,7)))"
} else {
    Write-Host "==> upstream has $($new.Count) new commit(s):"
    $new | ForEach-Object { Write-Host "    $_" }
}

$pending = @(git log --oneline origin/master..master)
if ($pending.Count -gt 0) {
    Write-Host "==> $($pending.Count) local commit(s) not yet pushed to origin:"
    $pending | ForEach-Object { Write-Host "    $_" }
} else {
    Write-Host "==> no local commits pending push."
}

if ($new.Count -eq 0 -or -not $Apply) {
    exit 0
}

Write-Host "==> merging upstream/master into master ..."
$out = git merge upstream/master --no-edit 2>&1
if ($LASTEXITCODE -ne 0) {
    $out | ForEach-Object { Write-Host $_ }
    Write-Host "!! merge conflict - resolve manually before pushing"
    exit 1
}

Write-Host "==> pushing to origin master ..."
$out = git push origin master 2>&1
if ($LASTEXITCODE -ne 0) {
    $out | ForEach-Object { Write-Host $_ }
    Write-Host "!! push failed (credential/network issue)"
    exit 1
}
Write-Host "==> done."
