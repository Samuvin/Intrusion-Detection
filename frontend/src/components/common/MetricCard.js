/**
 * Reusable metric card component for displaying key performance indicators.
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
} from '@mui/material';

const MetricCard = ({ title, value, icon, color = 'primary', subtitle, trend }) => {
  const getColorValue = (colorName) => {
    const colors = {
      primary: '#1976d2',
      secondary: '#dc004e',
      success: '#2e7d32',
      error: '#d32f2f',
      warning: '#ed6c02',
      info: '#0288d1',
    };
    return colors[colorName] || colors.primary;
  };

  const getGradient = (colorName) => {
    const gradients = {
      primary: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
      secondary: 'linear-gradient(135deg, rgba(220, 0, 78, 0.15) 0%, rgba(156, 39, 176, 0.15) 100%)',
      success: 'linear-gradient(135deg, rgba(46, 125, 50, 0.15) 0%, rgba(76, 175, 80, 0.15) 100%)',
      error: 'linear-gradient(135deg, rgba(211, 47, 47, 0.15) 0%, rgba(244, 67, 54, 0.15) 100%)',
      warning: 'linear-gradient(135deg, rgba(237, 108, 2, 0.15) 0%, rgba(255, 152, 0, 0.15) 100%)',
      info: 'linear-gradient(135deg, rgba(2, 136, 209, 0.15) 0%, rgba(33, 150, 243, 0.15) 100%)',
    };
    return gradients[colorName] || gradients.primary;
  };

  return (
    <Card 
      className="metric-card"
      sx={{ 
        height: '100%',
        background: getGradient(color),
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${getColorValue(color)}, ${getColorValue(color)}80)`,
        },
        '&:hover': {
          transform: 'translateY(-6px) scale(1.02)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
          border: `1px solid ${getColorValue(color)}40`,
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography 
              variant="subtitle2" 
              color="text.secondary" 
              gutterBottom
              sx={{ fontSize: '0.875rem', fontWeight: 500 }}
            >
              {title}
            </Typography>
            
            <Typography 
              variant="h4" 
              component="div"
              sx={{ 
                fontWeight: 'bold',
                color: 'text.primary',
                mb: 1,
                fontSize: { xs: '1.75rem', sm: '2.125rem' }
              }}
            >
              {value}
            </Typography>
            
            {subtitle && (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ fontSize: '0.75rem', lineHeight: 1.4 }}
              >
                {subtitle}
              </Typography>
            )}
            
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: trend.direction === 'up' ? 'success.main' : 'error.main',
                    fontWeight: 'medium',
                    fontSize: '0.75rem'
                  }}
                >
                  {trend.direction === 'up' ? '↗' : '↘'} {trend.value}%
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ ml: 1, fontSize: '0.75rem' }}
                >
                  vs last period
                </Typography>
              </Box>
            )}
          </Box>
          
          <Avatar
            sx={{
              bgcolor: `${getColorValue(color)}20`,
              color: getColorValue(color),
              width: 56,
              height: 56,
              ml: 2,
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MetricCard;
