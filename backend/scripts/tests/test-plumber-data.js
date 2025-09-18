const JobberAPIService = require('./JobberAPIService');

async function testPlumberData() {
  console.log('🧪 Testing plumber performance data from Jobber API...');
  
  try {
    const service = new JobberAPIService();
    
    // Use the fresh token directly
    const freshToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjIxMTM4NjksImlzcyI6Imh0dHBzOi8vYXBpLmdldGpvYmJlci5jb20iLCJjbGllbnRfaWQiOiI1MmU5ZmE1MS05Zjk5LTQ5ZWUtYjkxZi05NjkwYTQ1MTRhOWUiLCJzY29wZSI6InJlYWRfY2xpZW50cyByZWFkX2pvYnMgcmVhZF9pbnZvaWNlcyByZWFkX2pvYmJlcl9wYXltZW50cyByZWFkX3VzZXJzIHJlYWRfZXhwZW5zZXMgcmVhZF9jdXN0b21fZmllbGRfY29uZmlndXJhdGlvbnMgcmVhZF90aW1lX3NoZWV0cyIsImFwcF9pZCI6IjUyZTlmYTUxLTlmOTktNDllZS1iOTFmLTk2OTBhNDUxNGE5ZSIsInVzZXJfaWQiOjIxMTM4NjksImFjY291bnRfaWQiOjUwMTUxMywiZXhwIjoxNzU3ODkwNTQwfQ.EDcbZcnww1ER60XzuQ55h_aeFN8sda2cqAyOWdE9cpc";
    
    // Test 1: Get users (plumbers)
    console.log('\n🔍 Querying users (plumbers)...');
    const usersQuery = `
      query {
        users(first: 5) {
          edges {
            node {
              id
              name {
                first
                last
              }
            }
          }
        }
      }
    `;
    
    const usersResult = await service.queryDirect(usersQuery, freshToken);
    
    if (usersResult.users && usersResult.users.edges.length > 0) {
      console.log('✅ Users found:', usersResult.users.edges.length);
      usersResult.users.edges.forEach((edge, index) => {
        const user = edge.node;
        const fullName = `${user.name.first} ${user.name.last}`;
        console.log(`  ${index + 1}. ${fullName} (ID: ${user.id})`);
      });
    } else {
      console.log('⚠️ No users found');
    }
    
    // Test 2: Get recent jobs 
    console.log('\n🔍 Querying recent jobs...');
    const jobsQuery = `
      query {
        jobs(first: 5) {
          edges {
            node {
              id
              jobNumber
              title
              jobStatus
              startAt
              client {
                id
                name
              }
            }
          }
        }
      }
    `;
    
    const jobsResult = await service.queryDirect(jobsQuery, freshToken);
    
    if (jobsResult.jobs && jobsResult.jobs.edges.length > 0) {
      console.log('✅ Jobs found:', jobsResult.jobs.edges.length);
      jobsResult.jobs.edges.forEach((edge, index) => {
        const job = edge.node;
        console.log(`  ${index + 1}. Job #${job.jobNumber}: ${job.title}`);
        console.log(`     Status: ${job.jobStatus}, Start: ${job.startAt || 'N/A'}`);
        if (job.client) {
          console.log(`     Client: ${job.client.name}`);
        }
      });
    } else {
      console.log('⚠️ No jobs found');
    }
    
    // Test 3: Get invoices for revenue data
    console.log('\n🔍 Querying recent invoices...');
    const invoicesQuery = `
      query {
        invoices(first: 3) {
          edges {
            node {
              id
              invoiceNumber
              total
            }
          }
        }
      }
    `;
    
    const invoicesResult = await service.queryDirect(invoicesQuery, freshToken);
    
    if (invoicesResult.invoices && invoicesResult.invoices.edges.length > 0) {
      console.log('✅ Invoices found:', invoicesResult.invoices.edges.length);
      invoicesResult.invoices.edges.forEach((edge, index) => {
        const invoice = edge.node;
        console.log(`  ${index + 1}. Invoice #${invoice.invoiceNumber}: $${invoice.total}`);
      });
    } else {
      console.log('⚠️ No invoices found');
    }
    
    console.log('\n🎉 Plumber data test completed successfully!');
    
  } catch (error) {
    console.log('❌ Plumber data test failed:', error.message);
    
    if (error.response && error.response.errors) {
      console.log('📄 GraphQL errors:');
      error.response.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. ${err.message}`);
      });
    }
  }
}

testPlumberData();