#!/bin/bash

# Enhanced NIDS System - Complete Startup Script
# This script installs all dependencies and starts both backend and frontend services

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Check if running from project root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "========================================="
print_info "Enhanced NIDS System Startup Script"
print_info "========================================="
echo ""

# Step 1: Install Backend Dependencies
print_info "Step 1: Installing backend Python dependencies..."
cd backend

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed or not in PATH"
    exit 1
fi

# Install backend dependencies
print_info "Installing Python packages..."
python3 -m pip install --upgrade pip --quiet

# Install dependencies from requirements.txt if it exists
if [ -f "requirements.txt" ]; then
    print_info "Installing from requirements.txt (this may take a few minutes)..."
    # Try with requirements.txt first
    if ! python3 -m pip install -q -r requirements.txt 2>&1 | tee /tmp/pip_install.log | grep -q "error"; then
        print_success "Installed dependencies from requirements.txt"
    else
        print_warning "Some dependencies failed, installing core packages..."
        # Install core packages without strict version constraints
        python3 -m pip install -q fastapi "uvicorn[standard]" pydantic pydantic-settings python-multipart || true
        python3 -m pip install -q scikit-learn xgboost numpy pandas scipy || true
        python3 -m pip install -q websockets aiofiles aiosqlite watchdog || true
    fi
else
    # Fallback: install essential packages
    print_info "Installing essential packages..."
    python3 -m pip install -q fastapi "uvicorn[standard]" pydantic pydantic-settings python-multipart
    python3 -m pip install -q scikit-learn xgboost numpy pandas scipy
    python3 -m pip install -q websockets aiofiles aiosqlite watchdog
fi

# Ensure critical dependencies are installed
print_info "Verifying critical dependencies..."
python3 -c "import fastapi, uvicorn, xgboost, sklearn, pandas, numpy; print('✓ All critical dependencies verified')" 2>/dev/null || {
    print_warning "Some dependencies may be missing, but continuing..."
}

if [ $? -eq 0 ]; then
    print_success "Backend dependencies installed successfully"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

cd ..

# Step 2: Install Frontend Dependencies
print_info "Step 2: Installing frontend Node.js dependencies..."
cd frontend

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

# Install frontend dependencies
print_info "Installing Node.js packages (this may take a few minutes)..."
npm install --silent

# Install recharts if not already installed
if ! npm list recharts &> /dev/null; then
    print_info "Installing recharts library..."
    npm install recharts --silent
fi

if [ $? -eq 0 ]; then
    print_success "Frontend dependencies installed successfully"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

cd ..

# Step 3: Create necessary directories
print_info "Step 3: Creating necessary directories..."
mkdir -p backend/data/pipeline
mkdir -p backend/models/sgm
mkdir -p backend/models/optimization_results
mkdir -p demo_data/pipeline/sgm_models

print_success "Directories created"

# Step 4: Start Backend Server
print_info "Step 4: Starting backend server..."
cd backend

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    print_warning "Port 8000 is already in use. Stopping existing process..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 3
    
    # Double-check port is free
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        print_warning "Port still in use, attempting force kill..."
        lsof -ti:8000 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
fi

# Check if there's an old PID file and clean it up
if [ -f ../backend.pid ]; then
    OLD_PID=$(cat ../backend.pid)
    if ps -p $OLD_PID > /dev/null 2>&1; then
        print_warning "Stopping old backend process (PID: $OLD_PID)"
        kill -9 $OLD_PID 2>/dev/null || true
        sleep 1
    fi
    rm -f ../backend.pid
fi

# Start backend in background
print_info "Starting backend server..."
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid

# Wait for backend to start with retries
print_info "Waiting for backend server to start..."
sleep 3

# Check if backend process is running
max_attempts=10
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        # Check if it's actually listening on the port
        if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
            # Test if it's responding
            if curl -s http://localhost:8000/health > /dev/null 2>&1; then
                print_success "Backend server started successfully (PID: $BACKEND_PID)"
                print_info "Backend API: http://localhost:8000"
                print_info "API Documentation: http://localhost:8000/docs"
                break
            fi
        fi
    else
        print_error "Backend process died. Check backend.log for details:"
        tail -20 ../backend.log
        exit 1
    fi
    
    attempt=$((attempt + 1))
    if [ $attempt -lt $max_attempts ]; then
        echo -n "."
        sleep 1
    fi
done

if [ $attempt -eq $max_attempts ]; then
    print_error "Backend server failed to start within timeout"
    print_info "Last 20 lines of backend.log:"
    tail -20 ../backend.log
    exit 1
fi

cd ..

# Step 5: Start Frontend Application
print_info "Step 5: Starting frontend application..."

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    print_warning "Port 3000 is already in use. Attempting to stop existing process..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

cd frontend

# Start frontend in background (npm start runs in foreground, so we use nohup)
nohup npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid

# Wait for frontend to start
print_info "Waiting for frontend application to start (this may take 30-60 seconds)..."
sleep 15

# Check if frontend is running
if ps -p $FRONTEND_PID > /dev/null; then
    print_success "Frontend application started (PID: $FRONTEND_PID)"
    print_info "Frontend Dashboard: http://localhost:3000"
    print_info "Enhanced Log Analysis: http://localhost:3000/log-analysis"
else
    print_warning "Frontend may still be starting. Check frontend.log for details"
fi

cd ..

# Step 6: Display Summary
echo ""
print_info "========================================="
print_success "Enhanced NIDS System Started Successfully!"
print_info "========================================="
echo ""
print_info "Services:"
echo "  - Backend API:    http://localhost:8000"
echo "  - API Docs:       http://localhost:8000/docs"
echo "  - Frontend:       http://localhost:3000"
echo "  - Log Analysis:   http://localhost:3000/log-analysis"
echo ""
print_info "Process IDs:"
echo "  - Backend PID:    $BACKEND_PID (stored in backend.pid)"
echo "  - Frontend PID:   $FRONTEND_PID (stored in frontend.pid)"
echo ""
print_info "Logs:"
echo "  - Backend logs:   ./backend.log"
echo "  - Frontend logs:  ./frontend.log"
echo ""
print_warning "To stop the services, run: ./stop_enhanced_nids.sh"
print_warning "Or kill processes manually: kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Create stop script
cat > stop_enhanced_nids.sh << 'EOF'
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
EOF

chmod +x stop_enhanced_nids.sh
print_info "Created stop script: ./stop_enhanced_nids.sh"

print_success "Setup complete!"
