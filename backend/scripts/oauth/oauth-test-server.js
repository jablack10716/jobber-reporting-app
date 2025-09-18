require('dotenv').config();
const express = require('express');
const JobberAPIService = require('./JobberAPIService');

const app = express();
const port = 3001;

console.log('🔧 Starting minimal OAuth server for testing...');

// Basic static route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>OAuth Test Server</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; text-align: center;">
        <h1>🔑 OAuth Test Server</h1>
        <p>Server is running on port ${port}</p>
        <p><a href="/health">Health Check</a></p>
      </body>
    </html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OAuth test server running', 
    port,
    timestamp: new Date().toISOString()
  });
});

// OAuth callback endpoint
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log('[OAUTH-TEST] Callback received:', { 
    code: code ? 'present' : 'missing', 
    state: state || 'none',
    query: req.query 
  });
  
  if (!code) {
    console.log('[OAUTH-TEST] ❌ No authorization code provided');
    return res.status(400).send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; text-align: center;">
          <h1 style="color: red;">❌ Missing Authorization Code</h1>
          <p>The OAuth callback did not include an authorization code.</p>
          <p><a href="/">Back to Home</a></p>
        </body>
      </html>
    `);
  }

  try {
    console.log('[OAUTH-TEST] 🔄 Starting token exchange with corrected content type...');
    const jobberAPI = new JobberAPIService();
    const tokens = await jobberAPI.exchangeCodeForToken(code);
    
    console.log('[OAUTH-TEST] ✅ Token exchange successful!');
    console.log('[OAUTH-TEST] 💾 Tokens saved to:', jobberAPI.tokenStoragePath);
    
    res.send(`
      <html>
        <head><title>OAuth Success</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; text-align: center;">
          <h1 style="color: green;">✅ Authentication Successful!</h1>
          <p><strong>Token exchange completed using corrected content type:</strong></p>
          <ul style="text-align: left; max-width: 400px; margin: 20px auto;">
            <li>✅ Used application/x-www-form-urlencoded</li>
            <li>✅ Followed Jobber's documented OAuth flow</li>
            <li>✅ Tokens saved successfully</li>
          </ul>
          <p><strong>Next steps:</strong></p>
          <ol style="text-align: left; max-width: 400px; margin: 20px auto;">
            <li>Stop this test server (Ctrl+C)</li>
            <li>Test real API queries with new tokens</li>
            <li>Start main application server</li>
          </ol>
          <p><em>Token created: ${new Date().toLocaleString()}</em></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[OAUTH-TEST] ❌ Token exchange failed:', error.message);
    res.status(500).send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; text-align: center;">
          <h1 style="color: red;">❌ Token Exchange Failed</h1>
          <p><strong>Error:</strong> ${error.message}</p>
          <p>This may indicate the content type fix didn't resolve the issue.</p>
          <p><a href="/">Back to Home</a></p>
        </body>
      </html>
    `);
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 OAuth test server running on http://localhost:${port}`);
  console.log('');
  console.log('📋 Ready for OAuth callback test');
  console.log('✅ Content type corrected to application/x-www-form-urlencoded');
  console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 OAuth test server stopped');
  process.exit(0);
});