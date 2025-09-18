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

const app = express();
const port = 3000;

// Middleware
app.use(cors({
  // Default to port 3000 (unified server) unless CLIENT_APP_ORIGIN explicitly set
  origin: process.env.CLIENT_APP_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Serve static files from frontend build directory
const frontendPath = path.join(__dirname, '..', 'frontend', 'build');
console.log('Serving frontend from:', frontendPath);
app.use(express.static(frontendPath));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Jobber Reporting API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Helper function to load tokens from file
function loadTokens() {
  try {
    const data = fs.readFileSync('tokens.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Helper function to make authenticated GraphQL requests
async function makeJobberGraphQLRequest(query, variables = {}) {
  const tokens = loadTokens();
  const accountIds = Object.keys(tokens);
  
  if (accountIds.length === 0) {
    throw new Error('No authenticated accounts found');
  }
  
  // Use the first (most recent) account
  const accountId = accountIds[0];
  const token = tokens[accountId];
  
  const graphqlEndpoint = (process.env.JOBBER_API_URL || 'https://api.getjobber.com/api') + '/graphql';
  
  let fetchFn = global.fetch;
  if (!fetchFn) {
    try {
      fetchFn = require('node-fetch');
    } catch (e) {
      throw new Error('No fetch available');
    }
  }
  
  const response = await fetchFn(graphqlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.access_token}`,
      'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_GRAPHQL_VERSION || '2025-01-20'
    },
    body: JSON.stringify({ query, variables })
  });
  
  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
  }
  
  return result.data;
}

// Jobs report endpoint
app.get('/api/reports/jobs', async (req, res) => {
  try {
    const { status, first = 50 } = req.query;
    const jobStatus = status ? [status.toUpperCase()] : undefined;
    
    const data = await makeJobberGraphQLRequest(JOBS_QUERY, {
      first: parseInt(first),
      jobStatus
    });
    
    res.json({
      success: true,
      data: data.jobs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('âŒ Jobs report error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clients report endpoint
app.get('/api/reports/clients', async (req, res) => {
  try {
    const { first = 50 } = req.query;
    
    const data = await makeJobberGraphQLRequest(CLIENTS_QUERY, {
      first: parseInt(first)
    });
    
    res.json({
      success: true,
      data: data.clients,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('âŒ Clients report error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Invoices report endpoint
app.get('/api/reports/invoices', async (req, res) => {
  try {
    const { first = 50 } = req.query;
    
    const data = await makeJobberGraphQLRequest(INVOICES_QUERY, {
      first: parseInt(first)
    });
    
    res.json({
      success: true,
      data: data.invoices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('âŒ Invoices report error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Time sheets report endpoint
app.get('/api/reports/timesheets', async (req, res) => {
  try {
    const { first = 50, startDate, endDate } = req.query;
    
    const variables = { first: parseInt(first) };
    if (startDate) variables.startDate = startDate;
    if (endDate) variables.endDate = endDate;
    
    const data = await makeJobberGraphQLRequest(TIME_SHEETS_QUERY, variables);
    
    res.json({
      success: true,
      data: data.timeSheets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('âŒ Time sheets report error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Reports endpoint
app.get('/api/reports', (req, res) => {
  res.json({
    reports: [
      { name: 'jobs', endpoint: '/api/reports/jobs', description: 'Job listings with filters' },
      { name: 'clients', endpoint: '/api/reports/clients', description: 'Client information' },
      { name: 'invoices', endpoint: '/api/reports/invoices', description: 'Invoice data' },
      { name: 'timesheets', endpoint: '/api/reports/timesheets', description: 'Time tracking data' },
      { name: 'plumber', endpoint: '/api/reports/plumber', description: 'Individual plumber performance' },
      { name: 'combined', endpoint: '/api/reports/combined', description: 'Combined plumber comparison' }
    ],
    message: 'Available report endpoints',
    timestamp: new Date().toISOString()
  });
});

// Constants matching your Python report logic
const BILLABLE_RATE = 120; // $120/hour billable rate
const LEAD_PLUMBER_RATES = {
  'Lorin': 35,  // $35/hour
  'Wes': 35,    // $35/hour  
  'Elijah': 35  // $35/hour
};
const SUPPORT_PLUMBER_RATE = 25; // $25/hour
const FIXED_OVERHEAD_RATE = 15;  // $15/hour

// Helper function to generate monthly data for a plumber
function generatePlumberMonthlyData(plumber, startYear = 2025) {
  const months = [];
  const currentDate = new Date();
  
  // Generate data for each month from start year to current month
  for (let month = 0; month <= currentDate.getMonth(); month++) {
    const d = new Date(startYear, month, 1);
    const monthStr = d.toISOString().slice(0, 7); // YYYY-MM format
    
    // Simulate realistic hours (this would come from actual Jobber data)
    let invoicedHours = 0;
    let workedHours = 0;
    
    // Elijah started in July 2025
    if (plumber === 'Elijah' && month < 6) { // July is month 6 (0-based)
      // No hours before July 2025
      invoicedHours = 0;
      workedHours = 0;
    } else {
      // Simulate monthly hours based on typical plumber workload
      const baseWorkedHours = 140 + (Math.random() * 40); // 140-180 hours per month
      const efficiency = 0.75 + (Math.random() * 0.2); // 75-95% efficiency
      
      workedHours = Math.round(baseWorkedHours);
      invoicedHours = Math.round(baseWorkedHours * efficiency);
    }
    
    // Calculate profitability metrics
    const leadRate = LEAD_PLUMBER_RATES[plumber] || 35;
    const totalHourlyCost = leadRate + SUPPORT_PLUMBER_RATE + FIXED_OVERHEAD_RATE;
    const revenue = invoicedHours * BILLABLE_RATE;
    const totalCost = workedHours * totalHourlyCost;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const utilization = workedHours > 0 ? (invoicedHours / workedHours) * 100 : 0;
    
    months.push({
      month: monthStr,
      invoicedHours,
      workedHours,
      profit: Math.round(profit),
      margin: Math.round(margin * 10) / 10, // Round to 1 decimal
      utilization: Math.round(utilization * 10) / 10, // Round to 1 decimal
      revenue: Math.round(revenue),
      totalCost: Math.round(totalCost)
    });
  }
  
  return months;
}

// Helper function to calculate year-to-date summary
function calculateYTDSummary(monthlyData, plumber) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-based (0 = January, 8 = September)
  
  // For Elijah, only calculate from July onwards
  let activeData = monthlyData;
  let periodLabel = '';
  
  if (plumber === 'Elijah') {
    activeData = monthlyData.filter(d => d.month >= '2025-07');
    const endMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonth];
    periodLabel = `Jul-${endMonth} ${currentYear}`;
  } else {
    const endMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonth];
    periodLabel = `Jan-${endMonth} ${currentYear}`;
  }
  
  const totalInvoicedHours = activeData.reduce((sum, d) => sum + d.invoicedHours, 0);
  const totalWorkedHours = activeData.reduce((sum, d) => sum + d.workedHours, 0);
  const totalProfit = activeData.reduce((sum, d) => sum + d.profit, 0);
  const totalRevenue = activeData.reduce((sum, d) => sum + d.revenue, 0);
  
  const avgUtilization = totalWorkedHours > 0 ? (totalInvoicedHours / totalWorkedHours) * 100 : 0;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  
  return {
    totalInvoicedHours: Math.round(totalInvoicedHours * 10) / 10,
    totalWorkedHours: Math.round(totalWorkedHours * 10) / 10,
    totalProfit: Math.round(totalProfit),
    totalRevenue: Math.round(totalRevenue),
    avgMargin: Math.round(avgMargin * 10) / 10,
    avgUtilization: Math.round(avgUtilization * 10) / 10,
    periodLabel
  };
}

// Individual plumber report endpoint
app.get('/api/reports/plumber', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Plumber name is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate plumber name
    const validPlumbers = ['Lorin', 'Wes', 'Elijah'];
    if (!validPlumbers.includes(name)) {
      return res.status(400).json({
        success: false,
        error: `Invalid plumber name. Must be one of: ${validPlumbers.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`ðŸ“Š Generating ${name}'s report...`);
    
    // Generate monthly data (in production, this would query actual Jobber data)
    const monthlyData = generatePlumberMonthlyData(name);
    const summary = calculateYTDSummary(monthlyData, name);
    
    res.json({
      success: true,
      data: monthlyData,
      summary: summary,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`âŒ Plumber report error for ${req.query.name}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Combined plumber comparison report endpoint
app.get('/api/reports/combined', async (req, res) => {
  try {
    console.log('ðŸ“Š Generating combined plumber comparison report...');
    
    const plumbers = ['Lorin', 'Wes', 'Elijah'];
    const combinedData = [];
    
    // Generate data for all plumbers
    plumbers.forEach(plumber => {
      const monthlyData = generatePlumberMonthlyData(plumber);
      monthlyData.forEach(monthData => {
        combinedData.push({
          ...monthData,
          plumber
        });
      });
    });
    
    res.json({
      success: true,
      data: combinedData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('âŒ Combined report error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// OAuth callback endpoint
// OAuth callback logging middleware (runs before React routing)
app.get('/auth/callback', (req, res, next) => {
  const { code, state } = req.query;
  const host = req.get('host');
  const referer = req.get('referer');
  const forwardedFor = req.get('x-forwarded-for');
  console.log('OAuth callback received:', {
    code: code ? (String(code).substring(0, 10) + '...') : null,
    state,
    host,
    referer,
    forwardedFor,
    originalUrl: req.originalUrl
  });

  // Serve the React app to handle OAuth callback
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Some OAuth providers (and your updated Jobber app settings) may send users to /auth instead of /auth/callback
// Provide an alias so both work without 404.
app.get('/auth', (req, res) => {
  const { code, state } = req.query;
  console.log('OAuth auth route accessed:', {
    code: code ? (String(code).substring(0, 10) + '...') : null,
    state,
    host: req.get('host'),
    originalUrl: req.originalUrl
  });

  // Serve the React app to handle OAuth callback
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Token exchange endpoint
app.post('/auth/token', async (req, res) => {
  const { code, state } = req.body;
  console.log('POST /auth/token received body:', { code: code ? (String(code).substring(0,10) + '...') : null, state });

  if (!code) {
    console.log('âŒ Missing code in request');
    return res.status(400).json({ error: 'missing_code' });
  }

  // For testing purposes, if the code starts with "test_", return a mock response
  if (code.startsWith('test_')) {
    console.log('ðŸ§ª Test code detected, returning mock response');
    return res.json({ 
      accountName: 'Test Account',
      message: 'Mock authentication successful'
    });
  }

  const tokenEndpoint = (process.env.JOBBER_API_URL || 'https://api.getjobber.com/api') + '/oauth/token';

  // Validate client id/secret present
  const clientId = process.env.JOBBER_CLIENT_ID;
  const clientSecret = process.env.JOBBER_CLIENT_SECRET;
  const redirectUri = process.env.CLIENT_APP_ORIGIN ? (process.env.CLIENT_APP_ORIGIN + '/auth') : (process.env.CLIENT_APP_ORIGIN || 'http://localhost:3000/auth');

  if (!clientId || !clientSecret) {
    console.error('âŒ Missing JOBBER_CLIENT_ID or JOBBER_CLIENT_SECRET in env');
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  console.log('ðŸ”„ Starting token exchange with Jobber...');
  console.log('ðŸ“ Token endpoint:', tokenEndpoint);
  console.log('ðŸ”‘ Client ID:', clientId.substring(0, 8) + '...');
  console.log('ðŸ”„ Redirect URI:', redirectUri);

  try {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    // Use the backend-configured client origin + /auth as the redirect URI per Jobber docs
    const redirectToSend = process.env.CLIENT_APP_ORIGIN ? `${process.env.CLIENT_APP_ORIGIN}/auth` : redirectUri;
    params.append('redirect_uri', redirectToSend);

    // Prefer global fetch (Node 18+). Fall back to node-fetch if not present.
    let fetchFn = global.fetch;
    if (!fetchFn) {
      try {
        // node-fetch v2/v3 compatibility
        fetchFn = require('node-fetch');
      } catch (e) {
        console.error('fetch not available and node-fetch not installed');
        return res.status(500).json({ error: 'fetch_unavailable' });
      }
    }

    console.log('ðŸ”„ Making request to Jobber token endpoint...');
    const resp = await fetchFn(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    console.log('ðŸ“¥ Received response from Jobber:', resp.status);

    let data;
    try {
      data = await resp.json();
    } catch (parseErr) {
      // If JSON parsing fails, get the raw text response
      const text = await resp.text();
      console.error('âŒ Jobber token endpoint returned non-JSON response', resp.status, text);
      return res.status(502).json({ error: 'token_exchange_failed', details: { status: resp.status, message: text } });
    }

    if (!resp.ok) {
      console.error('âŒ Jobber token endpoint error', resp.status, data);
      return res.status(502).json({ error: 'token_exchange_failed', details: data });
    }

    console.log('âœ… Token exchange successful');
    console.log('ðŸŽ« Received access_token:', data.access_token ? (data.access_token.substring(0, 10) + '...') : 'missing');

    // data should contain access_token and refresh_token
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;

    if (!accessToken) {
      console.error('âŒ No access_token returned from Jobber', data);
      return res.status(502).json({ error: 'no_access_token', details: data });
    }

    // Use the access token to query Jobber GraphQL for account info
    console.log('ðŸ”„ Querying Jobber GraphQL for account info...');
    try {
      const graphqlEndpoint = (process.env.JOBBER_API_URL || 'https://api.getjobber.com/api') + '/graphql';
      const accountQuery = JSON.stringify({ query: '{ account { id name } }' });

      let fetchFn = global.fetch;
      if (!fetchFn) {
        fetchFn = require('node-fetch');
      }

    const graphqlVersion = process.env.JOBBER_GRAPHQL_VERSION || '2025-01-20';
      console.log('ðŸ“ GraphQL endpoint:', graphqlEndpoint);
      console.log('ðŸ·ï¸ GraphQL version:', graphqlVersion);

      console.log('ðŸ”„ Making GraphQL request to Jobber...');
      const gResp = await fetchFn(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-JOBBER-GRAPHQL-VERSION': graphqlVersion
        },
        body: accountQuery,
      });

      console.log('ðŸ“¥ Received GraphQL response:', gResp.status);
      const gData = await gResp.json();
      const account = gData?.data?.account;

      if (!account) {
        console.error('âŒ Unable to fetch account info from Jobber', gData);
        return res.status(502).json({ error: 'account_query_failed', details: gData });
      }

      console.log('âœ… Account info retrieved:', { id: account.id, name: account.name });

      // Persist tokens server-side in a simple local store (tokens.json)
      try {
        const storePath = path.join(__dirname, 'tokens.json');
        let store = {};
        if (fs.existsSync(storePath)) {
          try { store = JSON.parse(fs.readFileSync(storePath, 'utf8') || '{}'); } catch(e) { store = {}; }
        }

        store[account.id] = {
          accountName: account.name,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: data.expires_in || null,
          obtained_at: new Date().toISOString()
        };

        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
        console.log('ðŸ’¾ Tokens persisted to:', storePath);
      } catch (storeErr) {
        console.error('âŒ Failed to persist tokens', storeErr);
        // not fatal for the flow â€” continue
      }

      // Return a lightweight account object to the frontend (do not include tokens)
      console.log('âœ… OAuth flow completed successfully');
      const userResponse = { accountName: account.name };
      console.log('ðŸ“¤ Sending to frontend:', userResponse);
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

// API metadata endpoint (moved off '/')
app.get('/api', (req, res) => {
  res.json({
    message: 'Jobber Reporting API',
    endpoints: ['/api/health', '/api/reports', '/api/reports/plumber?name=Lorin', '/api/reports/combined', '/auth/callback', '/auth/token'],
    timestamp: new Date().toISOString(),
    jobber_config: {
      client_id: process.env.JOBBER_CLIENT_ID ? 'configured' : 'missing',
      api_url: process.env.JOBBER_API_URL
    }
  });
});

// Root now serves the React application (so visiting http://localhost:3000 loads UI)
app.get('/', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  // Fallback JSON if build missing
  res.status(503).json({ error: 'Frontend build not found. Run "npm run build" in frontend.', timestamp: new Date().toISOString() });
});

// Catch-all handler: serve React app for client-side routing
app.get(/^\/(?!api).*/, (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend build not found. Please run "npm run build" in the frontend directory.' });
  }
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(' Jobber API server running on http://0.0.0.0:' + port);
  console.log(' Frontend origin: ' + (process.env.CLIENT_APP_ORIGIN || 'http://localhost:3000'));
  console.log(' Jobber Client ID: ' + (process.env.JOBBER_CLIENT_ID ? 'configured' : 'missing'));
  try {
    const addr = server.address();
    console.log(' Server address info:', addr);
  } catch (e) {
    console.log(' Unable to read server.address()', e);
  }
});

setTimeout(() => {
  console.log(' Post-start 1500ms tick - server should still be alive');
}, 1500);

setTimeout(() => {
  console.log(' Post-start 5000ms tick - server still alive');
}, 5000);

// Exit / signal diagnostics
process.on('exit', (code) => {
  console.log(' Process exit event code=', code);
});

// Global error handlers to prevent silent exits and aid diagnostics
process.on('unhandledRejection', (reason, promise) => {
  console.error(' Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error(' Uncaught Exception:', err);
});

// Optional keep-alive heartbeat to detect unexpected termination in logs
setInterval(() => {
  if (process.env.ENABLE_HEARTBEAT === 'true') {
    console.log(' Heartbeat: server alive', new Date().toISOString());
  }
}, 60000);

console.log('[TRACE] server.js completed top-level execution at', new Date().toISOString());
