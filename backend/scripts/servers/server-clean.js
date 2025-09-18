console.log('[TRACE] server.js starting load at', new Date().toISOString());
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  ACCOUNT_QUERY,
  JOBS_QUERY,
  CLIENTS_QUERY,
  INVOICES_QUERY,
  TIME_SHEETS_QUERY
} = require('./graphql-queries');

// Import JobberAPIService and business logic
const JobberAPIService = require('./JobberAPIService');
const {
  BUSINESS_RATES,
  PLUMBER_MAPPINGS,
  processInvoiceData,
  calculateProfitMetrics,
  fetchInvoicesForPeriod,
  fetchTimesheetsForPeriod,
  getInvoicesQuery,
  getTimesheetsQuery
} = require('./jobber-queries');

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

// Generate mock data (fallback when OAuth not working)
function generateMockData(name) {
  // Generate comprehensive mock data with proper business rates
  const mockBusinessRates = {
    Lorin: { billableRate: 85, laborRate: 35, plumberOverhead: 12 },
    Wes: { billableRate: 75, laborRate: 28, plumberOverhead: 10 },
    Elijah: { billableRate: 70, laborRate: 22, plumberOverhead: 8 }
  };
  
  const fixedOverhead = 15;
  const rates = mockBusinessRates[name] || mockBusinessRates.Lorin;
  
  // Generate 4 months of data (changed from 3 to match real implementation)
  const monthlyData = [];
  const months = ['October', 'November', 'December', 'January'];
  const monthCodes = ['2024-10', '2024-11', '2024-12', '2025-01'];
  
  for (let i = 0; i < 4; i++) {
    const baseHours = 120 + Math.random() * 40;
    const efficiency = 0.85 + Math.random() * 0.15; // 85-100% efficiency
    const invoicedHours = Math.round(baseHours * 10) / 10;
    const workedHours = Math.round(baseHours * efficiency * 10) / 10;
    const revenue = Math.round(invoicedHours * rates.billableRate);
    // Adjust cost calculation to produce realistic profit margins
    const variableCostPerHour = rates.laborRate + rates.plumberOverhead + fixedOverhead;
    let totalCost = workedHours * variableCostPerHour;
    // Add small fixed cost component
    totalCost += invoicedHours * rates.billableRate * 0.1;
    totalCost = Math.round(totalCost);
    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    
    monthlyData.push({
      month: monthCodes[i],
      monthName: months[i],
      invoicedHours,
      workedHours,
      revenue,
      totalCost,
      profit,
      profitMargin: Math.round(profitMargin * 10) / 10,
      hourlyRate: rates.billableRate
    });
  }
  
  // Calculate YTD summary
  const totals = monthlyData.reduce((acc, item) => ({
    totalInvoicedHours: acc.totalInvoicedHours + item.invoicedHours,
    totalWorkedHours: acc.totalWorkedHours + item.workedHours,
    totalProfit: acc.totalProfit + item.profit,
    totalRevenue: acc.totalRevenue + item.revenue
  }), { totalInvoicedHours: 0, totalWorkedHours: 0, totalProfit: 0, totalRevenue: 0 });
  
  const avgUtilization = totals.totalInvoicedHours > 0 ? 
    (totals.totalWorkedHours / totals.totalInvoicedHours) * 100 : 0;
  const avgMargin = totals.totalRevenue > 0 ? (totals.totalProfit / totals.totalRevenue) * 100 : 0;
  
  const summary = {
    periodLabel: 'Year to Date 2025 (MOCK DATA - OAuth Required)',
    totalInvoicedHours: Math.round(totals.totalInvoicedHours * 10) / 10,
    totalWorkedHours: Math.round(totals.totalWorkedHours * 10) / 10,
    totalProfit: Math.round(totals.totalProfit),
    totalRevenue: Math.round(totals.totalRevenue),
    avgProfitMargin: Math.round(avgMargin * 10) / 10,
    avgUtilization: Math.round(avgUtilization * 10) / 10,
    avgHourlyRate: rates.billableRate
  };
  
  return {
    plumber: name,
    summary,
    monthlyData
  };
}

// Individual plumber report endpoint with OAuth fallback
app.get('/api/reports/plumber', async (req, res) => {
  try {
    const name = req.query.name || 'Unknown';
    console.log('[SERVER] Plumber report request for:', name);
    
    // Try to fetch real Jobber data first
    try {
      // Initialize Jobber API service
      const jobberAPI = new JobberAPIService();
      
      // Ensure we have a valid token
      await jobberAPI.ensureValidToken();
      
      console.log('[SERVER] Using REAL Jobber API data');
      
      // Map frontend plumber name to internal format
      const plumberKey = name.toLowerCase();
      const timesheetName = PLUMBER_MAPPINGS[plumberKey] || name;
      
      // Date ranges for last 3 months + current
      const now = new Date();
      const months = [];
      for (let i = 3; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        months.push({
          start: monthStart,
          end: monthEnd,
          code: `${monthStart.getFullYear()}-${(monthStart.getMonth() + 1).toString().padStart(2, '0')}`,
          name: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        });
      }
      
      const monthlyData = [];
      
      // Fetch data for each month
      for (const month of months) {
        console.log(`[SERVER] Fetching data for ${month.name}`);
        
        // Fetch invoices and timesheets in parallel
        const [invoiceData, timesheetData] = await Promise.all([
          fetchInvoicesForPeriod(jobberAPI, month.start, month.end, plumberKey),
          fetchTimesheetsForPeriod(jobberAPI, month.start, month.end, timesheetName)
        ]);
        
        // Calculate profit metrics
        const invoicedHours = invoiceData.invoicedHours;
        const workedHours = timesheetData.workedHours;
        const metrics = calculateProfitMetrics(invoicedHours, workedHours, name);
        
        monthlyData.push({
          month: month.code,
          monthName: month.name.split(' ')[0], // Just month name, not year
          invoicedHours: Math.round(invoicedHours * 10) / 10,
          workedHours: Math.round(workedHours * 10) / 10,
          revenue: metrics.revenue,
          totalCost: metrics.totalCost,
          profit: metrics.profit,
          profitMargin: metrics.profitMargin,
          hourlyRate: BUSINESS_RATES.BILLABLE_RATE
        });
      }
      
      // Calculate YTD summary
      const totals = monthlyData.reduce((acc, item) => ({
        totalInvoicedHours: acc.totalInvoicedHours + item.invoicedHours,
        totalWorkedHours: acc.totalWorkedHours + item.workedHours,
        totalProfit: acc.totalProfit + item.profit,
        totalRevenue: acc.totalRevenue + item.revenue
      }), { totalInvoicedHours: 0, totalWorkedHours: 0, totalProfit: 0, totalRevenue: 0 });
      
      const avgUtilization = totals.totalInvoicedHours > 0 ? 
        (totals.totalWorkedHours / totals.totalInvoicedHours) * 100 : 0;
      const avgMargin = totals.totalRevenue > 0 ? (totals.totalProfit / totals.totalRevenue) * 100 : 0;
      
      const summary = {
        periodLabel: 'Year to Date 2025 (REAL DATA)',
        totalInvoicedHours: Math.round(totals.totalInvoicedHours * 10) / 10,
        totalWorkedHours: Math.round(totals.totalWorkedHours * 10) / 10,
        totalProfit: Math.round(totals.totalProfit),
        totalRevenue: Math.round(totals.totalRevenue),
        avgProfitMargin: Math.round(avgMargin * 10) / 10,
        avgUtilization: Math.round(avgUtilization * 10) / 10,
        avgHourlyRate: BUSINESS_RATES.BILLABLE_RATE
      };
      
      const responseData = {
        plumber: name,
        summary,
        monthlyData
      };
      
      console.log('[SERVER] Real Jobber data for:', name, 'YTD Hours:', summary.totalInvoicedHours);
      res.json(responseData);
      return;
      
    } catch (authError) {
      console.log('[SERVER] OAuth/API error, falling back to MOCK data:', authError.message);
      
      // Fall back to mock data when OAuth fails
      const mockData = generateMockData(name);
      console.log('[SERVER] Returning MOCK data for:', name);
      res.json(mockData);
      return;
    }
    
  } catch (error) {
    console.error('[SERVER] Error fetching plumber data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch plumber data', 
      message: error.message,
      plumber: req.query.name || 'Unknown'
    });
  }
});

// OAuth callback endpoint
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log('[SERVER] OAuth callback:', req.query);
  
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  
  // Store the code and redirect to frontend
  const redirectUrl = `http://localhost:3000/auth?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`;
  res.redirect(redirectUrl);
});

// Token exchange endpoint
app.post('/auth/token', async (req, res) => {
  console.log('[SERVER] POST /auth/token received');
  console.log('[SERVER] Request body:', req.body);
  console.log('[SERVER] Request headers:', req.headers);
  
  try {
    const { code, state } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'missing_code', message: 'Authorization code is required' });
    }
    
    console.log('[SERVER] Token exchange with code:', code.substring(0, 10) + '...');
    console.log('[SERVER] State parameter:', state);
    
    // Exchange code for tokens
    const jobberAPI = new JobberAPIService();
    await jobberAPI.exchangeCodeForToken(code);
    
    // Fetch account info
    const accountQuery = `
      query {
        account {
          id
          name
        }
      }
    `;
    
    try {
      const accountData = await jobberAPI.query(accountQuery);
      const account = accountData.account;
      
      // Return a lightweight account object to the frontend (do not include tokens)
      console.log('[SERVER] OAuth flow completed successfully');
      const userResponse = { accountName: account.name };
      console.log('[SERVER] Sending user data:', userResponse);
      return res.json(userResponse);
    } catch (err) {
      console.error('Error fetching account info from Jobber', err);
      return res.status(500).json({ error: 'account_fetch_error', details: String(err) });
    }
  } catch (err) {
    console.error('Token exchange error', err);
    return res.status(500).json({ error: 'token_exchange_error', details: String(err) });
  }
});

// Catch-all handler for frontend routing
app.get('*', (req, res) => {
  console.log('[SERVER] Home page requested');
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

console.log('[TRACE] server.js completed top-level execution at', new Date().toISOString());

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Jobber API server running on http://0.0.0.0:${port}`);
  console.log(`📱 Frontend origin: http://localhost:${port}`);
  console.log(`🔑 Jobber Client ID: ${process.env.JOBBER_CLIENT_ID ? 'configured' : 'missing'}`);
  console.log('🔄 Server address info:', { address: '0.0.0.0', family: 'IPv4', port });
  
  // Periodic liveness check
  setTimeout(() => {
    console.log('✅ Post-start 1500ms tick - server should still be alive');
  }, 1500);
});