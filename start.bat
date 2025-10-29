@echo off
REM NIDS System Startup Script for Windows
REM This script starts both the backend (FastAPI) and frontend (React) services

setlocal enabledelayedexpansion

echo.
echo ╔═══════════════════════════════════════════════════════════════════════════════╗
echo ║                    🚀 NIDS System Startup Script 🚀                          ║
echo ║                   Network Intrusion Detection System                          ║
echo ║                                                                               ║
echo ║  Backend:  FastAPI + ML (Hybrid SVM + XGBoost + CSA)                        ║
echo ║  Frontend: React + Material-UI Dashboard                                      ║
echo ║                                                                               ║
echo ╚═══════════════════════════════════════════════════════════════════════════════╝
echo.

REM Check if we're in the right directory
if not exist "README.md" (
    echo [ERROR] Please run this script from the project root directory
    pause
    exit /b 1
)

if not exist "backend" (
    echo [ERROR] Backend directory not found
    pause
    exit /b 1
)

if not exist "frontend" (
    echo [ERROR] Frontend directory not found
    pause
    exit /b 1
)

REM Check for required tools
echo [NIDS] Checking system requirements...

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is required but not installed
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is required but not installed
    pause
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is required but not installed
    pause
    exit /b 1
)

echo [SUCCESS] All required tools are available

REM Setup Backend
echo [NIDS] Setting up backend environment...
cd backend

REM Check if virtual environment exists
if not exist "venv" (
    echo [NIDS] Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo [NIDS] Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo [NIDS] Installing Python dependencies...
pip install -q -r requirements.txt

REM Create models directory if it doesn't exist
if not exist "models" mkdir models

REM Start backend server
echo [NIDS] Starting backend server on http://localhost:8000...
start /B python run.py

REM Wait for backend to be ready
echo [NIDS] Waiting for backend to be ready...
timeout /t 5 /nobreak >nul

REM Setup Frontend
echo [NIDS] Setting up frontend environment...
cd ..\frontend

REM Install dependencies
echo [NIDS] Installing Node.js dependencies...
npm install

REM Start frontend server
echo [NIDS] Starting frontend server on http://localhost:3000...
start /B npm start

REM Wait for frontend to be ready
echo [NIDS] Waiting for frontend to be ready...
timeout /t 10 /nobreak >nul

REM Return to project root
cd ..

REM Display success message
echo.
echo ╔═══════════════════════════════════════════════════════════════════════════════╗
echo ║                        🎉 NIDS SYSTEM IS RUNNING! 🎉                         ║
echo ║                                                                               ║
echo ║  🌐 Frontend Dashboard: http://localhost:3000                                ║
echo ║  🔗 Backend API:        http://localhost:8000                                ║
echo ║  📚 API Documentation:  http://localhost:8000/docs                           ║
echo ║                                                                               ║
echo ║  📊 Features Available:                                                       ║
echo ║    • Real-time Network Monitoring                                            ║
echo ║    • ML Model Training ^& Management                                          ║
echo ║    • Dataset Upload ^& Processing                                             ║
echo ║    • Performance Analytics                                                   ║
echo ║    • System Configuration                                                    ║
echo ║                                                                               ║
echo ║  🛑 Close this window to stop all services                                   ║
echo ╚═══════════════════════════════════════════════════════════════════════════════╝
echo.

echo [NIDS] System is running. Both services have been started in the background.
echo [NIDS] Open http://localhost:3000 in your browser to access the dashboard.
echo.
echo Press any key to stop all services and exit...
pause >nul

REM Kill backend and frontend processes
echo [NIDS] Stopping services...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo [SUCCESS] NIDS system stopped
pause
