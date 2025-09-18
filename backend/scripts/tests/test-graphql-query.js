// Test script to verify GraphQL query structure
const { getInvoicesQuery } = require('./jobber-queries.js');

console.log('Testing GraphQL query structure...');

const startDate = new Date('2025-09-01');
const endDate = new Date('2025-09-15'); 

const query = getInvoicesQuery(startDate, endDate);

console.log('Generated query:');
console.log(query);

// Check for problematic fields
const problematicFields = ['selectedOption', 'numberValue', 'booleanValue'];
let hasProblems = false;

problematicFields.forEach(field => {
  if (query.includes(field)) {
    console.log(`❌ PROBLEM: Query still contains "${field}"`);
    hasProblems = true;
  }
});

if (!hasProblems) {
  console.log('✅ SUCCESS: Query only contains supported custom field types');
} else {
  console.log('❌ FAILED: Query contains unsupported custom field types');
  process.exit(1);
}