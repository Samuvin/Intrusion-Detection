/**
 * Settings component for system configuration and preferences.
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
  TextField,
  FormControlLabel,
  Switch,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Notifications as NotificationIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Save as SaveIcon,
  RestartAlt as RestartIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

import { ApiService } from '../services/ApiService';

const Settings = ({ onShowNotification }) => {
  const [settings, setSettings] = useState({
    // Detection Settings
    detection: {
      threshold: 0.5,
      enableRealTimeMonitoring: true,
      autoBlockThreats: false,
      confidenceThreshold: 0.8,
      maxConcurrentConnections: 10000,
    },
    // Model Settings
    model: {
      autoRetrain: false,
      retrainInterval: 24, // hours
      useHyperparameterOptimization: true,
      maxTrainingTime: 30, // minutes
      batchSize: 32,
    },
    // System Settings
    system: {
      logLevel: 'INFO',
      maxLogSize: 100, // MB
      enableMetrics: true,
      metricsRetention: 7, // days
      apiTimeout: 30, // seconds
    },
    // Notification Settings
    notifications: {
      enableEmailAlerts: false,
      emailAddress: '',
      enableWebhooks: false,
      webhookUrl: '',
      alertThreshold: 'medium',
      maxAlertsPerHour: 50,
    },
    // Security Settings
    security: {
      enableApiAuthentication: false,
      sessionTimeout: 30, // minutes
      maxFailedAttempts: 5,
      enableRateLimiting: true,
      rateLimitRequests: 100,
    }
  });

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);

  useEffect(() => {
    loadSettings();
    loadSystemInfo();
  }, []);

  const loadSettings = async () => {
    try {
      // For now, use default settings since we don't have a settings endpoint
      // In a real application, this would load from the backend
      onShowNotification('Settings loaded successfully', 'success');
    } catch (error) {
      console.error('Failed to load settings:', error);
      onShowNotification('Failed to load settings', 'error');
    }
  };

  const loadSystemInfo = async () => {
    try {
      const response = await ApiService.getSystemHealth();
      if (response.status === 'success') {
        setSystemInfo(response.system_info);
      }
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  };

  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    setUnsavedChanges(true);
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      // In a real application, this would send settings to the backend
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setUnsavedChanges(false);
      onShowNotification('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      onShowNotification('Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values?')) {
      // Reset to default values
      setSettings({
        detection: {
          threshold: 0.5,
          enableRealTimeMonitoring: true,
          autoBlockThreats: false,
          confidenceThreshold: 0.8,
          maxConcurrentConnections: 10000,
        },
        model: {
          autoRetrain: false,
          retrainInterval: 24,
          useHyperparameterOptimization: true,
          maxTrainingTime: 30,
          batchSize: 32,
        },
        system: {
          logLevel: 'INFO',
          maxLogSize: 100,
          enableMetrics: true,
          metricsRetention: 7,
          apiTimeout: 30,
        },
        notifications: {
          enableEmailAlerts: false,
          emailAddress: '',
          enableWebhooks: false,
          webhookUrl: '',
          alertThreshold: 'medium',
          maxAlertsPerHour: 50,
        },
        security: {
          enableApiAuthentication: false,
          sessionTimeout: 30,
          maxFailedAttempts: 5,
          enableRateLimiting: true,
          rateLimitRequests: 100,
        }
      });
      setUnsavedChanges(true);
      onShowNotification('Settings reset to default values', 'info');
    }
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nids-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
    onShowNotification('Settings exported successfully', 'success');
  };

  const importSettings = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target.result);
          setSettings(importedSettings);
          setUnsavedChanges(true);
          onShowNotification('Settings imported successfully', 'success');
        } catch (error) {
          onShowNotification('Invalid settings file format', 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          System Settings
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          {unsavedChanges && (
            <Chip 
              label="Unsaved Changes" 
              color="warning" 
              size="small" 
              icon={<InfoIcon />}
            />
          )}
          
          <Button
            variant="contained"
            onClick={saveSettings}
            disabled={!unsavedChanges || loading}
            startIcon={<SaveIcon />}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
          
          <Button
            variant="outlined"
            onClick={resetSettings}
            startIcon={<RestartIcon />}
          >
            Reset to Defaults
          </Button>
        </Box>
      </Box>

      {unsavedChanges && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You have unsaved changes. Don't forget to save your settings before leaving this page.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Detection Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <SecurityIcon sx={{ mr: 1 }} />
                Detection Settings
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>Detection Threshold</Typography>
                <Slider
                  value={settings.detection.threshold}
                  onChange={(e, value) => handleSettingChange('detection', 'threshold', value)}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  marks={[
                    { value: 0.1, label: '0.1' },
                    { value: 0.5, label: '0.5' },
                    { value: 1.0, label: '1.0' }
                  ]}
                  valueLabelDisplay="on"
                />
                <Typography variant="body2" color="text.secondary">
                  Lower values = more sensitive (more false positives)
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>Confidence Threshold</Typography>
                <Slider
                  value={settings.detection.confidenceThreshold}
                  onChange={(e, value) => handleSettingChange('detection', 'confidenceThreshold', value)}
                  min={0.5}
                  max={1.0}
                  step={0.05}
                  marks={[
                    { value: 0.5, label: '50%' },
                    { value: 0.75, label: '75%' },
                    { value: 1.0, label: '100%' }
                  ]}
                  valueLabelDisplay="on"
                  valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
                />
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.detection.enableRealTimeMonitoring}
                    onChange={(e) => handleSettingChange('detection', 'enableRealTimeMonitoring', e.target.checked)}
                  />
                }
                label="Enable Real-time Monitoring"
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.detection.autoBlockThreats}
                    onChange={(e) => handleSettingChange('detection', 'autoBlockThreats', e.target.checked)}
                  />
                }
                label="Auto-block Detected Threats"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Max Concurrent Connections"
                type="number"
                value={settings.detection.maxConcurrentConnections}
                onChange={(e) => handleSettingChange('detection', 'maxConcurrentConnections', parseInt(e.target.value))}
                inputProps={{ min: 1000, max: 100000 }}
                helperText="Maximum number of simultaneous connections to monitor"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Model Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <SpeedIcon sx={{ mr: 1 }} />
                Model Settings
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.model.autoRetrain}
                    onChange={(e) => handleSettingChange('model', 'autoRetrain', e.target.checked)}
                  />
                }
                label="Enable Auto-retraining"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Retrain Interval (hours)"
                type="number"
                value={settings.model.retrainInterval}
                onChange={(e) => handleSettingChange('model', 'retrainInterval', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 168 }}
                disabled={!settings.model.autoRetrain}
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.model.useHyperparameterOptimization}
                    onChange={(e) => handleSettingChange('model', 'useHyperparameterOptimization', e.target.checked)}
                  />
                }
                label="Use Hyperparameter Optimization (CSA)"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Max Training Time (minutes)"
                type="number"
                value={settings.model.maxTrainingTime}
                onChange={(e) => handleSettingChange('model', 'maxTrainingTime', parseInt(e.target.value))}
                inputProps={{ min: 5, max: 120 }}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Batch Size"
                type="number"
                value={settings.model.batchSize}
                onChange={(e) => handleSettingChange('model', 'batchSize', parseInt(e.target.value))}
                inputProps={{ min: 8, max: 256 }}
                helperText="Higher values use more memory but may train faster"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* System Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <SettingsIcon sx={{ mr: 1 }} />
                System Settings
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Log Level</InputLabel>
                <Select
                  value={settings.system.logLevel}
                  label="Log Level"
                  onChange={(e) => handleSettingChange('system', 'logLevel', e.target.value)}
                >
                  <MenuItem value="DEBUG">Debug</MenuItem>
                  <MenuItem value="INFO">Info</MenuItem>
                  <MenuItem value="WARNING">Warning</MenuItem>
                  <MenuItem value="ERROR">Error</MenuItem>
                  <MenuItem value="CRITICAL">Critical</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Max Log File Size (MB)"
                type="number"
                value={settings.system.maxLogSize}
                onChange={(e) => handleSettingChange('system', 'maxLogSize', parseInt(e.target.value))}
                inputProps={{ min: 10, max: 1000 }}
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.system.enableMetrics}
                    onChange={(e) => handleSettingChange('system', 'enableMetrics', e.target.checked)}
                  />
                }
                label="Enable Performance Metrics"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Metrics Retention (days)"
                type="number"
                value={settings.system.metricsRetention}
                onChange={(e) => handleSettingChange('system', 'metricsRetention', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 365 }}
                disabled={!settings.system.enableMetrics}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="API Timeout (seconds)"
                type="number"
                value={settings.system.apiTimeout}
                onChange={(e) => handleSettingChange('system', 'apiTimeout', parseInt(e.target.value))}
                inputProps={{ min: 5, max: 300 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <NotificationIcon sx={{ mr: 1 }} />
                Notification Settings
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.enableEmailAlerts}
                    onChange={(e) => handleSettingChange('notifications', 'enableEmailAlerts', e.target.checked)}
                  />
                }
                label="Enable Email Alerts"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={settings.notifications.emailAddress}
                onChange={(e) => handleSettingChange('notifications', 'emailAddress', e.target.value)}
                disabled={!settings.notifications.enableEmailAlerts}
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.enableWebhooks}
                    onChange={(e) => handleSettingChange('notifications', 'enableWebhooks', e.target.checked)}
                  />
                }
                label="Enable Webhook Notifications"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Webhook URL"
                value={settings.notifications.webhookUrl}
                onChange={(e) => handleSettingChange('notifications', 'webhookUrl', e.target.value)}
                disabled={!settings.notifications.enableWebhooks}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Alert Threshold</InputLabel>
                <Select
                  value={settings.notifications.alertThreshold}
                  label="Alert Threshold"
                  onChange={(e) => handleSettingChange('notifications', 'alertThreshold', e.target.value)}
                >
                  <MenuItem value="low">Low - All alerts</MenuItem>
                  <MenuItem value="medium">Medium - Important alerts</MenuItem>
                  <MenuItem value="high">High - Critical alerts only</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Max Alerts per Hour"
                type="number"
                value={settings.notifications.maxAlertsPerHour}
                onChange={(e) => handleSettingChange('notifications', 'maxAlertsPerHour', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 1000 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Import/Export & System Info */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <StorageIcon sx={{ mr: 1 }} />
                Configuration Management
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={() => setExportDialogOpen(true)}
                    >
                      Export Settings
                    </Button>
                    
                    <input
                      accept=".json"
                      style={{ display: 'none' }}
                      id="import-settings"
                      type="file"
                      onChange={importSettings}
                    />
                    <label htmlFor="import-settings">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<UploadIcon />}
                      >
                        Import Settings
                      </Button>
                    </label>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary">
                    Export your current settings to a JSON file or import settings from a previously exported file.
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  {systemInfo && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>System Information:</Typography>
                      <List dense>
                        <ListItem>
                          <ListItemText primary="Python Version" secondary={systemInfo.python_version || 'N/A'} />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="Backend Version" secondary={systemInfo.backend_version || '1.0.0'} />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="Available Memory" secondary={systemInfo.memory || 'N/A'} />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="CPU Cores" secondary={systemInfo.cpu_cores || 'N/A'} />
                        </ListItem>
                      </List>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Export Confirmation Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Settings</DialogTitle>
        <DialogContent>
          <Typography>
            This will download your current settings as a JSON file. You can use this file to restore your settings later or share your configuration.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button onClick={exportSettings} variant="contained">Export</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;