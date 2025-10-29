/**
 * Dataset Management component for uploading and managing datasets.
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Timeline as MetricsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

import MetricCard from './common/MetricCard';
import { ApiService } from '../services/ApiService';
import { useLocation } from 'react-router-dom';
import { useNavigationBlock } from '../App';

const DatasetManagement = ({ onShowNotification }) => {
  const location = useLocation();
  const { setNavigationBlocked } = useNavigationBlock();
  const [datasets, setDatasets] = useState([]);
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [selectedDatasetInfo, setSelectedDatasetInfo] = useState(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [currentDataset, setCurrentDataset] = useState(null);
  const [trainingDataset, setTrainingDataset] = useState(null);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingProgressInterval, setTrainingProgressInterval] = useState(null);
  const [trainingController, setTrainingController] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [trainingHistory, setTrainingHistory] = useState([]);

  useEffect(() => {
    loadAvailableDatasets();
    loadAllDatasets();
    loadModelInfo();
    loadTrainingHistory();
    
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
  }, []);

  const loadTrainingHistory = () => {
    try {
      const storedHistory = localStorage.getItem('nids_training_history');
      if (storedHistory) {
        const history = JSON.parse(storedHistory);
        setTrainingHistory(history);
      }
    } catch (e) {
      console.error('Failed to load training history from localStorage:', e);
    }
  };

  const saveTrainingHistory = (datasetName, fileName, performance, modelName = 'nids_model') => {
    try {
      const trainingRecord = {
        id: Date.now(),
        datasetName,
        fileName,
        modelName,
        timestamp: new Date().toISOString(),
        timestamp_ms: Date.now(),
        performance: performance || {},
        accuracy: performance?.accuracy || performance?.accuracy || 'N/A',
        precision: performance?.precision || performance?.precision || 'N/A',
        recall: performance?.recall || performance?.recall || 'N/A'
      };
      
      // Load current history from localStorage to ensure we have the latest
      let currentHistory = [];
      try {
        const storedHistory = localStorage.getItem('nids_training_history');
        if (storedHistory) {
          currentHistory = JSON.parse(storedHistory);
        }
      } catch (e) {
        console.error('Failed to load training history from localStorage:', e);
        currentHistory = [...trainingHistory]; // Fallback to state
      }
      
      // Check if this dataset was already trained before
      const existingIndex = currentHistory.findIndex(
        h => h.datasetName === datasetName && h.modelName === modelName
      );
      
      if (existingIndex >= 0) {
        // Update existing record
        currentHistory[existingIndex] = trainingRecord;
      } else {
        // Add new record
        currentHistory.push(trainingRecord);
      }
      
      // Sort by timestamp (newest first)
      currentHistory.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
      
      // Save to localStorage
      localStorage.setItem('nids_training_history', JSON.stringify(currentHistory));
      
      // Update state
      setTrainingHistory(currentHistory);
      
      console.log('Training history saved:', currentHistory);
      
      return trainingRecord;
    } catch (e) {
      console.error('Failed to save training history:', e);
      return null;
    }
  };

  const getDatasetTrainingInfo = (datasetName) => {
    return trainingHistory.find(h => h.datasetName === datasetName);
  };

  const hasDatasetBeenTrained = (datasetName) => {
    return trainingHistory.some(h => h.datasetName === datasetName);
  };

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
    }
  };

  // Block navigation when training is in progress
  useEffect(() => {
    if (trainingDataset) {
      setNavigationBlocked(true);
      
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = 'Model training is in progress. Are you sure you want to leave?';
        return e.returnValue;
      };

      // Prevent navigation via browser back/forward
      const handlePopState = (e) => {
        if (trainingDataset) {
          window.history.pushState(null, '', window.location.pathname);
          onShowNotification('Please wait for training to complete before navigating away', 'warning');
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
      
      // Push a state to prevent back navigation
      window.history.pushState(null, '', window.location.pathname);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
        setNavigationBlocked(false);
      };
    } else {
      setNavigationBlocked(false);
    }
  }, [trainingDataset, setNavigationBlocked, onShowNotification]);

  const loadAvailableDatasets = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getAvailableDatasets();
      if (response.status === 'success') {
        setAvailableDatasets(response.datasets);
      }
    } catch (error) {
      console.error('Failed to load datasets:', error);
      onShowNotification('Failed to load available datasets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAllDatasets = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/datasets/list');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setDatasets(data.datasets || []);
        }
      }
    } catch (error) {
      console.error('Failed to load all datasets:', error);
    }
  };

  const useDataset = async (datasetName) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/v1/datasets/use/${datasetName}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setCurrentDataset(datasetName);
          onShowNotification(`Dataset "${datasetName}" is now ready for training`, 'success');
          // Refresh the list to show updated status
          await loadAllDatasets();
        }
      } else {
        const errorData = await response.json();
        onShowNotification(`Failed to use dataset: ${errorData.detail || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Failed to use dataset:', error);
      onShowNotification(`Failed to use dataset: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const trainModel = async (datasetName, fileName) => {
    if (!window.confirm(`Train model with dataset "${datasetName}"? This may take several minutes. The app will continue working during training.`)) {
      return;
    }

    // Start training asynchronously without blocking UI
    setTrainingDataset(datasetName);
    setTrainingProgress(0);
    
    // Create AbortController for cancelling the fetch request
    const controller = new AbortController();
    setTrainingController(controller);
    
    // Simulate progress (in real scenario, backend would send progress updates)
    // Progress will go up to 95% while waiting, then complete to 100% on response
    const progressInterval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 95) {
          // Hold at 95% until response arrives
          return prev;
        }
        // Increment by smaller amounts as we approach 95%
        const increment = prev < 80 ? Math.random() * 5 : Math.random() * 2;
        return Math.min(prev + increment, 95);
      });
    }, 2000);
    setTrainingProgressInterval(progressInterval);
    
    // Safety timeout - if training takes more than 30 minutes, mark as failed
    const timeoutId = setTimeout(() => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setTrainingProgressInterval(null);
      setTrainingDataset(null);
      setTrainingProgress(0);
      setTrainingController(null);
      setNavigationBlocked(false);
      onShowNotification('Training timeout: The operation took too long. Please try again.', 'error');
    }, 30 * 60 * 1000); // 30 minutes

    try {
      onShowNotification(`Training started with "${datasetName}". You can continue using the app.`, 'info');
      
      const formData = new FormData();
      formData.append('dataset_name', datasetName);
      formData.append('target_column', 'class');
      formData.append('optimize_hyperparameters', 'true');
      
      // Make async request without blocking
      const response = await fetch('http://localhost:8000/api/v1/models/train-from-dataset', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      // Clear timeout since we got a response
      clearTimeout(timeoutId);
      
      // Stop progress simulation and complete to 100%
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setTrainingProgressInterval(null);
      
      // Set progress to 100% to show completion
      setTrainingProgress(100);
      
      // Small delay to show 100% before processing response
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          const accuracy = data.performance?.accuracy || data.accuracy || 'N/A';
          const precision = data.performance?.precision || data.precision || 'N/A';
          const recall = data.performance?.recall || data.recall || 'N/A';
          
          const performance = {
            accuracy: data.performance?.accuracy || data.accuracy,
            precision: data.performance?.precision || data.precision,
            recall: data.performance?.recall || data.recall
          };
          
          onShowNotification(
            `✅ Model trained successfully! Accuracy: ${typeof performance.accuracy === 'number' ? (performance.accuracy * 100).toFixed(2) + '%' : performance.accuracy} | Precision: ${typeof performance.precision === 'number' ? (performance.precision * 100).toFixed(2) + '%' : performance.precision} | Recall: ${typeof performance.recall === 'number' ? (performance.recall * 100).toFixed(2) + '%' : performance.recall}`,
            'success'
          );
          
          // Save training history to localStorage
          const savedRecord = saveTrainingHistory(datasetName, fileName, performance, 'nids_model');
          if (savedRecord) {
            console.log('Training record saved successfully:', savedRecord);
            // Reload training history to ensure UI updates
            loadTrainingHistory();
          }
          
          // Mark this dataset as used for training
          setCurrentDataset(datasetName);
          
          // Save model info to localStorage for consistency
          try {
            const modelInfo = {
              is_trained: true,
              dataset_name: datasetName,
              current_model_name: 'nids_model',
              last_training: new Date().toISOString(),
              training_timestamp: Date.now()
            };
            localStorage.setItem('nids_model_info', JSON.stringify(modelInfo));
            console.log('Model info saved to localStorage:', modelInfo);
          } catch (e) {
            console.error('Failed to save to localStorage:', e);
          }
          
          // Fetch updated model info from backend to get all details
          try {
            const modelInfoResponse = await fetch('http://localhost:8000/api/v1/models/info');
            if (modelInfoResponse.ok) {
              const modelData = await modelInfoResponse.json();
              if (modelData.status === 'success' && modelData.model_info) {
                const fullModelInfo = {
                  ...modelData.model_info,
                  training_timestamp: Date.now()
                };
                localStorage.setItem('nids_model_info', JSON.stringify(fullModelInfo));
                setModelInfo(fullModelInfo); // Update local state
              }
            }
          } catch (e) {
            console.error('Failed to fetch updated model info:', e);
          }
          
          // Reset training state after delay to show success message
          setTimeout(() => {
            setTrainingDataset(null);
            setTrainingProgress(0);
            setTrainingController(null);
            setNavigationBlocked(false);
            setLoading(false);
          }, 3000);
        } else {
          onShowNotification(`Training completed with status: ${data.status}`, 'warning');
          // Reset immediately for non-success response
          setTrainingDataset(null);
          setTrainingProgress(0);
          setTrainingController(null);
          setNavigationBlocked(false);
          setLoading(false);
        }
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        onShowNotification(`Training failed: ${errorData.detail || 'Unknown error'}`, 'error');
        
        // Reset training state immediately on error
        setTrainingDataset(null);
        setTrainingProgress(0);
        setTrainingController(null);
        setNavigationBlocked(false);
        setLoading(false);
      }
    } catch (error) {
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Stop progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setTrainingProgressInterval(null);
      
      // Reset all training states
      setTrainingDataset(null);
      setTrainingProgress(0);
      setTrainingController(null);
      setNavigationBlocked(false);
      setLoading(false);
      
      if (error.name === 'AbortError') {
        onShowNotification('Training cancelled by user', 'info');
      } else {
        console.error('Failed to train model:', error);
        onShowNotification(`Training failed: ${error.message}`, 'error');
      }
    }
  };

  const cancelTraining = () => {
    if (window.confirm('Are you sure you want to cancel the training? This action cannot be undone.')) {
      // Cancel the fetch request
      if (trainingController) {
        trainingController.abort();
        setTrainingController(null);
      }
      
      // Clear progress interval
      if (trainingProgressInterval) {
        clearInterval(trainingProgressInterval);
        setTrainingProgressInterval(null);
      }
      
      // Reset all training states immediately
      setTrainingDataset(null);
      setTrainingProgress(0);
      setNavigationBlocked(false);
      
      // Ensure loading state is also reset
      setLoading(false);
      
      // Force a small delay to ensure state updates propagate
      setTimeout(() => {
        onShowNotification('Training cancelled', 'info');
      }, 100);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setDatasetName(file.name.replace('.csv', ''));
        setUploadDialogOpen(true);
      } else {
        onShowNotification('Please select a CSV file', 'error');
      }
    }
  };

  const uploadDataset = async () => {
    if (!selectedFile || !datasetName.trim()) {
      onShowNotification('Please provide a file and dataset name', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await ApiService.uploadDataset(selectedFile, datasetName.trim());
      
      if (response.status === 'success') {
        onShowNotification(`Dataset "${datasetName}" uploaded successfully`, 'success');
        setUploadDialogOpen(false);
        setSelectedFile(null);
        setDatasetName('');
        
        // Refresh the datasets list
        await loadAvailableDatasets();
        await loadAllDatasets();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      onShowNotification(`Upload failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };


  const viewDatasetInfo = async (datasetName) => {
    try {
      setLoading(true);
      const response = await ApiService.getDatasetInfo(datasetName);
      if (response.status === 'success') {
        setSelectedDatasetInfo(response.dataset_info);
        setInfoDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to load dataset info:', error);
      onShowNotification('Failed to load dataset information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getDatasetStats = () => {
    // Use actual datasets list if available, otherwise fall back to availableDatasets
    const datasetList = datasets.length > 0 ? datasets : availableDatasets;
    const totalDatasets = datasetList.length;
    const availableCount = datasetList.filter(d => d.available !== false).length;
    
    let totalSize = 0;
    if (datasets.length > 0) {
      // Use actual dataset sizes
      totalSize = datasets.reduce((sum, d) => {
        return sum + (d.rows || 0);
      }, 0);
    } else {
      // Fallback to parsing from availableDatasets
      totalSize = availableDatasets.reduce((sum, d) => {
      const match = d.size?.match(/(\d+),?(\d*)/);
      return sum + (match ? parseInt(match[1].replace(',', '') + (match[2] || '')) : 0);
    }, 0);
    }

    return { totalDatasets, availableCount, totalSize };
  };

  const stats = getDatasetStats();

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold', mb: 3, flexShrink: 0 }}>
        Dataset & Model Management
      </Typography>

      {/* Training Status Banner */}
      {trainingDataset && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <Button
                size="small"
                color="error"
                variant="outlined"
                onClick={cancelTraining}
                sx={{ minWidth: 80 }}
              >
                Cancel
              </Button>
            </Box>
          }
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              Training model with dataset: <strong>{trainingDataset}</strong>
            </Typography>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress 
                variant="determinate" 
                value={trainingProgress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'right' }}>
              {Math.round(trainingProgress)}%
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Model Status Overview */}
      <Grid container spacing={3} sx={{ mb: 4, flexShrink: 0 }}>
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

      {/* Dataset Statistics */}
      <Grid container spacing={3} sx={{ mb: 4, flexShrink: 0 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Datasets"
            value={stats.totalDatasets}
            icon={<StorageIcon />}
            color="primary"
            subtitle="Available datasets"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Trained Datasets"
            value={trainingHistory.length}
            icon={<AssessmentIcon />}
            color="info"
            subtitle="Datasets used for training"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Records"
            value={stats.totalSize.toLocaleString()}
            icon={<InfoIcon />}
            color="success"
            subtitle="Approximate total samples"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Formats Supported"
            value="CSV, NSL-KDD"
            icon={<UploadIcon />}
            color="secondary"
            subtitle="Compatible formats"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ flex: 1, minHeight: 0 }}>
        {/* Model Information Panel */}
        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Model Info
              </Typography>
              
              {trainingHistory.length > 0 && (
                <Box sx={{ mb: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Training History: {trainingHistory.length} dataset(s)
                  </Typography>
                  <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
                    {trainingHistory.slice(0, 5).map((record) => (
                      <Chip
                        key={record.id}
                        label={`${record.datasetName} - ${new Date(record.timestamp).toLocaleDateString()}`}
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ mb: 0.5, mr: 0.5, fontSize: '0.7rem' }}
                      />
                    ))}
                    {trainingHistory.length > 5 && (
                      <Typography variant="caption" color="text.secondary">
                        +{trainingHistory.length - 5} more
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              
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
                  
                  <ListItem>
                    <ListItemText
                      primary="Selected Features"
                      secondary={modelInfo.selected_features?.length || 0}
                    />
                  </ListItem>
                </List>
              ) : (
                <Alert severity="info">
                  Model information will appear here after training.
                </Alert>
              )}
            </CardContent>
          </Card>

        {/* Upload Panel */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <UploadIcon sx={{ mr: 1 }} />
                Upload Dataset
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload your own dataset in CSV format for training and testing the intrusion detection models.
              </Typography>

              <Box sx={{ textAlign: 'center' }}>
                <input
                  accept=".csv"
                  style={{ display: 'none' }}
                  id="dataset-upload"
                  type="file"
                  onChange={handleFileSelect}
                />
                <label htmlFor="dataset-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<UploadIcon />}
                    size="large"
                    disabled={loading}
                  >
                    Select CSV File
                  </Button>
                </label>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Supported Formats:
                </Typography>
                <Chip label="NSL-KDD" size="small" sx={{ mr: 1, mb: 1 }} />
                <Chip label="UNR-IDD" size="small" sx={{ mr: 1, mb: 1 }} />
                <Chip label="Custom CSV" size="small" sx={{ mb: 1 }} />
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>CSV Requirements:</strong>
                  <br />• Include column headers
                  <br />• Target column (e.g., 'class')
                  <br />• No missing values preferred
                  <br />• Categorical features will be auto-encoded
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Datasets List */}
        <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
                <Typography variant="h6">
                Available Datasets
              </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    loadAvailableDatasets();
                    loadAllDatasets();
                  }}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Box>
              
              {loading && <LinearProgress sx={{ mb: 2, flexShrink: 0 }} />}
              
              <TableContainer 
                component={Paper} 
                variant="outlined"
                sx={{ 
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 180 }}>Dataset Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Size</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 110 }}>Features</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 130 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 380 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {datasets.length > 0 ? (
                      datasets.map((dataset, index) => (
                      <TableRow key={index}>
                          <TableCell sx={{ maxWidth: 200 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <StorageIcon sx={{ mr: 1, color: 'primary.main', fontSize: 20, flexShrink: 0 }} />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography 
                                  variant="body2" 
                                  fontWeight="medium" 
                                  sx={{ 
                                    mb: 0.5,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                              {dataset.name}
                            </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                  {currentDataset === dataset.name && (
                                    <Chip 
                                      label="Active" 
                                      color="success" 
                                      size="small" 
                                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'medium' }}
                                    />
                                  )}
                                  {hasDatasetBeenTrained(dataset.name) && (
                                    <Chip 
                                      label="Trained" 
                                      color="info" 
                                      size="small" 
                                      icon={<AssessmentIcon sx={{ fontSize: 14 }} />}
                                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'medium' }}
                                    />
                                  )}
                                </Box>
                              </Box>
                          </Box>
                        </TableCell>
                          <TableCell sx={{ maxWidth: 200 }}>
                            <Typography 
                              variant="body2" 
                              color="text.secondary" 
                              sx={{ 
                                lineHeight: 1.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                              }}
                            >
                              {dataset.description || `${dataset.type} dataset`}
                            </Typography>
                        </TableCell>
                        <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {dataset.size_mb ? `${dataset.size_mb} MB` : 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {dataset.rows?.toLocaleString()} rows
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Chip
                              label={`${dataset.columns} features`}
                              variant="outlined"
                              size="small"
                              sx={{ 
                                fontWeight: 'medium',
                                maxWidth: '100%',
                                '& .MuiChip-label': {
                                  overflow: 'visible',
                                  whiteSpace: 'nowrap'
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Chip
                              label={dataset.available ? 'Available' : 'Not Available'}
                              color={dataset.available ? 'success' : 'default'}
                              size="small"
                              sx={{ 
                                fontWeight: 'medium',
                                maxWidth: '100%',
                                '& .MuiChip-label': {
                                  overflow: 'visible',
                                  whiteSpace: 'nowrap'
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 380 }}>
                            <Box>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: trainingDataset === dataset.name ? 1 : 0 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => viewDatasetInfo(dataset.name)}
                                  title="View Info"
                                  disabled={trainingDataset !== null}
                                >
                                  <InfoIcon />
                                </IconButton>
                                
                                <Button
                                  size="small"
                                  variant={currentDataset === dataset.name ? "contained" : "outlined"}
                                  color={currentDataset === dataset.name ? "success" : "primary"}
                                  onClick={() => useDataset(dataset.name)}
                                  disabled={loading || trainingDataset !== null}
                                  sx={{ minWidth: 70 }}
                                >
                                  {currentDataset === dataset.name ? 'Using' : 'Use'}
                                </Button>
                                
                                <Button
                                  size="small"
                                  variant="contained"
                                  color={trainingDataset === dataset.name ? "warning" : "secondary"}
                                  onClick={() => trainModel(dataset.name, dataset.file_name)}
                                  disabled={loading || !dataset.available || trainingDataset !== null}
                                  sx={{ minWidth: 130 }}
                                  startIcon={
                                    trainingDataset === dataset.name ? (
                                      <CircularProgress size={14} color="inherit" />
                                    ) : (
                                      <AssessmentIcon />
                                    )
                                  }
                                >
                                  {trainingDataset === dataset.name ? 'Training...' : 'Train Model'}
                                </Button>
                                
                              </Box>
                              {trainingDataset === dataset.name && (
                                <Box>
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={trainingProgress} 
                                    sx={{ height: 8, borderRadius: 4, backgroundColor: 'grey.800' }}
                                  />
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }}>
                                    Training in progress... {Math.round(trainingProgress)}%
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      availableDatasets.map((dataset, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <StorageIcon sx={{ mr: 1, color: 'text.secondary', flexShrink: 0 }} />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography 
                                variant="body2" 
                                fontWeight="medium"
                                sx={{
                                  mb: 0.5,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {dataset.name}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                {hasDatasetBeenTrained(dataset.name) && (
                                  <Chip 
                                    label="Trained" 
                                    color="info" 
                                    size="small" 
                                    icon={<AssessmentIcon sx={{ fontSize: 14 }} />}
                                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'medium' }}
                                  />
                                )}
                              </Box>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}
                          >
                            {dataset.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {dataset.size}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Chip
                            label={dataset.features || 'N/A'}
                            variant="outlined"
                            size="small"
                            sx={{ 
                              fontWeight: 'medium',
                              '& .MuiChip-label': {
                                overflow: 'visible',
                                whiteSpace: 'nowrap'
                              }
                            }}
                          />
                        </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Chip
                            label={dataset.available ? 'Available' : 'Not Available'}
                            color={dataset.available ? 'success' : 'default'}
                            size="small"
                                sx={{ 
                                  fontWeight: 'medium',
                                  maxWidth: '100%',
                                  '& .MuiChip-label': {
                                    overflow: 'visible',
                                    whiteSpace: 'nowrap'
                                  }
                                }}
                              />
                              {hasDatasetBeenTrained(dataset.name) && (() => {
                                const trainingInfo = getDatasetTrainingInfo(dataset.name);
                                return (
                                  <Chip
                                    label={`Trained: ${trainingInfo ? new Date(trainingInfo.timestamp).toLocaleDateString() : ''}`}
                                    color="info"
                                    variant="outlined"
                                    size="small"
                                    sx={{ 
                                      fontSize: '0.65rem',
                                      height: 18,
                                      '& .MuiChip-label': {
                                        overflow: 'visible',
                                        whiteSpace: 'nowrap'
                                      }
                                    }}
                                  />
                                );
                              })()}
                            </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => viewDatasetInfo(dataset.name)}
                              title="View Info"
                            >
                              <InfoIcon />
                            </IconButton>
                            
                            {dataset.available && (
                              <>
                                  <Button
                                    size="small"
                                    variant={trainingDataset === dataset.name ? "contained" : "contained"}
                                    color={trainingDataset === dataset.name ? "warning" : "secondary"}
                                    onClick={() => trainModel(dataset.name, dataset.name)}
                                    disabled={loading || trainingDataset !== null}
                                    sx={{ minWidth: 120 }}
                                    startIcon={
                                      trainingDataset === dataset.name ? (
                                        <CircularProgress size={14} color="inherit" />
                                      ) : (
                                        <AssessmentIcon />
                                      )
                                    }
                                  >
                                    {trainingDataset === dataset.name ? 'Training...' : 'Train Model'}
                                  </Button>
                                  
                                  {trainingDataset === dataset.name && (
                                    <Box sx={{ width: '100%', mt: 1 }}>
                                      <LinearProgress 
                                        variant="determinate" 
                                        value={trainingProgress} 
                                        sx={{ height: 6, borderRadius: 3 }}
                                      />
                                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                        {Math.round(trainingProgress)}% complete
                                      </Typography>
                                    </Box>
                                  )}
                                  
                                <IconButton
                                  size="small"
                                  onClick={() => onShowNotification('Download feature coming soon', 'info')}
                                  title="Download"
                                    disabled={trainingDataset !== null}
                                >
                                  <DownloadIcon />
                                </IconButton>
                                
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      ))
                    )}
                    
                    {datasets.length === 0 && availableDatasets.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                          <Typography color="text.secondary">
                            No datasets available. Upload a dataset or check the datasets folder.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                    {datasets.length || availableDatasets.length} dataset(s) found
                </Typography>
                  {currentDataset && (
                    <Chip 
                      label={`Active: ${currentDataset}`} 
                      color="success" 
                  size="small"
                    />
                  )}
                  {trainingDataset && (
                    <Chip 
                      label={`Training: ${trainingDataset}`} 
                      color="warning" 
                  size="small"
                      icon={<CircularProgress size={12} />}
                    />
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Dataset</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Selected File: <strong>{selectedFile?.name}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Size: {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
            </Typography>
          </Box>
          
          <TextField
            fullWidth
            label="Dataset Name"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            margin="normal"
            helperText="Enter a descriptive name for this dataset"
          />
          
          <Alert severity="info" sx={{ mt: 2 }}>
            The dataset will be processed and validated after upload. Make sure it contains a target column for classification.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={uploadDataset} 
            variant="contained"
            disabled={loading || !datasetName.trim()}
          >
            {loading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dataset Info Dialog */}
      <Dialog open={infoDialogOpen} onClose={() => setInfoDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Dataset Information</DialogTitle>
        <DialogContent>
          {selectedDatasetInfo ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Dataset Name:</Typography>
                  <Typography variant="body2">{selectedDatasetInfo.name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Shape:</Typography>
                  <Typography variant="body2">
                    {selectedDatasetInfo.shape ? 
                      `${selectedDatasetInfo.shape[0]} rows × ${selectedDatasetInfo.shape[1]} columns` 
                      : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>

              {selectedDatasetInfo.class_distribution && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>Class Distribution:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(selectedDatasetInfo.class_distribution).map(([className, count]) => (
                      <Chip
                        key={className}
                        label={`${className}: ${count}`}
                        variant="outlined"
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {selectedDatasetInfo.columns && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Columns ({selectedDatasetInfo.columns.length}):</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 200, overflow: 'auto' }}>
                    {selectedDatasetInfo.columns.map((column, index) => (
                      <Chip
                        key={index}
                        label={column}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            <Typography>Loading dataset information...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DatasetManagement;