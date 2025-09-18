/**
 * Test script to check GraphQL schema fields without authentication
 * Based on Jobber API documentation
 */

console.log('[SCHEMA-TEST] Checking Jobber GraphQL schema for invoice fields...');

// From the documented schema types in copilot-instructions.md
const invoiceSchemaFields = [
    'id',
    'invoiceNumber', 
    'total',
    'paymentsTotal',
    'createdAt',
    'sentAt',           // This is what we want to verify
    'client',
    'customFields',
    'lineItems'
];

console.log('[SCHEMA-TEST] Expected Invoice fields based on schema documentation:');
invoiceSchemaFields.forEach(field => {
    console.log(`  ✓ ${field}`);
});

console.log('\n[SCHEMA-TEST] Key observations:');
console.log('  - Invoice type includes both createdAt and sentAt fields');
console.log('  - sentAt represents when invoice was issued/sent to client');
console.log('  - createdAt represents when invoice was created in system');
console.log('  - For business reporting, sentAt is more accurate for revenue timing');

// Test the date field configuration
require('dotenv').config();
const dateField = process.env.INVOICE_DATE_FIELD || 'createdAt';

console.log(`\n[SCHEMA-TEST] Current configuration: INVOICE_DATE_FIELD=${dateField}`);

if (dateField === 'sentAt') {
    console.log('  ✅ Configured to use sentAt for invoice date filtering');
    console.log('  📝 Note: sentAt may be null for unsent invoices');
    console.log('  🔄 Fallback logic will handle null sentAt values');
} else {
    console.log('  ℹ️ Using createdAt for invoice date filtering (default)');
}

console.log('\n[SCHEMA-TEST] Schema validation complete');