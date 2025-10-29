/**
 * Model Management component for training and managing ML models.
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
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as MetricsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

import MetricCard from './common/MetricCard';
import { ApiService } from '../services/ApiService';

const ModelManagement = ({ onShowNotification }) => {
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    // Load from localStorage first for immediate display
    try {
      const storedModelInfo = localStorage.getItem('nids_model_info');
      if (storedModelInfo) {
        const modelInfo = JSON.parse(storedModelInfo);
        setModelInfo(modelInfo);
      }
    } catch (e) {
      console.error('Failed to load model info from localStorage:', e);
    }
    
    loadModelInfo();
  }, []);

  const loadModelInfo = async () => {
    try {
      const response = await ApiService.getModelInfo();
      if (response.status === 'success') {
        setModelInfo(response.model_info);
        
        // Save to localStorage for consistency across navigation
        try {
          const fullModelInfo = {
            ...response.model_info,
            training_timestamp: Date.now()
          };
          localStorage.setItem('nids_model_info', JSON.stringify(fullModelInfo));
        } catch (e) {
          console.error('Failed to save model info to localStorage:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load model info:', error);
      onShowNotification('Failed to load model information', 'error');
    }
  };


  const loadPretrainedModel = async () => {
    try {
      const response = await ApiService.loadModel();
      if (response.status === 'success') {
        await loadModelInfo();
        onShowNotification('Pre-trained model loaded successfully', 'success');
      }
    } catch (error) {
      console.error('Failed to load model:', error);
      onShowNotification('Failed to load pre-trained model', 'error');
    }
  };


  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
        Model Management
      </Typography>

      {/* Model Status Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Model Status"
            value={modelInfo?.is_trained ? 'Trained' : 'Not Trained'}
            icon={modelInfo?.is_trained ? <CheckCircleIcon /> : <ErrorIcon />}
            color={modelInfo?.is_trained ? 'success' : 'warning'}
            subtitle="Current model state"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Selected Features"
            value={modelInfo?.selected_features?.length || 0}
            icon={<MetricsIcon />}
            color="info"
            subtitle="Optimized feature count"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Model Type"
            value="Hybrid"
            icon={<SettingsIcon />}
            color="primary"
            subtitle="SVM + XGBoost"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Optimization"
            value="CSA"
            icon={<InfoIcon />}
            color="secondary"
            subtitle="Crow Search Algorithm"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Model Information Panel */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Model Info
              </Typography>
              
              {modelInfo ? (
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Status"
                      secondary={
                        <Chip 
                          label={modelInfo.is_trained ? 'Trained' : 'Not Trained'}
                          color={modelInfo.is_trained ? 'success' : 'default'}
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                  
                  {modelInfo.current_model_name && (
                    <ListItem>
                      <ListItemText
                        primary="Active Model"
                        secondary={
                          <Chip 
                            label={modelInfo.current_model_name}
                            color="secondary"
                            size="small"
                            variant="outlined"
                          />
                        }
                      />
                    </ListItem>
                  )}
                  
                  <ListItem>
                    <ListItemText
                      primary="Model Type"
                      secondary={modelInfo.model_type || 'Hybrid SVM + XGBoost'}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Optimization"
                      secondary={modelInfo.optimization || 'Crow Search Algorithm'}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Total Features"
                      secondary={modelInfo.feature_count || 'N/A'}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Selected Features"
                      secondary={modelInfo.selected_features?.length || 0}
                    />
                  </ListItem>
                  
                  {modelInfo.dataset_name && (
                    <ListItem>
                      <ListItemText
                        primary="Training Dataset"
                        secondary={
                          <Chip 
                            label={modelInfo.dataset_name}
                            color="primary"
                            size="small"
                            variant="outlined"
                          />
                        }
                      />
                    </ListItem>
                  )}
                  
                  {modelInfo.last_training && (
                    <ListItem>
                      <ListItemText
                        primary="Last Trained"
                        secondary={new Date(modelInfo.last_training).toLocaleString()}
                      />
                    </ListItem>
                  )}
                </List>
              ) : (
                <Alert severity="info">
                  Model information will appear here after training or loading a model.
                </Alert>
              )}
              
              {modelInfo?.selected_features && modelInfo.selected_features.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Top Selected Features:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {modelInfo.selected_features.slice(0, 8).map((feature, index) => (
                      <Chip
                        key={index}
                        label={feature}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    ))}
                    {modelInfo.selected_features.length > 8 && (
                      <Chip
                        label={`+${modelInfo.selected_features.length - 8} more`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={loadModelInfo}
                  startIcon={<InfoIcon />}
                >
                  Refresh Model Info
                </Button>
                
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!modelInfo?.is_trained}
                  startIcon={<MetricsIcon />}
                  onClick={() => onShowNotification('Feature importance view coming soon', 'info')}
                >
                  View Feature Importance
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ModelManagement;