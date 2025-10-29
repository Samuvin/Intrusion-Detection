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
} from '@mui/material';
import {
  Security as SecurityIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

import MetricCard from './common/MetricCard';
import AttackTypeChart from './charts/AttackTypeChart';
import PerformanceChart from './charts/PerformanceChart';
import RecentActivityList from './common/RecentActivityList';
import { ApiService } from '../services/ApiService';

const Dashboard = ({ onShowNotification }) => {
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadDashboardData();
    
    // Set up periodic data refresh
    const interval = setInterval(loadDashboardData, 10000); // Every 10 seconds
    
    // Connect to WebSocket for real-time attack breakdown updates
    let ws = null;
    try {
      ws = new WebSocket(`ws://localhost:8000/api/v1/monitoring/live`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'traffic_update' && data.data?.attack_breakdown) {
          setAttackBreakdown(data.data.attack_breakdown);
        }
      };
      ws.onerror = (error) => {
        console.error('Dashboard WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
    
    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load multiple data sources in parallel
      const [healthResponse, modelInfo, monitoringStatus] = await Promise.allSettled([
        ApiService.checkHealth(),
        ApiService.getModelInfo(),
        ApiService.getMonitoringStatus(),
      ]);

      // Process health check
      if (healthResponse.status === 'fulfilled') {
        setSystemHealth(healthResponse.value?.status || 'unknown');
      }

      // Process model information
      if (modelInfo.status === 'fulfilled' && modelInfo.value?.status === 'success') {
        const info = modelInfo.value.model_info;
        setModelStatus({
          isTraining: false,
          isTrained: info.is_trained || false,
          selectedFeatures: info.selected_features?.length || 0,
          lastTraining: info.last_training || null,
        });
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
        activities.push({
          id: 3,
          type: 'model_status',
          message: 'Model is trained and active',
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

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      onShowNotification('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
          Loading dashboard data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
        NIDS Dashboard
      </Typography>

      {/* System Status Alert */}
      {systemHealth !== 'healthy' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          System health status: {systemHealth}. Some features may be limited.
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
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Attack Type Distribution
              </Typography>
              <AttackTypeChart data={Object.entries(attackBreakdown).map(([name, value]) => ({
                name,
                value,
                color: name === 'Normal' ? '#4caf50' : name === 'DoS' ? '#f44336' : name === 'Probe' ? '#ff9800' : name === 'U2R' ? '#2196f3' : '#9c27b0'
              }))} />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Metrics
              </Typography>
              <PerformanceChart />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
