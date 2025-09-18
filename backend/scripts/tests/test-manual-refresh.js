require('dotenv').config();
const JobberAPIService = require('./JobberAPIService');

async function testManualRefresh() {
  console.log('🔄 Testing manual token refresh...');
  
  try {
    const jobberAPI = new JobberAPIService();
    console.log('✅ JobberAPIService created');
    
    // Load current tokens
    const currentTokens = jobberAPI.loadTokens();
    console.log('Current tokens loaded:', {
      hasAccessToken: !!currentTokens.access_token,
      hasRefreshToken: !!currentTokens.refresh_token,
      createdAt: currentTokens.created_at
    });
    
    // Try manual refresh using refresh token
    console.log('🔄 Manually refreshing token...');
    const newTokens = await jobberAPI.refreshAccessToken(currentTokens.refresh_token);
    console.log('✅ Manual refresh successful');
    console.log('New tokens:', {
      hasAccessToken: !!newTokens.access_token,
      hasRefreshToken: !!newTokens.refresh_token,
      createdAt: newTokens.created_at
    });
    
    // Now try to get account info
    console.log('🔍 Testing account info with new token...');
    const account = await jobberAPI.getFirstValidAccount();
    console.log('✅ Account info retrieved:', account);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testManualRefresh();