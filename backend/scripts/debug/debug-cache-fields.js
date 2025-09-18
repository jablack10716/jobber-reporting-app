// Test custom fields in a simple way
const fs = require('fs');

// Read from a cached file to see what we're getting
try {
  const cacheFiles = fs.readdirSync('./cache/reports/').filter(f => f.includes('Lorin-2025-08'));
  if (cacheFiles.length > 0) {
    const cacheFile = `./cache/reports/${cacheFiles[0]}`;
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    
    console.log('=== AUGUST 2025 INVOICE DATA FOR LORIN ===');
    console.log('File:', cacheFile);
    console.log('Total invoices found:', cached.data.month.debug?.totalInvoices || 'unknown');
    
    // Look for first few invoices with custom fields
    if (cached.data.month.debug?.invoiceDebug) {
      const samples = cached.data.month.debug.invoiceDebug.slice(0, 3);
      samples.forEach((inv, i) => {
        console.log(`\n--- Invoice ${i+1}: ${inv.invoiceNumber} ---`);
        console.log('Custom Fields:');
        if (inv.customFields && inv.customFields.length > 0) {
          inv.customFields.forEach(field => {
            console.log(`  "${field.label}": "${field.valueText}"`);
          });
        } else {
          console.log('  (No custom fields found)');
        }
      });
    } else {
      console.log('No invoice debug data available');
    }
  } else {
    console.log('No cached data found for Lorin August 2025');
  }
} catch (error) {
  console.error('Error reading cache:', error.message);
}