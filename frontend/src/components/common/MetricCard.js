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

  return (
    <Card 
      className="metric-card"
      sx={{ 
        height: '100%',
        background: `linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(156, 39, 176, 0.1) 100%)`,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
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
