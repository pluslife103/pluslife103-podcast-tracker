@echo off
echo Starting 股癌 Podcast Tracker...

start "Backend - FastAPI" cmd /k "cd /d %~dp0backend && uvicorn main:app --reload --port 8000"
timeout /t 2 /nobreak >nul
start "Frontend - Next.js" cmd /k "cd /d %~dp0frontend && npm run dev -- -p 3001"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3001
echo.
pause
