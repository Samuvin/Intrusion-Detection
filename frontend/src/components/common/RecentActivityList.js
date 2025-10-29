/**
 * Component for displaying recent system activities and alerts.
 */

import React from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Update as UpdateIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

const RecentActivityList = ({ activities = [] }) => {
  const getActivityIcon = (type) => {
    const iconMap = {
      attack_blocked: <SecurityIcon />,
      model_update: <UpdateIcon />,
      training_complete: <SuccessIcon />,
      system_alert: <WarningIcon />,
      error: <ErrorIcon />,
      info: <InfoIcon />,
    };
    return iconMap[type] || <InfoIcon />;
  };

  const getActivityColor = (severity) => {
    const colorMap = {
      high: 'error',
      medium: 'warning',
      low: 'info',
      success: 'success',
      info: 'primary',
    };
    return colorMap[severity] || 'primary';
  };

  const getSeverityChip = (severity) => {
    const chipProps = {
      high: { label: 'High', color: 'error' },
      medium: { label: 'Medium', color: 'warning' },
      low: { label: 'Low', color: 'info' },
      success: { label: 'Success', color: 'success' },
      info: { label: 'Info', color: 'primary' },
    };
    
    const props = chipProps[severity] || chipProps.info;
    return (
      <Chip
        {...props}
        size="small"
        variant="outlined"
        sx={{ ml: 1 }}
      />
    );
  };

  if (!activities.length) {
    return (
      <Box 
        sx={{ 
          textAlign: 'center', 
          py: 4,
          color: 'text.secondary' 
        }}
      >
        <InfoIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
        <Typography variant="body1">
          No recent activities to display
        </Typography>
        <Typography variant="body2">
          System activities will appear here as they occur
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ width: '100%' }}>
      {activities.map((activity, index) => (
        <ListItem
          key={activity.id || index}
          alignItems="flex-start"
          sx={{
            borderRadius: 1,
            mb: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 56 }}>
            <Avatar
              sx={{
                bgcolor: `${getActivityColor(activity.severity)}.main`,
                width: 40,
                height: 40,
              }}
            >
              {getActivityIcon(activity.type)}
            </Avatar>
          </ListItemIcon>
          
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography
                  variant="body1"
                  sx={{ 
                    fontWeight: 'medium',
                    color: 'text.primary',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {activity.message}
                </Typography>
                {getSeverityChip(activity.severity)}
              </Box>
            }
            secondary={
              <Box sx={{ mt: 0.5 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.75rem' }}
                >
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </Typography>
                
                {activity.details && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ 
                      fontSize: '0.75rem',
                      mt: 0.25,
                      fontStyle: 'italic'
                    }}
                  >
                    {activity.details}
                  </Typography>
                )}
              </Box>
            }
          />
        </ListItem>
      ))}
      
      {activities.length > 5 && (
        <ListItem sx={{ justifyContent: 'center', pt: 2 }}>
          <Typography
            variant="body2"
            color="primary"
            sx={{ 
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            View all activities →
          </Typography>
        </ListItem>
      )}
    </List>
  );
};

export default RecentActivityList;
