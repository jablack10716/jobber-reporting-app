// Debug script to analyze Wes's August invoiced hours calculation
// Compare current logic vs expected Python reference logic

const https = require('https');
const http = require('http');

async function fetchFromAPI(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(120000, () => reject(new Error('Request timeout')));
  });
}

async function debugWesAugustInvoices() {
  console.log('=== Debugging Wes August 2025 Invoice Hours ===\n');
  
  try {
    // Fetch Wes's report data from the running server
    console.log('Fetching Wes report data from API...');
    const reportData = await fetchFromAPI('http://localhost:3000/api/reports/plumber?name=Wes&year=2025&refresh=1');
    
    // Find August data
    const augustData = reportData.monthlyData.find(month => month.month === '2025-08');
    
    if (!augustData) {
      console.log('❌ No August data found for Wes');
      return;
    }
    
    console.log(`=== CURRENT API RESULTS FOR WES AUGUST ===`);
    console.log(`Invoiced Hours: ${augustData.invoicedHours}`);
    console.log(`Revenue: $${augustData.revenue}`);
    console.log(`Worked Hours: ${augustData.workedHours}`);
    console.log(`Utilization: ${augustData.utilization}%`);
    console.log('');
    
    // Calculate what the invoiced hours would be if using direct quantity method
    const BILLABLE_RATE = 165.0;
    const impliedAdjustedQuantity = augustData.revenue / BILLABLE_RATE;
    
    console.log(`=== CALCULATION ANALYSIS ===`);
    console.log(`Current Method: revenue / billable_rate`);
    console.log(`  $${augustData.revenue} / $${BILLABLE_RATE} = ${augustData.invoicedHours} hours`);
    console.log('');
    console.log(`Python Reference Expected: 117.5 hours`);
    console.log(`Current Result: ${augustData.invoicedHours} hours`);
    console.log(`Difference: ${Math.abs(117.5 - augustData.invoicedHours).toFixed(1)} hours`);
    console.log('');
    
    if (Math.abs(augustData.invoicedHours - 117.5) > 10) {
      console.log(`🔍 SIGNIFICANT DISCREPANCY DETECTED!`);
      console.log(`The current calculation shows ${augustData.invoicedHours} hours vs expected 117.5 hours`);
      console.log(`This suggests the issue is in how we calculate either:`);
      console.log(`1. Revenue calculation (filtering, plumber matching, line item processing)`);
      console.log(`2. The method used (revenue/rate vs direct quantity summation)`);
      
      // Try to reverse engineer what the adjusted quantity sum should be
      const expectedRevenue = 117.5 * BILLABLE_RATE;
      console.log('');
      console.log(`If Python used direct quantity method:`);
      console.log(`  Expected adjusted quantity sum: 117.5 hours`);
      console.log(`  Expected revenue: 117.5 × $${BILLABLE_RATE} = $${expectedRevenue.toFixed(2)}`);
      console.log(`  Actual revenue: $${augustData.revenue}`);
      console.log(`  Revenue difference: $${Math.abs(expectedRevenue - augustData.revenue).toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n❌ Make sure the server is running on http://localhost:3000');
  }
}

// Run the debug analysis
debugWesAugustInvoices();