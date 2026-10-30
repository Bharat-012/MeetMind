# MeetMind - PowerShell One-Click Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          Starting MeetMind AI Platform" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot

# 1. Ollama Server
Write-Host "[1/3] Starting Ollama Engine..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama serve"

# 2. Backend Server
Write-Host "[2/3] Starting Backend API (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; .\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --host 127.0.0.1"

# 3. Frontend Dev Server
Write-Host "[3/3] Starting Frontend (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "All services started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend:  http://127.0.0.1:8000" -ForegroundColor White
Write-Host ""

Start-Sleep -Seconds 4
Start-Process "http://localhost:3000"
