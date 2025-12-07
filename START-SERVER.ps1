# Jarvis Server Startup Helper
# This script provides instructions and starts the server

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  JARVIS SERVER STARTUP" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "Starting Jarvis full stack..." -ForegroundColor Yellow
Write-Host "This will start:" -ForegroundColor White
Write-Host "  - Backend server (port 1234)" -ForegroundColor Gray
Write-Host "  - Next.js frontend (port 3001)" -ForegroundColor Gray
Write-Host "  - HTTPS proxy (port 3000)`n" -ForegroundColor Gray

Write-Host "IMPORTANT: Keep this window open!" -ForegroundColor Yellow -BackgroundColor DarkYellow
Write-Host "The server must stay running for tests to work.`n" -ForegroundColor Yellow

Write-Host "To run tests, open a NEW PowerShell window and run:" -ForegroundColor Cyan
Write-Host "  > cd C:\Users\yosiw\Desktop\Jarvis-main" -ForegroundColor White
Write-Host "  > .\run-all-tests.ps1`n" -ForegroundColor White

Write-Host "Starting server in 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

npm start
