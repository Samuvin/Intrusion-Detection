#!/bin/bash

# NIDS System Startup Script
# This script starts both the backend (FastAPI) and frontend (React) services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[NIDS]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill processes on specific ports
kill_port_processes() {
    local port=$1
    local pids=$(lsof -ti :$port)
    if [ ! -z "$pids" ]; then
        print_warning "Killing existing processes on port $port"
        kill $pids 2>/dev/null || true
        sleep 2
    fi
}

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down NIDS system..."
    
    # Kill backend processes
    if [ ! -z "$BACKEND_PID" ]; then
        print_status "Stopping backend server (PID: $BACKEND_PID)"
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    # Kill frontend processes
    if [ ! -z "$FRONTEND_PID" ]; then
        print_status "Stopping frontend server (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on our ports
    kill_port_processes 8000
    kill_port_processes 3000
    
    print_success "NIDS system stopped gracefully"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main script starts here
echo -e "${PURPLE}"
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                    🚀 NIDS System Startup Script 🚀                          ║"
echo "║                   Network Intrusion Detection System                          ║"
echo "║                                                                               ║"
echo "║  Backend:  FastAPI + ML (Hybrid SVM + XGBoost + CSA)                        ║"
echo "║  Frontend: React + Material-UI Dashboard                                      ║"
echo "║                                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check for required tools
print_status "Checking system requirements..."

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed"
    exit 1
fi

print_success "All required tools are available"

# Check and handle port conflicts
print_status "Checking for port conflicts..."

if check_port 8000; then
    print_warning "Port 8000 is already in use"
    read -p "Do you want to kill existing processes on port 8000? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port_processes 8000
    else
        print_error "Cannot start backend on port 8000. Exiting."
        exit 1
    fi
fi

if check_port 3000; then
    print_warning "Port 3000 is already in use"
    read -p "Do you want to kill existing processes on port 3000? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port_processes 3000
    else
        print_error "Cannot start frontend on port 3000. Exiting."
        exit 1
    fi
fi

# Setup Backend
print_status "Setting up backend environment..."

cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
if [ ! -f "venv/.dependencies_installed" ] || [ "requirements.txt" -nt "venv/.dependencies_installed" ]; then
    print_status "Installing Python dependencies..."
    pip install -q -r requirements.txt
    touch venv/.dependencies_installed
else
    print_status "Python dependencies are up to date"
fi

# Create models directory if it doesn't exist
mkdir -p models

# Start backend server
print_status "Starting backend server on http://localhost:8000..."
python run.py > nids_backend.log 2>&1 &
BACKEND_PID=$!
print_success "Backend server started (PID: $BACKEND_PID)"

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 3
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    print_error "Backend failed to start within 30 seconds"
    cleanup
    exit 1
else
    echo
    print_success "Backend is ready!"
fi

# Setup Frontend
print_status "Setting up frontend environment..."

cd ../frontend

# Install dependencies
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    print_status "Installing Node.js dependencies..."
    npm install > /dev/null 2>&1
    touch node_modules/.package-lock.json
else
    print_status "Node.js dependencies are up to date"
fi

# Start frontend server
print_status "Starting frontend server on http://localhost:3000..."
npm start > nids_frontend.log 2>&1 &
FRONTEND_PID=$!
print_success "Frontend server started (PID: $FRONTEND_PID)"

# Wait for frontend to be ready
print_status "Waiting for frontend to be ready..."
sleep 5
max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    print_error "Frontend failed to start within 60 seconds"
    cleanup
    exit 1
else
    echo
    print_success "Frontend is ready!"
fi

# Return to project root
cd ..

# Display success message
echo
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                        🎉 NIDS SYSTEM IS RUNNING! 🎉                         ║"
echo "║                                                                               ║"
echo "║  🌐 Frontend Dashboard: http://localhost:3000                                ║"
echo "║  🔗 Backend API:        http://localhost:8000                                ║"
echo "║  📚 API Documentation:  http://localhost:8000/docs                           ║"
echo "║                                                                               ║"
echo "║  📊 Features Available:                                                       ║"
echo "║    • Real-time Network Monitoring                                            ║"
echo "║    • ML Model Training & Management                                          ║"
echo "║    • Dataset Upload & Processing                                             ║"
echo "║    • Performance Analytics                                                   ║"
echo "║    • System Configuration                                                    ║"
echo "║                                                                               ║"
echo "║  🛑 Press Ctrl+C to stop all services                                        ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Show logs in real-time (optional)
print_status "System is running. Monitoring logs..."
print_status "Backend PID: $BACKEND_PID, Frontend PID: $FRONTEND_PID"

# Keep the script running and show logs
tail -f backend/nids_backend.log frontend/nids_frontend.log 2>/dev/null &
TAIL_PID=$!

# Wait for user interrupt
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend process died unexpectedly"
        break
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend process died unexpectedly"
        break
    fi
    sleep 5
done

# Cleanup on exit
cleanup
