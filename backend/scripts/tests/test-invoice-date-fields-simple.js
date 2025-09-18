// Test script to explore available invoice date fields
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
        
        console.log('[DATE-TEST] Testing query with sentAt and dueAt fields...');
        
        const result = await jobberApi.query(testQuery, {});
        
        if (result && result.invoices && result.invoices.edges.length > 0) {
            const invoice = result.invoices.edges[0].node;
            console.log('[DATE-TEST] SUCCESS: All date fields are available!');
            console.log('[DATE-TEST] Invoice Number:', invoice.invoiceNumber);
            console.log('[DATE-TEST] createdAt:', invoice.createdAt);
            console.log('[DATE-TEST] sentAt:', invoice.sentAt);
            console.log('[DATE-TEST] dueAt:', invoice.dueAt);
            
            // Analyze the dates to understand their meaning
            console.log('\n[DATE-TEST] Date Analysis:');
            if (invoice.createdAt) console.log('[DATE-TEST] Created Date (createdAt):', new Date(invoice.createdAt).toLocaleDateString());
            if (invoice.sentAt) console.log('[DATE-TEST] Sent Date (sentAt):', invoice.sentAt ? new Date(invoice.sentAt).toLocaleDateString() : 'Not sent');
            if (invoice.dueAt) console.log('[DATE-TEST] Due Date (dueAt):', invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : 'No due date');
            
        } else {
            console.log('[DATE-TEST] No invoices found in response');
        }
        
    } catch (error) {
        console.error('[DATE-TEST] Error testing full query:', error.message);
        
        // If sentAt/dueAt don't exist, try with just createdAt
        console.log('[DATE-TEST] Trying query with only createdAt field...');
        
        try {
            const jobberApi = new JobberAPIService();
            const tokens = jobberApi.loadTokens();
            jobberApi.initializeClient(tokens.access_token);
            
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
            
            const basicResult = await jobberApi.query(basicQuery, {});
            console.log('[DATE-TEST] Basic query successful - only createdAt is available');
            
            if (basicResult && basicResult.invoices && basicResult.invoices.edges.length > 0) {
                const invoice = basicResult.invoices.edges[0].node;
                console.log('[DATE-TEST] Invoice Number:', invoice.invoiceNumber);
                console.log('[DATE-TEST] createdAt:', invoice.createdAt);
                console.log('[DATE-TEST] Created Date:', new Date(invoice.createdAt).toLocaleDateString());
            }
            
        } catch (basicError) {
            console.error('[DATE-TEST] Basic query also failed:', basicError.message);
        }
    }
}

// Run the test
testInvoiceDateFields().catch(console.error);