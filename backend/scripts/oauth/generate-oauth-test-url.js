require('dotenv').config();

console.log('🔑 OAuth Setup for Testing Fixed Token Exchange');
console.log('================================================');
console.log('');

const clientId = process.env.JOBBER_CLIENT_ID;
const redirectUri = encodeURIComponent('http://localhost:3001/auth/callback'); // Test server on 3001
const scope = encodeURIComponent('read_clients read_jobs read_invoices read_jobber_payments read_users read_expenses read_custom_field_configurations read_time_sheets');
const state = Math.random().toString(36).substring(2, 15);

const authUrl = `https://api.getjobber.com/api/oauth/authorize?` +
  `client_id=${clientId}&` +
  `redirect_uri=${redirectUri}&` +
  `response_type=code&` +
  `scope=${scope}&` +
  `state=${state}`;

console.log('📋 Step 1: Start the OAuth test server:');
console.log('   node oauth-test-server.js');
console.log('');
console.log('📋 Step 2: Copy this OAuth URL and paste it in your browser:');
console.log('');
console.log(authUrl);
console.log('');
console.log('📋 Step 3: After authorizing, you will be redirected to:');
console.log('   http://localhost:3001/auth/callback?code=AUTHORIZATION_CODE&state=' + state);
console.log('');
console.log('📋 Step 4: Test server will use corrected content type for token exchange');
console.log('');
console.log('🔧 Test Configuration:');
console.log('   Client ID:', clientId);
console.log('   Test Server: http://localhost:3001/auth/callback');
console.log('   Content Type: application/x-www-form-urlencoded (FIXED!)');
console.log('   Scopes: read_clients, read_jobs, read_invoices, read_jobber_payments, read_users, read_expenses, read_custom_field_configurations, read_time_sheets');
console.log('');
console.log('🔍 What this tests:');
console.log('   ✅ Corrected content type per Jobber docs');
console.log('   ✅ Proper URLSearchParams encoding');
console.log('   ✅ Stable server without OAuth route conflicts');
console.log('');
console.log('⚠️  Important: Clear browser cookies for localhost before starting OAuth flow');