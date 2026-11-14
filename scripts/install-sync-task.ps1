<#
.SYNOPSIS
    Installs a Windows Scheduled Task that runs scripts/sync.ps1 every 5 minutes in the background.
#>
[CmdletBinding()]
param()

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    Write-Error "install-sync-task: not inside a git repository."
    exit 1
}

$taskName = "Procella-5Min-Sync"
$scriptPath = Join-Path $repoRoot "scripts\sync.ps1"
$psExe = (Get-Process -Id $PID).Path
if (-not $psExe) { $psExe = "powershell.exe" }

$actionCmd = "$psExe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

Write-Host "Creating Windows Scheduled Task '$taskName'..." -ForegroundColor Cyan

# Use schtasks to create a per-user recurring 5-minute task
$schtasksCmd = "schtasks.exe /create /tn `"$taskName`" /tr `"$actionCmd`" /sc minute /mo 5 /f"
cmd.exe /c $schtasksCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nTask '$taskName' installed successfully!" -ForegroundColor Green
    Write-Host "Sync will run automatically every 5 minutes."
    Write-Host "Logs are saved to: .tmp/sync.log"
    Write-Host "To remove the task anytime, run: powershell scripts/uninstall-sync-task.ps1"
} else {
    Write-Host "`nFailed to create scheduled task. You can also run the sync loop directly:" -ForegroundColor Yellow
    Write-Host "powershell -File scripts/sync.ps1 -Continuous"
}
