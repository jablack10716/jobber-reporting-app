// Test script to verify liFirst parameter fix
console.log('[TEST] Starting liFirst parameter test');

// Force clear the module cache before requiring
const jobberQueriesPath = require.resolve('./jobber-queries');
if (require.cache[jobberQueriesPath]) {
  console.log('[TEST] Removing cached jobber-queries module');
  delete require.cache[jobberQueriesPath];
}

// Import the module
const { fetchMonthData } = require('./jobber-queries');

console.log('[TEST] fetchMonthData function imported successfully');

// Test the variable creation logic by checking the function source
console.log('[TEST] Function source (first 1000 chars):');
console.log(fetchMonthData.toString().substring(0, 1000));

// Look for liFirst in the function source
const funcSource = fetchMonthData.toString();
const liFirstMatch = funcSource.match(/liFirst:\s*(\d+)/);
if (liFirstMatch) {
  console.log(`[TEST] Found liFirst value in function: ${liFirstMatch[1]}`);
  if (liFirstMatch[1] === '20') {
    console.log('[TEST] ✅ SUCCESS: liFirst is correctly set to 20');
  } else {
    console.log(`[TEST] ❌ FAILURE: liFirst is ${liFirstMatch[1]}, expected 20`);
  }
} else {
  console.log('[TEST] ❌ Could not find liFirst in function source');
}

console.log('[TEST] Test completed');