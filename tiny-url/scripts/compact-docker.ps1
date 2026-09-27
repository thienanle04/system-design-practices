# Script to safely compact Docker WSL2 disk after heavy load testing
Write-Host "Stopping Docker and WSL..." -ForegroundColor Cyan
Get-Process "Docker Desktop*", "com.docker.*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
wsl --shutdown

$vhdxPath = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx"
if (-not (Test-Path $vhdxPath)) {
    Write-Error "Could not find docker_data.vhdx at $vhdxPath"
    exit 1
}

$initialSize = [math]::round((Get-Item $vhdxPath).Length / 1GB, 2)
Write-Host "Current VHDX size: $initialSize GB" -ForegroundColor Yellow

$script = @"
select vdisk file="$vhdxPath"
attach vdisk readonly
compact vdisk
detach vdisk
"@

$tempScript = "$env:TEMP\compact_docker.txt"
$script | Out-File -FilePath $tempScript -Encoding ascii

Write-Host "Compacting VHDX via DiskPart..." -ForegroundColor Cyan
diskpart /s $tempScript
Remove-Item $tempScript -Force -ErrorAction SilentlyContinue

$finalSize = [math]::round((Get-Item $vhdxPath).Length / 1GB, 2)
Write-Host "Done! New VHDX size: $finalSize GB (Reclaimed: $([math]::round($initialSize - $finalSize, 2)) GB)" -ForegroundColor Green

Write-Host "Restarting Docker Desktop..." -ForegroundColor Cyan
Start-Process "C:\Program Files\Docker\Docker\resources\com.docker.backend.exe" -ArgumentList "-windows-service"
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
