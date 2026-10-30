@echo off
title MeetMind Launcher
echo ========================================================
echo           Starting MeetMind AI Platform
echo ========================================================
echo.

REM 1. Start Ollama
echo [1/3] Starting Local Ollama Engine...
start "MeetMind - Ollama Engine" cmd /k "ollama serve"

REM 2. Start Backend
echo [2/3] Starting FastAPI Backend (Port 8000)...
start "MeetMind - Backend API" cmd /k "cd /d %~dp0backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --host 127.0.0.1"

REM 3. Start Frontend
echo [3/3] Starting Next.js Frontend (Port 3000)...
start "MeetMind - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo All services launching in separate windows!
echo Frontend will be live at: http://localhost:3000
echo Backend will be live at:  http://127.0.0.1:8000
echo.
timeout /t 5 >nul
start http://localhost:3000
