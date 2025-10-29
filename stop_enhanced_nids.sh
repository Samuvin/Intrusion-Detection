#!/bin/bash

# Stop Enhanced NIDS Services

print_info() {
    echo "[INFO] $1"
}

print_success() {
    echo "[SUCCESS] $1"
}

print_info "Stopping Enhanced NIDS services..."

# Stop backend
if [ -f backend.pid ]; then
    BACKEND_PID=$(cat backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID 2>/dev/null || kill -9 $BACKEND_PID 2>/dev/null
        print_success "Backend server stopped (PID: $BACKEND_PID)"
    else
        print_info "Backend process not running"
    fi
    rm -f backend.pid
else
    # Try to kill by port
    lsof -ti:8000 | xargs kill -9 2>/dev/null && print_info "Stopped process on port 8000" || true
fi

# Stop frontend
if [ -f frontend.pid ]; then
    FRONTEND_PID=$(cat frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID 2>/dev/null || kill -9 $FRONTEND_PID 2>/dev/null
        print_success "Frontend application stopped (PID: $FRONTEND_PID)"
    else
        print_info "Frontend process not running"
    fi
    rm -f frontend.pid
else
    # Try to kill by port
    lsof -ti:3000 | xargs kill -9 2>/dev/null && print_info "Stopped process on port 3000" || true
fi

print_success "All services stopped"
