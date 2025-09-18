require('dotenv').config();
const JobberAPIService = require('./JobberAPIService');

async function testSimpleRealData() {
  console.log('🔍 Testing simple real data query (no custom fields)...');
  
  try {
    const jobberAPI = new JobberAPIService();
    console.log('✅ JobberAPIService created');
    
    // Test 1: Simple account info (should work)
    console.log('🔄 Step 1: Testing account info...');
    try {
      const account = await jobberAPI.getFirstValidAccount();
      console.log('✅ Account info retrieved:', account);
    } catch (error) {
      console.error('❌ Account info failed:', error.message);
      // This is expected if OAuth tokens are expired
      if (error.message.includes('401') || error.message.includes('Token')) {
        console.log('ℹ️  OAuth tokens need refresh - this is expected');
      } else {
        throw error;
      }
    }
    
    // Test 2: Simple invoice query without customFields
    console.log('🔄 Step 2: Testing simple invoice query...');
    const simpleInvoiceQuery = `
      query {
        invoices(first: 5) {
          edges {
            node {
              id
              invoiceNumber
              total
              createdAt
              client {
                companyName
                firstName
                lastName
              }
            }
          }
        }
      }
    `;
    
    try {
      const result = await jobberAPI.query(simpleInvoiceQuery);
      console.log('✅ Simple invoice query successful');
      console.log('Invoice count:', result.invoices.edges.length);
      if (result.invoices.edges.length > 0) {
        console.log('Sample invoice:', {
          number: result.invoices.edges[0].node.invoiceNumber,
          total: result.invoices.edges[0].node.total,
          client: result.invoices.edges[0].node.client.companyName || 
                  `${result.invoices.edges[0].node.client.firstName} ${result.invoices.edges[0].node.client.lastName}`
        });
      }
    } catch (error) {
      console.error('❌ Invoice query failed:', error.message);
      if (error.message.includes('401') || error.message.includes('Token')) {
        console.log('ℹ️  OAuth authentication required');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimpleRealData();