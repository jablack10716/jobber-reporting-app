#!/usr/bin/env node

// Debug script to see what names are in the timesheet data for August

require('dotenv').config();

const JobberAPIService = require('./JobberAPIService');

async function debugAugustNames() {
  console.log('=== DEBUGGING TIMESHEET NAMES FOR AUGUST ===');

  try {
    // Initialize the API service
    const jobberService = new JobberAPIService();
    const tokens = jobberService.loadTokens();
    jobberService.initializeClient(tokens.access_token);

    const startDate = '2025-08-01';
    const endDate = '2025-08-31';
    
    // Fetch first few batches of timesheet data
    let allEntries = [];
    let hasNextPage = true;
    let cursor = null;
    let batchCount = 0;
    const maxBatches = 15; // Use our new limit

    const timesheetQuery = `
      query($after: String) {
        timeSheetEntries(first: 20, after: $after, filter: {
          startAt: {
            after: "${startDate}",
            before: "${endDate}"
          }
        }) {
          edges {
            node {
              user {
                name {
                  first
                  last
                }
              }
              finalDuration
              startAt
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    `;

    while (hasNextPage && batchCount < maxBatches) {
      console.log(`[DEBUG] Fetching batch ${batchCount + 1}...`);
      const result = await jobberService.query(timesheetQuery, { after: cursor });
      
      if (result?.timeSheetEntries?.edges) {
        allEntries = allEntries.concat(result.timeSheetEntries.edges);
        hasNextPage = result.timeSheetEntries.pageInfo.hasNextPage;
        cursor = result.timeSheetEntries.pageInfo.endCursor;
        console.log(`[DEBUG] Got ${result.timeSheetEntries.edges.length} entries`);
      } else {
        console.log('[DEBUG] No more entries');
        break;
      }
      batchCount++;
    }

    console.log(`\n=== TOTAL ENTRIES: ${allEntries.length} ===`);

    // Get unique names
    const uniqueNames = new Set();
    const nameEntries = {};

    allEntries.forEach(entry => {
      const user = entry.node.user;
      if (user && user.name) {
        const fullName = `${user.name.first || ''} ${user.name.last || ''}`.trim();
        uniqueNames.add(fullName);
        
        if (!nameEntries[fullName]) {
          nameEntries[fullName] = { count: 0, totalHours: 0 };
        }
        nameEntries[fullName].count++;
        nameEntries[fullName].totalHours += (entry.node.finalDuration || 0) / 3600;
      }
    });

    console.log('\n=== UNIQUE NAMES AND THEIR TOTALS ===');
    Array.from(uniqueNames).sort().forEach(name => {
      const data = nameEntries[name];
      console.log(`${name}: ${data.count} entries, ${Math.round(data.totalHours * 10) / 10} hours`);
    });

    // Check specifically for Lorin variants
    console.log('\n=== LORIN ANALYSIS ===');
    const lorinVariants = Array.from(uniqueNames).filter(name => 
      name.toLowerCase().includes('lorin')
    );
    
    if (lorinVariants.length > 0) {
      lorinVariants.forEach(variant => {
        const data = nameEntries[variant];
        console.log(`Found: "${variant}" - ${data.count} entries, ${Math.round(data.totalHours * 10) / 10} hours`);
      });
    } else {
      console.log('❌ No names containing "lorin" found!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugAugustNames().catch(console.error);