<#
.SYNOPSIS
    Removes the Windows Scheduled Task for Procella 5-minute sync.
#>
[CmdletBinding()]
param()

$taskName = "Procella-5Min-Sync"
Write-Host "Removing Windows Scheduled Task '$taskName'..." -ForegroundColor Cyan
cmd.exe /c "schtasks.exe /delete /tn `"$taskName`" /f"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Task '$taskName' removed successfully." -ForegroundColor Green
} else {
    Write-Host "Task '$taskName' not found or could not be removed." -ForegroundColor Yellow
}
