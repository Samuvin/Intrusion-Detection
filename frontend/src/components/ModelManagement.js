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
  LinearProgress,
  TextField,
  FormControlLabel,
  Switch,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  PlayArrow as TrainIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as MetricsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';

import MetricCard from './common/MetricCard';
import { ApiService } from '../services/ApiService';

const ModelManagement = ({ onShowNotification }) => {
  const [modelInfo, setModelInfo] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingResults, setTrainingResults] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [trainingConfig, setTrainingConfig] = useState({
    targetColumn: 'class',
    optimizeHyperparameters: false,
    testSplit: 0.3
  });

  useEffect(() => {
    loadModelInfo();
  }, []);

  const loadModelInfo = async () => {
    try {
      const response = await ApiService.getModelInfo();
      if (response.status === 'success') {
        setModelInfo(response.model_info);
      }
    } catch (error) {
      console.error('Failed to load model info:', error);
      onShowNotification('Failed to load model information', 'error');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setUploadedFile(acceptedFiles[0]);
        onShowNotification(`Dataset uploaded: ${acceptedFiles[0].name}`, 'success');
      }
    },
    onDropRejected: (rejectedFiles) => {
      onShowNotification('Please upload a valid CSV file', 'error');
    }
  });

  const startTraining = async () => {
    if (!uploadedFile) {
      onShowNotification('Please upload a dataset first', 'error');
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingResults(null);

    // Simulate training progress
    const progressInterval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 10;
      });
    }, 500);

    try {
      const response = await ApiService.trainModel(
        uploadedFile,
        trainingConfig.targetColumn,
        trainingConfig.optimizeHyperparameters,
        (progressEvent) => {
          // Handle upload progress if needed
          console.log('Upload progress:', progressEvent);
        }
      );

      clearInterval(progressInterval);
      setTrainingProgress(100);

      if (response.status === 'success') {
        setTrainingResults(response);
        setModelInfo(prev => ({ ...prev, is_trained: true }));
        onShowNotification('Model training completed successfully!', 'success');
        
        // Reload model info
        setTimeout(loadModelInfo, 1000);
      } else {
        throw new Error(response.message || 'Training failed');
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Training failed:', error);
      onShowNotification(`Training failed: ${error.message}`, 'error');
    } finally {
      setIsTraining(false);
      setTimeout(() => setTrainingProgress(0), 2000);
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

  const formatAccuracy = (value) => {
    if (typeof value === 'number') {
      return (value * 100).toFixed(2) + '%';
    }
    return value || 'N/A';
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
        {/* Training Panel */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <TrainIcon sx={{ mr: 1 }} />
                Model Training
              </Typography>

              {/* Dataset Upload */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  1. Upload Training Dataset
                </Typography>
                
                <Paper
                  {...getRootProps()}
                  sx={{
                    p: 3,
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  
                  {uploadedFile ? (
                    <Box>
                      <Typography variant="body1" color="primary">
                        ✅ {uploadedFile.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Size: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="body1">
                        {isDragActive ? 'Drop the CSV file here...' : 'Drag & drop a CSV file here, or click to select'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Supports NSL-KDD and UNR-IDD format datasets
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Training Configuration */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  2. Training Configuration
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Target Column"
                      value={trainingConfig.targetColumn}
                      onChange={(e) => setTrainingConfig(prev => ({
                        ...prev,
                        targetColumn: e.target.value
                      }))}
                      size="small"
                      helperText="Column name containing class labels"
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Test Split Ratio"
                      type="number"
                      inputProps={{ min: 0.1, max: 0.5, step: 0.1 }}
                      value={trainingConfig.testSplit}
                      onChange={(e) => setTrainingConfig(prev => ({
                        ...prev,
                        testSplit: parseFloat(e.target.value)
                      }))}
                      size="small"
                      helperText="Proportion of data for testing (0.1-0.5)"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={trainingConfig.optimizeHyperparameters}
                          onChange={(e) => setTrainingConfig(prev => ({
                            ...prev,
                            optimizeHyperparameters: e.target.checked
                          }))}
                        />
                      }
                      label="Enable Hyperparameter Optimization (CSA)"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                      Uses Crow Search Algorithm to find optimal parameters (slower but better accuracy)
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Training Controls */}
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  onClick={startTraining}
                  disabled={!uploadedFile || isTraining}
                  startIcon={<TrainIcon />}
                  size="large"
                >
                  {isTraining ? 'Training...' : 'Start Training'}
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={loadPretrainedModel}
                  disabled={isTraining}
                  startIcon={<CheckCircleIcon />}
                >
                  Load Sample Model
                </Button>
              </Box>

              {/* Training Progress */}
              {isTraining && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Training Progress: {trainingProgress.toFixed(1)}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={trainingProgress} 
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {trainingProgress < 30 ? 'Preprocessing data...' :
                     trainingProgress < 60 ? 'Feature selection...' :
                     trainingProgress < 90 ? 'Training hybrid model...' :
                     'Finalizing...'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Training Results */}
          {trainingResults && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Training Results
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {formatAccuracy(trainingResults.metrics?.accuracy)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Accuracy
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {formatAccuracy(trainingResults.metrics?.precision)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Precision
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="warning.main">
                        {formatAccuracy(trainingResults.metrics?.recall)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Recall
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={6} sm={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="info.main">
                        {formatAccuracy(trainingResults.metrics?.f1_score)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        F1-Score
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <Chip 
                    label={`Training: ${trainingResults.training_samples || 0} samples`} 
                    variant="outlined" 
                  />
                  <Chip 
                    label={`Testing: ${trainingResults.test_samples || 0} samples`} 
                    variant="outlined" 
                  />
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Model Information Panel */}
        <Grid item xs={12} md={4}>
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