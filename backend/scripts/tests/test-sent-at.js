// Test script to verify sentAt field is valid in Jobber API
const JobberAPIService = require('./JobberAPIService');

async function testSentAtField() {
    console.log('[SENT-AT-TEST] Testing sentAt field in invoice queries...');
    
    try {
        // Load environment
        require('dotenv').config();
        
        const jobberApi = new JobberAPIService();
        
        // Load tokens and initialize client
        const tokens = jobberApi.loadTokens();
        if (!tokens || !tokens.access_token) {
            throw new Error('No access token available');
        }
        
        jobberApi.initializeClient(tokens.access_token);
        
        // Test basic invoice query with sentAt field
        const testQuery = `
            query {
              invoices(first: 1) {
                edges {
                  node {
                    id
                    invoiceNumber
                    createdAt
                    sentAt
                    total
                  }
                }
              }
            }
        `;
        
        console.log('[SENT-AT-TEST] Testing basic query with sentAt field...');
        
        const result = await jobberApi.query(testQuery, {});
        
        if (result && result.invoices && result.invoices.edges.length > 0) {
            const invoice = result.invoices.edges[0].node;
            console.log('[SENT-AT-TEST] ✅ SUCCESS: sentAt field is available!');
            console.log('[SENT-AT-TEST] Invoice Number:', invoice.invoiceNumber);
            console.log('[SENT-AT-TEST] createdAt:', invoice.createdAt);
            console.log('[SENT-AT-TEST] sentAt:', invoice.sentAt);
            
            if (invoice.sentAt) {
                console.log('[SENT-AT-TEST] Sent Date:', new Date(invoice.sentAt).toLocaleDateString());
            } else {
                console.log('[SENT-AT-TEST] ⚠️  This invoice has not been sent yet (sentAt is null)');
            }
            
        } else {
            console.log('[SENT-AT-TEST] No invoices found in response');
        }
        
        // Now test filtering by sentAt
        console.log('\n[SENT-AT-TEST] Testing sentAt filtering...');
        
        const filterQuery = `
            query {
              invoices(
                first: 3,
                filter: {
                  sentAt: {
                    after: "2025-08-01"
                    before: "2025-08-31"
                  }
                }
              ) {
                edges {
                  node {
                    invoiceNumber
                    sentAt
                  }
                }
              }
            }
        `;
        
        const filterResult = await jobberApi.query(filterQuery, {});
        
        if (filterResult && filterResult.invoices) {
            console.log(`[SENT-AT-TEST] ✅ sentAt filtering works! Found ${filterResult.invoices.edges.length} invoices sent in August 2025`);
            
            filterResult.invoices.edges.forEach(edge => {
                console.log(`[SENT-AT-TEST] Invoice ${edge.node.invoiceNumber}: sentAt = ${edge.node.sentAt}`);
            });
        }
        
    } catch (error) {
        console.error('[SENT-AT-TEST] ❌ Error:', error.message);
        
        if (error.message.includes('sentAt')) {
            console.log('[SENT-AT-TEST] ❌ sentAt field is not available in the Jobber API');
        }
    }
}

// Run the test
testSentAtField().catch(console.error);