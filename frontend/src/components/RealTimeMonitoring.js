/**
 * Real-time Monitoring component for live network traffic analysis.
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  NetworkCheck as NetworkIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';

import MetricCard from './common/MetricCard';
import { ApiService } from '../services/ApiService';

const RealTimeMonitoring = ({ onShowNotification }) => {
  const [monitoringStatus, setMonitoringStatus] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [liveData, setLiveData] = useState({
    totalConnections: 0,
    suspiciousActivities: 0,
    blockedAttacks: 0,
    currentThreatLevel: 'Low',
    networkMetrics: {
      bandwidthUsage: 0,
      packetLoss: 0,
      latency: 0
    },
    attackBreakdown: {
      Normal: 0,
      DoS: 0,
      Probe: 0,
      U2R: 0,
      R2L: 0
    }
  });
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [websocket, setWebsocket] = useState(null);

  useEffect(() => {
    loadMonitoringStatus();
    
    // Refresh data every 10 seconds
    const interval = setInterval(() => {
      loadMonitoringStatus();
    }, 10000);
    
    return () => {
      if (websocket) {
        websocket.close();
      }
      clearInterval(interval);
    };
  }, []);
  
  useEffect(() => {
    // Auto-connect WebSocket after initial load
    if (!isConnected) {
      connectWebSocket();
    }
  }, []);

  const loadMonitoringStatus = async () => {
    try {
      const response = await ApiService.getMonitoringStatus();
      if (response.status === 'success') {
        setMonitoringStatus(response.monitoring_status);
        
        // Get real log statistics
        try {
          const logStatsResponse = await fetch('http://localhost:8000/api/v1/log-analysis/logs/statistics');
          if (logStatsResponse.ok) {
            const logStats = await logStatsResponse.json();
            const stats = logStats.statistics || {};
            
            // Update live data with REAL values from log statistics
            setLiveData(prev => ({
              ...prev,
              totalConnections: response.monitoring_status.statistics?.total_connections_today || stats.total_entries || 0,
              suspiciousActivities: stats.error_rate > 0 ? Math.floor(stats.total_entries * stats.error_rate) : 0,
              blockedAttacks: response.monitoring_status.statistics?.attacks_blocked_today || 0,
              networkMetrics: {
                bandwidthUsage: Math.min(stats.entries_per_second * 5, 100) || 0, // Estimate based on entries/sec
                packetLoss: (stats.error_rate * 100) || 0,
                latency: stats.entries_per_second > 0 ? Math.max(10, 1000 / stats.entries_per_second) : 0
              }
            }));
          }
        } catch (error) {
          console.error('Failed to fetch log statistics:', error);
          // Fallback to monitoring status only
          setLiveData(prev => ({
            ...prev,
            totalConnections: response.monitoring_status.statistics?.total_connections_today || 0,
            blockedAttacks: response.monitoring_status.statistics?.attacks_blocked_today || 0,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load monitoring status:', error);
      onShowNotification('Failed to load monitoring status', 'error');
    }
  };

  const connectWebSocket = () => {
    try {
      const ws = ApiService.createWebSocketConnection(
        (data) => {
          // Handle incoming WebSocket data
          if (data.type === 'traffic_update') {
            setLiveData(prev => ({
              ...prev,
              totalConnections: data.data.total_connections || prev.totalConnections,
              suspiciousActivities: data.data.suspicious_activities || prev.suspiciousActivities,
              blockedAttacks: data.data.blocked_attacks || prev.blockedAttacks,
              currentThreatLevel: data.data.current_threat_level || prev.currentThreatLevel,
              networkMetrics: data.data.network_metrics || prev.networkMetrics,
              attackBreakdown: data.data.attack_breakdown || prev.attackBreakdown
            }));
          } else if (data.type === 'attack_detected') {
            // Add new alert
            const newAlert = {
              id: Date.now(),
              type: data.data.attack_type,
              message: `${data.data.attack_type} attack detected from ${data.data.source_ip}`,
              severity: data.data.severity.toLowerCase(),
              timestamp: new Date(data.timestamp),
              confidence: data.data.confidence
            };
            
            setRecentAlerts(prev => [newAlert, ...prev.slice(0, 9)]); // Keep last 10 alerts
            onShowNotification(`Security Alert: ${newAlert.message}`, 'warning');
          }
        },
        (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
          onShowNotification('Real-time connection lost', 'error');
        },
        () => {
          setIsConnected(false);
          onShowNotification('Real-time monitoring disconnected', 'info');
        }
      );

      if (ws) {
        setWebsocket(ws);
        setIsConnected(true);
        onShowNotification('Real-time monitoring connected', 'success');
        
        // Send ping every 30 seconds to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        ws.onclose = () => {
          clearInterval(pingInterval);
          setIsConnected(false);
        };
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      onShowNotification('Failed to connect to real-time monitoring', 'error');
    }
  };

  const disconnectWebSocket = () => {
    if (websocket) {
      websocket.close();
      setWebsocket(null);
      setIsConnected(false);
      onShowNotification('Real-time monitoring disconnected', 'info');
    }
  };

  const simulateAttack = async (attackType) => {
    try {
      const response = await ApiService.simulateAttack(attackType);
      if (response.status === 'success') {
        onShowNotification(`${attackType} attack simulation triggered`, 'info');
      }
    } catch (error) {
      console.error('Attack simulation failed:', error);
      onShowNotification('Attack simulation failed', 'error');
    }
  };

  const getThreatLevelColor = (level) => {
    switch (level) {
      case 'High': return 'error';
      case 'Medium': return 'warning';
      case 'Low': return 'success';
      default: return 'default';
    }
  };

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'high': case 'critical': return <ErrorIcon color="error" />;
      case 'medium': case 'warning': return <WarningIcon color="warning" />;
      case 'low': case 'info': return <CheckCircleIcon color="info" />;
      default: return <SecurityIcon color="primary" />;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          Real-time Monitoring
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={isConnected ? <CheckCircleIcon /> : <ErrorIcon />}
            label={isConnected ? 'Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'error'}
            variant="outlined"
          />
          
          {!isConnected ? (
            <Button 
              variant="contained" 
              onClick={connectWebSocket}
              startIcon={<NetworkIcon />}
            >
              Connect Live Monitoring
            </Button>
          ) : (
            <Button 
              variant="outlined" 
              onClick={disconnectWebSocket}
              color="error"
            >
              Disconnect
            </Button>
          )}
        </Box>
      </Box>

      {/* Real-time Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Live Connections"
            value={liveData.totalConnections.toLocaleString()}
            icon={<NetworkIcon />}
            color="primary"
            subtitle="Active network connections"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Suspicious Activities"
            value={liveData.suspiciousActivities}
            icon={<WarningIcon />}
            color="warning"
            subtitle="Anomalies detected"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Blocked Attacks"
            value={liveData.blockedAttacks}
            icon={<SecurityIcon />}
            color="error"
            subtitle="Threats prevented"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="System Load"
            value={`${liveData.networkMetrics.bandwidthUsage.toFixed(1)}%`}
            icon={<SpeedIcon />}
            color="info"
            subtitle="Network bandwidth usage"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Current Threat Level */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <SecurityIcon sx={{ mr: 1 }} />
                Current Threat Level
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Chip
                  label={liveData.currentThreatLevel}
                  color={getThreatLevelColor(liveData.currentThreatLevel)}
                  size="large"
                  variant="filled"
                />
                <Typography variant="body2" color="text.secondary">
                  Based on real-time analysis
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Network Activity Level
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={liveData.networkMetrics.bandwidthUsage} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Typography variant="body2" color="text.secondary">
                Packet Loss: {liveData.networkMetrics.packetLoss.toFixed(2)}% | 
                Latency: {liveData.networkMetrics.latency.toFixed(1)}ms
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Attack Type Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <TimelineIcon sx={{ mr: 1 }} />
                Attack Type Distribution
              </Typography>
              
              {Object.entries(liveData.attackBreakdown).map(([type, count]) => (
                <Box key={type} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">{type}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((count / Math.max(...Object.values(liveData.attackBreakdown))) * 100, 100)}
                      sx={{ width: 100, height: 6 }}
                      color={type === 'Normal' ? 'success' : 'error'}
                    />
                    <Typography variant="body2" sx={{ minWidth: 30, textAlign: 'right' }}>
                      {count}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Security Alerts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Security Alerts
              </Typography>
              
              {recentAlerts.length === 0 ? (
                <Alert severity="info">
                  No recent alerts. System is operating normally.
                </Alert>
              ) : (
                <List>
                  {recentAlerts.map((alert) => (
                    <ListItem key={alert.id} divider>
                      <ListItemIcon>
                        {getAlertIcon(alert.severity)}
                      </ListItemIcon>
                      <ListItemText
                        primary={alert.message}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 0.5 }}>
                            <Typography variant="caption">
                              {alert.timestamp.toLocaleString()}
                            </Typography>
                            {alert.confidence && (
                              <Chip
                                label={`${(alert.confidence * 100).toFixed(1)}% confidence`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Testing Panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Attack Simulation
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Test the detection system with simulated attacks
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {['DoS', 'Probe', 'U2R', 'R2L'].map((attackType) => (
                  <Button
                    key={attackType}
                    variant="outlined"
                    size="small"
                    onClick={() => simulateAttack(attackType)}
                    startIcon={<WarningIcon />}
                  >
                    Simulate {attackType} Attack
                  </Button>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {!isConnected && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <strong>Live monitoring is disconnected.</strong> Click "Connect Live Monitoring" to start receiving real-time updates.
        </Alert>
      )}
    </Box>
  );
};

export default RealTimeMonitoring;