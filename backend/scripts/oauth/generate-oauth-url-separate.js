require('dotenv').config();

console.log('🔑 Manual OAuth Setup for Jobber API (Using OAuth Server)');
console.log('=========================================================');
console.log('');

const clientId = process.env.JOBBER_CLIENT_ID;
const redirectUri = encodeURIComponent('http://localhost:3001/auth/callback'); // Note: port 3001 for OAuth server
const scope = encodeURIComponent('read_clients read_jobs read_invoices read_jobber_payments read_users read_expenses read_custom_field_configurations read_time_sheets');
const state = Math.random().toString(36).substring(2, 15);

const authUrl = `https://api.getjobber.com/api/oauth/authorize?` +
  `client_id=${clientId}&` +
  `redirect_uri=${redirectUri}&` +
  `response_type=code&` +
  `scope=${scope}&` +
  `state=${state}`;

console.log('📋 Step 1: Start the OAuth callback server:');
console.log('   node oauth-server.js');
console.log('');
console.log('📋 Step 2: Copy this OAuth URL and paste it in your browser:');
console.log('');
console.log(authUrl);
console.log('');
console.log('📋 Step 3: After authorizing, you will be redirected to:');
console.log('   http://localhost:3001/auth/callback?code=AUTHORIZATION_CODE&state=' + state);
console.log('');
console.log('📋 Step 4: After successful authentication, stop OAuth server and start main server');
console.log('');
console.log('🔧 Current Configuration:');
console.log('   Client ID:', clientId);
console.log('   OAuth Server: http://localhost:3001/auth/callback');
console.log('   Main Server: http://localhost:3000 (start after OAuth)');
console.log('   Scopes: read_clients, read_jobs, read_invoices, read_jobber_payments, read_users, read_expenses, read_custom_field_configurations, read_time_sheets');
console.log('');
console.log('⚠️  Important: Clear browser cookies for localhost before starting OAuth flow');