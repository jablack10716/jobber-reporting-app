// Test real data integration step by step
const JobberAPIService = require('./JobberAPIService');
require('dotenv').config();

async function testRealDataStep() {
  console.log('🔍 Testing real data integration...');
  
  try {
    // Step 1: Check OAuth
    const jobberAPI = new JobberAPIService();
    console.log('✅ JobberAPIService created');
    
    // Step 2: Get account
    const account = await jobberAPI.getFirstValidAccount();
    console.log('✅ Got valid account:', account?.id);
    
    // Step 3: Test simple query (no customFields)
    const simpleQuery = `
      query {
        invoices(first: 2) {
          edges {
            node {
              id
              invoiceNumber
              total
              createdAt
            }
          }
        }
      }
    `;
    
    console.log('🔍 Testing simple query...');
    const result = await jobberAPI.query(simpleQuery);
    console.log('✅ Simple query success! Got', result.invoices.edges.length, 'invoices');
    
    // Step 4: Test with client info (might cause issue)
    const clientQuery = `
      query {
        invoices(first: 2) {
          edges {
            node {
              id
              invoiceNumber
              total
              createdAt
              client {
                id
                companyName
              }
            }
          }
        }
      }
    `;
    
    console.log('🔍 Testing query with client info...');
    const result2 = await jobberAPI.query(clientQuery);
    console.log('✅ Client query success! Got', result2.invoices.edges.length, 'invoices');
    
    console.log('🎯 All tests passed! Real data integration should work.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('📋 GraphQL errors:', JSON.stringify(error.response.errors, null, 2));
    }
  }
}

testRealDataStep();