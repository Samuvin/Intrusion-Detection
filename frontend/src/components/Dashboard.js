/**
 * Main Dashboard component with overview metrics and charts.
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import MetricCard from './common/MetricCard';
import AttackTypeChart from './charts/AttackTypeChart';
import PerformanceChart from './charts/PerformanceChart';
import RecentActivityList from './common/RecentActivityList';
import { ApiService } from '../services/ApiService';

const Dashboard = ({ onShowNotification }) => {
  const [loading, setLoading] = useState(false); // Start as false since initial load is silent
  const [metrics, setMetrics] = useState({
    totalConnections: 0,
    threatsBlocked: 0,
    systemAccuracy: 0,
    uptime: '0h 0m',
    currentThreatLevel: 'Low',
    activeModels: 0,
  });
  
  const [modelStatus, setModelStatus] = useState({
    isTraining: false,
    isTrained: false,
    selectedFeatures: 0,
    lastTraining: null,
    datasetName: null,
    currentModelName: null,
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [systemHealth, setSystemHealth] = useState('healthy');
  const [attackBreakdown, setAttackBreakdown] = useState({
    Normal: 0,
    DoS: 0,
    Probe: 0,
    U2R: 0,
    R2L: 0
  });
  const [serverData, setServerData] = useState({});
  const [destinationData, setDestinationData] = useState({});
  const [serverDataLoading, setServerDataLoading] = useState(false);

  useEffect(() => {
    // Load from localStorage first for immediate display
    try {
      const storedModelInfo = localStorage.getItem('nids_model_info');
      if (storedModelInfo) {
        const modelInfo = JSON.parse(storedModelInfo);
        setModelStatus({
          isTraining: false,
          isTrained: modelInfo.is_trained || false,
          selectedFeatures: modelInfo.selected_features?.length || 0,
          lastTraining: modelInfo.last_training || null,
          datasetName: modelInfo.dataset_name || null,
          currentModelName: modelInfo.current_model_name || null,
        });
      }
    } catch (e) {
      console.error('Failed to load model info from localStorage:', e);
    }
    
    // Initial load only - no automatic refresh
    loadDashboardData(true); // Skip loading state on initial load
    
    // Connect to WebSocket for real-time attack breakdown updates only
    // No automatic refresh - user must click refresh button to reload full data
    let ws = null;
    try {
      ws = new WebSocket(`ws://localhost:8000/api/v1/monitoring/live`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'traffic_update') {
            // Only update attack breakdown from WebSocket - lightweight update, no full refresh
            if (data.data?.attack_breakdown) {
              setAttackBreakdown(data.data.attack_breakdown);
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      ws.onerror = (error) => {
        console.error('Dashboard WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
    
    return () => {
      if (ws) ws.close();
    };
  }, []);

  const loadDashboardData = async (silent = false) => {
    // Prevent multiple simultaneous refreshes
    if (loading) {
      console.debug('Dashboard refresh already in progress, skipping...');
      return;
    }
    
    try {
      // Set loading state only if not a silent refresh
      if (!silent) {
        setLoading(true);
      }

      // Load multiple data sources in parallel
      const [healthResponse, modelInfo, monitoringStatus, serverStatsResponse, destinationStatsResponse] = await Promise.allSettled([
        fetch('http://localhost:8000/health').then(r => r.json()).catch(() => ({ status: 'unknown' })),
        ApiService.getModelInfo(),
        ApiService.getMonitoringStatus(),
        fetch('http://localhost:8000/api/v1/log-analysis/logs/statistics/by-source').then(r => r.json()),
        fetch('http://localhost:8000/api/v1/log-analysis/logs/statistics/by-destination').then(r => r.json()),
      ]);

      // Process health check - fail silently, don't show errors
      if (healthResponse.status === 'fulfilled') {
        const healthData = healthResponse.value || {};
        setSystemHealth(healthData.status || 'healthy');
      } else {
        // Default to healthy if check fails to avoid showing warnings
        setSystemHealth('healthy');
      }

      // Process model information
      if (modelInfo.status === 'fulfilled' && modelInfo.value?.status === 'success') {
        const info = modelInfo.value.model_info;
        const modelStatusData = {
          isTraining: false,
          isTrained: info.is_trained || false,
          selectedFeatures: info.selected_features?.length || 0,
          lastTraining: info.last_training || null,
          datasetName: info.dataset_name || null,  // Include dataset name
          currentModelName: info.current_model_name || null,  // Include current model name
        };
        setModelStatus(modelStatusData);
        
        // Save to localStorage for consistency across navigation
        try {
          const fullModelInfo = {
            ...info,
            training_timestamp: Date.now()
          };
          localStorage.setItem('nids_model_info', JSON.stringify(fullModelInfo));
        } catch (e) {
          console.error('Failed to save model info to localStorage:', e);
        }
      }

      // Fetch log statistics FIRST (most accurate and real-time source)
      let logStatsData = {};
      try {
        const logStatsResponse = await fetch('http://localhost:8000/api/v1/log-analysis/logs/statistics');
        if (logStatsResponse.ok) {
          const logStats = await logStatsResponse.json();
          logStatsData = logStats.statistics || {};
        }
      } catch (error) {
        console.error('Failed to fetch log statistics:', error);
      }

      // Process monitoring status
      let monitoringStats = {};
      let uptimeStr = '0h 0m';
      if (monitoringStatus.status === 'fulfilled' && monitoringStatus.value?.status === 'success') {
        const status = monitoringStatus.value.monitoring_status;
        monitoringStats = status.statistics || {};
        uptimeStr = status.uptime || '0h 0m';
      }

      // Combine data sources - prefer log statistics for real-time data
      const totalConnections = logStatsData?.total_entries ?? monitoringStats?.total_connections_today ?? 0;
      const threatsBlocked = monitoringStats?.attacks_blocked_today ?? 0;
      const systemAccuracy = monitoringStats?.system_accuracy ? ((monitoringStats.system_accuracy) * 100).toFixed(1) : '0.0';
      
      setMetrics({
        totalConnections: totalConnections,
        threatsBlocked: threatsBlocked,
        systemAccuracy: systemAccuracy,
        uptime: uptimeStr,
        currentThreatLevel: determineThreatLevel(threatsBlocked),
        activeModels: 1, // Since we have one hybrid model
      });

      // Build real recent activity from log statistics
      const activities = [];
      const stats = logStatsData;
      
      if (stats.total_entries > 0) {
        activities.push({
          id: 1,
          type: 'system_update',
          message: `Processing ${stats.total_entries} log entries from ${stats.unique_sources} sources`,
          timestamp: new Date(),
          severity: 'info',
        });
      }
      
      if (stats.error_rate > 0) {
        activities.push({
          id: 2,
          type: 'warning',
          message: `Error rate: ${(stats.error_rate * 100).toFixed(2)}% - ${stats.entries_per_second.toFixed(2)} entries/sec`,
          timestamp: new Date(Date.now() - 60000),
          severity: stats.error_rate > 0.1 ? 'warning' : 'info',
        });
      } else if (stats.total_entries > 0) {
        activities.push({
          id: 2,
          type: 'info',
          message: `${stats.entries_per_second.toFixed(2)} entries/sec - ${stats.unique_sources} unique sources`,
          timestamp: new Date(Date.now() - 30000),
          severity: 'info',
        });
      }
      
      if (modelInfo.status === 'fulfilled' && modelInfo.value?.model_info?.is_trained) {
        const modelInfoData = modelInfo.value.model_info;
        const datasetInfo = modelInfoData.dataset_name 
          ? ` (trained on "${modelInfoData.dataset_name}")` 
          : '';
        activities.push({
          id: 3,
          type: 'model_status',
          message: `Model is trained and active${datasetInfo}`,
          timestamp: new Date(Date.now() - 120000),
          severity: 'success',
        });
      }
      
      if (stats.total_entries === 0) {
        activities.push({
          id: 0,
          type: 'info',
          message: 'Waiting for log data from Real Application. Make API calls to generate traffic.',
          timestamp: new Date(),
          severity: 'info',
        });
      }
      
      setRecentActivity(activities);

      // Process server/source statistics
      if (serverStatsResponse.status === 'fulfilled' && serverStatsResponse.value?.status === 'success') {
        setServerData(serverStatsResponse.value.sources || {});
      }

      // Process destination/server statistics (CloudFront, Cloudflare, APIs, etc.)
      if (destinationStatsResponse.status === 'fulfilled') {
        if (destinationStatsResponse.value?.status === 'success') {
          const destinations = destinationStatsResponse.value.destinations || {};
          console.log('Destination data loaded:', Object.keys(destinations).length, 'destinations');
          setDestinationData(destinations);
        } else {
          console.error('Destination stats response error:', destinationStatsResponse.value);
        }
      } else {
        console.error('Destination stats request failed:', destinationStatsResponse.reason);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Only show notifications for non-silent refreshes
      if (!silent) {
        console.debug('Dashboard refresh error (non-critical):', error.message);
      }
    } finally {
      // Always reset loading state, even for silent refreshes (to allow button clicks)
      setLoading(false);
    }
  };
  
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const determineThreatLevel = (attacksBlocked) => {
    if (attacksBlocked > 50) return 'High';
    if (attacksBlocked > 20) return 'Medium';
    return 'Low';
  };

  const getThreatLevelColor = () => {
    switch (metrics.currentThreatLevel) {
      case 'High':
        return 'error';
      case 'Medium':
        return 'warning';
      case 'Low':
        return 'success';
      default:
        return 'default';
    }
  };

  // Don't show loading screen - refresh happens silently in background
  // Only show loading state if explicitly triggered by user (not on initial load)

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Header Section with Gradient */}
      <Box sx={{ 
        mb: 4, 
        p: 3, 
        borderRadius: 2, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        boxShadow: 3,
        position: 'relative'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
              Network Intrusion Detection System
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Real-time security monitoring and threat analysis dashboard
            </Typography>
          </Box>
          <Tooltip title="Refresh Dashboard Data">
            <IconButton
              onClick={() => loadDashboardData(false)}
              disabled={loading}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.5)',
                }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* System Status Alert - Only show if explicitly unhealthy, not for unknown */}
      {systemHealth === 'error' && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          System health check failed. Please check backend connection.
        </Alert>
      )}

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Connections Today"
            value={metrics.totalConnections.toLocaleString()}
            icon={<SecurityIcon />}
            color="primary"
            subtitle="Total network connections monitored"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Threats Blocked"
            value={metrics.threatsBlocked}
            icon={<WarningIcon />}
            color="error"
            subtitle="Malicious activities prevented"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="System Accuracy"
            value={`${metrics.systemAccuracy}%`}
            icon={<TrendingUpIcon />}
            color="success"
            subtitle="Detection accuracy rate"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="System Uptime"
            value={metrics.uptime}
            icon={<SpeedIcon />}
            color="info"
            subtitle="Continuous monitoring time"
          />
        </Grid>
      </Grid>

      {/* Status Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Current Threat Level</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={metrics.currentThreatLevel}
                  color={getThreatLevelColor()}
                  variant="filled"
                  size="large"
                />
                <Typography variant="body2" color="text.secondary">
                  Based on recent attack patterns
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Model Status</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">Training Status:</Typography>
                  <Chip
                    label={modelStatus.isTrained ? 'Trained' : 'Not Trained'}
                    color={modelStatus.isTrained ? 'success' : 'warning'}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Selected Features: {modelStatus.selectedFeatures}
                </Typography>
                {modelStatus.currentModelName && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Active Model:
                    </Typography>
                    <Chip 
                      label={modelStatus.currentModelName}
                      color="secondary"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                )}
                {modelStatus.datasetName && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Training Dataset:
                    </Typography>
                    <Chip 
                      label={modelStatus.datasetName}
                      color="primary"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary">
                  Active Models: {metrics.activeModels}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts and Analytics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ 
            borderRadius: 3, 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 0 }}>
                  Attack Type Distribution
                </Typography>
                <Chip label="Real-time" color="primary" size="small" />
              </Box>
              <AttackTypeChart data={Object.entries(attackBreakdown).map(([name, value]) => ({
                name,
                value,
                color: name === 'Normal' ? '#4caf50' : name === 'DoS' ? '#f44336' : name === 'Probe' ? '#ff9800' : name === 'U2R' ? '#2196f3' : '#9c27b0'
              }))} />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            borderRadius: 3, 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 0 }}>
                  Performance Metrics
                </Typography>
              </Box>
              <PerformanceChart />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Destination Servers Section (CloudFront, Cloudflare, APIs, etc.) */}
      {Object.keys(destinationData).length > 0 ? (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <SpeedIcon sx={{ mr: 1, color: 'primary.main' }} />
                  Destination Servers & Services ({Object.keys(destinationData).length})
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Statistics for servers/services being accessed (CloudFront, Cloudflare, APIs, etc.)
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Server/Service</strong></TableCell>
                        <TableCell><strong>Hostname</strong></TableCell>
                        <TableCell><strong>IP:Port</strong></TableCell>
                        <TableCell align="right"><strong>Requests</strong></TableCell>
                        <TableCell align="right"><strong>Errors</strong></TableCell>
                        <TableCell align="right"><strong>Error Rate</strong></TableCell>
                        <TableCell align="right"><strong>Unique Sources</strong></TableCell>
                        <TableCell align="right"><strong>Data Transfer</strong></TableCell>
                        <TableCell align="right"><strong>Rate</strong></TableCell>
                        <TableCell align="right"><strong>Avg Response</strong></TableCell>
                        <TableCell><strong>Protocols/Methods</strong></TableCell>
                        <TableCell><strong>Attacks</strong></TableCell>
                        <TableCell><strong>Time Range</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(destinationData)
                        .sort((a, b) => b[1].total_entries - a[1].total_entries)  // Sort by total entries
                        .map(([destinationName, stats]) => (
                        <TableRow key={destinationName} hover>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {destinationName || 'Unknown'}
                              </Typography>
                              {stats.server && (
                                <Chip 
                                  label={stats.server} 
                                  size="small" 
                                  color="primary"
                                  variant="outlined"
                                  sx={{ mt: 0.5, height: 18, fontSize: '0.65rem' }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                              {stats.hostname || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {stats.destination_ip && !stats.destination_ip.includes('.com') && !stats.destination_ip.includes('.org') ? 
                                `${stats.destination_ip}:${stats.destination_port || 'N/A'}` : 
                                stats.destination_port ? `:${stats.destination_port}` : 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {(stats.total_entries || 0).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color={(stats.error_count || 0) > 0 ? 'error.main' : 'text.secondary'}>
                              {stats.error_count || 0}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={`${((stats.error_rate || 0) * 100).toFixed(1)}%`}
                              size="small"
                              color={(stats.error_rate || 0) > 0.2 ? 'error' : (stats.error_rate || 0) > 0.1 ? 'warning' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">{stats.unique_source_ips || 0}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Box>
                              <Typography variant="caption" display="block">
                                ↑ {formatBytes(stats.total_bytes_sent || 0)}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                ↓ {formatBytes(stats.total_bytes_received || 0)}
                              </Typography>
                              <Typography variant="caption" display="block" color="primary.main" sx={{ mt: 0.5 }}>
                                {formatBytes((stats.total_bytes_sent || 0) + (stats.total_bytes_received || 0))}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {(stats.entries_per_second || 0).toFixed(2)}/s
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Box>
                              <Typography variant="caption" display="block">
                                {(stats.avg_response_time_ms || 0).toFixed(0)}ms
                              </Typography>
                              {((stats.avg_dns_time_ms || 0) > 0 || (stats.avg_tcp_time_ms || 0) > 0 || (stats.avg_ssl_time_ms || 0) > 0) && (
                                <>
                                  {(stats.avg_dns_time_ms || 0) > 0 && (
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                      DNS: {(stats.avg_dns_time_ms || 0).toFixed(0)}ms
                                    </Typography>
                                  )}
                                  {(stats.avg_tcp_time_ms || 0) > 0 && (
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                      TCP: {(stats.avg_tcp_time_ms || 0).toFixed(0)}ms
                                    </Typography>
                                  )}
                                  {(stats.avg_ssl_time_ms || 0) > 0 && (
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                      SSL: {(stats.avg_ssl_time_ms || 0).toFixed(0)}ms
                                    </Typography>
                                  )}
                                </>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {(stats.protocols || []).length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {stats.protocols.slice(0, 2).map((proto, idx) => (
                                    <Chip 
                                      key={idx} 
                                      label={proto} 
                                      size="small" 
                                      variant="outlined"
                                      sx={{ height: 18, fontSize: '0.6rem' }}
                                    />
                                  ))}
                                </Box>
                              )}
                              {(stats.methods || []).length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {stats.methods.slice(0, 3).map((method, idx) => (
                                    <Chip 
                                      key={idx} 
                                      label={method} 
                                      size="small" 
                                      color={method === 'GET' ? 'primary' : method === 'POST' ? 'secondary' : 'default'}
                                      sx={{ height: 16, fontSize: '0.6rem' }}
                                    />
                                  ))}
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {stats.attack_types && Object.keys(stats.attack_types).length > 0 ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {Object.entries(stats.attack_types).map(([type, count]) => (
                                  <Chip 
                                    key={type}
                                    label={`${type}: ${count}`}
                                    size="small"
                                    color="error"
                                    sx={{ height: 18, fontSize: '0.6rem' }}
                                  />
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">None</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="caption" display="block">
                                {stats.first_seen ? new Date(stats.first_seen).toLocaleTimeString() : 'N/A'}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                {stats.last_seen ? `to ${new Date(stats.last_seen).toLocaleTimeString()}` : 'N/A'}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                ({formatDuration(stats.duration_seconds || 0)})
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                      {Object.keys(destinationData).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={13} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No destination server data available. Make API calls in the Real Application to see data.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Alert severity="info">
              <Typography variant="body2">
                No destination server data available yet. Make API calls in the Real Application to see destination servers (CloudFront, Cloudflare, APIs, etc.).
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      )}

      {/* Data Sources Section (log sources) */}
      {Object.keys(serverData).length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <SpeedIcon sx={{ mr: 1, color: 'primary.main' }} />
                  Log Sources ({Object.keys(serverData).length})
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Statistics for log sources (where logs are collected from)
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Source/Server</strong></TableCell>
                        <TableCell align="right"><strong>Total Entries</strong></TableCell>
                        <TableCell align="right"><strong>Errors</strong></TableCell>
                        <TableCell align="right"><strong>Error Rate</strong></TableCell>
                        <TableCell align="right"><strong>Unique IPs</strong></TableCell>
                        <TableCell align="right"><strong>Data (Sent/Recv)</strong></TableCell>
                        <TableCell align="right"><strong>Rate</strong></TableCell>
                        <TableCell><strong>Protocols</strong></TableCell>
                        <TableCell><strong>Methods</strong></TableCell>
                        <TableCell><strong>Attacks Detected</strong></TableCell>
                        <TableCell><strong>Time Range</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(serverData).map(([sourceName, stats]) => (
                        <TableRow key={sourceName} hover>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {sourceName === 'unknown' ? 'Unknown Source' : sourceName}
                              </Typography>
                              {stats.attack_count > 0 && (
                                <Chip 
                                  label={`${stats.attack_count} attacks`} 
                                  size="small" 
                                  color="error" 
                                  sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {stats.total_entries.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color={stats.error_count > 0 ? 'error.main' : 'text.secondary'}>
                              {stats.error_count}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={`${(stats.error_rate * 100).toFixed(1)}%`}
                              size="small"
                              color={stats.error_rate > 0.2 ? 'error' : stats.error_rate > 0.1 ? 'warning' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">{stats.unique_ips}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Box>
                              <Typography variant="caption" display="block">
                                ↑ {formatBytes(stats.total_bytes_sent)}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                ↓ {formatBytes(stats.total_bytes_received)}
                              </Typography>
                              <Typography variant="caption" display="block" color="primary.main" sx={{ mt: 0.5 }}>
                                {formatBytes(stats.total_bytes)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {stats.entries_per_second.toFixed(2)}/s
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {stats.protocols.slice(0, 3).map((proto, idx) => (
                                <Chip 
                                  key={idx} 
                                  label={proto} 
                                  size="small" 
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              ))}
                              {stats.protocols.length > 3 && (
                                <Typography variant="caption" color="text.secondary">
                                  +{stats.protocols.length - 3}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {stats.methods.slice(0, 3).map((method, idx) => (
                                <Chip 
                                  key={idx} 
                                  label={method} 
                                  size="small" 
                                  color={method === 'GET' ? 'primary' : method === 'POST' ? 'secondary' : 'default'}
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              ))}
                              {stats.methods.length > 3 && (
                                <Typography variant="caption" color="text.secondary">
                                  +{stats.methods.length - 3}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {Object.keys(stats.attack_types).length > 0 ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {Object.entries(stats.attack_types).map(([type, count]) => (
                                  <Chip 
                                    key={type}
                                    label={`${type}: ${count}`}
                                    size="small"
                                    color="error"
                                    sx={{ height: 18, fontSize: '0.6rem' }}
                                  />
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">None</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="caption" display="block">
                                {new Date(stats.first_seen).toLocaleTimeString()}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                to {new Date(stats.last_seen).toLocaleTimeString()}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                ({formatDuration(stats.duration_seconds)})
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <RecentActivityList activities={recentActivity} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
