const JobberAPIService = require('./JobberAPIService');

async function testJobSchema() {
  console.log('🔍 Testing Job schema fields...');
  
  try {
    const service = new JobberAPIService();
    const freshToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjIxMTM4NjksImlzcyI6Imh0dHBzOi8vYXBpLmdldGpvYmJlci5jb20iLCJjbGllbnRfaWQiOiI1MmU5ZmE1MS05Zjk5LTQ5ZWUtYjkxZi05NjkwYTQ1MTRhOWUiLCJzY29wZSI6InJlYWRfY2xpZW50cyByZWFkX2pvYnMgcmVhZF9pbnZvaWNlcyByZWFkX2pvYmJlcl9wYXltZW50cyByZWFkX3VzZXJzIHJlYWRfZXhwZW5zZXMgcmVhZF9jdXN0b21fZmllbGRfY29uZmlndXJhdGlvbnMgcmVhZF90aW1lX3NoZWV0cyIsImFwcF9pZCI6IjUyZTlmYTUxLTlmOTktNDllZS1iOTFmLTk2OTBhNDUxNGE5ZSIsInVzZXJfaWQiOjIxMTM4NjksImFjY291bnRfaWQiOjUwMTUxMywiZXhwIjoxNzU3ODkwNTQwfQ.EDcbZcnww1ER60XzuQ55h_aeFN8sda2cqAyOWdE9cpc";
    
    // Test with minimal Job fields to see what's available
    const jobsQuery = `
      query {
        jobs(first: 3) {
          edges {
            node {
              id
              jobNumber
              title
              jobStatus
              startAt
            }
          }
        }
      }
    `;
    
    const result = await service.queryDirect(jobsQuery, freshToken);
    
    if (result.jobs && result.jobs.edges.length > 0) {
      console.log('✅ Jobs found:', result.jobs.edges.length);
      result.jobs.edges.forEach((edge, index) => {
        const job = edge.node;
        console.log(`  ${index + 1}. Job #${job.jobNumber}: ${job.title}`);
        console.log(`     Status: ${job.jobStatus}, Start: ${job.startAt || 'N/A'}`);
      });
    } else {
      console.log('⚠️ No jobs found');
    }
    
  } catch (error) {
    console.log('❌ Job schema test failed:', error.message);
    
    if (error.response && error.response.errors) {
      console.log('📄 GraphQL errors:');
      error.response.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. ${err.message}`);
      });
    }
  }
}

testJobSchema();