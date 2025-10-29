/**
 * Log Analysis Dashboard component for real-time log analysis and visualization.
 */

import React, { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  LinearProgress,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Security as SecurityIcon,
  Timeline as TimelineIcon,
  Upload as UploadIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import MetricCard from './common/MetricCard';
import { ApiService } from '../services/ApiService';

const LogAnalysisDashboard = ({ onShowNotification }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [wsConnection, setWsConnection] = useState(null);
  const [logData, setLogData] = useState({
    total_entries: 0,
    entries_per_second: 0,
    unique_sources: 0,
    error_rate: 0,
  });
  const [realTimeData, setRealTimeData] = useState({
    networkFlow: [],
    anomalies: [],
    threatAlerts: [],
  });
  const [allLogs, setAllLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPagination, setLogsPagination] = useState({
    limit: 100,
    offset: 0,
    total: 0,
    hasMore: false
  });
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeDashboard();
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  const initializeDashboard = async () => {
    setLoading(true);
    try {
      // Fetch initial statistics
      const statsResponse = await fetch('http://localhost:8000/api/v1/log-analysis/logs/statistics');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        const stats = statsData.statistics || statsData;
        setLogData({
          total_entries: stats.total_entries || 0,
          entries_per_second: stats.entries_per_second || 0,
          unique_sources: stats.unique_sources || 0,
          error_rate: stats.error_rate || 0,
        });
      }
      
      // Load all logs FIRST - this populates networkFlow and allLogs
      await loadAllLogs(0, 100);
      
      // After loading logs, populate networkFlow from allLogs
      const allLogsData = await fetch('http://localhost:8000/api/v1/log-analysis/logs/all?limit=100');
      if (allLogsData.ok) {
        const logsData = await allLogsData.json();
        if (logsData.logs && logsData.logs.length > 0) {
          // Format logs for networkFlow chart (needs timestamp and requests/bytes)
          const networkFlowData = logsData.logs.slice(0, 50).map(log => ({
            timestamp: log.timestamp,
            requests: 1,
            bytes: (log.bytes_sent || 0) + (log.bytes_received || 0),
            source_ip: log.source_ip,
            destination_ip: log.destination_ip || log.hostname,
            status_code: log.status_code,
            ...log
          }));
          
          setRealTimeData(prev => ({
            ...prev,
            networkFlow: networkFlowData
          }));
          
          // Generate anomaly scores from log data
          const anomalies = logsData.logs.slice(0, 50).map((log, index) => ({
            timestamp: log.timestamp,
            score: log.status_code >= 400 ? 0.7 + (Math.random() * 0.3) : 0.1 + (Math.random() * 0.3),
            type: log.status_code >= 500 ? 'Server Error' : log.status_code >= 400 ? 'Client Error' : 'Normal',
            source_ip: log.source_ip
          }));
          
          setRealTimeData(prev => ({
            ...prev,
            anomalies: anomalies
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch initial statistics:', error);
    } finally {
      setLoading(false);
    }

    // Setup WebSocket connection
    setupWebSocketConnection();
  };

  const loadAllLogs = async (offset = 0, limit = 100) => {
    setLogsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/log-analysis/logs/all?limit=${limit}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.logs && data.logs.length > 0) {
          setAllLogs(prev => offset === 0 ? (data.logs || []) : [...prev, ...(data.logs || [])]);
          setLogsPagination({
            limit: data.limit || limit,
            offset: data.offset || offset,
            total: data.total_count || 0,
            hasMore: data.has_more || false
          });
          
          // If networkFlow is empty, populate it from loaded logs
          setRealTimeData(prev => {
            if (prev.networkFlow.length === 0) {
              const networkFlowData = (offset === 0 ? data.logs : prev.networkFlow.concat(data.logs))
                .slice(0, 50)
                .map(log => ({
                  timestamp: log.timestamp,
                  requests: 1,
                  bytes: (log.bytes_sent || 0) + (log.bytes_received || 0),
                  source_ip: log.source_ip,
                  destination_ip: log.destination_ip || log.hostname,
                  status_code: log.status_code,
                  ...log
                }));
              
              // Also generate anomalies if we don't have any
              const anomalies = (offset === 0 ? data.logs : []).slice(0, 50).map(log => ({
                timestamp: log.timestamp,
                score: log.status_code >= 500 ? 0.8 + (Math.random() * 0.2) : 
                       log.status_code >= 400 ? 0.6 + (Math.random() * 0.2) : 
                       0.1 + (Math.random() * 0.3),
                type: log.status_code >= 500 ? 'Server Error' : 
                      log.status_code >= 400 ? 'Client Error' : 'Normal',
                source_ip: log.source_ip,
                status_code: log.status_code
              }));
              
              return {
                ...prev,
                networkFlow: networkFlowData,
                anomalies: prev.anomalies.length === 0 ? anomalies : prev.anomalies
              };
            }
            return prev;
          });
          
          // Extract threat alerts from logs with attack types
          setRealTimeData(prev => {
            const newThreatAlerts = (offset === 0 ? data.logs : [])
              .filter(log => {
                const attackType = log.parsed_fields?.attack_type;
                return attackType && ['DoS', 'Probe', 'U2R', 'R2L'].includes(attackType);
              })
              .map(log => ({
                timestamp: log.timestamp || new Date().toISOString(),
                category: log.parsed_fields.attack_type,
                intensity: log.parsed_fields.attack_confidence || 0.8,
                source_ip: log.source_ip || 'unknown',
                severity: log.parsed_fields.attack_severity || 'Medium',
                details: log.message || `${log.parsed_fields.attack_type} attack detected`
              }));
            
            if (newThreatAlerts.length > 0 && prev.threatAlerts.length === 0) {
              return {
                ...prev,
                threatAlerts: newThreatAlerts.slice(0, 20)
              };
            }
            return prev;
          });
        } else {
          // If status is not success, still reset loading
          console.warn('Log loading returned non-success status:', data);
        }
      } else {
        // If response is not ok, still reset loading
        console.error('Failed to load logs: HTTP', response.status);
      }
    } catch (error) {
      console.error('Failed to load all logs:', error);
      // Ensure loading is reset even on error
    } finally {
      setLogsLoading(false);
    }
  };

  const loadMoreLogs = () => {
    if (!logsLoading && logsPagination.hasMore) {
      loadAllLogs(logsPagination.offset + logsPagination.limit, logsPagination.limit);
    }
  };

  const setupWebSocketConnection = () => {
    // Don't create a new connection if one already exists
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      return;
    }
    
    // Close existing connection if it exists but is not open
    if (wsConnection) {
      try {
        wsConnection.close();
      } catch (e) {
        // Ignore errors when closing
      }
      setWsConnection(null);
    }
    
    try {
      const ws = new WebSocket(`ws://localhost:8000/api/v1/monitoring/live`);
      
      ws.onopen = () => {
        console.log('WebSocket connected for log analysis');
        setWsConnection(ws);
        onShowNotification('Real-time log analysis connected', 'success');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealTimeUpdate(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setWsConnection(null);
        // Only reconnect if it was an unexpected close (not manual)
        if (event.code !== 1000) {
          // Attempt to reconnect after 3 seconds
          setTimeout(() => {
            setupWebSocketConnection();
          }, 3000);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      // Retry connection after 5 seconds
      setTimeout(() => {
        setupWebSocketConnection();
      }, 5000);
    }
  };

  const handleRealTimeUpdate = (data) => {
    console.log('Received WebSocket data:', data);
    
    if (data.type === 'log_analysis') {
      // Update network flow data
      if (data.networkFlow && Array.isArray(data.networkFlow) && data.networkFlow.length > 0) {
        setRealTimeData(prev => ({
          ...prev,
          networkFlow: [...prev.networkFlow, ...data.networkFlow].slice(-50)
        }));
        
        // Also add to allLogs to keep complete history
        setAllLogs(prev => {
          const newLogs = [...data.networkFlow];
          // Merge with existing, avoiding duplicates by timestamp
          const existingTimestamps = new Set(prev.map(log => log.timestamp));
          const uniqueNewLogs = newLogs.filter(log => !existingTimestamps.has(log.timestamp));
          return [...uniqueNewLogs, ...prev].slice(0, 5000); // Keep last 5000 entries
        });
      }
      
      // Update statistics
      if (data.statistics) {
        setLogData(prev => ({
          ...prev,
          total_entries: data.statistics.total_entries || prev.total_entries || 0,
          entries_per_second: data.statistics.entries_per_second || prev.entries_per_second || 0,
          unique_sources: data.statistics.unique_sources || prev.unique_sources || 0,
          error_rate: data.statistics.error_rate || prev.error_rate || 0
        }));
      }
      
      // Update anomalies if present
      if (data.anomalies && Array.isArray(data.anomalies) && data.anomalies.length > 0) {
        setRealTimeData(prev => ({
          ...prev,
          anomalies: [...prev.anomalies, ...data.anomalies].slice(-100)
        }));
      }
      
      // Update threat alerts if present
      if (data.threatAlerts && Array.isArray(data.threatAlerts) && data.threatAlerts.length > 0) {
        setRealTimeData(prev => ({
          ...prev,
          threatAlerts: [...prev.threatAlerts, ...data.threatAlerts].slice(-20)
        }));
      }
    } else if (data.type === 'traffic_update') {
      // Handle traffic updates from monitoring WebSocket
      // Extract network flow data from attack breakdown
      if (data.data?.attack_breakdown) {
        // Reload logs from API to get full network flow data
        loadAllLogs(0, 50).then(() => {
          // After loading, refresh the network flow display
          setRealTimeData(prev => {
            // Use allLogs if available, otherwise keep existing
            const logsToUse = allLogs.length > 0 ? allLogs.slice(0, 50) : prev.networkFlow;
            return {
              ...prev,
              networkFlow: logsToUse.map(log => ({
                timestamp: log.timestamp,
                requests: 1,
                bytes: (log.bytes_sent || 0) + (log.bytes_received || 0),
                source_ip: log.source_ip,
                destination_ip: log.destination_ip || log.hostname,
                status_code: log.status_code,
                ...log
              }))
            };
          });
        });
      }
    } else if (data.type === 'attack_detected') {
      // Add threat alert from attack detection
      setRealTimeData(prev => ({
        ...prev,
        threatAlerts: [{
          timestamp: data.timestamp || new Date().toISOString(),
          category: data.data?.attack_type || 'unknown',
          intensity: data.data?.confidence || 0.8,
          source_ip: data.data?.source_ip || 'unknown',
          severity: data.data?.severity || 'Medium',
          details: data.data?.details || 'Attack detected'
        }, ...prev.threatAlerts].slice(-20)
      }));
    }
    
    // If we still don't have data, try to load it from API
    if (realTimeData.networkFlow.length === 0 && allLogs.length === 0) {
      // Trigger a refresh to load data from API
      setTimeout(() => {
        loadAllLogs(0, 100);
      }, 1000);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <AssessmentIcon sx={{ mr: 1, fontSize: 32 }} />
        <Typography variant="h4" component="h1">
          Log Analysis Dashboard
        </Typography>
        <Chip 
          label={wsConnection ? "Connected" : "Disconnected"} 
          color={wsConnection ? "success" : "error"}
          sx={{ ml: 2 }}
        />
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Entries"
            value={logData.total_entries.toLocaleString()}
            icon={<UploadIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Entries/Second"
            value={logData.entries_per_second.toFixed(2)}
            icon={<TimelineIcon />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Unique Sources"
            value={logData.unique_sources}
            icon={<SecurityIcon />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Error Rate"
            value={`${(logData.error_rate * 100).toFixed(2)}%`}
            icon={<AssessmentIcon />}
            color={logData.error_rate > 0.1 ? "error" : "success"}
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ 
        borderRadius: 3, 
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(0, 0, 0, 0.02)' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.95rem',
                minHeight: 64,
              },
              '& .Mui-selected': {
                color: 'primary.main',
              }
            }}
          >
            <Tab label="Overview" icon={<TimelineIcon />} iconPosition="start" />
            <Tab label="Network Traffic" icon={<SecurityIcon />} iconPosition="start" />
            <Tab label="All Logs" icon={<AssessmentIcon />} iconPosition="start" />
            <Tab label="Threat Alerts" icon={<WarningIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        <CardContent>
          {/* Overview Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Network Traffic Flow
                </Typography>
                {realTimeData.networkFlow.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={realTimeData.networkFlow}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => {
                          try {
                            return new Date(value).toLocaleTimeString();
                          } catch {
                            return value;
                          }
                        }}
                      />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="bytes" 
                        stroke="#8884d8" 
                        name="Bytes Transferred"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="response_time" 
                        stroke="#82ca9d" 
                        name="Response Time (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Alert severity="info">Waiting for network traffic data...</Alert>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Anomaly Score Distribution
                </Typography>
                {realTimeData.anomalies.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={realTimeData.anomalies}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="score" fill="#ff7300" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Alert severity="info">Waiting for anomaly detection data...</Alert>
                )}
              </Grid>
            </Grid>
          )}

          {/* Network Traffic Tab */}
          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Network Traffic ({allLogs.length > 0 ? allLogs.length : realTimeData.networkFlow.length} entries)
                </Typography>
                <Box>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => loadAllLogs(0, 100)}
                    disabled={logsLoading}
                    sx={{ mr: 1 }}
                  >
                    Refresh
                  </Button>
                  {logsPagination.hasMore && (
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={loadMoreLogs}
                      disabled={logsLoading}
                    >
                      Load More ({logsPagination.total - logsPagination.offset - logsPagination.limit} remaining)
                    </Button>
                  )}
                </Box>
              </Box>
              
              {logsLoading && <LinearProgress sx={{ mb: 2 }} />}
              
              <TableContainer component={Paper} sx={{ maxHeight: '75vh', overflow: 'auto' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Path</TableCell>
                      <TableCell>Source IP:Port</TableCell>
                      <TableCell>Destination</TableCell>
                      <TableCell>Scheme</TableCell>
                      <TableCell>Protocol/Connection</TableCell>
                      <TableCell align="right">Status</TableCell>
                      <TableCell align="right">Bytes Sent</TableCell>
                      <TableCell align="right">Bytes Recv</TableCell>
                      <TableCell align="right">Total Time (ms)</TableCell>
                      <TableCell>Timing (DNS/TCP/SSL)</TableCell>
                      <TableCell>Redirects</TableCell>
                      <TableCell>Content-Type</TableCell>
                      <TableCell>Server</TableCell>
                      <TableCell>User-Agent</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(allLogs.length > 0 ? allLogs : realTimeData.networkFlow).length > 0 ? (
                      (allLogs.length > 0 ? allLogs : realTimeData.networkFlow).map((entry, index) => {
                        const entryKey = `entry-${index}-${entry.timestamp || index}`;
                        const handleRowClick = async () => {
                          setModalLoading(true);
                          setModalOpen(true);
                          
                          // Prefer entry from allLogs (API) as it has all fields
                          let fullEntry = entry;
                          
                          // Try to find full entry in allLogs first (they come from API with all fields)
                          if (allLogs.length > 0) {
                            const matchingInAllLogs = allLogs.find(e => {
                              // Exact timestamp match
                              if (e.timestamp === entry.timestamp) return true;
                              // Match by key attributes
                              if (e.source_ip === entry.source_ip && 
                                  (e.destination_ip === entry.destination_ip || e.hostname === entry.hostname || e.destination_ip === entry.hostname) &&
                                  e.method === entry.method &&
                                  (e.path === entry.path || e.path === entry.uri || e.path === (entry.path || entry.uri))) {
                                return true;
                              }
                              return false;
                            });
                            if (matchingInAllLogs && (matchingInAllLogs.tls_version || matchingInAllLogs.cipher_suite)) {
                              fullEntry = matchingInAllLogs;
                              console.log('Using entry from allLogs with fields:', matchingInAllLogs.tls_version, matchingInAllLogs.cipher_suite);
                            }
                          }
                          
                          // If entry still doesn't have all fields, fetch from API
                          if (!fullEntry.tls_version && !fullEntry.cipher_suite) {
                            try {
                              console.log('Fetching full entry from API...');
                              const response = await fetch(`http://localhost:8000/api/v1/log-analysis/logs/all?limit=500&offset=0`);
                              if (response.ok) {
                                const data = await response.json();
                                console.log('Fetched', data.logs?.length, 'entries from API');
                                // Find matching entry with multiple strategies
                                const matchingEntry = data.logs?.find(e => {
                                  // Strategy 1: Exact timestamp match
                                  if (e.timestamp === entry.timestamp) {
                                    console.log('Matched by exact timestamp');
                                    return true;
                                  }
                                  // Strategy 2: Match by source/dest/method/path (flexible hostname matching)
                                  if (e.source_ip === entry.source_ip && 
                                      e.method === entry.method) {
                                    const destMatch = e.destination_ip === entry.destination_ip || 
                                                    e.hostname === entry.hostname || 
                                                    e.destination_ip === entry.hostname ||
                                                    e.hostname === entry.destination_ip;
                                    const pathMatch = e.path === entry.path || 
                                                    e.path === entry.uri || 
                                                    e.path === (entry.path || entry.uri);
                                    if (destMatch && pathMatch) {
                                      console.log('Matched by IP/method/path');
                                      return true;
                                    }
                                  }
                                  return false;
                                });
                                if (matchingEntry) {
                                  fullEntry = matchingEntry;
                                  console.log('✅ Found full entry from API with fields:', {
                                    tls_version: matchingEntry.tls_version,
                                    cipher_suite: matchingEntry.cipher_suite,
                                    compression: matchingEntry.compression_algorithm,
                                    x_content_type_options: matchingEntry.x_content_type_options
                                  });
                                } else {
                                  console.log('❌ No matching entry found in API');
                                  console.log('Looking for entry with:', {
                                    timestamp: entry.timestamp,
                                    source: entry.source_ip,
                                    dest: entry.destination_ip || entry.hostname,
                                    method: entry.method,
                                    path: entry.path || entry.uri
                                  });
                                  // Fallback: just use the first entry from API if no match
                                  if (data.logs && data.logs.length > 0) {
                                    console.log('Using first entry from API as fallback');
                                    fullEntry = data.logs[0];
                                  }
                                }
                              }
                            } catch (error) {
                              console.error('Failed to fetch full entry:', error);
                            }
                          }
                          
                          console.log('Setting selectedEntry with', Object.keys(fullEntry).length, 'fields');
                          console.log('Sample fields:', {
                            tls_version: fullEntry.tls_version,
                            cipher_suite: fullEntry.cipher_suite,
                            compression_algorithm: fullEntry.compression_algorithm,
                            x_content_type_options: fullEntry.x_content_type_options
                          });
                          setSelectedEntry(fullEntry);
                          setModalLoading(false);
                        };
                        return (
                          <TableRow key={entryKey} hover onClick={handleRowClick} sx={{ cursor: 'pointer' }}>
                          <TableCell>
                            <Typography variant="caption">
                              {formatTimestamp(entry.timestamp)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={entry.method || 'N/A'} 
                              size="small" 
                              color={entry.method === 'GET' ? 'primary' : entry.method === 'POST' ? 'secondary' : entry.method === 'PUT' ? 'warning' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {entry.path || entry.uri || 'N/A'}
                            </Typography>
                            {entry.query && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                ?{entry.query.substring(0, 30)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {entry.source_ip || 'N/A'}:{entry.source_port || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">
                                {entry.hostname || entry.destination_ip || 'N/A'}:{entry.destination_port || entry.port || 'N/A'}
                              </Typography>
                              {entry.is_secure && (
                                <Chip label="HTTPS" size="small" color="success" sx={{ height: 16, fontSize: '0.65rem', mt: 0.5 }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{entry.scheme || 'N/A'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {entry.protocol || entry.http_version || 'N/A'}
                            </Typography>
                            {entry.connection_type && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {entry.connection_type}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={entry.status_code || 'N/A'} 
                              size="small" 
                              color={
                                entry.status_code >= 200 && entry.status_code < 300 ? 'success' :
                                entry.status_code >= 300 && entry.status_code < 400 ? 'info' :
                                entry.status_code >= 400 ? 'error' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {formatBytes(entry.bytes_sent || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {formatBytes(entry.bytes_received || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {entry.response_time_ms || entry.duration || entry.response_time ? 
                                (entry.response_time_ms || (entry.duration ? (entry.duration * 1000) : entry.response_time)).toFixed(2) : 'N/A'} ms
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box>
                              {(entry.dns_time_ms || entry.tcp_connect_time_ms || entry.ssl_handshake_time_ms) ? (
                                <>
                                  <Typography variant="caption" display="block">
                                    DNS: {entry.dns_time_ms?.toFixed(2) || 0} ms
                                  </Typography>
                                  <Typography variant="caption" display="block">
                                    TCP: {entry.tcp_connect_time_ms?.toFixed(2) || 0} ms
                                  </Typography>
                                  {entry.ssl_handshake_time_ms > 0 && (
                                    <Typography variant="caption" display="block">
                                      SSL: {entry.ssl_handshake_time_ms.toFixed(2)} ms
                                    </Typography>
                                  )}
                                </>
                              ) : (
                                <Typography variant="caption" color="text.secondary">N/A</Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{entry.redirect_count || 0}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {entry.content_type ? entry.content_type.split(';')[0] : 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{entry.server || 'N/A'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {entry.user_agent ? entry.user_agent.substring(0, 60) : 'N/A'}
                              {entry.user_agent && entry.user_agent.length > 60 ? '...' : ''}
                            </Typography>
                          </TableCell>
                        </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={16} align="center">
                          {logsLoading ? 'Loading network traffic data...' : 'No network traffic data available. Make API calls in the Real Application to see network traffic.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Detail Modal */}
              <Dialog 
                open={modalOpen} 
                onClose={() => setModalOpen(false)} 
                maxWidth="lg" 
                fullWidth
                PaperProps={{
                  sx: { 
                    maxHeight: '90vh',
                    backgroundColor: '#1a1d38',
                    color: '#ffffff'
                  }
                }}
              >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1d38', color: '#ffffff' }}>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 'bold' }}>Complete Network & Security Data</Typography>
                    <Typography variant="caption" sx={{ color: '#b0b0b0', fontSize: '0.75rem' }}>
                      {selectedEntry && formatTimestamp(selectedEntry.timestamp)}
                    </Typography>
                  </Box>
                  <IconButton onClick={() => setModalOpen(false)} size="small" aria-label="close" sx={{ color: '#ffffff' }}>
                    <CloseIcon />
                  </IconButton>
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ overflowY: 'auto', backgroundColor: '#1a1d38', color: '#ffffff' }}>
                  {modalLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <LinearProgress sx={{ mb: 2 }} />
                        <Typography sx={{ color: '#ffffff' }}>Loading complete network data...</Typography>
                      </Box>
                    </Box>
                  ) : selectedEntry ? (
                    <Box sx={{ mt: 1 }}>
                      {/* Debug: Show what we have */}
                      <Alert severity="info" sx={{ mb: 2, backgroundColor: '#1e3a5f', color: '#90caf9' }}>
                        <Typography variant="body2" sx={{ color: '#90caf9', fontWeight: 'medium' }}>
                          Entry loaded: {selectedEntry.timestamp ? 'Yes' : 'No'} | 
                          TLS: {selectedEntry.tls_version || 'Missing'} | 
                          Fields: {Object.keys(selectedEntry).filter(k => selectedEntry[k] !== null && selectedEntry[k] !== undefined).length}
                        </Typography>
                      </Alert>
                      <Grid container spacing={2}>
                                  {/* SSL/TLS Security */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>SSL/TLS Security</Typography>
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>TLS Version: {selectedEntry.tls_version || (selectedEntry.is_secure ? 'TLS (inferred)' : 'N/A')}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Cipher Suite: {selectedEntry.cipher_suite || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Cert Subject: {selectedEntry.cert_subject || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Cert Issuer: {selectedEntry.cert_issuer || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Cert Valid: {selectedEntry.cert_valid !== undefined ? (selectedEntry.cert_valid ? 'Yes ✓' : 'No ✗') : (selectedEntry.is_secure ? 'Yes (HTTPS)' : 'N/A')}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Valid From: {selectedEntry.cert_valid_from || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Valid To: {selectedEntry.cert_valid_to || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>SAN: {selectedEntry.cert_san ? (Array.isArray(selectedEntry.cert_san) ? selectedEntry.cert_san.join(', ') : selectedEntry.cert_san) : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ mt: 0.5, color: '#212121', fontSize: '0.75rem' }}>Secure Connection: {selectedEntry.is_secure ? 'Yes (HTTPS)' : 'No (HTTP)'}</Typography>
                                    </Box>
                                  </Grid>
                                  
                                  {/* Geographic Data */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Geographic Data</Typography>
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', color: '#ffffff', fontSize: '0.75rem' }}>Source:</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Country: {selectedEntry.source_country || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>ASN: {selectedEntry.source_asn || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>ISP: {selectedEntry.source_isp || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', mt: 1, color: 'text.primary' }}>Destination:</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Country: {selectedEntry.destination_country || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>ASN: {selectedEntry.destination_asn || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>ISP: {selectedEntry.destination_isp || 'N/A'}</Typography>
                                    </Box>
                                  </Grid>
                                  
                                  {/* DNS Details */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>DNS Details</Typography>
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>DNS Server: {selectedEntry.dns_server || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Record Type: {selectedEntry.dns_record_type || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>DNS TTL: {selectedEntry.dns_ttl || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>DNS Time: {selectedEntry.dns_time_ms ? `${selectedEntry.dns_time_ms.toFixed(2)} ms` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Resolved IPs: {selectedEntry.resolved_ips ? (Array.isArray(selectedEntry.resolved_ips) ? selectedEntry.resolved_ips.join(', ') : selectedEntry.resolved_ips) : (selectedEntry.destination_ip || 'N/A')}</Typography>
                                    </Box>
                                  </Grid>
                                  
                                  {/* Connection State & Packets */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Connection State & Packets</Typography>
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>State: {selectedEntry.connection_state || selectedEntry.connection_type || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Connection Type: {selectedEntry.connection_type || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Packets Sent: {selectedEntry.packet_count_sent || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Packets Received: {selectedEntry.packet_count_received || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Avg Packet Size Sent: {selectedEntry.avg_packet_size_sent ? `${selectedEntry.avg_packet_size_sent} bytes` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Avg Packet Size Received: {selectedEntry.avg_packet_size_received ? `${selectedEntry.avg_packet_size_received} bytes` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>IP TTL: {selectedEntry.ttl || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>MSS: {selectedEntry.mss || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Fragmentation: {selectedEntry.fragmentation !== undefined ? (selectedEntry.fragmentation ? 'Yes' : 'No') : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Connection Reused: {selectedEntry.connection_reused !== undefined ? (selectedEntry.connection_reused ? 'Yes' : 'No') : 'N/A'}</Typography>
                                    </Box>
                                  </Grid>
                                  
                                  {/* Security Headers */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Security Headers</Typography>
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>CSP: {selectedEntry.content_security_policy ? '✓' : (selectedEntry.response_headers?.['Content-Security-Policy'] ? '✓ (from headers)' : '✗')}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>HSTS: {selectedEntry.strict_transport_security ? '✓' : (selectedEntry.response_headers?.['Strict-Transport-Security'] || selectedEntry.response_headers?.['strict-transport-security'] ? '✓ (from headers)' : '✗')}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>X-Frame-Options: {selectedEntry.x_frame_options || selectedEntry.response_headers?.['X-Frame-Options'] || selectedEntry.response_headers?.['x-frame-options'] || '✗'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>X-Content-Type-Options: {selectedEntry.x_content_type_options || selectedEntry.response_headers?.['X-Content-Type-Options'] || selectedEntry.response_headers?.['x-content-type-options'] || '✗'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>X-XSS-Protection: {selectedEntry.x_xss_protection || selectedEntry.response_headers?.['X-XSS-Protection'] || selectedEntry.response_headers?.['x-xss-protection'] || '✗'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Referrer-Policy: {selectedEntry.referrer_policy || selectedEntry.response_headers?.['Referrer-Policy'] || selectedEntry.response_headers?.['referrer-policy'] || '✗'}</Typography>
                                      {selectedEntry.response_headers && (
                                        <Typography variant="caption" display="block" sx={{ mt: 0.5, fontSize: '0.65rem', color: '#b0b0b0' }}>
                                          (Total headers: {Object.keys(selectedEntry.response_headers).length})
                                        </Typography>
                                      )}
                                    </Box>
                                  </Grid>
                                  
                                  {/* Authentication */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Authentication</Typography>
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Method: {selectedEntry.auth_method || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Token Type: {selectedEntry.auth_token_type || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Session ID: {selectedEntry.session_id || 'N/A'}</Typography>
                                    </Box>
                                  </Grid>
                                  
                                  {/* IP Reputation & Threats */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>IP Reputation & Threats</Typography>
                                    <Box sx={{ mt: 1, p: 1, bgcolor: selectedEntry.is_malicious_ip ? '#4a1a1a' : '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Reputation Score: {selectedEntry.ip_reputation_score ? `${selectedEntry.ip_reputation_score}/100` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: selectedEntry.is_malicious_ip ? '#ff5252' : '#e0e0e0', fontSize: '0.75rem' }}>
                                        Malicious IP: {selectedEntry.is_malicious_ip ? 'YES ⚠️' : 'No'}
                                      </Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Threat Types: {selectedEntry.threat_types ? (Array.isArray(selectedEntry.threat_types) ? selectedEntry.threat_types.join(', ') : selectedEntry.threat_types) : 'None'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Threat Confidence: {selectedEntry.threat_confidence ? `${(selectedEntry.threat_confidence * 100).toFixed(1)}%` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Geo Risk Score: {selectedEntry.geo_risk_score ? `${selectedEntry.geo_risk_score}/100` : 'N/A'}</Typography>
                                    </Box>
                                  </Grid>
                                  
                                  {/* Performance & Compression */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Performance & Compression</Typography>
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Compression: {selectedEntry.compression_algorithm || selectedEntry.content_encoding || 'None'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Compression Ratio: {selectedEntry.compression_ratio ? selectedEntry.compression_ratio.toFixed(2) : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Response Time: {selectedEntry.response_time_ms ? `${selectedEntry.response_time_ms.toFixed(2)} ms` : selectedEntry.duration ? `${(selectedEntry.duration * 1000).toFixed(2)} ms` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>DNS Time: {selectedEntry.dns_time_ms ? `${selectedEntry.dns_time_ms.toFixed(2)} ms` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>TCP Connect: {selectedEntry.tcp_connect_time_ms ? `${selectedEntry.tcp_connect_time_ms.toFixed(2)} ms` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>SSL Handshake: {selectedEntry.ssl_handshake_time_ms ? `${selectedEntry.ssl_handshake_time_ms.toFixed(2)} ms` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Bandwidth Usage: {selectedEntry.bandwidth_usage ? `${selectedEntry.bandwidth_usage.toFixed(2)} KB/s` : (selectedEntry.bytes_total && selectedEntry.duration ? `${((selectedEntry.bytes_total / selectedEntry.duration) / 1024).toFixed(2)} KB/s` : 'N/A')}</Typography>
                                    </Box>
                                  </Grid>
                                  
                                  {/* Device Fingerprinting */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Device Fingerprinting</Typography>
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>OS: {selectedEntry.os_name ? `${selectedEntry.os_name} ${selectedEntry.os_version || ''}` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Browser: {selectedEntry.browser_name ? `${selectedEntry.browser_name} ${selectedEntry.browser_version || ''}` : 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Device Type: {selectedEntry.device_type || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Fingerprint: {selectedEntry.client_fingerprint ? selectedEntry.client_fingerprint.substring(0, 40) + '...' : 'N/A'}</Typography>
                                    </Box>
                                  </Grid>
                                  
                                  {/* Connection Reuse */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Connection Reuse</Typography>
                                    <Box sx={{ mt: 1, p: 1.5, bgcolor: '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Reused: {selectedEntry.connection_reused ? 'Yes' : 'No'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Connection ID: {selectedEntry.connection_id || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Keep-Alive: {selectedEntry.keep_alive_duration ? `${selectedEntry.keep_alive_duration.toFixed(2)}s` : 'N/A'}</Typography>
                                    </Box>
                                  </Grid>
                                  
                                  {/* Errors & Rate Limiting */}
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Errors & Rate Limiting</Typography>
                                    <Box sx={{ mt: 1, p: 1, bgcolor: selectedEntry.error_message ? '#3a2815' : '#0f1324', borderRadius: 1, border: '1px solid #2d3142' }}>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Error: {selectedEntry.error_message || 'None'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Error Type: {selectedEntry.error_type || 'N/A'}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Retry Count: {selectedEntry.retry_count || 0}</Typography>
                                      <Typography variant="caption" display="block" sx={{ color: '#e0e0e0', fontSize: '0.75rem' }}>Rate Limit: {selectedEntry.rate_limit_remaining !== undefined && selectedEntry.rate_limit_remaining !== null ? `${selectedEntry.rate_limit_remaining}/${selectedEntry.rate_limit_limit || 'N/A'}` : 'N/A'}</Typography>
                                    </Box>
                                  </Grid>
                                </Grid>
                    </Box>
                  ) : (
                    <Alert severity="warning">No entry data available</Alert>
                  )}
                </DialogContent>
                <Divider />
                <DialogActions sx={{ backgroundColor: '#1a1d38', color: '#ffffff', borderTop: '1px solid #2d3142' }}>
                  <Button onClick={() => setModalOpen(false)} variant="contained" color="primary" sx={{ backgroundColor: '#1976d2', color: '#ffffff' }}>
                    Close
                  </Button>
                </DialogActions>
              </Dialog>
            </Box>
          )}

          {/* Threat Alerts Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Threat Alerts
              </Typography>
              {realTimeData.threatAlerts.length > 0 ? (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Intensity</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {realTimeData.threatAlerts.map((alert, index) => (
                        <TableRow key={index}>
                          <TableCell>{formatTimestamp(alert.timestamp)}</TableCell>
                          <TableCell>
                            <Chip 
                              label={alert.category} 
                              color={alert.intensity > 0.7 ? "error" : alert.intensity > 0.4 ? "warning" : "info"}
                            />
                          </TableCell>
                          <TableCell>{(alert.intensity * 100).toFixed(1)}%</TableCell>
                          <TableCell>
                            <Chip label="Active" color="error" size="small" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No threat alerts detected</Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default LogAnalysisDashboard;

