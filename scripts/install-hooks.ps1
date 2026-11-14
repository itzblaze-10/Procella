<#
.SYNOPSIS
    Configures git core.hooksPath to scripts/hooks on Windows.
#>
[CmdletBinding()]
param()

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    Write-Error "install-hooks: not inside a git repository."
    exit 1
}
Set-Location $repoRoot

git config core.hooksPath scripts/hooks
Write-Host "hooks installed: core.hooksPath = scripts/hooks" -ForegroundColor Green
