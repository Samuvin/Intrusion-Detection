/**
 * API service for communication with NIDS backend.
 */

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

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

  // Health check
  async checkHealth() {
    return this.get('/health');
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
    return this.get('/monitoring/status');
  }

  async simulateAttack(attackType = 'DoS') {
    return this.post('/monitoring/simulate-attack', {}, {
      params: { attack_type: attackType }
    });
  }

  // WebSocket connection for real-time monitoring
  createWebSocketConnection(onMessage, onError, onClose) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/monitoring/live`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) onError(error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (onClose) onClose();
      };
      
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

  // WebSocket connection for real-time monitoring
  createWebSocketConnection(onMessage, onError, onClose) {
    try {
      const ws = new WebSocket('ws://localhost:8000/ws/monitoring');
      
      ws.onopen = () => {
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) onError(error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (onClose) onClose();
      };
      
      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      if (onError) onError(error);
      return null;
    }
  }

  // Simulate attack for testing
  async simulateAttack(attackType) {
    return this.request('/api/v1/monitoring/simulate-attack', {
      method: 'POST',
      body: JSON.stringify({ attack_type: attackType })
    });
  }

  // Load pre-trained model
  async loadModel() {
    return this.request('/api/v1/models/load', {
      method: 'POST'
    });
  }

  // Upload dataset
  async uploadDataset(file, name) {
    const formData = new FormData();
    formData.append('dataset', file);
    formData.append('name', name);
    
    return this.request('/api/v1/datasets/upload', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header, let the browser set it with boundary
      headers: {}
    });
  }

  // Delete dataset
  async deleteDataset(name) {
    return this.request(`/api/v1/datasets/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
  }

  // Get dataset info
  async getDatasetInfo(name) {
    return this.request(`/api/v1/datasets/${encodeURIComponent(name)}/info`);
  }

  // Get system health
  async getSystemHealth() {
    return this.request('/api/v1/monitoring/health');
  }
}

// Create and export singleton instance
const apiServiceInstance = new ApiService();
export { apiServiceInstance as ApiService };
export default apiServiceInstance;
