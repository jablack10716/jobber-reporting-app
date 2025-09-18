// Test script to explore available invoice date fields
// This will help us determine if we should use sentAt, dueAt, or createdAt

const JobberAPIService = require('./JobberAPIService');

async function testInvoiceDateFields() {
    console.log('[DATE-TEST] Starting invoice date field exploration...');
    
    try {
        const jobberApi = new JobberAPIService();
        
        // Load tokens and initialize client
        const tokens = jobberApi.loadTokens();
        if (!tokens || !tokens.access_token) {
            throw new Error('No access token available');
        }
        
        jobberApi.initializeClient(tokens.access_token);
        
        // Test query to get a single invoice with all possible date fields
        const testQuery = `
            query {
              invoices(first: 1) {
                edges {
                  node {
                    id
                    invoiceNumber
                    createdAt
                    sentAt
                    dueAt
                    total
                  }
                }
              }
            }
        `;
        
        console.log('[DATE-TEST] Executing test query to check available date fields...');
        
        const result = await jobberApi.query(testQuery, {});
        
        if (result && result.invoices && result.invoices.edges.length > 0) {
            const invoice = result.invoices.edges[0].node;
            console.log('[DATE-TEST] Sample invoice date fields:');
            console.log('[DATE-TEST] Invoice Number:', invoice.invoiceNumber);
            console.log('[DATE-TEST] createdAt:', invoice.createdAt);
            console.log('[DATE-TEST] sentAt:', invoice.sentAt);
            console.log('[DATE-TEST] dueAt:', invoice.dueAt);
        } else {
            console.log('[DATE-TEST] No invoices found in response');
        }
        
    } catch (error) {
        console.error('[DATE-TEST] Error:', error.message);
        
        // If the query fails, it might be because some fields don't exist
        // Let's try a more basic query
        console.log('[DATE-TEST] Trying basic query with only createdAt...');
        
        try {
            const jobberApi = new JobberAPIService();
            const basicQuery = `
                query {
                  invoices(first: 1) {
                    edges {
                      node {
                        id
                        invoiceNumber
                        createdAt
                        total
                      }
                    }
                  }
                }
            `;
            
            const basicResult = await jobberApi.request(basicQuery, {});
            console.log('[DATE-TEST] Basic query successful - createdAt is available');
            
            if (basicResult && basicResult.invoices && basicResult.invoices.edges.length > 0) {
                const invoice = basicResult.invoices.edges[0].node;
                console.log('[DATE-TEST] Sample invoice with createdAt:');
                console.log('[DATE-TEST] Invoice Number:', invoice.invoiceNumber);
                console.log('[DATE-TEST] createdAt:', invoice.createdAt);
            }
            
        } catch (basicError) {
            console.error('[DATE-TEST] Basic query also failed:', basicError.message);
        }
    }
}

// Run the test
testInvoiceDateFields().catch(console.error);