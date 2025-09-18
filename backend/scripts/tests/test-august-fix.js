#!/usr/bin/env node

// Test script to verify August timesheet data after the pagination fix

require('dotenv').config();

const { fetchMonthData } = require('./jobber-queries');

async function testAugustFix() {
  console.log('=== TESTING AUGUST TIMESHEET FIX ===');
  console.log('Expected: 157.9 hours for Lorin in August 2025');
  console.log('');

  try {
    console.log('1. Testing fetchMonthData for August 2025...');
    
    // Set up proper dates for August 2025
    const startDate = new Date('2025-08-01');
    const endDate = new Date('2025-08-31');
    const account = { name: 'Test Account' }; // Mock account
    
    const result = await fetchMonthData(account, 'Lorin', startDate, endDate);
    
    console.log('2. Result structure:');
    console.log('  Invoice data:', {
      totalInvoices: result.invoices?.length || 0,
      totalRevenue: result.invoiceRevenue || 0
    });
    
    console.log('  Timesheet data:', {
      totalEntries: result.timesheets?.length || 0,
      totalHours: result.totalHours || 0,
      timesheetHours: result.timesheetHours || 0
    });
    
    // Check if we have Lorin's timesheet entries
    if (result.timesheets && result.timesheets.length > 0) {
      console.log('3. Sample timesheet entries:');
      result.timesheets.slice(0, 5).forEach((entry, idx) => {
        const duration = (entry.finalDuration || 0) / 3600;
        console.log(`  ${idx + 1}. ${entry.startAt} - ${Math.round(duration * 100) / 100}h - ${entry.user?.name?.first} ${entry.user?.name?.last}`);
      });
      
      // Calculate Lorin's hours manually
      const lorinEntries = result.timesheets.filter(entry => {
        const name = entry.user?.name || {};
        const fullName = `${name.first || ''} ${name.last || ''}`.trim();
        return fullName.toLowerCase().includes('lorin');
      });
      
      const lorinHours = lorinEntries.reduce((sum, entry) => {
        return sum + ((entry.finalDuration || 0) / 3600);
      }, 0);
      
      console.log('4. Lorin Analysis:');
      console.log(`  Total entries: ${lorinEntries.length}`);
      console.log(`  Total hours: ${Math.round(lorinHours * 10) / 10}`);
      console.log(`  Expected: 157.9 hours`);
      console.log(`  Match: ${Math.abs(lorinHours - 157.9) < 0.1 ? '✅ YES' : '❌ NO'}`);
      
    } else {
      console.log('❌ No timesheet data found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testAugustFix().catch(console.error);