require('dotenv').config();

console.log('🔑 Manual OAuth Setup for Jobber API');
console.log('=====================================');
console.log('');

const clientId = process.env.JOBBER_CLIENT_ID;
const redirectUri = encodeURIComponent('http://localhost:3000/auth/callback');
const scope = encodeURIComponent('read_clients read_jobs read_invoices read_jobber_payments read_users read_expenses read_custom_field_configurations read_time_sheets');
const state = Math.random().toString(36).substring(2, 15);

const authUrl = `https://api.getjobber.com/api/oauth/authorize?` +
  `client_id=${clientId}&` +
  `redirect_uri=${redirectUri}&` +
  `response_type=code&` +
  `scope=${scope}&` +
  `state=${state}`;

console.log('📋 Step 1: Copy this OAuth URL and paste it in your browser:');
console.log('');
console.log(authUrl);
console.log('');
console.log('📋 Step 2: After authorizing, you will be redirected to:');
console.log('   http://localhost:3000/auth/callback?code=AUTHORIZATION_CODE&state=' + state);
console.log('');
console.log('📋 Step 3: Make sure the server is running to handle the callback');
console.log('');
console.log('🔧 Current Configuration:');
console.log('   Client ID:', clientId);
console.log('   Redirect URI:', 'http://localhost:3000/auth/callback');
console.log('   Scopes: read_clients, read_jobs, read_invoices, read_jobber_payments, read_users, read_expenses, read_custom_field_configurations, read_time_sheets');
console.log('');
console.log('⚠️  Important: Make sure your browser cookies for localhost:3000 are cleared before clicking the OAuth URL');