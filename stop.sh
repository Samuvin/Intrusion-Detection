#!/bin/bash

# Stop All NIDS Services

print_info() { echo "[INFO] $1"; }
print_success() { echo "[SUCCESS] $1"; }

print_info "Stopping all NIDS services..."

# Stop by PID files
if [ -f backend.pid ]; then
    BACKEND_PID=$(cat backend.pid)
    if ps -p $BACKEND_PID >/dev/null 2>&1; then
        kill -9 $BACKEND_PID 2>/dev/null || true
        print_success "Backend stopped (PID: $BACKEND_PID)"
    fi
    rm -f backend.pid
fi

if [ -f frontend.pid ]; then
    FRONTEND_PID=$(cat frontend.pid)
    if ps -p $FRONTEND_PID >/dev/null 2>&1; then
        kill -9 $FRONTEND_PID 2>/dev/null || true
        print_success "Frontend stopped (PID: $FRONTEND_PID)"
    fi
    rm -f frontend.pid
fi

if [ -f app.pid ]; then
    APP_PID=$(cat app.pid)
    if ps -p $APP_PID >/dev/null 2>&1; then
        kill -9 $APP_PID 2>/dev/null || true
        print_success "Real Application stopped (PID: $APP_PID)"
    fi
    rm -f app.pid
fi

# Kill by ports as backup
lsof -ti:3000 | xargs kill -9 2>/dev/null && print_info "Stopped process on port 3000" || true
lsof -ti:8000 | xargs kill -9 2>/dev/null && print_info "Stopped process on port 8000" || true
lsof -ti:9000 | xargs kill -9 2>/dev/null && print_info "Stopped process on port 9000" || true

# Kill related processes
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true
pkill -f "python3 app.py" 2>/dev/null || true

print_success "All services stopped"
