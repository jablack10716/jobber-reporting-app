require('dotenv').config();
const express = require('express');
const JobberAPIService = require('./JobberAPIService');

const app = express();
const port = 3001; // Use different port to avoid conflicts

console.log('🔧 Starting minimal OAuth callback server on port 3001...');

// OAuth callback endpoint only
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log('[OAUTH-SERVER] Received callback:', { code: code ? 'present' : 'missing', state });
  
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    console.log('[OAUTH-SERVER] Exchanging code for tokens...');
    const jobberAPI = new JobberAPIService();
    const tokens = await jobberAPI.exchangeCodeForToken(code);
    
    console.log('[OAUTH-SERVER] ✅ Tokens obtained successfully!');
    console.log('[OAUTH-SERVER] Token saved to:', jobberAPI.tokenStoragePath);
    
    res.send(`
      <html>
        <head><title>OAuth Success</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; text-align: center;">
          <h1 style="color: green;">✅ Authentication Successful!</h1>
          <p>Your Jobber API tokens have been saved successfully.</p>
          <p><strong>Next steps:</strong></p>
          <ol style="text-align: left; max-width: 400px; margin: 20px auto;">
            <li>Close this tab</li>
            <li>Stop this OAuth server (Ctrl+C)</li>
            <li>Start the main server</li>
            <li>Access your reports with real data</li>
          </ol>
          <p><em>Token created: ${new Date().toLocaleString()}</em></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[OAUTH-SERVER] ❌ Token exchange failed:', error.message);
    res.status(500).send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; text-align: center;">
          <h1 style="color: red;">❌ Authentication Failed</h1>
          <p>Error: ${error.message}</p>
          <p><a href="javascript:history.back()">Go Back</a></p>
        </body>
      </html>
    `);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OAuth server running', port });
});

app.listen(port, () => {
  console.log(`🚀 OAuth callback server running on http://localhost:${port}`);
  console.log('');
  console.log('📋 Instructions:');
  console.log('1. Use the OAuth URL from generate-oauth-url.js');
  console.log('2. Change the redirect_uri to: http://localhost:3001/auth/callback');
  console.log('3. Or run: node generate-oauth-url.js and manually edit the URL');
  console.log('');
});