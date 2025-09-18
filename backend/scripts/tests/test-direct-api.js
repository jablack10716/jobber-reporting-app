const JobberAPIService = require('./JobberAPIService');

async function testDirectAPI() {
  console.log('🧪 Testing direct API call with fresh token...');
  
  try {
    const service = new JobberAPIService();
    
    // Use the fresh token directly without going through the stored token logic
    const freshToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjIxMTM4NjksImlzcyI6Imh0dHBzOi8vYXBpLmdldGpvYmJlci5jb20iLCJjbGllbnRfaWQiOiI1MmU5ZmE1MS05Zjk5LTQ5ZWUtYjkxZi05NjkwYTQ1MTRhOWUiLCJzY29wZSI6InJlYWRfY2xpZW50cyByZWFkX2pvYnMgcmVhZF9pbnZvaWNlcyByZWFkX2pvYmJlcl9wYXltZW50cyByZWFkX3VzZXJzIHJlYWRfZXhwZW5zZXMgcmVhZF9jdXN0b21fZmllbGRfY29uZmlndXJhdGlvbnMgcmVhZF90aW1lX3NoZWV0cyIsImFwcF9pZCI6IjUyZTlmYTUxLTlmOTktNDllZS1iOTFmLTk2OTBhNDUxNGE5ZSIsInVzZXJfaWQiOjIxMTM4NjksImFjY291bnRfaWQiOjUwMTUxMywiZXhwIjoxNzU3ODkwNTQwfQ.EDcbZcnww1ER60XzuQ55h_aeFN8sda2cqAyOWdE9cpc";
    
    service.initializeClient(freshToken);
    
    // Simple account query with only valid fields
    const accountQuery = `
      query {
        account {
          id
          name
        }
      }
    `;
    
    console.log('🔍 Querying account information directly...');
    const result = await service.queryDirect(accountQuery, freshToken);
    
    if (result.account) {
      console.log('✅ Real data connection successful!');
      console.log('🏢 Account:', result.account.name);
      console.log('🆔 Account ID:', result.account.id);
    } else {
      console.log('⚠️ Query succeeded but no account data returned');
      console.log('📝 Full result:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.log('❌ API connection failed:', error.message);
    
    if (error.response) {
      console.log('📄 Response status:', error.response.status);
      console.log('📄 Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testDirectAPI();