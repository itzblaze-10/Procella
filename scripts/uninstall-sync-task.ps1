<#
.SYNOPSIS
    Removes the Windows Scheduled Task for Procella 5-minute sync.
#>
[CmdletBinding()]
param()

$taskName = "Procella-5Min-Sync"
Write-Host "Removing Windows Scheduled Task '$taskName'..." -ForegroundColor Cyan

$removed = $false
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    $removed = $true
} catch {
    cmd.exe /c "schtasks.exe /delete /tn `"$taskName`" /f"
    if ($LASTEXITCODE -eq 0) { $removed = $true }
}

if ($removed) {
    Write-Host "Task '$taskName' removed successfully." -ForegroundColor Green
} else {
    Write-Host "Task '$taskName' was not found or already removed." -ForegroundColor Yellow
}
