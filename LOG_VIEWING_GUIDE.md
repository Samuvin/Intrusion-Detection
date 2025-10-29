# Where to View Logs - Complete Guide

## 📍 Log File Locations

### 1. **Real Application Logs**
- **File**: `real_application/real_application.log`
- **Network Traffic Logs**: `real_application/network_traffic.log`
- **Purpose**: Contains logs from the Flask application that generates network traffic
- **View Command**: `tail -f real_application/real_application.log`

### 2. **Backend Server Logs**
- **File**: `backend.log` (project root)
- **Alternative**: `backend/nids.log`
- **Purpose**: FastAPI backend server logs, API requests, errors
- **View Command**: `tail -f backend.log`

### 3. **Frontend Logs**
- **File**: `frontend.log` (project root)
- **Purpose**: React development server logs
- **View Command**: `tail -f frontend.log`

### 4. **Application Logs**
- **File**: `app.log` (project root)
- **Purpose**: General application logs

---

## 🖥️ Dashboard View (Web UI)

### **Log Analysis Dashboard**
1. Open browser: `http://localhost:3000`
2. Navigate to **"Log Analysis"** from the menu
3. You'll see:
   - **Network Traffic Flow** (real-time chart)
   - **Statistics** (total entries, entries/sec, etc.)
   - **Anomaly Score Distribution**
   - **Threat Alerts**
   - **Recent Log Entries**

### **Real-time Updates**
- Logs from the Real Application automatically appear here
- WebSocket connection provides live updates
- No need to refresh the page

---

## 🔧 How Logs Flow

```
Real Application (Port 9000)
    ↓ [POST request]
Backend API (/api/v1/log-analysis/logs/submit)
    ↓ [WebSocket broadcast]
Frontend Dashboard (Port 3000)
```

---

## 📊 Viewing Logs via API

### Test Log Submission:
```bash
curl -X POST http://localhost:8000/api/v1/log-analysis/logs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "log_lines": ["{\"timestamp\":\"2024-01-01T00:00:00Z\",\"type\":\"api_call\"}"],
    "log_format": "json",
    "source_name": "manual_test",
    "real_time": true
  }'
```

### View Log Statistics:
```bash
curl http://localhost:8000/api/v1/log-analysis/statistics
```

---

## 🐛 Troubleshooting

### If logs don't appear in dashboard:
1. Check if backend is running: `curl http://localhost:8000/health`
2. Check if frontend is running: Open `http://localhost:3000`
3. Check WebSocket connection in browser console (F12)
4. Verify Real Application is running: `curl http://localhost:9000/`

### View all log files:
```bash
find . -name "*.log" -type f ! -path "*/node_modules/*" ! -path "*/venv/*"
```

---

## ✅ Fixed Issues

1. **500 Error on Log Submission**: Fixed missing `timedelta` import
2. **WebSocket 403 Error**: Fixed WebSocket URL path to `/api/v1/monitoring/live`

