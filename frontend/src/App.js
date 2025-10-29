/**
 * Main App component for NIDS Dashboard.
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Storage as StorageIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';

import Dashboard from './components/Dashboard';
import ModelManagement from './components/ModelManagement';
import DatasetManagement from './components/DatasetManagement';
import RealTimeMonitoring from './components/RealTimeMonitoring';
import LogAnalysisDashboard from './components/LogAnalysisDashboard';
import { ApiService } from './services/ApiService';

const drawerWidth = 240;

const menuItems = [
  { title: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { title: 'Real-time Monitoring', icon: <SecurityIcon />, path: '/monitoring' },
  { title: 'Log Analysis', icon: <UploadIcon />, path: '/log-analysis' },
  { title: 'Model Management', icon: <AnalyticsIcon />, path: '/models' },
  { title: 'Dataset Management', icon: <StorageIcon />, path: '/datasets' },
];

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState('healthy');
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    // Check system health on app load
    checkSystemHealth();
    
    // Set up periodic health checks
    const healthInterval = setInterval(checkSystemHealth, 30000); // Every 30 seconds
    
    return () => clearInterval(healthInterval);
  }, []);

  const checkSystemHealth = async () => {
    try {
      const response = await ApiService.get('/health');
      if (response.status === 'healthy') {
        setSystemStatus('healthy');
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setSystemStatus('error');
      showNotification('System health check failed', 'error');
    }
  };

  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          NIDS
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.title} disablePadding>
            <ListItemButton component="a" href={item.path}>
              <ListItemIcon sx={{ color: 'primary.main' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.title} 
                sx={{ color: 'text.primary' }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  const getSystemStatusColor = () => {
    switch (systemStatus) {
      case 'healthy':
        return 'success.main';
      case 'warning':
        return 'warning.main';
      case 'error':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Network Intrusion Detection System
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: getSystemStatusColor(),
                animation: systemStatus === 'healthy' ? 'pulse 2s infinite' : 'none',
              }}
            />
            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
              {systemStatus}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Container maxWidth="xl">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route 
              path="/dashboard" 
              element={<Dashboard onShowNotification={showNotification} />} 
            />
            <Route 
              path="/monitoring" 
              element={<RealTimeMonitoring onShowNotification={showNotification} />} 
            />
            <Route 
              path="/log-analysis" 
              element={<LogAnalysisDashboard onShowNotification={showNotification} />} 
            />
            <Route 
              path="/models" 
              element={<ModelManagement onShowNotification={showNotification} />} 
            />
            <Route 
              path="/datasets" 
              element={<DatasetManagement onShowNotification={showNotification} />} 
            />
          </Routes>
        </Container>
      </Box>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
