/**
 * API service for communication with NIDS backend.
 */

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (error) => {
        console.error('API Response Error:', error);
        
        if (error.response?.status === 401) {
          // Handle unauthorized access
          console.warn('Unauthorized access detected');
        } else if (error.response?.status >= 500) {
          // Handle server errors
          console.error('Server error detected');
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Generic HTTP methods
  async get(url, config = {}) {
    return this.client.get(url, config);
  }

  async post(url, data = {}, config = {}) {
    return this.client.post(url, data, config);
  }

  async put(url, data = {}, config = {}) {
    return this.client.put(url, data, config);
  }

  async delete(url, config = {}) {
    return this.client.delete(url, config);
  }

  // File upload method
  async uploadFile(url, file, additionalData = {}, onUploadProgress = null) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add additional form data
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };

    if (onUploadProgress) {
      config.onUploadProgress = onUploadProgress;
    }

    return this.client.post(url, formData, config);
  }

  // Health check - endpoint is at root level, not under /api/v1
  async checkHealth() {
    try {
      const response = await fetch('http://localhost:8000/health');
      if (response.ok) {
        return await response.json();
      }
      throw new Error(`Health check failed: ${response.status}`);
    } catch (error) {
      console.debug('Health check error:', error);
      return { status: 'error', message: error.message };
    }
  }

  // Model Management APIs
  async getModelInfo() {
    return this.get('/models/info');
  }

  async trainModel(dataset, targetColumn = 'class', optimizeHyperparameters = true, onUploadProgress = null) {
    return this.uploadFile(
      '/models/train',
      dataset,
      {
        target_column: targetColumn,
        optimize_hyperparameters: optimizeHyperparameters,
      },
      onUploadProgress
    );
  }

  async predictWithModel(dataset, onUploadProgress = null) {
    return this.uploadFile('/models/predict', dataset, {}, onUploadProgress);
  }

  async loadModel(modelPath = null) {
    return this.post('/models/load', { model_path: modelPath });
  }

  // Dataset Management APIs
  async getAvailableDatasets() {
    return this.get('/datasets/available');
  }

  async uploadDataset(file, name, onUploadProgress = null) {
    return this.uploadFile('/datasets/upload', file, { name }, onUploadProgress);
  }

  async getDatasetInfo(datasetName) {
    return this.get(`/datasets/info/${datasetName}`);
  }

  async deleteDataset(datasetName) {
    return this.delete(`/datasets/${datasetName}`);
  }

  // Monitoring APIs
  async getMonitoringStatus() {
    // Use full URL for monitoring status
    const response = await fetch('http://localhost:8000/api/v1/monitoring/status');
    if (response.ok) {
      return await response.json();
    }
    throw new Error(`Monitoring status failed: ${response.status}`);
  }

  async simulateAttack(attackType = 'DoS') {
    // Use full URL for simulate attack
    const response = await fetch(`http://localhost:8000/api/v1/monitoring/simulate-attack?attack_type=${encodeURIComponent(attackType)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      return await response.json();
    }
    const errorText = await response.text();
    throw new Error(`Attack simulation failed: ${response.status} - ${errorText}`);
  }

  // WebSocket connection for real-time monitoring
  createWebSocketConnection(onMessage, onError, onClose) {
    // Use explicit backend URL for WebSocket
    const wsUrl = 'ws://localhost:8000/api/v1/monitoring/live';
    
    try {
      const ws = new WebSocket(wsUrl);
      
      // Only set basic handlers, let component override for state management
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) onError(error);
      };
      
      // onopen and onclose will be set by the component for state management
      
      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      if (onError) onError(error);
      return null;
    }
  }

  // Performance Analytics APIs
  async getSystemMetrics() {
    return this.get('/analytics/metrics');
  }

  async getPerformanceHistory(timeRange = '24h') {
    return this.get('/analytics/performance', {
      params: { time_range: timeRange }
    });
  }

  async getAttackStatistics(timeRange = '7d') {
    return this.get('/analytics/attacks', {
      params: { time_range: timeRange }
    });
  }

  async exportResults(format = 'csv') {
    return this.get('/analytics/export', {
      params: { format },
      responseType: 'blob'
    });
  }
}

// Create and export singleton instance
const apiServiceInstance = new ApiService();
export { apiServiceInstance as ApiService };
export default apiServiceInstance;
