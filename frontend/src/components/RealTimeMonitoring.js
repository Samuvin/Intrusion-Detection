/**
 * Real-time Monitoring component for live network traffic analysis.
 */

import React, { useState, useEffect, useRef } from 'react';
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
  const [isConnecting, setIsConnecting] = useState(false);
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
  const wsRef = useRef(null);

  useEffect(() => {
    loadMonitoringStatus();
    
    // Refresh data every 10 seconds
    const interval = setInterval(() => {
      loadMonitoringStatus();
    }, 10000);
    
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'Component unmounting');
        } catch (e) {
          // Ignore errors
        }
        wsRef.current = null;
      }
      if (websocket) {
        try {
          websocket.close(1000, 'Component unmounting');
        } catch (e) {
          // Ignore errors
        }
      }
      clearInterval(interval);
    };
  }, []);
  
  useEffect(() => {
    // Auto-connect WebSocket after initial load
    const connectTimer = setTimeout(() => {
      connectWebSocket();
    }, 1000); // Small delay to ensure component is fully mounted
    
    return () => clearTimeout(connectTimer);
  }, []); // Only run on mount

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
            
            // If there are no logs, reset all values to zero
            const totalEntries = stats.total_entries || 0;
            const entriesPerSec = stats.entries_per_second || 0;
            const errorRate = stats.error_rate || 0;
            
            if (totalEntries === 0) {
              // No logs - reset everything to zero
              setLiveData(prev => ({
                ...prev,
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
              }));
            } else {
              // Update live data with REAL values from log statistics
              setLiveData(prev => ({
                ...prev,
                totalConnections: response.monitoring_status.statistics?.total_connections_today || totalEntries || 0,
                suspiciousActivities: errorRate > 0 ? Math.floor(totalEntries * errorRate) : 0,
                blockedAttacks: response.monitoring_status.statistics?.attacks_blocked_today || 0,
                networkMetrics: {
                  bandwidthUsage: entriesPerSec > 0 ? Math.min(entriesPerSec * 5, 100) : 0,
                  packetLoss: errorRate > 0 ? (errorRate * 100) : 0,
                  latency: entriesPerSec > 0 ? Math.max(10, 1000 / entriesPerSec) : 0
                }
              }));
            }
          }
        } catch (error) {
          console.error('Failed to fetch log statistics:', error);
          // Fallback to monitoring status only - check if we have real data
          const totalConnections = response.monitoring_status.statistics?.total_connections_today || 0;
          setLiveData(prev => ({
            ...prev,
            totalConnections: totalConnections,
            blockedAttacks: response.monitoring_status.statistics?.attacks_blocked_today || 0,
            // If no connections, reset network metrics
            networkMetrics: totalConnections === 0 ? {
              bandwidthUsage: 0,
              packetLoss: 0,
              latency: 0
            } : prev.networkMetrics
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load monitoring status:', error);
      onShowNotification('Failed to load monitoring status', 'error');
    }
  };

  const connectWebSocket = () => {
    // Don't create duplicate connections
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        return; // Already connected
      } else if (wsRef.current.readyState === WebSocket.CONNECTING) {
        return; // Already connecting
      } else {
        // Close existing connection before creating a new one
        try {
          wsRef.current.close();
        } catch (e) {
          // Ignore errors
        }
      }
    }
    
    setIsConnecting(true);
    
    try {
      // Create WebSocket directly with explicit URL
      const wsUrl = 'ws://localhost:8000/api/v1/monitoring/live';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected to:', wsUrl);
        setIsConnected(true);
        setIsConnecting(false);
        setWebsocket(ws);
        onShowNotification('Real-time monitoring connected', 'success');
        
        // Send ping every 30 seconds to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch (e) {
              console.error('Failed to send ping:', e);
              clearInterval(pingInterval);
            }
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
        
        // Store ping interval for cleanup
        ws._pingInterval = pingInterval;
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle incoming WebSocket data - sync with real log statistics
          if (data.type === 'traffic_update') {
            // Immediately fetch fresh log statistics to ensure sync
            fetch('http://localhost:8000/api/v1/log-analysis/logs/statistics')
              .then(response => response.json())
              .then(logStats => {
                const stats = logStats.statistics || {};
                const totalEntries = stats.total_entries || 0;
                const errorRate = stats.error_rate || 0;
                
                // Update with both WebSocket data AND real statistics for full sync
                setLiveData(prev => ({
                  ...prev,
                  // Use WebSocket data but validate with real statistics
                  totalConnections: totalEntries || data.data?.total_connections || prev.totalConnections,
                  suspiciousActivities: errorRate > 0 ? Math.floor(totalEntries * errorRate) : (data.data?.suspicious_activities || prev.suspiciousActivities),
                  blockedAttacks: data.data?.blocked_attacks || prev.blockedAttacks,
                  currentThreatLevel: data.data?.current_threat_level || prev.currentThreatLevel,
                  networkMetrics: data.data?.network_metrics || prev.networkMetrics,
                  // Attack breakdown from WebSocket is synced with log aggregator
                  attackBreakdown: data.data?.attack_breakdown || prev.attackBreakdown
                }));
              })
              .catch(error => {
                console.error('Failed to sync log statistics:', error);
                // Fallback to WebSocket data only
                setLiveData(prev => ({
                  ...prev,
                  totalConnections: data.data?.total_connections || prev.totalConnections,
                  suspiciousActivities: data.data?.suspicious_activities || prev.suspiciousActivities,
                  blockedAttacks: data.data?.blocked_attacks || prev.blockedAttacks,
                  currentThreatLevel: data.data?.current_threat_level || prev.currentThreatLevel,
                  networkMetrics: data.data?.network_metrics || prev.networkMetrics,
                  attackBreakdown: data.data?.attack_breakdown || prev.attackBreakdown
                }));
              });
          } else if (data.type === 'attack_detected') {
            // Add new alert with deduplication
            const alertKey = `${data.data?.source_ip || 'unknown'}_${data.data?.attack_type || 'Unknown'}`;
            const alertTimestamp = new Date(data.timestamp || Date.now());
            const newAlert = {
              id: Date.now(),
              key: alertKey,  // Unique key for deduplication
              type: data.data?.attack_type || 'Unknown',
              message: `${data.data?.attack_type || 'Unknown'} attack detected from ${data.data?.source_ip || 'unknown'}`,
              severity: (data.data?.severity || 'medium').toLowerCase(),
              timestamp: alertTimestamp,
              confidence: data.data?.confidence || 0.5
            };
            
            setRecentAlerts(prev => {
              // Check if we already have an alert for this IP + attack type in the last 60 seconds
              const existingAlert = prev.find(alert => 
                alert.key === alertKey && 
                (Date.now() - alert.timestamp.getTime()) < 60000  // Within last 60 seconds
              );
              
              // If no duplicate found, add the new alert
              if (!existingAlert) {
                onShowNotification(`Security Alert: ${newAlert.message}`, 'warning');
                return [newAlert, ...prev.slice(0, 9)]; // Keep last 10 alerts
              }
              
              // Duplicate detected - don't add it again
              return prev;
            });
          } else if (data.type === 'pong') {
            // Handle pong response to ping
            console.log('Received pong from server');
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setIsConnecting(false);
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        // Clear ping interval
        if (ws._pingInterval) {
          clearInterval(ws._pingInterval);
        }
        
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        setWebsocket(null);
        
        // Only attempt to reconnect if it wasn't a manual close (code 1000)
        if (event.code !== 1000) {
          console.log('Attempting to reconnect in 3 seconds...');
          setTimeout(() => {
            if (!wsRef.current) {
              connectWebSocket();
            }
          }, 3000);
        }
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;
      // Retry connection after 5 seconds
      setTimeout(() => {
        if (!wsRef.current) {
          connectWebSocket();
        }
      }, 5000);
    }
  };


  const simulateAttack = async (attackType) => {
    try {
      onShowNotification(`Triggering ${attackType} attack simulation...`, 'info');
      const response = await ApiService.simulateAttack(attackType);
      if (response && response.status === 'success') {
        const simulationData = response.simulation_data || {};
        const message = response.message || `${attackType} attack simulation completed`;
        onShowNotification(`${message} (${simulationData.packets || 0} packets, ${simulationData.duration || 0}s)`, 'success');
        
        // Force refresh of monitoring data after attack simulation
        setTimeout(() => {
          loadMonitoringStatus();
        }, 1000);
      } else {
        onShowNotification('Attack simulation completed but received unexpected response', 'warning');
      }
    } catch (error) {
      console.error('Attack simulation failed:', error);
      const errorMessage = error.message || 'Failed to simulate attack';
      onShowNotification(`Attack simulation failed: ${errorMessage}`, 'error');
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
            label={isConnected ? 'Live' : 'Connecting...'}
            color={isConnected ? 'success' : 'warning'}
            variant="outlined"
            size="small"
          />
        </Box>
      </Box>

      {/* Real-time Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Live Connections"
            value={(liveData.totalConnections || 0).toLocaleString()}
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
            value={`${(liveData.networkMetrics?.bandwidthUsage || 0).toFixed(1)}%`}
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
                  value={liveData.networkMetrics?.bandwidthUsage || 0} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Typography variant="body2" color="text.secondary">
                Packet Loss: {(liveData.networkMetrics?.packetLoss || 0).toFixed(2)}% | 
                Latency: {(liveData.networkMetrics?.latency || 0).toFixed(1)}ms
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
                              {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'Unknown'}
                            </Typography>
                            {alert.confidence && (
                              <Chip
                                label={`${((alert.confidence || 0) * 100).toFixed(1)}% confidence`}
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

      {!isConnected && !isConnecting && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <strong>Not connected.</strong> Attempting to connect automatically...
        </Alert>
      )}
      
      {isConnecting && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          <strong>Connecting to real-time monitoring...</strong> Data will appear automatically once connected.
        </Alert>
      )}
    </Box>
  );
};

export default RealTimeMonitoring;