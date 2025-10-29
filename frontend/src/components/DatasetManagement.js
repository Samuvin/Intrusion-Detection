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
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';

import MetricCard from './common/MetricCard';
import { ApiService } from '../services/ApiService';

const DatasetManagement = ({ onShowNotification }) => {
  const [datasets, setDatasets] = useState([]);
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [selectedDatasetInfo, setSelectedDatasetInfo] = useState(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  useEffect(() => {
    loadAvailableDatasets();
  }, []);

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
      }
    } catch (error) {
      console.error('Upload failed:', error);
      onShowNotification(`Upload failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteDataset = async (datasetName) => {
    if (!window.confirm(`Are you sure you want to delete dataset "${datasetName}"?`)) {
      return;
    }

    try {
      const response = await ApiService.deleteDataset(datasetName);
      if (response.status === 'success') {
        onShowNotification(`Dataset "${datasetName}" deleted successfully`, 'success');
        await loadAvailableDatasets();
      }
    } catch (error) {
      console.error('Delete failed:', error);
      onShowNotification(`Delete failed: ${error.message}`, 'error');
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
    const totalDatasets = availableDatasets.length;
    const availableCount = availableDatasets.filter(d => d.available).length;
    const totalSize = availableDatasets.reduce((sum, d) => {
      const match = d.size?.match(/(\d+),?(\d*)/);
      return sum + (match ? parseInt(match[1].replace(',', '') + (match[2] || '')) : 0);
    }, 0);

    return { totalDatasets, availableCount, totalSize };
  };

  const stats = getDatasetStats();

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
        Dataset Management
      </Typography>

      {/* Dataset Statistics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
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
            title="Ready to Use"
            value={stats.availableCount}
            icon={<AssessmentIcon />}
            color="success"
            subtitle="Datasets ready for training"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Records"
            value={stats.totalSize.toLocaleString()}
            icon={<InfoIcon />}
            color="info"
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

      <Grid container spacing={3}>
        {/* Upload Panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
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
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Datasets
              </Typography>
              
              {loading && <LinearProgress sx={{ mb: 2 }} />}
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Dataset Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Features</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableDatasets.map((dataset, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <StorageIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" fontWeight="medium">
                              {dataset.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {dataset.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {dataset.size}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {dataset.features}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={dataset.available ? 'Available' : 'Not Available'}
                            color={dataset.available ? 'success' : 'default'}
                            size="small"
                          />
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
                                <IconButton
                                  size="small"
                                  onClick={() => onShowNotification('Download feature coming soon', 'info')}
                                  title="Download"
                                >
                                  <DownloadIcon />
                                </IconButton>
                                
                                <IconButton
                                  size="small"
                                  onClick={() => deleteDataset(dataset.name)}
                                  title="Delete"
                                  color="error"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {availableDatasets.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                          <Typography color="text.secondary">
                            No datasets available. Upload a dataset to get started.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {availableDatasets.length} dataset(s) found
                </Typography>
                
                <Button
                  variant="outlined"
                  size="small"
                  onClick={loadAvailableDatasets}
                  disabled={loading}
                >
                  Refresh
                </Button>
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