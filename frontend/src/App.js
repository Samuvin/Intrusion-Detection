/**
 * Main App component for NIDS Dashboard.
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
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
  Storage as StorageIcon,
  CloudUpload as UploadIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';

import Dashboard from './components/Dashboard';
import DatasetManagement from './components/DatasetManagement';
import RealTimeMonitoring from './components/RealTimeMonitoring';
import LogAnalysisDashboard from './components/LogAnalysisDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { ApiService } from './services/ApiService';

const drawerWidth = 240;

// Context to share navigation blocking state
const NavigationContext = createContext({
  isNavigationBlocked: false,
  setNavigationBlocked: () => {}
});

export const useNavigationBlock = () => useContext(NavigationContext);

const menuItems = [
  { title: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { title: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
  { title: 'Real-time Monitoring', icon: <SecurityIcon />, path: '/monitoring' },
  { title: 'Log Analysis', icon: <UploadIcon />, path: '/log-analysis' },
  { title: 'Datasets & Models', icon: <StorageIcon />, path: '/datasets' },
];

function App() {
  const location = useLocation();
  const [isNavigationBlocked, setNavigationBlocked] = useState(false);
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
      // Health endpoint is at root level, not under /api/v1
      const response = await fetch('http://localhost:8000/health');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'healthy') {
          setSystemStatus('healthy');
        } else {
          setSystemStatus('warning');
        }
      } else {
        setSystemStatus('error');
      }
    } catch (error) {
      // Silently handle health check failures - don't spam user with notifications
      console.debug('Health check failed:', error);
      setSystemStatus('error');
      // Don't show notification for health check failures to avoid annoying users
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
            <ListItemButton 
              component={Link} 
              to={item.path}
              disabled={isNavigationBlocked && location.pathname !== item.path}
              onClick={(e) => {
                if (isNavigationBlocked && location.pathname !== item.path) {
                  e.preventDefault();
                }
              }}
            >
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
          height: 'calc(100vh - 64px)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Container maxWidth="xl" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <NavigationContext.Provider value={{ isNavigationBlocked, setNavigationBlocked }}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route 
                path="/dashboard" 
                element={<Dashboard onShowNotification={showNotification} />} 
              />
              <Route 
                path="/analytics" 
                element={<AnalyticsDashboard onShowNotification={showNotification} />} 
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
                path="/datasets" 
                element={<DatasetManagement onShowNotification={showNotification} />} 
              />
            </Routes>
          </NavigationContext.Provider>
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
