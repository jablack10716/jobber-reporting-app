require('dotenv').config();
const JobberAPIService = require('./JobberAPIService');

async function testTokenRefresh() {
  console.log('🔄 Testing token refresh...');
  
  try {
    const jobberAPI = new JobberAPIService();
    console.log('✅ JobberAPIService created');
    
    // This should automatically refresh the expired token
    console.log('🔄 Ensuring valid token (should refresh expired token)...');
    const tokens = await jobberAPI.ensureValidToken();
    console.log('✅ Token refreshed successfully');
    console.log('New token expires:', tokens.created_at);
    
    // Now try to get account info
    console.log('🔍 Testing account info retrieval...');
    const account = await jobberAPI.getFirstValidAccount();
    console.log('✅ Account info retrieved:', account);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testTokenRefresh();