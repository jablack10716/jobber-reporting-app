console.log('[SERVER] Starting up at', new Date().toISOString());
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3000;

// Basic middleware
app.use(cors({
  origin: process.env.CLIENT_APP_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Serve static files from frontend build
const frontendPath = path.join(__dirname, '..', 'frontend', 'build');
console.log('[SERVER] Serving frontend from:', frontendPath);
app.use(express.static(frontendPath));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock plumber data endpoint
app.get('/api/reports/plumber', (req, res) => {
  const name = req.query.name || 'Unknown';
  const mockData = {
    plumber: name,
    summary: {
      periodLabel: 'Year to Date 2025',
      totalInvoicedHours: Math.floor(Math.random() * 1000) + 500,
      totalRevenue: Math.floor(Math.random() * 50000) + 25000
    },
    monthlyData: [
      { month: '2025-01', hours: 120, revenue: 6000 },
      { month: '2025-02', hours: 135, revenue: 6750 },
      { month: '2025-03', hours: 142, revenue: 7100 }
    ]
  };
  
  console.log('[SERVER] Plumber report for:', name);
  res.json(mockData);
});

// OAuth callback (serves React app)
app.get('/auth', (req, res) => {
  console.log('[SERVER] OAuth callback:', req.query);
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend build not found' });
  }
});

// Simple OAuth token endpoint
app.post('/auth/token', async (req, res) => {
  const { code } = req.body;
  console.log('[SERVER] Token exchange with code:', code?.substring(0, 10) + '...');
  res.json({ accountName: 'Advanced Plumbing' });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not found' });
  }
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log('[SERVER] ✅ Running on http://localhost:' + port);
  console.log('[SERVER] 🔗 Frontend origin:', process.env.CLIENT_APP_ORIGIN || 'http://localhost:3000');
  console.log('[SERVER] 🎯 Ready for OAuth testing!');
});

// Clean shutdown
process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] ❌ Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[SERVER] ❌ Uncaught exception:', err);
  process.exit(1);
});

console.log('[SERVER] Initialization complete at', new Date().toISOString());