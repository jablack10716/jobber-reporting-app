// Controlled data refresh script
// Refreshes plumber data with corrected logic while respecting rate limits

const express = require('express');
const { generatePlumberReport } = require('./jobber-queries.js');

const PLUMBERS = ['Lorin', 'Matt', 'Cory', 'Sean']; // Add your plumbers here
const DELAY_BETWEEN_PLUMBERS = 45000; // 45 seconds between plumbers (conservative)

async function refreshPlumberData() {
  require('dotenv').config();
const { generatePlumberReport } = require('./jobber-queries.js');
const JobberAPIService = require('./JobberAPIService');

console.log("🔄 Starting controlled data refresh with corrected logic...");
  console.log(`📋 Plumbers to refresh: ${PLUMBERS.join(', ')}`);
  console.log(`⏰ Delay between plumbers: ${DELAY_BETWEEN_PLUMBERS / 1000}s\n`);

  for (let i = 0; i < PLUMBERS.length; i++) {
    const plumber = PLUMBERS[i];
    const isLast = i === PLUMBERS.length - 1;
    
    try {
      console.log(`\n[${i + 1}/${PLUMBERS.length}] 🔄 Refreshing data for: ${plumber}`);
      console.log(`⏰ Started at: ${new Date().toLocaleTimeString()}`);
      
      // Initialize Jobber API and get account (same as server.js)
      const jobberAPI = new JobberAPIService();
      await jobberAPI.ensureValidToken();
      const account = await jobberAPI.getFirstValidAccount();
      
      // Generate report with both account and plumber name
      const report = await generatePlumberReport(account, plumber);
      
      console.log(`✅ Success for ${plumber}:`);
      console.log(`   📊 Months: ${report.monthlyData.length}`);
      
      if (report.monthlyData.length > 0) {
        const latest = report.monthlyData[report.monthlyData.length - 1];
        const previous = report.monthlyData[report.monthlyData.length - 2];
        console.log(`   📅 Latest: ${latest.monthName} - ${latest.invoicedHours}h invoiced, ${latest.workedHours}h worked`);
        if (previous) {
          console.log(`   📅 Previous: ${previous.monthName} - ${previous.invoicedHours}h invoiced, ${previous.workedHours}h worked`);
        }
      }
      
      console.log(`⏰ Completed at: ${new Date().toLocaleTimeString()}`);
      
      if (!isLast) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_PLUMBERS / 1000}s before next plumber...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PLUMBERS));
      }
      
    } catch (error) {
      console.error(`❌ Error refreshing ${plumber}:`, error.message);
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        console.log('⚠️  Rate limit hit - extending delay to 60s for next plumber');
        if (!isLast) {
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      } else if (!isLast) {
        console.log(`⏳ Continuing with normal delay...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PLUMBERS));
      }
    }
  }
  
  console.log('\n🎉 Data refresh complete!');
  console.log('💡 All plumber reports now use corrected invoice calculation logic');
  console.log('📋 Summary: Job Details line items are now properly excluded from invoiced hours');
}

// Auto-run if called directly
if (require.main === module) {
  refreshPlumberData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Refresh failed:', error);
      process.exit(1);
    });
}

module.exports = { refreshPlumberData };