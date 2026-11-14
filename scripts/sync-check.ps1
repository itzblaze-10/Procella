<#
.SYNOPSIS
    Verifies that the local folder and GitHub are identical for the current branch.
    Exit 0 = in sync. Non-zero = uncommitted, unpushed, or behind.
#>
[CmdletBinding()]
param()

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    Write-Error "sync-check: not inside a git repository."
    exit 2
}
Set-Location $repoRoot

$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
if (-not $branch -or $branch -eq "HEAD") {
    Write-Error "sync-check: detached HEAD or invalid branch."
    exit 2
}

git fetch origin --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "sync-check: cannot reach origin" -ForegroundColor Yellow
    exit 2
}

$status = 0
$changes = git status --porcelain 2>$null
if ($changes) {
    Write-Host "sync-check: UNCOMMITTED changes:" -ForegroundColor Yellow
    git status --short
    $status = 1
}

git rev-parse --verify --quiet "origin/$branch" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "sync-check: branch '$branch' does not exist on origin yet" -ForegroundColor Red
    exit 1
}

$ahead = [int](git rev-list --count "origin/$branch..HEAD" 2>$null)
$behind = [int](git rev-list --count "HEAD..origin/$branch" 2>$null)

if ($ahead -gt 0) {
    Write-Host "sync-check: $ahead commit(s) not pushed" -ForegroundColor Yellow
    $status = 1
}
if ($behind -gt 0) {
    Write-Host "sync-check: $behind commit(s) to pull from origin" -ForegroundColor Yellow
    $status = 1
}

if ($status -eq 0) {
    $commitShort = (git rev-parse --short HEAD)
    Write-Host "sync-check: local == origin/$branch ($commitShort)" -ForegroundColor Green
}

exit $status
