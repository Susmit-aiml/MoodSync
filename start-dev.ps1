# MoodSync Developer Environment Launcher (PowerShell)
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "          🎵 MoodSync Developer Launcher               " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "moodsync-backend"
$extensionDist = Join-Path $scriptDir "moodsync-extension\dist"

Set-Location $backendDir

if (-not (Test-Path ".env")) {
    Write-Host "[!] Notice: moodsync-backend\.env was not found." -ForegroundColor Yellow
    Write-Host "    Copying .env.example to .env ..." -ForegroundColor Gray
    Copy-Item ".env.example" ".env"
    Write-Host "[i] Remember to add your SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to moodsync-backend\.env" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "[*] Starting MoodSync Backend on http://localhost:3001 ..." -ForegroundColor Cyan
Write-Host "[i] Chrome Extension Location: $extensionDist" -ForegroundColor Magenta
Write-Host "    Load this unpacked folder into chrome://extensions/ with Developer mode ON." -ForegroundColor Gray
Write-Host ""

npm run dev
