// Debug script to validate specific Wes August invoice numbers
// Check which invoices from the Python reference we're actually processing

const expectedInvoices = [
  '81425', '81421', '81418', '81415', '81414', '81412', '81411', '81410',
  '81406', '81405', '81404', '81398', '81396', '81392', '81391', '81384',
  '81383', '81382', '81381', '81380', '81379', '81365', '81364', '81363',
  '81361', '81357', '81353', '81350', '81349', '81347', '81346', '81345',
  '81343', '81342', '81341', '81340', '81337', '81336', '81334', '81326'
];

console.log(`=== VALIDATING WES AUGUST INVOICES ===`);
console.log(`Expected invoices from Python reference: ${expectedInvoices.length}`);
console.log(`Invoice numbers: ${expectedInvoices.join(', ')}`);
console.log('');

// Add debug logging to the jobber-queries module specifically for these invoices
const fs = require('fs');
const path = require('path');

// Read the current jobber-queries file
const queriesPath = path.join(__dirname, 'jobber-queries.js');
let queriesContent = fs.readFileSync(queriesPath, 'utf8');

// Check if we already have the validation logging
if (!queriesContent.includes('INVOICE_VALIDATION_MODE')) {
  console.log('Adding invoice validation logging to jobber-queries.js...');
  
  // Add validation constants at the top
  const validationCode = `
// Invoice validation for Wes August debugging
const INVOICE_VALIDATION_MODE = true;
const EXPECTED_WES_AUGUST_INVOICES = [
  '81425', '81421', '81418', '81415', '81414', '81412', '81411', '81410',
  '81406', '81405', '81404', '81398', '81396', '81392', '81391', '81384',
  '81383', '81382', '81381', '81380', '81379', '81365', '81364', '81363',
  '81361', '81357', '81353', '81350', '81349', '81347', '81346', '81345',
  '81343', '81342', '81341', '81340', '81337', '81336', '81334', '81326'
];
`;

  // Insert after the initial console.log
  queriesContent = queriesContent.replace(
    "console.log('[JOBBER-QUERIES] Module loaded at:', new Date().toISOString());",
    "console.log('[JOBBER-QUERIES] Module loaded at:', new Date().toISOString());" + validationCode
  );

  // Add validation in processInvoiceData function
  const processInvoiceValidation = `
  // VALIDATION: Check for expected Wes August invoices
  if (INVOICE_VALIDATION_MODE) {
    const allInvoiceNumbers = invoices.map(inv => inv.node.invoiceNumber);
    const foundExpected = allInvoiceNumbers.filter(num => EXPECTED_WES_AUGUST_INVOICES.includes(num));
    const missingExpected = EXPECTED_WES_AUGUST_INVOICES.filter(num => !allInvoiceNumbers.includes(num));
    
    console.log(\`[VALIDATION] Total invoices processed: \${invoices.length}\`);
    console.log(\`[VALIDATION] Expected Wes August invoices found: \${foundExpected.length}/\${EXPECTED_WES_AUGUST_INVOICES.length}\`);
    console.log(\`[VALIDATION] Found: \${foundExpected.join(', ')}\`);
    if (missingExpected.length > 0) {
      console.log(\`[VALIDATION] MISSING: \${missingExpected.join(', ')}\`);
    }
  }
`;

  // Insert validation after the initial invoice processing loop
  queriesContent = queriesContent.replace(
    'function processInvoiceData(invoices) {\n  const dataList = [];',
    'function processInvoiceData(invoices) {\n  const dataList = [];\n' + processInvoiceValidation
  );

  // Write the modified file
  fs.writeFileSync(queriesPath, queriesContent);
  console.log('✅ Invoice validation logging added to jobber-queries.js');
} else {
  console.log('✅ Invoice validation logging already present in jobber-queries.js');
}

console.log('\nNow trigger a Wes August report to see validation results...');
console.log('Run: curl "http://localhost:3000/api/reports/plumber?name=Wes&year=2025&refresh=1"');