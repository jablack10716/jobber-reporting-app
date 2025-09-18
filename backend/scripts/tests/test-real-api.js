require('dotenv').config();
const JobberAPIService = require('./JobberAPIService');

async function testRealData() {
  console.log('🧪 Testing Jobber API connection...');
  
  try {
    const service = new JobberAPIService();
    
    // Load existing tokens
    const tokens = service.loadTokens();
    if (!tokens) {
      console.log('❌ No tokens found - need to authenticate first');
      return;
    }
    
    console.log('✅ Tokens loaded');
    console.log('📅 Token created:', tokens.created_at);
    
    // Initialize client with tokens
    service.initializeClient(tokens.access_token);
    
    // Try to get account info as a simple test
    const accountQuery = `
      query {
        account {
          id
          name
          email
          timeZone
        }
      }
    `;
    
    console.log('🔍 Querying account information...');
    const result = await service.query(accountQuery);
    
    if (result.account) {
      console.log('✅ Real data connection successful!');
      console.log('🏢 Account:', result.account.name);
      console.log('� Email:', result.account.email);
      console.log('🌐 TimeZone:', result.account.timeZone);
    } else {
      console.log('⚠️ Query succeeded but no account data returned');
    }
    
  } catch (error) {
    console.log('❌ API connection failed:', error.message);
    
    // Check if it's a token expiration issue
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('🔑 Token may be expired - need to refresh or re-authenticate');
    }
  }
}

testRealData();