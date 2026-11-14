<#
.SYNOPSIS
    Installs a Windows Scheduled Task that runs scripts/sync.ps1 every 5 minutes in the background.
#>
[CmdletBinding()]
param()

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    if ($PSScriptRoot -and (Test-Path "$PSScriptRoot\..\.git")) {
        $repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
    } else {
        Write-Error "install-sync-task: not inside a git repository."
        exit 1
    }
}

$taskName = "Procella-5Min-Sync"
$scriptPath = Join-Path $repoRoot "scripts\sync.ps1"
$psExe = "powershell.exe"
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

Write-Host "Creating Windows Scheduled Task '$taskName'..." -ForegroundColor Cyan

$success = $false

# 1. Try PowerShell ScheduledTasks module
try {
    $action = New-ScheduledTaskAction -Execute $psExe -Argument $psArgs -WorkingDirectory $repoRoot
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $registered = Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Procella 5-minute Git synchronization task" -Force -ErrorAction Stop
    if ($registered) {
        $success = $true
    }
} catch {
    Write-Host "PowerShell cmdlet failed: $_. Trying schtasks..." -ForegroundColor Yellow
}

# 2. Fallback to schtasks if Register-ScheduledTask wasn't successful
if (-not $success) {
    $schCmd = "schtasks.exe /create /tn `"$taskName`" /tr `"\`"$psExe\`" $psArgs`" /sc minute /mo 5 /f"
    cmd.exe /c $schCmd
    if ($LASTEXITCODE -eq 0) {
        $success = $true
    }
}

if ($success) {
    Write-Host "`nTask '$taskName' installed and active!" -ForegroundColor Green
    Write-Host "Sync will run automatically every 5 minutes."
    Write-Host "Logs are saved to: .tmp/sync.log"
    Write-Host "To remove the task anytime, run: powershell -File scripts/uninstall-sync-task.ps1"
} else {
    Write-Host "`nFailed to register scheduled task. You can run the sync loop directly:" -ForegroundColor Yellow
    Write-Host "powershell -File scripts/sync.ps1 -Continuous"
}
