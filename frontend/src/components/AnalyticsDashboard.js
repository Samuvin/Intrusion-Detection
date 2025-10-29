/**
 * Advanced Analytics Dashboard with comprehensive analysis features
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Button,
  IconButton,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  Timeline as TimelineIcon,
  Map as MapIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { ApiService } from '../services/ApiService';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const AnalyticsDashboard = ({ onShowNotification }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedAttackType, setSelectedAttackType] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedDestination, setSelectedDestination] = useState('all');
  const [drillDownData, setDrillDownData] = useState(null);
  const [drillDownType, setDrillDownType] = useState(null);
  const [analyticsData, setAnalyticsData] = useState({
    timeline: [],
    threatTrends: [],
    topSources: [],
    topDestinations: [],
    protocolDistribution: [],
    attackPatterns: [],
    performanceMetrics: [],
    geographicData: [],
    errorAnalysis: [],
    allLogs: [],
    cloudServices: [],
  });
  const [realTimeStats, setRealTimeStats] = useState({
    totalLogs: 0,
    threatsDetected: 0,
    attackRate: 0,
    avgResponseTime: 0,
    errorRate: 0,
  });

  useEffect(() => {
    loadAnalyticsData();
    const interval = setInterval(loadAnalyticsData, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, [timeRange, selectedAttackType, selectedSource, selectedDestination]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch log statistics
      const [statsResponse, logsResponse, serverStatsResponse, destinationStatsResponse] = await Promise.allSettled([
        fetch('http://localhost:8000/api/v1/log-analysis/logs/statistics'),
        fetch('http://localhost:8000/api/v1/log-analysis/logs/all?limit=1000'),
        fetch('http://localhost:8000/api/v1/log-analysis/logs/statistics/by-source'),
        fetch('http://localhost:8000/api/v1/log-analysis/logs/statistics/by-destination'),
      ]);

      let stats = {};
      let logs = [];
      let serverStats = {};
      let destinationStats = {};

      if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
        const data = await statsResponse.value.json();
        stats = data.statistics || data;
      }

      if (logsResponse.status === 'fulfilled' && logsResponse.value.ok) {
        const data = await logsResponse.value.json();
        logs = data.logs || [];
        // Store all logs for filtering and drill-down
        setAnalyticsData(prev => ({ ...prev, allLogs: logs }));
      }

      if (serverStatsResponse.status === 'fulfilled' && serverStatsResponse.value.ok) {
        const data = await serverStatsResponse.value.json();
        serverStats = data.statistics || {};
      }

      if (destinationStatsResponse.status === 'fulfilled' && destinationStatsResponse.value.ok) {
        const data = await destinationStatsResponse.value.json();
        destinationStats = data.statistics || {};
      }

      // Apply filters before processing
      let filteredLogs = logs;
      if (selectedAttackType !== 'all') {
        filteredLogs = filteredLogs.filter(log => {
          const attackType = log.parsed_fields?.attack_type || 'Normal';
          return attackType.toLowerCase() === selectedAttackType.toLowerCase();
        });
      }
      if (selectedSource !== 'all') {
        filteredLogs = filteredLogs.filter(log => {
          const source = log.source_name || log.source_ip || 'Unknown';
          return source === selectedSource;
        });
      }
      if (selectedDestination !== 'all') {
        filteredLogs = filteredLogs.filter(log => {
          const dest = log.destination || log.hostname || log.server || 'Unknown';
          return dest === selectedDestination;
        });
      }
      
      // Process analytics data with filtered logs
      processAnalyticsData(filteredLogs, stats, serverStats, destinationStats);
      
      setRealTimeStats({
        totalLogs: stats.total_entries || 0,
        threatsDetected: stats.attacks_blocked_today || 0,
        attackRate: (stats.attacks_blocked_today || 0) / Math.max(stats.total_entries || 1, 1) * 100,
        avgResponseTime: stats.avg_response_time_ms || 0,
        errorRate: stats.error_rate || 0,
      });
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      onShowNotification('Failed to load analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (logs, stats, serverStats, destinationStats) => {
    // Timeline data (last 24 hours by hour)
    const timeline = generateTimelineData(logs);
    
    // Threat trends
    const threatTrends = generateThreatTrends(logs);
    
    // Top sources
    const topSources = generateTopSources(logs, serverStats);
    
    // Top destinations
    const topDestinations = generateTopDestinations(logs, destinationStats);
    
    // Protocol distribution
    const protocolDistribution = generateProtocolDistribution(logs);
    
    // Attack patterns
    const attackPatterns = generateAttackPatterns(logs);
    
    // Performance metrics
    const performanceMetrics = generatePerformanceMetrics(logs);
    
    // Geographic data (simulated for demo)
    const geographicData = generateGeographicData(logs);
    
    // Error analysis
    const errorAnalysis = generateErrorAnalysis(logs);
    
    // Cloud services analysis
    const cloudServices = generateCloudServicesData(logs);

    setAnalyticsData({
      timeline,
      threatTrends,
      topSources,
      topDestinations,
      protocolDistribution,
      attackPatterns,
      performanceMetrics,
      geographicData,
      errorAnalysis,
      cloudServices,
    });
  };

  const generateTimelineData = (logs) => {
    const hours = 24;
    const now = Date.now();
    const data = [];
    
    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = now - (i + 1) * 3600000;
      const hourEnd = now - i * 3600000;
      
      const hourLogs = logs.filter(log => {
        const logTime = new Date(log.timestamp || log.created_at || 0).getTime();
        return logTime >= hourStart && logTime < hourEnd;
      });
      
      const attacks = hourLogs.filter(log => {
        const attackType = log.parsed_fields?.attack_type || 
                          (log.status_code >= 400 ? 'Suspicious' : null);
        return attackType && attackType !== 'Normal';
      }).length;
      
      data.push({
        time: new Date(hourStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        requests: hourLogs.length,
        attacks,
        errors: hourLogs.filter(log => log.status_code >= 400).length,
        avgResponseTime: hourLogs.length > 0
          ? hourLogs.reduce((sum, log) => sum + (log.response_time_ms || log.duration || 0), 0) / hourLogs.length
          : 0,
      });
    }
    
    return data;
  };

  const generateThreatTrends = (logs) => {
    const attackTypes = {};
    
    logs.forEach(log => {
      const attackType = log.parsed_fields?.attack_type || 
                        (log.status_code >= 400 ? 'Suspicious' : 'Normal');
      attackTypes[attackType] = (attackTypes[attackType] || 0) + 1;
    });
    
    return Object.entries(attackTypes).map(([name, value]) => ({
      name,
      value,
      percentage: logs.length > 0 ? (value / logs.length) * 100 : 0,
    }));
  };

  const generateTopSources = (logs, serverStats) => {
    const sourceMap = {};
    
    logs.forEach(log => {
      const source = log.source_name || log.source_ip || 'Unknown';
      if (!sourceMap[source]) {
        sourceMap[source] = {
          source,
          requests: 0,
          attacks: 0,
          errors: 0,
          avgResponseTime: 0,
          responseTimes: [],
        };
      }
      sourceMap[source].requests++;
      if (log.status_code >= 400) sourceMap[source].errors++;
      if (log.parsed_fields?.attack_type && log.parsed_fields.attack_type !== 'Normal') {
        sourceMap[source].attacks++;
      }
      if (log.response_time_ms || log.duration) {
        sourceMap[source].responseTimes.push(log.response_time_ms || log.duration);
      }
    });
    
    return Object.values(sourceMap)
      .map(item => ({
        ...item,
        avgResponseTime: item.responseTimes.length > 0
          ? item.responseTimes.reduce((a, b) => a + b, 0) / item.responseTimes.length
          : 0,
        attackRate: item.requests > 0 ? (item.attacks / item.requests) * 100 : 0,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  };

  const generateTopDestinations = (logs, destinationStats) => {
    const destMap = {};
    
    logs.forEach(log => {
      const dest = log.destination || log.hostname || log.server || 'Unknown';
      if (!destMap[dest]) {
        destMap[dest] = {
          destination: dest,
          requests: 0,
          attacks: 0,
          errors: 0,
          totalBytes: 0,
          avgResponseTime: 0,
          responseTimes: [],
        };
      }
      destMap[dest].requests++;
      if (log.status_code >= 400) destMap[dest].errors++;
      if (log.parsed_fields?.attack_type && log.parsed_fields.attack_type !== 'Normal') {
        destMap[dest].attacks++;
      }
      if (log.bytes_total || log.bytes_sent) {
        destMap[dest].totalBytes += (log.bytes_total || log.bytes_sent || 0);
      }
      if (log.response_time_ms || log.duration) {
        destMap[dest].responseTimes.push(log.response_time_ms || log.duration);
      }
    });
    
    return Object.values(destMap)
      .map(item => ({
        ...item,
        avgResponseTime: item.responseTimes.length > 0
          ? item.responseTimes.reduce((a, b) => a + b, 0) / item.responseTimes.length
          : 0,
        attackRate: item.requests > 0 ? (item.attacks / item.requests) * 100 : 0,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  };

  const generateProtocolDistribution = (logs) => {
    const protocols = {};
    
    logs.forEach(log => {
      const protocol = log.protocol || log.scheme?.toUpperCase() || 'HTTP';
      protocols[protocol] = (protocols[protocol] || 0) + 1;
    });
    
    return Object.entries(protocols).map(([name, value]) => ({
      name,
      value,
      percentage: logs.length > 0 ? (value / logs.length) * 100 : 0,
    }));
  };

  const generateAttackPatterns = (logs) => {
    const patterns = {};
    
    logs.forEach(log => {
      const attackType = log.parsed_fields?.attack_type;
      if (attackType && attackType !== 'Normal') {
        const method = log.method || 'GET';
        const pattern = `${attackType}-${method}`;
        patterns[pattern] = (patterns[pattern] || 0) + 1;
      }
    });
    
    return Object.entries(patterns)
      .map(([name, value]) => {
        const [attackType, method] = name.split('-');
        return { attackType, method, count: value };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  const generatePerformanceMetrics = (logs) => {
    const metrics = logs.map(log => ({
      timestamp: log.timestamp || log.created_at,
      responseTime: log.response_time_ms || log.duration || 0,
      statusCode: log.status_code || 200,
      bytesTransferred: log.bytes_total || log.bytes_sent || 0,
    })).filter(m => m.responseTime > 0).slice(-50);
    
    return metrics;
  };

  const generateGeographicData = (logs) => {
    // Simulated geographic data based on IPs
    const countries = {};
    logs.forEach(log => {
      const country = log.geo_country || 'Unknown';
      countries[country] = (countries[country] || 0) + 1;
    });
    
    return Object.entries(countries)
      .map(([country, requests]) => ({ country, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 15);
  };

  const generateErrorAnalysis = (logs) => {
    const errors = {};
    
    logs.filter(log => log.status_code >= 400).forEach(log => {
      const code = log.status_code || 500;
      const category = code >= 500 ? '5xx' : code >= 400 ? '4xx' : 'Other';
      errors[category] = (errors[category] || 0) + 1;
      errors[code] = (errors[code] || 0) + 1;
    });
    
    return Object.entries(errors)
      .filter(([key]) => !isNaN(parseInt(key)))
      .map(([code, count]) => ({ code: parseInt(code), count }))
      .sort((a, b) => b.count - a.count);
  };

  const generateCloudServicesData = (logs) => {
    const cloudServicesMap = {};
    
    logs.forEach(log => {
      const hostname = log.hostname || log.destination || log.server || 'unknown';
      const url = log.target_url || '';
      
      // Identify cloud service based on hostname patterns
      let service = 'Other';
      let serviceType = 'Unknown';
      
      // AWS Services
      if (hostname.includes('amazonaws.com') || hostname.includes('.s3.') || hostname.includes('s3.amazonaws.com')) {
        service = 'AWS S3';
        serviceType = 'Storage';
      } else if (hostname.includes('cloudfront.net')) {
        service = 'AWS CloudFront';
        serviceType = 'CDN';
      } else if (hostname.includes('execute-api') || hostname.includes('apigateway')) {
        service = 'AWS API Gateway';
        serviceType = 'API';
      } else if (hostname.includes('amazonaws.com')) {
        service = 'AWS (Other)';
        serviceType = 'Cloud';
      }
      // Azure Services
      else if (hostname.includes('azure.com') || hostname.includes('azurewebsites.net') || hostname.includes('.blob.core.windows.net')) {
        service = 'Azure';
        serviceType = hostname.includes('.blob.') ? 'Storage' : 'Cloud';
      }
      // Google Cloud Platform
      else if (hostname.includes('googleapis.com') || hostname.includes('gcp') || hostname.includes('googlecloud.com')) {
        service = 'Google Cloud';
        serviceType = 'Cloud';
      } else if (hostname.includes('storage.googleapis.com')) {
        service = 'GCP Storage';
        serviceType = 'Storage';
      }
      // Cloudflare
      else if (hostname.includes('cloudflare.com') || hostname.includes('cloudflare.net') || hostname.includes('cf-')) {
        service = 'Cloudflare';
        serviceType = 'CDN';
      }
      // Fastly
      else if (hostname.includes('fastly.com') || hostname.includes('fastly.net')) {
        service = 'Fastly';
        serviceType = 'CDN';
      }
      // GitHub
      else if (hostname.includes('github.com') || hostname.includes('githubusercontent.com')) {
        service = 'GitHub';
        serviceType = 'Platform';
      }
      // GitLab
      else if (hostname.includes('gitlab.com')) {
        service = 'GitLab';
        serviceType = 'Platform';
      }
      // Vercel
      else if (hostname.includes('vercel.app') || hostname.includes('vercel.com')) {
        service = 'Vercel';
        serviceType = 'Hosting';
      }
      // Netlify
      else if (hostname.includes('netlify.app') || hostname.includes('netlify.com')) {
        service = 'Netlify';
        serviceType = 'Hosting';
      }
      // DigitalOcean
      else if (hostname.includes('digitalocean.com') || hostname.includes('digitaloceanspaces.com')) {
        service = 'DigitalOcean';
        serviceType = 'Cloud';
      }
      // Heroku
      else if (hostname.includes('herokuapp.com') || hostname.includes('heroku.com')) {
        service = 'Heroku';
        serviceType = 'Platform';
      }
      
      if (!cloudServicesMap[service]) {
        cloudServicesMap[service] = {
          service,
          serviceType,
          requests: 0,
          attacks: 0,
          errors: 0,
          totalBytes: 0,
          avgResponseTime: 0,
          responseTimes: [],
          uniqueHosts: new Set(),
        };
      }
      
      cloudServicesMap[service].requests++;
      cloudServicesMap[service].uniqueHosts.add(hostname);
      
      if (log.status_code >= 400) {
        cloudServicesMap[service].errors++;
      }
      
      if (log.parsed_fields?.attack_type && log.parsed_fields.attack_type !== 'Normal') {
        cloudServicesMap[service].attacks++;
      }
      
      if (log.bytes_total || log.bytes_sent) {
        cloudServicesMap[service].totalBytes += (log.bytes_total || log.bytes_sent || 0);
      }
      
      if (log.response_time_ms || log.duration) {
        cloudServicesMap[service].responseTimes.push(log.response_time_ms || log.duration);
      }
    });
    
    return Object.values(cloudServicesMap)
      .map(item => ({
        ...item,
        uniqueHosts: item.uniqueHosts.size,
        avgResponseTime: item.responseTimes.length > 0
          ? item.responseTimes.reduce((a, b) => a + b, 0) / item.responseTimes.length
          : 0,
        attackRate: item.requests > 0 ? (item.attacks / item.requests) * 100 : 0,
        errorRate: item.requests > 0 ? (item.errors / item.requests) * 100 : 0,
      }))
      .sort((a, b) => b.requests - a.requests);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
            Advanced Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Comprehensive network security analysis and threat intelligence
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} label="Time Range">
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Attack Type</InputLabel>
            <Select value={selectedAttackType} onChange={(e) => setSelectedAttackType(e.target.value)} label="Attack Type">
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="dos">DoS</MenuItem>
              <MenuItem value="probe">Probe</MenuItem>
              <MenuItem value="u2r">U2R</MenuItem>
              <MenuItem value="r2l">R2L</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Source</InputLabel>
            <Select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} label="Source">
              <MenuItem value="all">All Sources</MenuItem>
              {analyticsData.topSources.slice(0, 10).map((source, idx) => (
                <MenuItem key={idx} value={source.source}>{source.source}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Refresh Data">
            <IconButton onClick={loadAnalyticsData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Report">
            <IconButton color="primary">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          {drillDownData && (
            <Button 
              variant="outlined" 
              onClick={() => {
                setDrillDownData(null);
                setDrillDownType(null);
              }}
              startIcon={<FilterIcon />}
            >
              Clear Filter
            </Button>
          )}
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ opacity: 0.9 }}>
                Total Logs
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {realTimeStats.totalLogs.toLocaleString()}
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon fontSize="small" />
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Real-time analysis
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'error.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ opacity: 0.9 }}>
                Threats Detected
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {realTimeStats.threatsDetected}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {realTimeStats.attackRate.toFixed(2)}% attack rate
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ opacity: 0.9 }}>
                Error Rate
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {realTimeStats.errorRate.toFixed(2)}%
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Failed requests
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'success.main', color: 'white', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ opacity: 0.9 }}>
                Avg Response
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {Math.round(realTimeStats.avgResponseTime)}ms
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Performance metric
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Analytics Tabs */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab icon={<TimelineIcon />} iconPosition="start" label="Timeline Analysis" />
            <Tab icon={<SecurityIcon />} iconPosition="start" label="Threat Intelligence" />
            <Tab icon={<ShowChartIcon />} iconPosition="start" label="Performance" />
            <Tab icon={<BarChartIcon />} iconPosition="start" label="Traffic Analysis" />
            <Tab icon={<MapIcon />} iconPosition="start" label="Geographic" />
            <Tab icon={<CloudIcon />} iconPosition="start" label="Cloud Services" />
          </Tabs>
        </Box>

        <CardContent>
          {/* Timeline Analysis Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Network Activity Timeline (24 Hours)
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={analyticsData.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RechartsTooltip />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="requests" stackId="1" stroke="#8884d8" fill="#8884d8" name="Total Requests" />
                    <Area yAxisId="left" type="monotone" dataKey="attacks" stackId="2" stroke="#ff7300" fill="#ff7300" name="Attacks" />
                    <Area yAxisId="left" type="monotone" dataKey="errors" stackId="3" stroke="#ff0000" fill="#ff0000" name="Errors" />
                    <Line yAxisId="right" type="monotone" dataKey="avgResponseTime" stroke="#82ca9d" strokeWidth={3} name="Avg Response Time (ms)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          )}

          {/* Threat Intelligence Tab */}
          {activeTab === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Threat Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData.threatTrends}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      onClick={(data) => {
                        if (data && data.name && data.name !== 'Normal') {
                          setSelectedAttackType(data.name.toLowerCase());
                          setDrillDownData(data);
                          setDrillDownType('attack');
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {analyticsData.threatTrends.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Top Attack Patterns
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Attack Type</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analyticsData.attackPatterns.map((pattern, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Chip label={pattern.attackType} size="small" color="error" />
                          </TableCell>
                          <TableCell>{pattern.method}</TableCell>
                          <TableCell align="right">{pattern.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}

          {/* Performance Tab */}
          {activeTab === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Response Time Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.performanceMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="responseTime" stroke="#8884d8" name="Response Time (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Error Status Codes
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analyticsData.errorAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="code" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#f44336" />
                  </BarChart>
                </ResponsiveContainer>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Protocol Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analyticsData.protocolDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analyticsData.protocolDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          )}

          {/* Traffic Analysis Tab */}
          {activeTab === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Top Traffic Sources
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Source</TableCell>
                        <TableCell align="right">Requests</TableCell>
                        <TableCell align="right">Attacks</TableCell>
                        <TableCell align="right">Avg Response</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analyticsData.topSources.slice(0, 10).map((source, idx) => (
                        <TableRow 
                          key={idx} 
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedSource(source.source);
                            setDrillDownData(source);
                            setDrillDownType('source');
                          }}
                        >
                          <TableCell>{source.source}</TableCell>
                          <TableCell align="right">{source.requests}</TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={source.attacks} 
                              size="small" 
                              color={source.attacks > 0 ? "error" : "default"}
                            />
                          </TableCell>
                          <TableCell align="right">{Math.round(source.avgResponseTime)}ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Top Destinations
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Destination</TableCell>
                        <TableCell align="right">Requests</TableCell>
                        <TableCell align="right">Data Transfer</TableCell>
                        <TableCell align="right">Attack Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analyticsData.topDestinations.slice(0, 10).map((dest, idx) => (
                        <TableRow 
                          key={idx}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedDestination(dest.destination);
                            setDrillDownData(dest);
                            setDrillDownType('destination');
                          }}
                        >
                          <TableCell>{dest.destination}</TableCell>
                          <TableCell align="right">{dest.requests}</TableCell>
                          <TableCell align="right">{formatBytes(dest.totalBytes)}</TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={`${dest.attackRate.toFixed(1)}%`} 
                              size="small" 
                              color={dest.attackRate > 5 ? "error" : dest.attackRate > 0 ? "warning" : "success"}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}

          {/* Geographic Tab */}
          {activeTab === 4 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Geographic Distribution of Traffic
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analyticsData.geographicData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="country" type="category" width={150} />
                    <RechartsTooltip />
                    <Bar dataKey="requests" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          )}

          {/* Cloud Services Tab */}
          {activeTab === 5 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Cloud Services Traffic Analysis
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Traffic breakdown by cloud service provider and service type
                </Typography>
              </Grid>

              {/* Cloud Services Summary Cards */}
              <Grid item xs={12}>
                <Grid container spacing={2}>
                  {analyticsData.cloudServices.slice(0, 6).map((service, idx) => (
                    <Grid item xs={12} sm={6} md={4} key={idx}>
                      <Card sx={{ 
                        height: '100%',
                        borderLeft: `4px solid ${COLORS[idx % COLORS.length]}`,
                        '&:hover': {
                          boxShadow: 4,
                        }
                      }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                {service.service}
                              </Typography>
                              <Chip 
                                label={service.serviceType} 
                                size="small" 
                                color="primary" 
                                variant="outlined"
                                sx={{ mt: 0.5 }}
                              />
                            </Box>
                            <CloudIcon sx={{ fontSize: 32, opacity: 0.3 }} />
                          </Box>
                          <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary">Requests</Typography>
                              <Typography variant="h6">{service.requests}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary">Hosts</Typography>
                              <Typography variant="h6">{service.uniqueHosts}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary">Attacks</Typography>
                              <Typography variant="h6" color={service.attacks > 0 ? 'error.main' : 'text.primary'}>
                                {service.attacks}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary">Error Rate</Typography>
                              <Typography variant="h6" color={service.errorRate > 5 ? 'error.main' : 'text.primary'}>
                                {service.errorRate.toFixed(1)}%
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="body2" color="text.secondary">Data Transfer</Typography>
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                {formatBytes(service.totalBytes)}
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="body2" color="text.secondary">Avg Response Time</Typography>
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                {Math.round(service.avgResponseTime)}ms
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>

              {/* Cloud Services Table */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Detailed Cloud Services Statistics
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Cloud Service</strong></TableCell>
                        <TableCell><strong>Type</strong></TableCell>
                        <TableCell align="right"><strong>Requests</strong></TableCell>
                        <TableCell align="right"><strong>Unique Hosts</strong></TableCell>
                        <TableCell align="right"><strong>Attacks</strong></TableCell>
                        <TableCell align="right"><strong>Errors</strong></TableCell>
                        <TableCell align="right"><strong>Error Rate</strong></TableCell>
                        <TableCell align="right"><strong>Data Transfer</strong></TableCell>
                        <TableCell align="right"><strong>Avg Response</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analyticsData.cloudServices.map((service, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CloudIcon fontSize="small" />
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {service.service}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={service.serviceType} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell align="right">{service.requests.toLocaleString()}</TableCell>
                          <TableCell align="right">{service.uniqueHosts}</TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={service.attacks} 
                              size="small" 
                              color={service.attacks > 0 ? "error" : "default"}
                            />
                          </TableCell>
                          <TableCell align="right">{service.errors}</TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={`${service.errorRate.toFixed(1)}%`} 
                              size="small" 
                              color={service.errorRate > 5 ? "error" : service.errorRate > 0 ? "warning" : "success"}
                            />
                          </TableCell>
                          <TableCell align="right">{formatBytes(service.totalBytes)}</TableCell>
                          <TableCell align="right">{Math.round(service.avgResponseTime)}ms</TableCell>
                        </TableRow>
                      ))}
                      {analyticsData.cloudServices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              No cloud service traffic detected yet. Start making API calls to cloud services to see statistics here.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Cloud Services Distribution Chart */}
              {analyticsData.cloudServices.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Cloud Services Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analyticsData.cloudServices.map(s => ({
                          ...s,
                          percentage: analyticsData.cloudServices.reduce((sum, svc) => sum + svc.requests, 0) > 0
                            ? (s.requests / analyticsData.cloudServices.reduce((sum, svc) => sum + svc.requests, 0) * 100).toFixed(1)
                            : 0
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ service, percentage }) => `${service}: ${percentage}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="requests"
                      >
                        {analyticsData.cloudServices.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Grid>
              )}

              {/* Cloud Services Performance Chart */}
              {analyticsData.cloudServices.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Cloud Services Performance Comparison
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.cloudServices.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="service" type="category" width={150} />
                      <RechartsTooltip />
                      <Bar dataKey="avgResponseTime" fill="#8884d8" name="Avg Response Time (ms)" />
                    </BarChart>
                  </ResponsiveContainer>
                </Grid>
              )}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Drill-Down Details Panel */}
      {drillDownData && (
        <Card sx={{ mt: 3, border: '2px solid', borderColor: 'primary.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Drill-Down Analysis: {drillDownType === 'attack' ? drillDownData.name : drillDownType === 'source' ? drillDownData.source : drillDownData.destination}
              </Typography>
              <IconButton onClick={() => {
                setDrillDownData(null);
                setDrillDownType(null);
              }}>
                <CloseIcon />
              </IconButton>
            </Box>
            
            {drillDownType === 'attack' && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Alert severity="info">
                    <Typography variant="body2">
                      Showing all logs for attack type: <strong>{drillDownData.name}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Count: {drillDownData.value} ({drillDownData.percentage?.toFixed(1)}%)
                    </Typography>
                  </Alert>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Filtered Data
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Use the Attack Type filter above to view detailed logs for this attack type.
                  </Typography>
                </Grid>
              </Grid>
            )}
            
            {(drillDownType === 'source' || drillDownType === 'destination') && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
                    <Typography variant="h4">{drillDownData.requests}</Typography>
                    <Typography variant="caption">Total Requests</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.main', color: 'white' }}>
                    <Typography variant="h4">{drillDownData.attacks}</Typography>
                    <Typography variant="caption">Attacks Detected</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.main', color: 'white' }}>
                    <Typography variant="h4">{drillDownData.errors}</Typography>
                    <Typography variant="caption">Errors</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.main', color: 'white' }}>
                    <Typography variant="h4">{Math.round(drillDownData.avgResponseTime)}ms</Typography>
                    <Typography variant="caption">Avg Response</Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default AnalyticsDashboard;

