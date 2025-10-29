/**
 * Chart component for displaying attack type distribution.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  useTheme,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const AttackTypeChart = ({ data: propData }) => {
  const theme = useTheme();
  const [chartData, setChartData] = useState([]);

  // Default sample data if none provided
  const defaultData = [
    { name: 'Normal', value: 65, color: theme.palette.success.main },
    { name: 'DoS', value: 20, color: theme.palette.error.main },
    { name: 'Probe', value: 10, color: theme.palette.warning.main },
    { name: 'U2R', value: 3, color: theme.palette.info.main },
    { name: 'R2L', value: 2, color: theme.palette.secondary.main },
  ];

  useEffect(() => {
    // Use provided data or default sample data
    const dataToUse = propData || defaultData;
    setChartData(dataToUse);
  }, [propData]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <Box
          sx={{
            backgroundColor: 'background.paper',
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 3,
          }}
        >
          <Typography variant="subtitle2" sx={{ color: data.payload.color }}>
            {data.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Count: {data.value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Percentage: {((data.value / chartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%
          </Typography>
        </Box>
      );
    }
    return null;
  };


  if (!chartData.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No attack data available
        </Typography>
      </Box>
    );
  }

  // Filter out zero values to avoid clutter, but keep at least one entry for visual consistency
  const displayData = chartData.filter(item => item.value > 0);
  
  if (displayData.length === 0 && chartData.length > 0) {
    // If all values are 0, show only the first one with value 0
    displayData.push(chartData[0]);
  }
  
  // Calculate total for percentage display
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Box sx={{ width: '100%', height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={displayData}
            cx="50%"
            cy="45%"
            labelLine={false}
            label={false}
            outerRadius={100}
            innerRadius={30}
            fill="#8884d8"
            dataKey="value"
            paddingAngle={2}
          >
            {displayData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color} 
                stroke={entry.color}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Custom Legend Below Chart */}
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        justifyContent: 'center', 
        gap: 2,
        mt: 2,
        px: 2
      }}>
        {chartData.map((entry, index) => {
          const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
          return (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                minWidth: '120px',
                mb: 1,
              }}
            >
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  backgroundColor: entry.color,
                  borderRadius: 1,
                  mr: 1.5,
                  flexShrink: 0,
                }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 500,
                    color: 'text.primary',
                    lineHeight: 1.2
                  }}
                >
                  {entry.name}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    lineHeight: 1.2
                  }}
                >
                  {entry.value} ({percentage}%)
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default AttackTypeChart;
