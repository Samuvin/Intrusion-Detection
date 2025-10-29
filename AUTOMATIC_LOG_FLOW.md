# Automatic Log Flow to Dashboard

## 🎯 Overview

The system now automatically sends logs from the Real Application (port 9000) to the Dashboard (port 3000) in real-time whenever API calls are made.

## 🔄 How It Works

```
┌─────────────────────┐
│ Real Application    │  Port: 9000
│ (Makes API Calls)   │
└──────────┬──────────┘
           │
           │ 1. Makes API call (Poem, JSONPlaceholder, Weather)
           │
           ├─► 2. Logs network traffic
           │
           │ 3. Automatically sends log to Backend API
           ↓
┌─────────────────────┐
│ Backend API         │  Port: 8000
│ /api/v1/log-analysis│
│ /logs/submit        │
└──────────┬──────────┘
           │
           │ 4. Processes and aggregates logs
           │
           │ 5. Broadcasts via WebSocket
           ↓
┌─────────────────────┐
│ Frontend Dashboard  │  Port: 3000
│ (WebSocket Client)   │
│ Log Analysis Tab    │
└─────────────────────┘
           │
           │ 6. Updates charts & statistics in real-time
           │
           └─► Dashboard displays live network traffic!
```

## 📋 Implementation Details

### 1. Real Application (`real_application/app.py`)

**What it does:**
- Makes API calls to external services (Poem, JSONPlaceholder, Weather)
- **Automatically logs each API call**
- **Automatically sends each log entry to the backend**

**Key Functions:**
- `log_network_traffic()`: Logs to file AND sends to dashboard
- `send_to_dashboard()`: Sends log entry to backend API

**Example Flow:**
```python
# User clicks "Get Posts" button
→ call_api() is executed
→ log_network_traffic() is called
→ Log entry is created
→ send_to_dashboard() sends it to http://localhost:8000/api/v1/log-analysis/logs/submit
→ Dashboard receives it via WebSocket automatically!
```

### 2. Backend API (`backend/app/api/endpoints/log_analysis.py`)

**What it does:**
- Receives log submissions from Real Application
- Processes logs using the LogProcessor
- Adds to LogAggregator for analysis
- **Broadcasts updates to all connected WebSocket clients**

**Endpoint:**
```
POST /api/v1/log-analysis/logs/submit
```

**WebSocket Broadcasting:**
- When logs are received, they're immediately broadcasted via WebSocket
- All connected dashboard clients receive real-time updates
- Updates include: network flow data, statistics, entry counts

### 3. Frontend Dashboard (`frontend/src/components/LogAnalysisDashboard.js`)

**What it does:**
- Connects to WebSocket: `ws://localhost:8000/api/monitoring/live`
- Listens for `log_analysis` type messages
- **Automatically updates charts and statistics in real-time**

**Real-time Updates Include:**
- ✅ Network Traffic Flow chart (updates with each API call)
- ✅ Total Log Entries counter
- ✅ Entries per Second rate
- ✅ Unique Sources count
- ✅ Error Rate percentage

## 🚀 How to Use

### Start All Services:
```bash
./start.sh
```

### Access:
1. **Real Application**: `http://localhost:9000`
   - Click buttons to make API calls
   - Each call automatically sends logs to dashboard

2. **Dashboard**: `http://localhost:3000/log-analysis`
   - Opens automatically
   - Shows real-time updates as you make API calls

### Test the Flow:
1. Open Real Application: `http://localhost:9000`
2. Open Dashboard: `http://localhost:3000/log-analysis` (in another tab)
3. Click "Get Posts" or "Random Poem" in Real Application
4. **Watch the dashboard update automatically!** ✨

## 📊 Real-Time Data Flow

### When you make an API call:

1. **Real Application** (port 9000):
   ```
   User clicks "Get Posts"
   → API call to JSONPlaceholder
   → log_network_traffic() creates entry
   → send_to_dashboard() sends to backend
   ```

2. **Backend** (port 8000):
   ```
   Receives log at /api/v1/log-analysis/logs/submit
   → Processes log entry
   → Adds to LogAggregator
   → Broadcasts via WebSocket to all connected clients
   ```

3. **Dashboard** (port 3000):
   ```
   WebSocket receives log_analysis message
   → Updates networkFlow array
   → Updates statistics
   → Chart automatically refreshes
   → User sees new data appear!
   ```

## 📈 What Updates in Real-Time

### Overview Tab:
- **Network Traffic Flow Chart**: Shows bytes transferred over time
- **Total Log Entries**: Increments with each API call
- **Unique Sources**: Updates as new IPs appear
- **Entries Per Second**: Calculated and displayed

### Log Management Tab:
- **Processing Statistics**: Updates with current rates
- **Active Log Sources**: Shows "real_application" as active source

## 🔧 Configuration

### Real Application Logging:
- **Network Log File**: `real_application/network_traffic.log`
- **App Log File**: `real_application/real_application.log`
- **Backend API**: `http://localhost:8000/api/v1/log-analysis/logs/submit`

### Dashboard Updates:
- **WebSocket URL**: `ws://localhost:8000/api/monitoring/live`
- **Update Frequency**: Instant (as soon as logs are received)
- **Data Retention**: Last 50 network flow entries, last 100 anomalies

## 🎯 Benefits

1. **Zero Manual Steps**: Logs flow automatically
2. **Real-Time Visibility**: See network activity as it happens
3. **No File Upload Needed**: Everything is automatic
4. **Live Analysis**: Dashboard updates without page refresh
5. **Complete Integration**: All three services work together seamlessly

## 🐛 Troubleshooting

### If logs don't appear in dashboard:

1. **Check WebSocket Connection**:
   - Open browser console (F12)
   - Look for "WebSocket connected" message
   - Check for any WebSocket errors

2. **Check Backend Logs**:
   ```bash
   tail -f backend.log | grep "log_analysis\|WebSocket"
   ```

3. **Check Real Application Logs**:
   ```bash
   tail -f real_application/real_application.log
   ```

4. **Verify Services Are Running**:
   ```bash
   lsof -i :3000 -i :8000 -i :9000
   ```

5. **Test Backend API Directly**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/log-analysis/logs/submit \
     -H "Content-Type: application/json" \
     -d '{"log_lines":["{\"timestamp\":\"2024-01-01T00:00:00Z\",\"type\":\"test\"}"],"log_format":"json","source_name":"test"}'
   ```

## ✅ Verification

To verify everything is working:

1. **Start all services**: `./start.sh`
2. **Open Real Application**: `http://localhost:9000`
3. **Open Dashboard**: `http://localhost:3000/log-analysis`
4. **Make API calls** in Real Application
5. **Watch Dashboard** update automatically! ✨

---

**Status**: ✅ Fully Implemented and Automatic!
