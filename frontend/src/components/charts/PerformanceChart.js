/**
 * Chart component for displaying system performance metrics.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  useTheme,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

const PerformanceChart = ({ data: propData, type = 'area' }) => {
  const theme = useTheme();
  const [chartData, setChartData] = useState([]);

  // Generate sample performance data
  const generateSampleData = () => {
    const now = new Date();
    const data = [];
    
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000); // Last 24 hours
      data.push({
        time: time.getHours() + ':00',
        accuracy: 95 + Math.random() * 4, // 95-99%
        precision: 94 + Math.random() * 5, // 94-99%
        recall: 93 + Math.random() * 6, // 93-99%
        f1Score: 94 + Math.random() * 4, // 94-98%
      });
    }
    
    return data;
  };

  useEffect(() => {
    // Use provided data or generate sample data
    const dataToUse = propData || generateSampleData();
    setChartData(dataToUse);
  }, [propData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: 'background.paper',
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 3,
            minWidth: 200,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Time: {label}
          </Typography>
          {payload.map((entry, index) => (
            <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" sx={{ color: entry.color }}>
                {entry.name}:
              </Typography>
              <Typography variant="body2" sx={{ ml: 1, fontWeight: 'medium' }}>
                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}%
              </Typography>
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  if (!chartData.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No performance data available
        </Typography>
      </Box>
    );
  }

  const Chart = type === 'line' ? LineChart : AreaChart;

  return (
    <Box sx={{ width: '100%', height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={theme.palette.divider}
            opacity={0.3}
          />
          <XAxis 
            dataKey="time" 
            stroke={theme.palette.text.secondary}
            fontSize={12}
          />
          <YAxis 
            domain={[90, 100]}
            stroke={theme.palette.text.secondary}
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {type === 'area' ? (
            <>
              <Area
                type="monotone"
                dataKey="accuracy"
                stackId="1"
                stroke={theme.palette.primary.main}
                fill={theme.palette.primary.main}
                fillOpacity={0.6}
                name="Accuracy"
              />
              <Area
                type="monotone"
                dataKey="precision"
                stackId="2"
                stroke={theme.palette.success.main}
                fill={theme.palette.success.main}
                fillOpacity={0.6}
                name="Precision"
              />
            </>
          ) : (
            <>
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke={theme.palette.primary.main}
                strokeWidth={2}
                dot={{ fill: theme.palette.primary.main, strokeWidth: 2, r: 3 }}
                name="Accuracy"
              />
              <Line 
                type="monotone" 
                dataKey="precision" 
                stroke={theme.palette.success.main}
                strokeWidth={2}
                dot={{ fill: theme.palette.success.main, strokeWidth: 2, r: 3 }}
                name="Precision"
              />
              <Line 
                type="monotone" 
                dataKey="recall" 
                stroke={theme.palette.warning.main}
                strokeWidth={2}
                dot={{ fill: theme.palette.warning.main, strokeWidth: 2, r: 3 }}
                name="Recall"
              />
              <Line 
                type="monotone" 
                dataKey="f1Score" 
                stroke={theme.palette.info.main}
                strokeWidth={2}
                dot={{ fill: theme.palette.info.main, strokeWidth: 2, r: 3 }}
                name="F1-Score"
              />
            </>
          )}
        </Chart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1, flexWrap: 'wrap' }}>
        {[
          { key: 'accuracy', label: 'Accuracy', color: theme.palette.primary.main },
          { key: 'precision', label: 'Precision', color: theme.palette.success.main },
          { key: 'recall', label: 'Recall', color: theme.palette.warning.main },
          { key: 'f1Score', label: 'F1-Score', color: theme.palette.info.main },
        ].map((item) => (
          <Box
            key={item.key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              mr: 2,
              mb: 0.5,
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: item.color,
                borderRadius: 0.5,
                mr: 1,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default PerformanceChart;
