#!/usr/bin/env node

// Script to refresh OAuth tokens and then debug timesheet data

require('dotenv').config();

const JobberAPIService = require('./JobberAPIService');

async function refreshTokenAndDebug() {
  console.log('=== TOKEN REFRESH AND TIMESHEET DEBUG ===');
  
  try {
    console.log('1. Creating JobberAPIService...');
    const service = new JobberAPIService();
    
    console.log('2. Attempting to refresh tokens...');
    await service.ensureValidToken();
    console.log('✅ Token refresh completed');
    
    console.log('3. Testing API connectivity...');
    const testQuery = `
      query {
        account {
          id
          name
        }
      }
    `;
    
    const testResult = await service.query(testQuery);
    console.log('✅ API connection successful');
    console.log('Account:', testResult.account);
    
    console.log('\n4. Now testing timesheet data for August...');
    
    // Now run our timesheet debug
    const { getTimesheetEntriesQuery } = require('./jobber-queries');
    
    const startDate = new Date('2025-08-01');
    const endDate = new Date('2025-08-31');
    const timesheetQuery = getTimesheetEntriesQuery(startDate, endDate);
    
    console.log('5. Fetching first batch of timesheet data...');
    
    const variables = { after: null };
    const timesheetResult = await service.query(timesheetQuery, variables);
    const timesheetData = timesheetResult.timeSheetEntries || {};
    const timesheetEdges = timesheetData.edges || [];
    
    console.log(`✅ Successfully fetched ${timesheetEdges.length} timesheet entries`);
    console.log(`Has more pages: ${timesheetData.pageInfo?.hasNextPage || false}`);
    console.log(`End cursor: ${timesheetData.pageInfo?.endCursor || 'null'}`);
    
    // Quick analysis of users
    const userHours = {};
    timesheetEdges.forEach(edge => {
      const user = edge.node.user || {};
      const name = user.name || {};
      const fullName = `${name.first || ''} ${name.last || ''}`.trim();
      const duration = (edge.node.finalDuration || 0) / 3600;
      
      if (!userHours[fullName]) {
        userHours[fullName] = 0;
      }
      userHours[fullName] += duration;
    });
    
    console.log('\n6. User hours in first batch:');
    Object.entries(userHours).forEach(([name, hours]) => {
      const roundedHours = Math.round(hours * 10) / 10;
      console.log(`  ${name}: ${roundedHours} hours`);
    });
    
    const lorinHours = userHours['Lorin Sharpless'] || 0;
    console.log(`\n7. Lorin Analysis (first batch only):`);
    console.log(`  Hours found: ${Math.round(lorinHours * 10) / 10}`);
    console.log(`  Expected total: 157.9 hours`);
    
    if (timesheetData.pageInfo?.hasNextPage) {
      console.log('\n⚠️  WARNING: There are more pages of timesheet data!');
      console.log('   This explains why we\'re missing hours.');
      console.log('   The system needs to fetch ALL pages to get the complete picture.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.response?.status === 401) {
      console.error('\n🔑 Authentication failed. This could mean:');
      console.error('   - Refresh token has expired');
      console.error('   - OAuth app permissions have changed');
      console.error('   - Need to re-authorize the application');
      console.error('\n💡 Try visiting: http://localhost:3000/auth/jobber');
    }
  }
}

// Run the script
refreshTokenAndDebug().catch(console.error);