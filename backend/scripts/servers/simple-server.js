console.log('[SIMPLE] server.js starting at', new Date().toISOString());
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Import only basic GraphQL queries
const {
  ACCOUNT_QUERY,
  JOBS_QUERY,
  CLIENTS_QUERY,
  INVOICES_QUERY,
  TIME_SHEETS_QUERY
} = require('./graphql-queries');

const app = express();
const port = 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Serve static files from frontend build
const frontendPath = path.join(__dirname, 'build');
console.log('Serving frontend from:', frontendPath);
app.use(express.static(frontendPath));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple plumber endpoint (no JobberAPI service yet)
app.get('/api/reports/plumber', async (req, res) => {
  try {
    const name = req.query.name || 'Unknown';
    console.log('[SIMPLE] Simple report request for:', name);
    
    // Return basic mock data for now
    const mockData = {
      plumber: name,
      summary: {
        periodLabel: 'Test Data (Limited Scope)',
        totalInvoicedHours: 100.0,
        totalWorkedHours: 95.0,
        totalProfit: 8000,
        totalRevenue: 16500,
        avgProfitMargin: 48.5,
        avgUtilization: 95.0,
        avgHourlyRate: 165
      },
      monthlyData: [
        {
          month: '2025-06',
          monthName: 'June',
          invoicedHours: 25.0,
          workedHours: 24.0,
          revenue: 4125,
          totalCost: 2000,
          profit: 2125,
          profitMargin: 51.5,
          hourlyRate: 165
        }
      ]
    };
    
    console.log('[SIMPLE] Returning mock data for:', name);
    res.json(mockData);
    
  } catch (error) {
    console.error('[SIMPLE] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch plumber data', 
      message: error.message,
      plumber: req.query.name || 'Unknown'
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[SIMPLE] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

console.log('[SIMPLE] server.js completed setup at', new Date().toISOString());

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Simple Jobber API server running on http://0.0.0.0:${port}`);
  console.log(`📱 Frontend origin: http://localhost:${port}`);
  console.log('✅ Simple server started successfully');
});

console.log('[SIMPLE] server.js file executed completely at', new Date().toISOString());