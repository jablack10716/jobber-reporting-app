#!/usr/bin/env node

// Test the exact fetchMonthData function to see what it returns

require('dotenv').config();

const { fetchMonthData } = require('./jobber-queries');

async function testFetchMonthData() {
  console.log('=== TESTING fetchMonthData FUNCTION ===');

  try {
    const startDate = new Date('2025-08-01');
    const endDate = new Date('2025-08-31');
    const account = { name: 'Test Account' };
    
    console.log('Calling fetchMonthData...');
    const result = await fetchMonthData(account, 'Lorin', startDate, endDate);
    
    console.log('\n=== RESULT STRUCTURE ===');
    console.log('Keys in result:', Object.keys(result));
    console.log('Type of result:', typeof result);
    
    if (result.timesheets) {
      console.log('timesheets array length:', result.timesheets.length);
      console.log('First timesheet entry:', result.timesheets[0]);
    } else {
      console.log('No timesheets property found');
    }
    
    if (result.timesheet) {
      console.log('timesheet property found:', result.timesheet);
    }
    
    // Log all properties that might contain timesheet data
    for (const [key, value] of Object.entries(result)) {
      if (Array.isArray(value)) {
        console.log(`Array property "${key}": length ${value.length}`);
        if (value.length > 0) {
          console.log(`  First item:`, value[0]);
        }
      } else if (typeof value === 'object' && value !== null) {
        console.log(`Object property "${key}":`, value);
      } else {
        console.log(`Scalar property "${key}":`, value);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFetchMonthData().catch(console.error);