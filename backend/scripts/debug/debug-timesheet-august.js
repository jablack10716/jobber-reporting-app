#!/usr/bin/env node

// Debug script to investigate timesheet data discrepancy for Lorin in August 2025
// Real Jobber shows 157.9 hours, but system reports only 91 hours

require('dotenv').config();

const JobberAPIService = require('./JobberAPIService');
const { getTimesheetEntriesQuery } = require('./jobber-queries');

const PLUMBER_MAPPINGS = {
  "wes": "Wes Transier",
  "lorin": "Lorin Sharpless", 
  "elijah": "Elijah Yanez"
};

async function debugTimesheetAugust() {
  console.log('=== TIMESHEET DEBUG: AUGUST 2025 ===');
  console.log('Expected: Lorin worked 157.9 hours');
  console.log('Problem: System reports only 91 hours');
  console.log('');

  try {
    const service = new JobberAPIService();
    console.log('1. Ensuring valid token...');
    await service.ensureValidToken();
    console.log('✅ Token valid');

    const startDate = new Date('2025-08-01');
    const endDate = new Date('2025-08-31');
    const timesheetQuery = getTimesheetEntriesQuery(startDate, endDate);
    
    console.log('\n2. GraphQL Query:');
    console.log(timesheetQuery);
    console.log('');

    let allEntries = [];
    let tsHasNextPage = true;
    let tsCursor = null;
    let tsQueryCount = 0;
    const tsMaxQueries = 20; // Increased to capture all data

    console.log('3. Fetching timesheet data...');
    
    while (tsHasNextPage && tsQueryCount < tsMaxQueries) {
      console.log(`  Batch ${tsQueryCount + 1}: Querying with cursor=${tsCursor}`);
      
      const variables = { after: tsCursor };
      const timesheetResult = await service.query(timesheetQuery, variables);
      const timesheetData = timesheetResult.timeSheetEntries || {};
      const timesheetEdges = timesheetData.edges || [];
      
      console.log(`  Batch ${tsQueryCount + 1}: Received ${timesheetEdges.length} entries`);
      
      allEntries.push(...timesheetEdges);
      
      tsHasNextPage = timesheetData.pageInfo?.hasNextPage || false;
      tsCursor = timesheetData.pageInfo?.endCursor || null;
      tsQueryCount++;
      
      console.log(`  Batch ${tsQueryCount}: hasNextPage=${tsHasNextPage}, cursor=${tsCursor}`);
      
      if (timesheetEdges.length === 0) {
        console.log('  No more entries, stopping pagination');
        break;
      }
    }

    console.log(`\n4. Processing ${allEntries.length} total entries...`);
    
    // Process all entries to see all users and filter for Lorin
    const allProcessed = allEntries.map((e, idx) => {
      const user = e.node.user || {};
      const name = user.name || {};
      const fullName = `${name.first || ''} ${name.last || ''}`.trim();
      const duration = (e.node.finalDuration || 0) / 3600; // Convert seconds to hours
      const startAt = e.node.startAt;
      
      return {
        index: idx + 1,
        fullName,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimals
        startAt,
        isLorin: fullName.toLowerCase().includes('lorin')
      };
    });

    // Show summary by user
    console.log('\n5. Summary by User:');
    const userSummary = {};
    allProcessed.forEach(entry => {
      if (!userSummary[entry.fullName]) {
        userSummary[entry.fullName] = { count: 0, totalHours: 0 };
      }
      userSummary[entry.fullName].count++;
      userSummary[entry.fullName].totalHours += entry.duration;
    });

    Object.entries(userSummary).forEach(([name, data]) => {
      const hours = Math.round(data.totalHours * 10) / 10;
      console.log(`  ${name}: ${data.count} entries, ${hours} hours`);
    });

    // Filter for Lorin specifically
    const lorinEntries = allProcessed.filter(e => e.isLorin);
    const totalLorinHours = lorinEntries.reduce((sum, e) => sum + e.duration, 0);

    console.log(`\n6. Lorin Analysis:`);
    console.log(`  Matching entries: ${lorinEntries.length}`);
    console.log(`  Total hours: ${Math.round(totalLorinHours * 10) / 10}`);
    console.log(`  Expected hours: 157.9`);
    console.log(`  Difference: ${Math.round((157.9 - totalLorinHours) * 10) / 10} hours missing`);

    if (lorinEntries.length > 0) {
      console.log('\n7. First 10 Lorin entries:');
      lorinEntries.slice(0, 10).forEach(entry => {
        console.log(`  ${entry.index}: ${entry.startAt} - ${entry.duration}h - "${entry.fullName}"`);
      });
    }

    console.log('\n8. Pagination Analysis:');
    console.log(`  Total batches fetched: ${tsQueryCount}`);
    console.log(`  Max batches allowed: ${tsMaxQueries}`);
    console.log(`  Reached pagination limit: ${tsQueryCount >= tsMaxQueries ? 'YES - May have missed data!' : 'No'}`);
    console.log(`  Last cursor: ${tsCursor}`);
    console.log(`  Has more pages: ${tsHasNextPage ? 'YES - More data available!' : 'No'}`);

    if (tsHasNextPage) {
      console.log('\n⚠️  WARNING: There is more timesheet data available that was not fetched!');
      console.log('   This could explain the missing hours.');
    }

    // Check the name mapping
    console.log('\n9. Name Mapping Check:');
    const searchName = 'lorin';
    const expectedMappedName = PLUMBER_MAPPINGS[searchName.toLowerCase()];
    console.log(`  Search name: "${searchName}"`);
    console.log(`  Mapped to: "${expectedMappedName}"`);
    
    const matchedByMapping = allProcessed.filter(e => 
      e.fullName.toLowerCase().includes(expectedMappedName.toLowerCase())
    );
    console.log(`  Entries matching mapped name: ${matchedByMapping.length}`);
    
    const directMatches = allProcessed.filter(e => 
      e.fullName.toLowerCase().includes(searchName.toLowerCase())
    );
    console.log(`  Entries matching direct search: ${directMatches.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

// Run the debug
debugTimesheetAugust().catch(console.error);