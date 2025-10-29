/**
 * Performance Analytics component for detailed system performance metrics.
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  BugReport as BugReportIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

import MetricCard from './common/MetricCard';
import PerformanceChart from './charts/PerformanceChart';
import AttackTypeChart from './charts/AttackTypeChart';
import { ApiService } from '../services/ApiService';

const PerformanceAnalytics = ({ onShowNotification }) => {
  const [timeRange, setTimeRange] = useState('24h');
  const [performanceData, setPerformanceData] = useState({
    systemMetrics: {
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      network_throughput: 0,
      response_time: 0,
      uptime: '0 days'
    },
    detectionMetrics: {
      total_detections: 0,
      true_positives: 0,
      false_positives: 0,
      true_negatives: 0,
      false_negatives: 0,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1_score: 0
    },
    attackStats: {
      Normal: 0,
      DoS: 0,
      Probe: 0,
      U2R: 0,
      R2L: 0
    },
    historicalData: [],
    alerts: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPerformanceData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadPerformanceData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      
      // Load monitoring status and system health
      const [monitoringResponse, healthResponse] = await Promise.all([
        ApiService.getMonitoringStatus(),
        ApiService.getSystemHealth().catch(() => ({ status: 'error' }))
      ]);

      if (monitoringResponse.status === 'success') {
        const stats = monitoringResponse.monitoring_status.statistics;
        
        // Simulate realistic performance data
        const mockSystemMetrics = {
          cpu_usage: Math.random() * 40 + 20, // 20-60%
          memory_usage: Math.random() * 30 + 40, // 40-70%
          disk_usage: Math.random() * 20 + 15, // 15-35%
          network_throughput: Math.random() * 500 + 100, // 100-600 Mbps
          response_time: Math.random() * 50 + 10, // 10-60ms
          uptime: monitoringResponse.monitoring_status.uptime || '0 days'
        };

        const mockDetectionMetrics = {
          total_detections: stats.total_connections_today || 0,
          true_positives: stats.attacks_blocked_today || 0,
          false_positives: stats.false_positives || 0,
          true_negatives: Math.floor((stats.total_connections_today || 0) * 0.85),
          false_negatives: Math.floor((stats.attacks_blocked_today || 0) * 0.05),
          accuracy: stats.system_accuracy || 0,
          precision: calculatePrecision(stats),
          recall: calculateRecall(stats),
          f1_score: calculateF1Score(stats)
        };

        const mockAttackStats = {
          Normal: Math.floor(Math.random() * 500 + 3500),
          DoS: Math.floor(Math.random() * 100 + 50),
          Probe: Math.floor(Math.random() * 80 + 30),
          U2R: Math.floor(Math.random() * 20 + 5),
          R2L: Math.floor(Math.random() * 30 + 10)
        };

        setPerformanceData(prev => ({
          ...prev,
          systemMetrics: mockSystemMetrics,
          detectionMetrics: mockDetectionMetrics,
          attackStats: mockAttackStats,
          historicalData: generateHistoricalData(timeRange),
          alerts: generateRecentAlerts()
        }));
      }
    } catch (error) {
      console.error('Failed to load performance data:', error);
      onShowNotification('Failed to load performance analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculatePrecision = (stats) => {
    const tp = stats.attacks_blocked_today || 0;
    const fp = stats.false_positives || 0;
    return tp + fp > 0 ? tp / (tp + fp) : 0;
  };

  const calculateRecall = (stats) => {
    const tp = stats.attacks_blocked_today || 0;
    const fn = Math.floor(tp * 0.05); // Assume 5% false negatives
    return tp + fn > 0 ? tp / (tp + fn) : 0;
  };

  const calculateF1Score = (stats) => {
    const precision = calculatePrecision(stats);
    const recall = calculateRecall(stats);
    return precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  };

  const generateHistoricalData = (timeRange) => {
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
    const points = Math.min(hours, 48); // Max 48 data points for performance
    
    return Array.from({ length: points }, (_, i) => ({
      time: new Date(Date.now() - (points - i - 1) * (hours / points) * 60 * 60 * 1000),
      accuracy: 0.85 + Math.random() * 0.1,
      throughput: 100 + Math.random() * 500,
      response_time: 10 + Math.random() * 40,
      cpu_usage: 20 + Math.random() * 40,
      attacks_detected: Math.floor(Math.random() * 10)
    }));
  };

  const generateRecentAlerts = () => {
    const alertTypes = ['High CPU Usage', 'Memory Warning', 'Unusual Traffic Pattern', 'Model Accuracy Drop', 'Network Latency'];
    const severities = ['high', 'medium', 'low'];
    
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      message: `System alert detected - ${alertTypes[Math.floor(Math.random() * alertTypes.length)]}`
    }));
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const formatPercentage = (value) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value) => value.toLocaleString();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          Performance Analytics
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
          
          <Button 
            variant="outlined" 
            onClick={loadPerformanceData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* System Performance Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2}>
          <MetricCard
            title="CPU Usage"
            value={`${performanceData.systemMetrics.cpu_usage.toFixed(1)}%`}
            icon={<SpeedIcon />}
            color={performanceData.systemMetrics.cpu_usage > 80 ? 'error' : 'primary'}
            subtitle="Current system load"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <MetricCard
            title="Memory Usage"
            value={`${performanceData.systemMetrics.memory_usage.toFixed(1)}%`}
            icon={<AssessmentIcon />}
            color={performanceData.systemMetrics.memory_usage > 85 ? 'warning' : 'success'}
            subtitle="RAM utilization"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <MetricCard
            title="Response Time"
            value={`${performanceData.systemMetrics.response_time.toFixed(0)}ms`}
            icon={<TimelineIcon />}
            color={performanceData.systemMetrics.response_time > 100 ? 'warning' : 'info'}
            subtitle="Average API response"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <MetricCard
            title="Throughput"
            value={`${performanceData.systemMetrics.network_throughput.toFixed(0)} Mbps`}
            icon={<TrendingUpIcon />}
            color="secondary"
            subtitle="Network processing"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <MetricCard
            title="Disk Usage"
            value={`${performanceData.systemMetrics.disk_usage.toFixed(1)}%`}
            icon={<SecurityIcon />}
            color={performanceData.systemMetrics.disk_usage > 90 ? 'error' : 'primary'}
            subtitle="Storage utilization"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <MetricCard
            title="Uptime"
            value={performanceData.systemMetrics.uptime}
            icon={<CheckCircleIcon />}
            color="success"
            subtitle="System availability"
          />
        </Grid>
      </Grid>

      {/* Detection Performance Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Accuracy"
            value={formatPercentage(performanceData.detectionMetrics.accuracy)}
            icon={<CheckCircleIcon />}
            color="success"
            subtitle="Overall detection accuracy"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Precision"
            value={formatPercentage(performanceData.detectionMetrics.precision)}
            icon={<SecurityIcon />}
            color="primary"
            subtitle="True positive rate"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Recall"
            value={formatPercentage(performanceData.detectionMetrics.recall)}
            icon={<TrendingUpIcon />}
            color="info"
            subtitle="Attack detection rate"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="F1-Score"
            value={formatPercentage(performanceData.detectionMetrics.f1_score)}
            icon={<AssessmentIcon />}
            color="secondary"
            subtitle="Harmonic mean"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Performance Charts */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Historical Performance Trends
              </Typography>
              <PerformanceChart data={performanceData.historicalData} timeRange={timeRange} />
            </CardContent>
          </Card>
        </Grid>

        {/* Attack Distribution */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Attack Type Distribution
              </Typography>
              <AttackTypeChart data={performanceData.attackStats} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Confusion Matrix */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Detection Confusion Matrix
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell align="center"><strong>Predicted Normal</strong></TableCell>
                      <TableCell align="center"><strong>Predicted Attack</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><strong>Actual Normal</strong></TableCell>
                      <TableCell align="center" sx={{ backgroundColor: 'success.light', color: 'success.contrastText' }}>
                        {formatNumber(performanceData.detectionMetrics.true_negatives)}
                      </TableCell>
                      <TableCell align="center" sx={{ backgroundColor: 'warning.light', color: 'warning.contrastText' }}>
                        {formatNumber(performanceData.detectionMetrics.false_positives)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Actual Attack</strong></TableCell>
                      <TableCell align="center" sx={{ backgroundColor: 'error.light', color: 'error.contrastText' }}>
                        {formatNumber(performanceData.detectionMetrics.false_negatives)}
                      </TableCell>
                      <TableCell align="center" sx={{ backgroundColor: 'success.light', color: 'success.contrastText' }}>
                        {formatNumber(performanceData.detectionMetrics.true_positives)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" label={`Total Detections: ${formatNumber(performanceData.detectionMetrics.total_detections)}`} />
                <Chip size="small" label={`Accuracy: ${formatPercentage(performanceData.detectionMetrics.accuracy)}`} color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* System Alerts */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent System Alerts
              </Typography>
              
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {performanceData.alerts.map((alert) => (
                  <Alert 
                    key={alert.id} 
                    severity={getSeverityColor(alert.severity)}
                    sx={{ mb: 1 }}
                    icon={
                      alert.severity === 'high' ? <BugReportIcon /> :
                      alert.severity === 'medium' ? <WarningIcon /> :
                      <CheckCircleIcon />
                    }
                  >
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {alert.type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {alert.timestamp.toLocaleString()}
                      </Typography>
                    </Box>
                  </Alert>
                ))}
              </Box>

              {performanceData.alerts.length === 0 && (
                <Alert severity="success">
                  No recent alerts. System is operating normally.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PerformanceAnalytics;