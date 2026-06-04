$ErrorActionPreference = "Stop"

$source = "C:\dev\k9sar_frontend"
$stage  = "$env:TEMP\k9sar_frontend_stage"
$target = "k9sar:~/k9sar_frontend/frontend-src/"

Write-Host "Preparing staged frontend source..." -ForegroundColor Cyan

if (Test-Path $stage) {
    Remove-Item -Recurse -Force $stage
}

New-Item -ItemType Directory -Force -Path $stage | Out-Null

# Copy source while excluding heavy/unwanted folders
robocopy $source $stage /E /XD node_modules .git dist .vite | Out-Null

# robocopy uses special exit codes; 0-7 are success-ish
if ($LASTEXITCODE -gt 7) {
    throw "robocopy staging failed with exit code $LASTEXITCODE"
}

Write-Host "Copying staged source to server..." -ForegroundColor Cyan
scp -r "$stage\*" $target

if ($LASTEXITCODE -ne 0) {
    throw "scp copy failed."
}

Write-Host "Frontend source copied successfully." -ForegroundColor Green