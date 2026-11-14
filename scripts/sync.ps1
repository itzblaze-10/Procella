<#
.SYNOPSIS
    Syncs the local Procella repository with GitHub on a 5-minute (or custom) basis.
.DESCRIPTION
    1. Fetches the latest state from origin.
    2. Pulls incoming commits using --rebase --autostash (aborts safely if conflicts occur).
    3. Stages and commits any uncommitted local changes (respecting .gitignore).
    4. Pushes local commits to origin.
.PARAMETER Continuous
    Run continuously in a loop sleeping IntervalSeconds between passes.
.PARAMETER IntervalSeconds
    Interval between sync cycles when running in continuous mode (default: 300 = 5 minutes).
.PARAMETER LogToFile
    Appends output to .tmp/sync.log in addition to stdout.
#>
[CmdletBinding()]
param(
    [switch]$Continuous,
    [int]$IntervalSeconds = 300,
    [switch]$LogToFile = $true
)

$ErrorActionPreference = "Continue"

# Resolve repo root (fallback to script's parent directory if invoked from outside)
if (-not (git rev-parse --is-inside-work-tree 2>$null)) {
    if ($PSScriptRoot -and (Test-Path "$PSScriptRoot\..\.git")) {
        Set-Location (Resolve-Path "$PSScriptRoot\..").Path
    }
}

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    Write-Error "sync: not inside a git repository."
    exit 2
}
Set-Location $repoRoot

$tmpDir = Join-Path $repoRoot ".tmp"
if (-not (Test-Path $tmpDir)) {
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
}
$logPath = Join-Path $tmpDir "sync.log"

function Write-SyncLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$timestamp] [$Level] $Message"
    Write-Output $line
    if ($LogToFile) {
        Add-Content -Path $logPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    }
}

function Invoke-SyncPass {
    $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
    if (-not $branch -or $branch -eq "HEAD") {
        Write-SyncLog "Detached HEAD or unknown branch. Skipping sync pass." "WARN"
        return
    }

    # 1. Fetch remote branch
    git fetch origin $branch --quiet 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-SyncLog "Cannot reach origin for branch '$branch'. Will retry next cycle." "WARN"
        return
    }

    # Verify origin/$branch exists
    git rev-parse --verify --quiet "origin/$branch" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-SyncLog "Remote branch 'origin/$branch' does not exist." "WARN"
        return
    }

    # 2. Check behind count and pull if needed
    $behind = [int](git rev-list --count "HEAD..origin/$branch" 2>$null)
    if ($behind -gt 0) {
        Write-SyncLog "Pulling $behind incoming commit(s) from origin/$branch..." "INFO"
        git pull --rebase --autostash origin $branch
        if ($LASTEXITCODE -ne 0) {
            Write-SyncLog "Rebase conflict or error detected! Aborting rebase to preserve local state..." "ERROR"
            git rebase --abort 2>$null
            Write-SyncLog "Manual conflict resolution required." "ERROR"
            return
        }
    }

    # 3. Check for local changes and commit
    $status = git status --porcelain 2>$null
    if ($status) {
        Write-SyncLog "Local changes detected. Staging and committing..." "INFO"
        git add -A
        $commitTime = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        git commit -m "Auto-sync: $commitTime"
        if ($LASTEXITCODE -ne 0) {
            Write-SyncLog "Commit failed or no staged changes." "WARN"
        }
    }

    # 4. Check ahead count and push
    $ahead = [int](git rev-list --count "origin/$branch..HEAD" 2>$null)
    if ($ahead -gt 0) {
        Write-SyncLog "Pushing $ahead commit(s) to origin/$branch..." "INFO"
        git push origin $branch
        if ($LASTEXITCODE -ne 0) {
            Write-SyncLog "Push failed. Will retry on next cycle." "WARN"
        } else {
            Write-SyncLog "Successfully pushed $ahead commit(s) to origin/$branch." "INFO"
        }
    } else {
        Write-SyncLog "local == origin/$branch (in sync at $(git rev-parse --short HEAD))." "INFO"
    }
}

if ($Continuous) {
    Write-SyncLog "Starting 5-minute sync loop (interval: $IntervalSeconds s). Stop with Ctrl+C." "INFO"
    while ($true) {
        Invoke-SyncPass
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    Invoke-SyncPass
}
