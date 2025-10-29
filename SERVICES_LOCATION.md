# Services Location and Access Guide

## 📍 Service Locations and Ports

### 🎯 Main NIDS Dashboard (Enhanced System)

**Location**: `frontend/` directory  
**Port**: `3000`  
**URL**: `http://localhost:3000`

#### Dashboard Routes:
- **Main Dashboard**: `http://localhost:3000/dashboard`
- **Real-time Monitoring**: `http://localhost:3000/monitoring`
- **Enhanced Log Analysis**: `http://localhost:3000/log-analysis` ⭐ (New!)
- **Model Management**: `http://localhost:3000/models`
- **Dataset Management**: `http://localhost:3000/datasets`
- **Performance Analytics**: `http://localhost:3000/analytics`
- **Settings**: `http://localhost:3000/settings`

#### Frontend Files:
- Main App: `frontend/src/App.js`
- Log Analysis Dashboard: `frontend/src/components/LogAnalysisDashboard.js`
- Real-time Monitoring: `frontend/src/components/RealTimeMonitoring.js`
- Main Dashboard: `frontend/src/components/Dashboard.js`

---

### ⚙️ Backend API (NIDS Backend)

**Location**: `backend/` directory  
**Port**: `8000`  
**URL**: `http://localhost:8000`

#### API Endpoints:
- **Health Check**: `http://localhost:8000/health`
- **API Documentation**: `http://localhost:8000/docs`
- **Dataset Management**: `http://localhost:8000/api/datasets/*`
- **Model Management**: `http://localhost:8000/api/models/*`
- **Real-time Monitoring**: `http://localhost:8000/api/monitoring/*`
- **Log Analysis** (New): `http://localhost:8000/api/log-analysis/*`

#### Backend Files:
- Main App: `backend/app/main.py`
- API Routes: `backend/app/api/routes.py`
- Log Analysis API: `backend/app/api/endpoints/log_analysis.py`
- Monitoring API: `backend/app/api/endpoints/monitoring.py`

---

### 🚀 Real Application (API Interaction App)

**Location**: `real_application/` directory  
**Port**: `9000`  
**URL**: `http://localhost:9000`

**Purpose**: Application that interacts with external APIs (Poem, JSONPlaceholder, Weather APIs) and generates network traffic logs.

**Log Files**:
- Application Log: `real_application/real_application.log`
- Network Traffic Log: `real_application/network_traffic.log`

**Note**: This is the application that generates logs that the dashboard analyzes.

---

### 🔍 Sidecar NIDS

**Location**: `sidecar_nids/` directory  
**Port**: **Unknown / Not Currently Running**

**Status**: The `sidecar_nids/` directory exists but currently only contains a virtual environment. The actual sidecar application code doesn't appear to be present in the codebase.

**Purpose**: Sidecar pattern typically monitors network traffic from the real application and forwards logs to the NIDS system.

---

## 🗺️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     NIDS System Architecture                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┐
│ Real Application│  Port: 9000  (Generates logs)
│ (API Calls)     │  Location: real_application/
└────────┬────────┘
         │
         │ Network Traffic & Logs
         ↓
┌─────────────────┐         ┌──────────────────┐
│  Sidecar NIDS   │         │  NIDS Backend    │  Port: 8000
│  (Port: ?)      │         │  (FastAPI)       │  Location: backend/
│                 │────────▶│                  │
│ Location:       │         │  - Log Analysis  │
│ sidecar_nids/   │         │  - SGM Analysis  │
│ (Not Implemented│         │  - Threat Detect│
│  in codebase)   │         │  - ML Models     │
└─────────────────┘         └────────┬─────────┘
                                     │
                                     │ API Calls
                                     ↓
                            ┌──────────────────┐
                            │  NIDS Dashboard  │  Port: 3000
                            │  (React.js)      │  Location: frontend/
                            │                  │
                            │  - Log Analysis  │
                            │  - SGM Viz       │
                            │  - Threats      │
                            │  - DoS Detection │
                            └──────────────────┘
```

---

## 📂 Directory Structure

```
/Users/jenishs/Desktop/Spryzen/ppt/
│
├── frontend/              ← 🎯 Main Dashboard (Port 3000)
│   ├── src/
│   │   ├── App.js
│   │   └── components/
│   │       ├── LogAnalysisDashboard.js    ← Enhanced Log Analysis
│   │       ├── RealTimeMonitoring.js      ← Real-time Monitoring
│   │       └── Dashboard.js                ← Main Dashboard
│   └── package.json
│
├── backend/               ← ⚙️ Backend API (Port 8000)
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   └── endpoints/
│   │   │       ├── log_analysis.py        ← New Log Analysis API
│   │   │       └── monitoring.py
│   │   └── ml/
│   │       ├── sgm_analyzer.py             ← SGM Implementation
│   │       └── enhanced_csa_optimizer.py   ← Enhanced CSA
│   └── requirements.txt
│
├── real_application/      ← 🚀 Real App (Port 9000)
│   ├── real_application.log
│   └── network_traffic.log
│
└── sidecar_nids/          ← 🔍 Sidecar (Port: Unknown)
    └── venv/              (Only venv, no application code)
```

---

## 🚀 Quick Access Guide

### To Access the Dashboard:
1. **Main Dashboard**: Open `http://localhost:3000` in your browser
2. **Enhanced Log Analysis**: Navigate to `http://localhost:3000/log-analysis`
3. **Real-time Monitoring**: Navigate to `http://localhost:3000/monitoring`

### To Start All Services:
```bash
./start_enhanced_nids.sh
```

This will start:
- ✅ Backend API on port 8000
- ✅ Frontend Dashboard on port 3000

### To Check What's Running:
```bash
# Check all listening ports
lsof -i -P | grep LISTEN

# Check specific ports
lsof -i :3000  # Frontend
lsof -i :8000  # Backend
lsof -i :9000  # Real Application
```

---

## 📝 Notes

1. **Sidecar NIDS**: The sidecar directory exists but appears to be incomplete. The sidecar would typically:
   - Run alongside the real application
   - Monitor network traffic
   - Forward logs to the NIDS backend
   - Run on a separate port (commonly 5000 or 8080)

2. **Real Application**: This is your Application 1 that interacts with APIs and generates logs that the dashboard (Application 2) analyzes.

3. **Enhanced Dashboard**: The new Log Analysis Dashboard (`/log-analysis`) implements:
   - SGM (Statistical Gaussian Mixture) analysis
   - DoS attack detection
   - Threat intelligence
   - Real-time log processing

---

## 🔧 Current Status

| Service | Status | Port | Location |
|---------|--------|------|----------|
| **Frontend Dashboard** | ✅ Implemented | 3000 | `frontend/` |
| **Backend API** | ✅ Implemented | 8000 | `backend/` |
| **Real Application** | ✅ Running | 9000 | `real_application/` |
| **Sidecar NIDS** | ⚠️ Not Complete | ? | `sidecar_nids/` |

---

For more details, see:
- `ENHANCED_NIDS_IMPLEMENTATION.md` - Full implementation details
- `README.md` - System overview
- `DEPLOYMENT.md` - Deployment guide
