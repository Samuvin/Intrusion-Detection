#!/bin/bash

# Complete NIDS System Startup Script
# Starts: Backend API (8000), Frontend Dashboard (3000), Real Application (9000)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running from project root
if [ ! -d "backend" ] || [ ! -d "frontend" ] || [ ! -d "real_application" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "========================================="
print_info "Complete NIDS System Startup"
print_info "========================================="
echo ""

# Cleanup function
cleanup() {
    print_info "Stopping all services..."
    if [ -f backend.pid ]; then kill -9 $(cat backend.pid) 2>/dev/null || true; rm -f backend.pid; fi
    if [ -f frontend.pid ]; then kill -9 $(cat frontend.pid) 2>/dev/null || true; rm -f frontend.pid; fi
    if [ -f app.pid ]; then kill -9 $(cat app.pid) 2>/dev/null || true; rm -f app.pid; fi
    lsof -ti:3000 -ti:8000 -ti:9000 | xargs kill -9 2>/dev/null || true
    print_success "All services stopped"
}

trap cleanup EXIT INT TERM

# Kill existing processes on our ports
print_info "Checking for existing processes..."
for port in 3000 8000 9000; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $port is in use. Stopping existing process..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
done

# Step 1: Install Backend Dependencies
print_info "Step 1: Installing backend dependencies..."
cd backend
python3 -m pip install --upgrade pip --quiet >/dev/null 2>&1
python3 -m pip install -q fastapi 'uvicorn[standard]' pydantic pydantic-settings python-multipart scikit-learn xgboost numpy pandas scipy websockets aiofiles aiosqlite watchdog 2>/dev/null || {
    print_warning "Some dependencies may have issues, continuing..."
}
cd ..
print_success "Backend dependencies ready"

# Step 2: Install Frontend Dependencies
print_info "Step 2: Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install --silent >/dev/null 2>&1
fi
if ! npm list recharts >/dev/null 2>&1; then
    npm install recharts --silent >/dev/null 2>&1
fi
cd ..
print_success "Frontend dependencies ready"

# Step 3: Install Real Application Dependencies
print_info "Step 3: Installing real application dependencies..."
cd real_application
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q flask requests psutil >/dev/null 2>&1
deactivate
cd ..
print_success "Real application dependencies ready"

# Step 4: Start Real Application (Port 9000)
print_info "Step 4: Starting Real Application (port 9000)..."
cd real_application
source venv/bin/activate
python3 app.py > ../app.log 2>&1 &
APP_PID=$!
echo $APP_PID > ../app.pid
deactivate
cd ..
sleep 3
if ps -p $APP_PID > /dev/null 2>&1; then
    print_success "Real Application started (PID: $APP_PID) - http://localhost:9000"
else
    print_error "Real Application failed to start. Check app.log"
    exit 1
fi

# Step 5: Start Backend API (Port 8000)
print_info "Step 5: Starting Backend API (port 8000)..."
cd backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
cd ..
sleep 4

# Verify backend is responding
max_attempts=15
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        print_success "Backend API started (PID: $BACKEND_PID) - http://localhost:8000"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done
echo ""

if [ $attempt -eq $max_attempts ]; then
    print_error "Backend failed to start. Check backend.log"
    tail -20 backend.log
    exit 1
fi

# Step 6: Start Frontend Dashboard (Port 3000)
print_info "Step 6: Starting Frontend Dashboard (port 3000)..."
cd frontend
BROWSER=none npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
cd ..
sleep 10

# Verify frontend is responding
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        print_success "Frontend Dashboard started (PID: $FRONTEND_PID) - http://localhost:3000"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 2
done
echo ""

if [ $attempt -eq $max_attempts ]; then
    print_warning "Frontend may still be starting. Check frontend.log"
fi

# Display Summary
echo ""
print_info "========================================="
print_success "All Services Started Successfully!"
print_info "========================================="
echo ""
print_info "🌐 Services Running:"
echo "  📊 Frontend Dashboard:    http://localhost:3000"
echo "  📊 Log Analysis:           http://localhost:3000/log-analysis"
echo "  ⚙️  Backend API:            http://localhost:8000"
echo "  📚 API Documentation:      http://localhost:8000/docs"
echo "  🚀 Real Application:      http://localhost:9000"
echo ""
print_info "📝 Process IDs:"
echo "  - Real App PID:    $APP_PID (stored in app.pid)"
echo "  - Backend PID:     $BACKEND_PID (stored in backend.pid)"
echo "  - Frontend PID:    $FRONTEND_PID (stored in frontend.pid)"
echo ""
print_info "📋 Log Files:"
echo "  - Real App logs:   ./app.log"
echo "  - Backend logs:    ./backend.log"
echo "  - Frontend logs:   ./frontend.log"
echo ""
print_warning "Press CTRL+C to stop all services"
echo ""

# Wait for user interrupt
wait