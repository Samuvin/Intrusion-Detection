/**
 * Log Analysis Dashboard component for real-time log analysis and visualization.
 */

import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Security as SecurityIcon,
  Timeline as TimelineIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
      const statsResponse = await fetch('http://localhost:8000/api/v1/log-analysis/statistics');
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setLogData({
          total_entries: stats.total_entries || 0,
          entries_per_second: stats.entries_per_second || 0,
          unique_sources: stats.unique_sources || 0,
          error_rate: stats.error_rate || 0,
        });
      }
      
      // Load all logs
      loadAllLogs(0, 100);
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
        if (data.status === 'success') {
          setAllLogs(prev => offset === 0 ? data.logs : [...prev, ...data.logs]);
          setLogsPagination({
            limit: data.limit || limit,
            offset: data.offset || offset,
            total: data.total_count || 0,
            hasMore: data.has_more || false
          });
        }
      }
    } catch (error) {
      console.error('Failed to load all logs:', error);
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
    try {
      const ws = new WebSocket(`ws://localhost:8000/api/v1/monitoring/live`);
      
      ws.onopen = () => {
        console.log('WebSocket connected for log analysis');
        setWsConnection(ws);
        onShowNotification('Real-time log analysis connected', 'success');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleRealTimeUpdate(data);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnection(null);
        // Attempt to reconnect after 5 seconds
        setTimeout(setupWebSocketConnection, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('WebSocket connection failed:', error);
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
      if (data.anomalies && Array.isArray(data.anomalies)) {
        setRealTimeData(prev => ({
          ...prev,
          anomalies: [...prev.anomalies, ...data.anomalies].slice(-100)
        }));
      }
      
      // Update threat alerts if present
      if (data.threatAlerts && Array.isArray(data.threatAlerts)) {
        setRealTimeData(prev => ({
          ...prev,
          threatAlerts: [...prev.threatAlerts, ...data.threatAlerts].slice(-20)
        }));
      }
    } else if (data.type === 'traffic_update' || data.type === 'attack_detected') {
      // Also handle general traffic updates
      if (data.type === 'attack_detected') {
        setRealTimeData(prev => ({
          ...prev,
          threatAlerts: [{
            timestamp: data.timestamp,
            category: data.data?.attack_type || 'unknown',
            intensity: data.data?.confidence || 0.8
          }, ...prev.threatAlerts].slice(-20)
        }));
      }
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
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Overview" />
            <Tab label="Network Traffic" />
            <Tab label="All Logs" />
            <Tab label="Threat Alerts" />
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
                      <Tooltip />
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
                      <Tooltip />
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
              <Typography variant="h6" gutterBottom>
                Recent Network Traffic
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Destination</TableCell>
                      <TableCell>Port</TableCell>
                      <TableCell>Protocol</TableCell>
                      <TableCell align="right">Bytes</TableCell>
                      <TableCell align="right">Status</TableCell>
                      <TableCell align="right">Response (ms)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {realTimeData.networkFlow.length > 0 ? (
                      realTimeData.networkFlow.slice(-20).reverse().map((entry, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{formatTimestamp(entry.timestamp)}</TableCell>
                          <TableCell>
                            <Chip 
                              label={entry.method || 'N/A'} 
                              size="small" 
                              color={entry.method === 'GET' ? 'primary' : entry.method === 'POST' ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>{entry.source_ip || 'N/A'}</TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">{entry.hostname || entry.destination_ip || 'N/A'}</Typography>
                              {entry.is_secure && (
                                <Chip label="HTTPS" size="small" color="success" sx={{ ml: 0.5, height: 16, fontSize: '0.65rem' }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>{entry.destination_port || entry.port || 'N/A'}</TableCell>
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
                            <Box>
                              <Typography variant="body2">{formatBytes(entry.bytes || (entry.bytes_sent + entry.bytes_received) || 0)}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                ↑{formatBytes(entry.bytes_sent || 0)} ↓{formatBytes(entry.bytes_received || 0)}
                              </Typography>
                            </Box>
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
                            <Box>
                              <Typography variant="body2">{entry.response_time ? entry.response_time.toFixed(0) : 'N/A'} ms</Typography>
                              {(entry.dns_time_ms || entry.tcp_connect_time_ms || entry.ssl_handshake_time_ms) && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  DNS:{entry.dns_time_ms?.toFixed(0) || 0}ms
                                  TCP:{entry.tcp_connect_time_ms?.toFixed(0) || 0}ms
                                  {entry.ssl_handshake_time_ms > 0 && ` SSL:${entry.ssl_handshake_time_ms.toFixed(0)}ms`}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          No network traffic data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {/* Detailed Network Information Panel */}
              {realTimeData.networkFlow.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Detailed Network Information
                  </Typography>
                  <Grid container spacing={2}>
                    {realTimeData.networkFlow.slice(-5).reverse().map((entry, index) => (
                      <Grid item xs={12} md={6} key={index}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" gutterBottom>
                              Request #{index + 1} - {entry.method || 'N/A'} {entry.path || 'N/A'}
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1 }}>
                              <Typography variant="caption"><strong>Source:</strong> {entry.source_ip}:{entry.source_port || 'N/A'}</Typography>
                              <Typography variant="caption"><strong>Destination:</strong> {entry.destination_ip || entry.hostname}:{entry.destination_port || entry.port || 'N/A'}</Typography>
                              <Typography variant="caption"><strong>Scheme:</strong> {entry.scheme || 'N/A'}</Typography>
                              <Typography variant="caption"><strong>Connection:</strong> {entry.connection_type || 'N/A'}</Typography>
                              <Typography variant="caption"><strong>HTTP Version:</strong> {entry.http_version || entry.protocol || 'N/A'}</Typography>
                              <Typography variant="caption"><strong>Status:</strong> {entry.status_code || 'N/A'}</Typography>
                              <Typography variant="caption"><strong>Total Time:</strong> {entry.response_time?.toFixed(2) || 'N/A'} ms</Typography>
                              <Typography variant="caption"><strong>Redirects:</strong> {entry.redirect_count || 0}</Typography>
                              {entry.dns_time_ms > 0 && (
                                <Typography variant="caption"><strong>DNS:</strong> {entry.dns_time_ms.toFixed(2)} ms</Typography>
                              )}
                              {entry.tcp_connect_time_ms > 0 && (
                                <Typography variant="caption"><strong>TCP:</strong> {entry.tcp_connect_time_ms.toFixed(2)} ms</Typography>
                              )}
                              {entry.ssl_handshake_time_ms > 0 && (
                                <Typography variant="caption"><strong>SSL:</strong> {entry.ssl_handshake_time_ms.toFixed(2)} ms</Typography>
                              )}
                              {entry.content_type && (
                                <Typography variant="caption"><strong>Content-Type:</strong> {entry.content_type}</Typography>
                              )}
                              {entry.server && (
                                <Typography variant="caption"><strong>Server:</strong> {entry.server}</Typography>
                              )}
                              {entry.user_agent && (
                                <Typography variant="caption" sx={{ gridColumn: '1 / -1' }}>
                                  <strong>User-Agent:</strong> {entry.user_agent.substring(0, 80)}
                                  {entry.user_agent.length > 80 ? '...' : ''}
                                </Typography>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          )}

          {/* All Logs Tab */}
          {activeTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  All Network Logs ({logsPagination.total.toLocaleString()} total)
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
              
              <TableContainer component={Paper} sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Source IP:Port</TableCell>
                      <TableCell>Destination</TableCell>
                      <TableCell>Hostname</TableCell>
                      <TableCell>Path</TableCell>
                      <TableCell>Protocol</TableCell>
                      <TableCell align="right">Status</TableCell>
                      <TableCell align="right">Bytes Sent</TableCell>
                      <TableCell align="right">Bytes Recv</TableCell>
                      <TableCell align="right">Time (ms)</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allLogs.length > 0 ? (
                      allLogs.map((entry, index) => (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Typography variant="caption">
                              {formatTimestamp(entry.timestamp)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={entry.method || 'N/A'} 
                              size="small" 
                              color={entry.method === 'GET' ? 'primary' : entry.method === 'POST' ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {entry.source_ip || 'N/A'}:{entry.source_port || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">
                                {entry.destination_ip || 'N/A'}:{entry.destination_port || entry.port || 'N/A'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">{entry.hostname || 'N/A'}</Typography>
                              {entry.is_secure && (
                                <Chip label="HTTPS" size="small" color="success" sx={{ height: 16, fontSize: '0.65rem', mt: 0.5 }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {entry.path || entry.uri || 'N/A'}
                            </Typography>
                            {entry.query && (
                              <Typography variant="caption" color="text.secondary">
                                ?{entry.query.substring(0, 30)}
                              </Typography>
                            )}
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
                            <Box>
                              <Typography variant="body2">
                                {entry.response_time_ms || entry.duration ? (entry.response_time_ms || (entry.duration * 1000)).toFixed(0) : 'N/A'} ms
                              </Typography>
                              {(entry.dns_time_ms || entry.tcp_connect_time_ms || entry.ssl_handshake_time_ms) && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  DNS:{entry.dns_time_ms?.toFixed(0) || 0} TCP:{entry.tcp_connect_time_ms?.toFixed(0) || 0}
                                  {entry.ssl_handshake_time_ms > 0 && ` SSL:${entry.ssl_handshake_time_ms.toFixed(0)}`}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box>
                              {entry.content_type && (
                                <Typography variant="caption" display="block">
                                  {entry.content_type.split(';')[0]}
                                </Typography>
                              )}
                              {entry.server && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {entry.server}
                                </Typography>
                              )}
                              {entry.redirect_count > 0 && (
                                <Chip label={`${entry.redirect_count} redirects`} size="small" sx={{ mt: 0.5, height: 18 }} />
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={12} align="center">
                          {logsLoading ? 'Loading logs...' : 'No logs available. Make API calls in the Real Application to see network traffic.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {/* Expandable Details for Selected Log */}
              {allLogs.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Complete Network Data (Latest {Math.min(10, allLogs.length)} entries)
                  </Typography>
                  <Grid container spacing={2}>
                    {allLogs.slice(0, 10).map((entry, index) => (
                      <Grid item xs={12} key={index}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" gutterBottom>
                              Log #{index + 1} - {entry.method || 'N/A'} {entry.path || entry.uri || 'N/A'}
                            </Typography>
                            <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                              {Object.entries(entry).map(([key, value]) => {
                                if (key === 'parsed_fields' || key === 'raw_log') return null;
                                if (value === null || value === undefined || value === '') return null;
                                if (typeof value === 'object' && !Array.isArray(value)) {
                                  return (
                                    <Box key={key}>
                                      <Typography variant="caption" color="text.secondary">
                                        <strong>{key}:</strong>
                                      </Typography>
                                      <Typography variant="caption" display="block">
                                        {JSON.stringify(value).substring(0, 100)}
                                        {JSON.stringify(value).length > 100 ? '...' : ''}
                                      </Typography>
                                    </Box>
                                  );
                                }
                                return (
                                  <Typography key={key} variant="caption">
                                    <strong>{key}:</strong> {String(value).substring(0, 100)}
                                    {String(value).length > 100 ? '...' : ''}
                                  </Typography>
                                );
                              })}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          )}

          {/* Threat Alerts Tab */}
          {activeTab === 3 && (
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

