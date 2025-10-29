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
  Legend,
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

  const CustomLegend = ({ payload }) => {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', mt: 2 }}>
        {payload.map((entry, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              mr: 2,
              mb: 1,
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: entry.color,
                borderRadius: 0.5,
                mr: 1,
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {entry.value}
            </Typography>
          </Box>
        ))}
      </Box>
    );
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

  return (
    <Box sx={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color} 
                stroke={entry.color}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default AttackTypeChart;
