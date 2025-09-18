console.log('[TRACE] server.js starting load at', new Date().toISOString());
// Development guard (prevents multiple concurrent instances)
try { require('./dev-guard'); } catch(e) { console.warn('[WARN] dev-guard load failed:', e.message); }
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
// Force clear Node.js module cache for jobber-queries to ensure fresh loading
const jobberQueriesPath = require.resolve('./jobber-queries');
if (require.cache[jobberQueriesPath]) {
  console.log('[CACHE-CLEAR] Removing cached jobber-queries module');
  delete require.cache[jobberQueriesPath];
}

const {
  BUSINESS_RATES,
  PLUMBER_MAPPINGS,
  processInvoiceData,
  processTimesheetData,
  calculateProfitMetrics,
  getInvoicesQuery,
  getTimesheetEntriesQuery,
  formatDate,
  generatePlumberReport
} = require('./jobber-queries');

const app = express();
const port = 3000;

// ----------------------------------------------------------------------------
// Observability & Diagnostics Enhancements (Priority 1)
//   - Active request tracking
//   - Structured global error & rejection handlers
//   - Memory usage interval logging (DIAG_INTERVAL_SEC)
//   - Signal handlers annotate active requests
// ----------------------------------------------------------------------------
let activeRequests = 0;
let totalRequests = 0;
const requestTimings = { maxMs: 0, lastMs: 0 };

// Lightweight helper to capture memory + request snapshot
function diagSnapshot(label) {
  const mem = process.memoryUsage();
  return {
    label,
    ts: new Date().toISOString(),
    pid: process.pid,
    activeRequests,
    totalRequests,
    requestTimings: { ...requestTimings },
    rssMB: +(mem.rss / 1024 / 1024).toFixed(1),
    heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(1),
    heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(1),
    externalKB: Math.round(mem.external / 1024)
  };
}

// Request tracking middleware (placed very early after JSON parsing setup below)
function requestTracker(req, res, next) {
  const start = process.hrtime.bigint();
  activeRequests++;
  totalRequests++;
  const id = totalRequests;
  if (process.env.DIAG_REQUEST_LOG === 'true') {
    console.log('[REQ][START]', id, req.method, req.url, 'active=', activeRequests);
  }
  res.on('finish', () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;
    activeRequests = Math.max(0, activeRequests - 1);
    requestTimings.lastMs = +durMs.toFixed(1);
    if (durMs > requestTimings.maxMs) requestTimings.maxMs = requestTimings.lastMs;
    if (process.env.DIAG_REQUEST_LOG === 'true') {
      console.log('[REQ][END]', id, req.method, req.url, res.statusCode, 'durMs=', requestTimings.lastMs, 'active=', activeRequests);
    }
  });
  next();
}

// Create global JobberAPI service instance
const jobberAPI = new JobberAPIService();

// Global error/rejection diagnostics (enhanced)
process.on('uncaughtException', (err) => {
  const snap = diagSnapshot('uncaughtException');
  console.error('[FATAL] Uncaught Exception', { snap, error: err && err.stack || err });
});
process.on('unhandledRejection', (reason, promise) => {
  const snap = diagSnapshot('unhandledRejection');
  console.error('[FATAL] Unhandled Rejection', { snap, reason, promise });
});
// ------------------------------------------------------------------------------------
// Simple In-Memory Cache for Plumber Reports
// ------------------------------------------------------------------------------------
// Structure: { [key]: { data, expiresAt, meta } }
// Key format: plumberName:YYYY (current year)
// TTL default 10 minutes (configurable via REPORT_CACHE_TTL_MS env)
const reportCache = Object.create(null);
const DEFAULT_CACHE_TTL_MS = parseInt(process.env.REPORT_CACHE_TTL_MS || '600000', 10); // 10 minutes

function cacheKey(plumber, year) {
  const targetYear = year || new Date().getFullYear();
  return `${plumber}:${targetYear}`;
}

function getCachedReport(plumber, year) {
  const key = cacheKey(plumber, year);
  const entry = reportCache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete reportCache[key];
    return null;
  }
  return entry;
}

function setCachedReport(plumber, data, sourceMeta = {}, year) {
  const key = cacheKey(plumber, year);
  reportCache[key] = {
    data,
    expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
    meta: { cachedAt: new Date().toISOString(), ttlMs: DEFAULT_CACHE_TTL_MS, ...sourceMeta }
  };
  return reportCache[key];
}

// Helper to fetch (real or mock) plumber report with caching considerations
async function buildPlumberReport(name, { refresh = false, year } = {}) {
  const useRealData = process.env.USE_REAL_DATA === 'true';
  const cacheBypass = refresh;
  if (!cacheBypass) {
    const cached = getCachedReport(name, year);
    if (cached) {
      return cached.data;
    }
  }

  // MOCK PATH
  if (!useRealData) {
    const mockData = generateMockData(name);
    mockData.summary.periodLabel = 'Year to Date 2025 (ENHANCED MOCK DATA - Set USE_REAL_DATA=true for real data)';
    mockData.meta = {
      dataMode: 'mock',
      reason: 'config_USE_REAL_DATA_false',
      generatedAt: new Date().toISOString()
    };
    setCachedReport(name, mockData, { source: 'mock', refresh }, year);
    return mockData;
  }

  // REAL DATA PATH
  let account;
  try {
    account = await jobberAPI.getFirstValidAccount();
  } catch (error) {
    // OAuth failure fallback to mock
    const mockData = generateMockData(name);
    const data = { ...mockData, notice: 'Using mock data - OAuth tokens need refresh', plumber: name };
    data.meta = {
      dataMode: 'mock',
      reason: 'oauth_auth_failure',
      authError: error.message,
      generatedAt: new Date().toISOString()
    };
    setCachedReport(name, data, { source: 'mock-fallback', refresh, authError: error.message }, year);
    return data;
  }

  if (!account) {
    const authRequired = {
      error: 'Authentication required',
      plumber: name,
      summary: {
        periodLabel: 'Authentication Required - Click to Connect Jobber',
        totalInvoicedHours: 0,
        totalWorkedHours: 0,
        totalProfit: 0,
        totalRevenue: 0,
        avgProfitMargin: 0,
        avgUtilization: 0,
        avgHourlyRate: 0
      },
      monthlyData: []
    };
    return authRequired;
  }

  const reportData = await generatePlumberReport(account, name, { refresh, year });
  reportData.meta = {
    dataMode: 'real',
    generatedAt: new Date().toISOString()
  };
  setCachedReport(name, reportData, { source: 'real', refresh }, year);
  return reportData;
}

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
// Attach request tracking AFTER basic middleware
app.use(requestTracker);

// Serve static files from frontend build
const frontendPath = path.join(__dirname, 'build');
console.log('Serving frontend from:', frontendPath);
app.use(express.static(frontendPath));

// Root serve index.html if present (after frontendPath is defined)
app.get('/', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(503).json({ error: 'Frontend build not found. Run frontend build.', timestamp: new Date().toISOString() });
});

// Catch-all for client-side routing (excluding /api paths and auth callback)
app.get(/^\/(?!api|auth\/callback|api\/)/, (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).json({ error: 'Frontend build not found.' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OAuth URL generation endpoint
app.get('/api/auth/oauth-url', (req, res) => {
  try {
    const jobberAPI = new JobberAPIService();
    const state = Math.random().toString(36).substring(2, 15); // Generate random state
    const authUrl = jobberAPI.generateAuthUrl(state);
    res.json({ 
      authUrl, 
      state,
      message: "Visit this URL to re-authenticate with Jobber",
      instructions: "After clicking the URL and authorizing, you'll be redirected back to complete the OAuth flow"
    });
  } catch (error) {
    console.error('[SERVER] Error generating OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL', message: error.message });
  }
});

// OAuth route temporarily removed to stop infinite redirect loop
// Will be restored after fixing browser cookie issue

// Generate mock data (enhanced with realistic year-to-date data)
function generateMockData(name) {
  // Generate comprehensive mock data with proper business rates
  const mockBusinessRates = {
    Lorin: { billableRate: 165, laborRate: 35, plumberOverhead: 12 },
    Wes: { billableRate: 165, laborRate: 28, plumberOverhead: 10 },
    Elijah: { billableRate: 165, laborRate: 22, plumberOverhead: 8 }
  };
  
  const fixedOverhead = 15;
  const rates = mockBusinessRates[name] || mockBusinessRates.Lorin;
  
  // Generate 9 months of YTD data (January through September)
  const monthlyData = [];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September'];
  const monthCodes = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09'];
  
  for (let i = 0; i < 9; i++) {
    // Simulate seasonal variations and business growth
    const seasonalMultiplier = [0.8, 0.9, 1.1, 1.2, 1.3, 1.4, 1.3, 1.2, 1.1][i];
    const baseHours = (80 + Math.random() * 40) * seasonalMultiplier;
    const efficiency = 0.85 + Math.random() * 0.15; // 85-100% efficiency
    const invoicedHours = Math.round(baseHours * 10) / 10;
    const workedHours = Math.round(baseHours * efficiency * 10) / 10;
    const revenue = Math.round(invoicedHours * rates.billableRate);
    
    // Calculate realistic costs
    const variableCostPerHour = rates.laborRate + rates.plumberOverhead + fixedOverhead;
    let totalCost = workedHours * variableCostPerHour;
    // Add small fixed cost component
    totalCost += invoicedHours * rates.billableRate * 0.05;
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
    periodLabel: 'Year to Date 2025 (ENHANCED MOCK DATA)',
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

// Debug endpoint removed - causing conflicts with main implementation

app.get('/api/test-jobber', async (req, res) => {
  try {
    console.log('[SERVER] Testing simple Jobber API connection...');
    
    const JobberAPIService = require('./JobberAPIService');
    const service = new JobberAPIService();
    await service.ensureValidToken();
    
    // Simple test query - just get account info
    const testQuery = `
      query {
        account {
          id
        }
      }
    `;
    
    const result = await service.query(testQuery);
    console.log('[SERVER] Jobber API test successful:', result);
    
    res.json({ 
      status: 'success', 
      message: 'Jobber API connection working',
      data: result
    });
    
  } catch (error) {
    console.error('[SERVER] Jobber API test failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Jobber API connection failed',
      error: error.message
    });
  }
});

// Individual plumber report endpoint with conditional real/mock data
app.get('/api/reports/plumber', async (req, res) => {
  const name = req.query.name || 'Lorin';
  const refresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());
  const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
  try {
    console.log('[SERVER] Plumber report request for:', name, 'refresh=', refresh, 'year=', year || 'default');
    const data = await buildPlumberReport(name, { refresh, year });
    res.json(data);
  } catch (error) {
    console.error('[SERVER] Error building plumber report:', error);
    res.status(500).json({
      error: 'Failed to build plumber report',
      message: error.message,
      plumber: name,
      summary: {
        periodLabel: `Error: ${error.message}`,
        totalInvoicedHours: 0,
        totalWorkedHours: 0,
        totalProfit: 0,
        totalRevenue: 0,
        avgProfitMargin: 0,
        avgUtilization: 0,
        avgHourlyRate: 0
      },
      monthlyData: []
    });
  }
});

// Combined reports endpoint
// Returns reports for multiple plumbers in a single payload
// Query params:
//   plumbers=Lorin,Wes,Elijah  (optional, defaults to those three)
//   refresh=1 (bypass cache for all)
app.get('/api/reports/combined', async (req, res) => {
  const refresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());
  const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
  const paramList = (req.query.plumbers || '').toString().trim();
  let plumbers = paramList ? paramList.split(',').map(p => p.trim()).filter(Boolean) : ['Lorin', 'Wes', 'Elijah'];
  // Ensure uniqueness
  plumbers = Array.from(new Set(plumbers));
  const results = [];
  for (const p of plumbers) {
    try {
      const report = await buildPlumberReport(p, { refresh, year });
      results.push(report);
    } catch (e) {
      results.push({ 
        plumber: p, 
        error: true, 
        message: e.message, 
        monthlyData: [], 
        summary: { 
          periodLabel: `Error: ${e.message}`, 
          totalInvoicedHours: 0, 
          totalWorkedHours: 0, 
          totalProfit: 0, 
          totalRevenue: 0, 
          avgProfitMargin: 0, 
          avgUtilization: 0, 
          avgHourlyRate: 0 
        } 
      });
    }
  }

  // Aggregate simple YTD totals (across plumbers) for convenience
  const aggregate = results.reduce((acc, r) => {
    const s = r.summary || {};
    acc.totalInvoicedHours += s.totalInvoicedHours || 0;
    acc.totalWorkedHours += s.totalWorkedHours || 0;
    acc.totalProfit += s.totalProfit || 0;
    acc.totalRevenue += s.totalRevenue || 0;
    return acc;
  }, { totalInvoicedHours: 0, totalWorkedHours: 0, totalProfit: 0, totalRevenue: 0 });

  const avgMargin = aggregate.totalRevenue > 0 ? (aggregate.totalProfit / aggregate.totalRevenue) * 100 : 0;
  // Align utilization formula with individual plumber report (invoiced / worked * 100)
  const avgUtil = aggregate.totalWorkedHours > 0 ? (aggregate.totalInvoicedHours / aggregate.totalWorkedHours) * 100 : 0;
  // Return results WITHOUT synthesized TOTAL row (reverted change)
  res.json({
    generatedAt: new Date().toISOString(),
    plumbers: results,
    aggregate: {
      totalInvoicedHours: Math.round(aggregate.totalInvoicedHours * 10) / 10,
      totalWorkedHours: Math.round(aggregate.totalWorkedHours * 10) / 10,
      totalProfit: Math.round(aggregate.totalProfit),
      totalRevenue: Math.round(aggregate.totalRevenue),
      avgProfitMargin: Math.round(avgMargin * 10) / 10,
      avgUtilization: Math.round(avgUtil * 10) / 10,
      avgHourlyRate: (aggregate.totalInvoicedHours > 0) ? Math.round((aggregate.totalRevenue / aggregate.totalInvoicedHours) * 100) / 100 : 0
    },
    meta: {
      generatedAt: new Date().toISOString(),
      anyMock: results.some(r => r.meta && r.meta.dataMode === 'mock'),
      plumbersMockCount: results.filter(r => r.meta && r.meta.dataMode === 'mock').length,
      mockReasons: Array.from(new Set(results.filter(r => r.meta && r.meta.dataMode === 'mock').map(r => r.meta.reason))).sort()
    }
  });
});

// -----------------------------------------------------------------------------
// Admin Year Refresh Endpoint
//   POST /api/admin/refresh-year?year=2025&plumbers=Lorin,Wes
//   Headers: x-admin-key: <ADMIN_KEY>
//   Rate limited by timestamp persisted to backend/.admin-ops.json
// -----------------------------------------------------------------------------
const ADMIN_OPS_FILE = path.join(__dirname, '.admin-ops.json');
const ADMIN_MIN_INTERVAL_MIN = parseInt(process.env.ADMIN_REFRESH_MIN_INTERVAL || '15', 10); // default 15 minutes

function loadAdminOps() {
  try { return JSON.parse(fs.readFileSync(ADMIN_OPS_FILE, 'utf8')); } catch { return {}; }
}
function saveAdminOps(data) {
  try { fs.writeFileSync(ADMIN_OPS_FILE, JSON.stringify(data, null, 2)); } catch (e) { console.warn('[ADMIN] Failed to write ops file', e.message); }
}

app.post('/api/admin/refresh-year', async (req, res) => {
  try {
    const adminKey = process.env.ADMIN_KEY || '';
    if (!adminKey) return res.status(500).json({ error: 'ADMIN_KEY not configured' });
    const provided = req.headers['x-admin-key'];
    if (provided !== adminKey) return res.status(401).json({ error: 'unauthorized' });

    const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
    const paramList = (req.query.plumbers || '').toString().trim();
    let plumbers = paramList ? paramList.split(',').map(p => p.trim()).filter(Boolean) : ['Lorin','Wes','Elijah'];
    plumbers = Array.from(new Set(plumbers));

    // Rate limit check
    const ops = loadAdminOps();
    const lastTs = ops.lastRefreshTs ? new Date(ops.lastRefreshTs).getTime() : 0;
    const nowTs = Date.now();
    const minGapMs = ADMIN_MIN_INTERVAL_MIN * 60 * 1000;
    if (lastTs && (nowTs - lastTs) < minGapMs) {
      const waitMin = Math.ceil((minGapMs - (nowTs - lastTs)) / 60000);
      return res.status(429).json({ error: 'rate_limited', retryInMinutes: waitMin });
    }

    const results = [];
    for (const p of plumbers) {
      try {
        const report = await buildPlumberReport(p, { refresh: true, year });
        results.push({ plumber: p, success: true, summary: report.summary });
      } catch (e) {
        results.push({ plumber: p, success: false, error: e.message });
      }
    }

    ops.lastRefreshTs = new Date().toISOString();
    saveAdminOps(ops);
    res.json({ ok: true, year, plumbers: results, nextAllowedAfter: new Date(new Date(ops.lastRefreshTs).getTime() + minGapMs).toISOString() });
  } catch (e) {
    console.error('[ADMIN] refresh-year failed', e);
    res.status(500).json({ error: 'internal_error', message: e.message });
  }
});


// OAuth initiation endpoint (enables user to start OAuth flow for refresh token)
app.get('/auth', (req, res) => {
  try {
    const jobberAPI = new JobberAPIService();
    const state = Math.random().toString(36).substring(2, 15); // Generate random state
    const authUrl = jobberAPI.generateAuthUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[SERVER] Error generating OAuth URL:', error);
    res.status(500).send('Failed to generate OAuth URL');
  }
});

// OAuth callback endpoint - DISABLED: Frontend handles OAuth callback
// Uncomment below if backend should handle OAuth callback directly
/*
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log('[SERVER] OAuth callback:', req.query);

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Exchange code for tokens directly in the callback
    const tokenData = await jobberAPI.exchangeCodeForToken(code);
    console.log('[SERVER] Token exchange successful');

    // Send a simple success page instead of redirecting
    res.send(`
      <html>
        <head><title>OAuth Success</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; text-align: center;">
          <h1 style="color: green;">✅ Authentication Successful!</h1>
          <p>You have successfully authenticated with Jobber.</p>
          <p>Your tokens have been saved and you can now access real data.</p>
          <p><a href="/" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[SERVER] Token exchange failed:', error);
    res.send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; text-align: center;">
          <h1 style="color: red;">❌ Authentication Failed</h1>
          <p>There was an error during authentication:</p>
          <p style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${error.message}</p>
          <p><a href="/auth" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Try Again</a></p>
        </body>
      </html>
    `);
  }
});
*/

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

// Error handler
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

console.log('[TRACE] server.js completed top-level execution at', new Date().toISOString());

// Environment validation before server start
function validateEnvironment() {
  const required = [
    'JOBBER_CLIENT_ID',
    'JOBBER_CLIENT_SECRET',
    'JOBBER_API_URL',
    'JOBBER_REDIRECT_URI',
    'SESSION_SECRET'
  ];

  const warnings = [];
  const errors = [];

  // Check required variables
  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Check optional but recommended variables
  if (!process.env.ADMIN_KEY) {
    warnings.push('ADMIN_KEY not set - admin endpoints will be disabled');
  }

  if (!process.env.USE_REAL_DATA || process.env.USE_REAL_DATA !== 'true') {
    warnings.push('USE_REAL_DATA is not set to "true" - server will use mock data');
  }

  // Log results
  if (errors.length > 0) {
    console.error('[ENV] ❌ Environment validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('[ENV] Please set the missing environment variables in your .env file');
    console.error('[ENV] Refer to .env.example for the complete list of required variables');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('[ENV] ⚠️ Environment validation warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  console.log('[ENV] ✅ Environment validation passed');
}

// Validate environment before starting server
validateEnvironment();

// Start server with diagnostics
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Jobber API server running on http://0.0.0.0:${port}`);
  console.log(`📱 Frontend origin: ${process.env.CLIENT_APP_ORIGIN || 'http://localhost:3000'}`);
  console.log(`🔑 Jobber Client ID: ${process.env.JOBBER_CLIENT_ID ? 'configured' : 'missing'}`);
  try { console.log('� Server address info:', server.address()); } catch(e){ console.log('⚠️ server.address() error', e); }
  setTimeout(()=>console.log('✅ Post-start 1500ms tick - server should still be alive'),1500);
  setTimeout(()=>console.log('✅ Post-start 5000ms tick - server still alive'),5000);
});

server.on('error', (err) => {
  console.error('[SERVER] server.error event:', err);
});

process.on('beforeExit', (code) => {
  console.log('[SERVER][beforeExit] code=', code, 'uptimeMs=', Math.round(process.uptime()*1000));
});

process.on('exit', (code)=>{
  console.log('[SERVER][exit] code=', code, 'uptimeMs=', Math.round(process.uptime()*1000));
});

// Keep alive heartbeat
setInterval(()=>{ if (process.env.ENABLE_HEARTBEAT === 'true') console.log('💓 Server heartbeat:', new Date().toISOString()); }, 30000);

// Memory / diagnostics interval
const diagIntervalSec = parseInt(process.env.DIAG_INTERVAL_SEC || '0', 10);
if (diagIntervalSec > 0) {
  setInterval(() => {
    const snap = (typeof diagSnapshot === 'function') ? diagSnapshot('interval') : {};
    console.log('[DIAG][INTERVAL]', snap);
  }, Math.max(5, diagIntervalSec) * 1000).unref();
  console.log(`[DIAG] Interval memory logging enabled every ${Math.max(5, diagIntervalSec)}s`);
}

function annotateSignal(sig){
  const snap = (typeof diagSnapshot === 'function') ? diagSnapshot(`signal:${sig}`) : {};
  console.log(`[SIGNAL] ${sig} received`, snap);
}
['SIGINT','SIGTERM','SIGHUP'].forEach(sig => {
  process.on(sig, () => {
    annotateSignal(sig);
    // allow existing handlers (dev-guard cleanup) then exit
    setTimeout(()=>process.exit(0), 25).unref();
  });
});

// Debug invoice items endpoint (guarded by DEBUG_INVOICE_API=true)
app.get('/api/debug/invoice-items', async (req, res) => {
  if (process.env.DEBUG_INVOICE_API !== 'true') {
    return res.status(403).json({ error: 'disabled', message: 'Enable by setting DEBUG_INVOICE_API=true' });
  }
  const plumber = req.query.plumber || 'Wes';
  const month = req.query.month; // format YYYY-MM
  const year = req.query.year ? parseInt(req.query.year,10) : (month ? parseInt(month.split('-')[0],10) : new Date().getFullYear());
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'bad_request', message: 'month query param required (YYYY-MM)' });
  }
  try {
    const account = await jobberAPI.getFirstValidAccount();
    // Narrow fetch to just target month by setting year=year then filtering
    const report = await generatePlumberReport(account, plumber, { refresh: true, year, includeInvoiceItems: true });
    const payload = (report.monthlyData || []).find(m => m.month === month);
    if (!payload) {
      return res.status(404).json({ error: 'not_found', message: 'Month not found in report' });
    }
    res.json({ plumber, month, invoiceItemsCount: payload.invoiceItems?.length || 0, invoicedHours: payload.invoicedHours, invoiceItems: payload.invoiceItems, rawInvoiceLineItems: payload.rawInvoiceLineItems });
  } catch (e) {
    console.error('[DEBUG-ENDPOINT] Error', e);
    res.status(500).json({ error: 'internal_error', message: e.message });
  }
});