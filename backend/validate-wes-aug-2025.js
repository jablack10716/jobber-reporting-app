/**
 * Reconciliation script: Compare Python CSV Adjusted Quantity totals for a plumber & month
 * against Node report computation (generatePlumberReport) after pagination / logic fixes.
 *
 * Steps:
 * 1. Parse Python CSV filtering Month_Period == target (YYYY-MM) and Lead Plumber == plumber
 *    - Sum Adjusted Quantity (exclude Job Details lines)
 * 2. Invoke generatePlumberReport (live if tokens valid) with includeInvoiceItems (if enabled) or fall back to cached slice.
 * 3. Output difference and top contributing invoices.
 *
 * Usage examples:
 *   node validate-wes-aug-2025.js --plumber Wes --year 2025 --month 08
 *   node validate-wes-aug-2025.js -p Lorin -y 2025 -m 07
 */

const fs = require('fs');
const path = require('path');
const { generatePlumberReport, processInvoiceData } = require('./jobber-queries');
const JobberAPIService = require('./JobberAPIService');

function parseArgs() {
  const defaults = { plumber: 'Wes', year: new Date().getFullYear(), month: String(new Date().getMonth() + 1).padStart(2,'0') };
  const args = process.argv.slice(2);
  for (let i=0;i<args.length;i++) {
    const a = args[i];
    if ((a === '--plumber' || a === '-p') && args[i+1]) { defaults.plumber = args[++i]; }
    else if ((a === '--year' || a === '-y') && args[i+1]) { defaults.year = parseInt(args[++i],10); }
    else if ((a === '--month' || a === '-m') && args[i+1]) { defaults.month = args[++i]; }
  }
  if (!/^\d{2}$/.test(defaults.month)) throw new Error('Month must be two digits, e.g. 08');
  return defaults;
}

async function main() {
  const { plumber, year, month } = parseArgs();
  const monthPeriod = `${year}-${month}`;
  const csvPath = path.join(__dirname, '..', 'Python_Code', 'invoice_data_with_lead_plumber.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found at', csvPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split(',');
  const idx = {
    invoiceNumber: header.indexOf('Invoice Number'),
    leadPlumber: header.indexOf('Lead Plumber'),
    monthPeriod: header.indexOf('Month_Period'),
    adjustedQty: header.indexOf('Adjusted Quantity'),
    isJobDetails: header.indexOf('Is Job Details')
  };
  for (const [k,v] of Object.entries(idx)) {
    if (v === -1) {
      console.error('Missing column in CSV:', k);
      process.exit(1);
    }
  }
  let pythonRows = [];
  for (let i=1;i<lines.length;i++) {
    const parts = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/); // crude CSV split honoring quotes
    if (parts.length < header.length) continue;
    if (parts[idx.monthPeriod] !== monthPeriod) continue;
    if (parts[idx.leadPlumber] !== plumber) continue;
    const isJobDetails = parts[idx.isJobDetails] === 'True';
    if (isJobDetails) continue; // Python adjusted qty includes job details lines separately; ensure exclusion
    const invoiceNumber = parts[idx.invoiceNumber];
    const adjustedQty = parseFloat(parts[idx.adjustedQty]) || 0;
    pythonRows.push({ invoiceNumber, adjustedQty });
  }
  const pythonTotal = pythonRows.reduce((s,r)=>s+r.adjustedQty,0);

  // Group Python by invoice for comparison
  const pythonByInvoice = pythonRows.reduce((map,r)=>{ map[r.invoiceNumber]=(map[r.invoiceNumber]||0)+r.adjustedQty; return map; },{});

  // Prefer live generation if tokens valid, else fallback to cached slice JSON
  let nodeInvoicedHours = 0; let monthData = null; let mode = 'cache';
  try {
    const api = new JobberAPIService();
    const account = await api.getFirstValidAccount();
    const report = await generatePlumberReport(account, plumber, { refresh: true, year, includeInvoiceItems: true });
    monthData = (report.monthlyData || report.monthly || []).find(m => m.month === monthPeriod);
    if (monthData) { nodeInvoicedHours = monthData.invoicedHours; mode = 'live'; }
  } catch (e) {
    const cachePath = path.join(__dirname, 'cache', 'reports', `${plumber}-${monthPeriod}.json`);
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath,'utf8'));
      monthData = cached.month;
      nodeInvoicedHours = monthData.invoicedHours;
    } else {
      console.error('Failed live fetch and no cache slice found.');
    }
  }

  // For deeper diff, we need raw invoice line items; reuse internal caching path: generatePlumberReport currently not returning raw items.
  // As a fallback, re-fetch invoices for Aug only by calling internal process via JobberAPIService directly.
  // Simpler: rely on invoice cache existing; but to avoid internal refactor, surface a warning.
  // TODO (if needed): expose a debug endpoint returning raw processed invoice line items for a plumber-month.

  // Compare sets (only invoice-level possible with current access)
  const pythonInvoices = new Set(Object.keys(pythonByInvoice));
  // Without raw Node invoices we can't list Node-only invoiceNumbers; placeholder for future enhancement.

  console.log(`--- Reconciliation: ${plumber} ${monthPeriod} ---`);
  console.log('Python total adjusted quantity (expected invoiced hours):', pythonTotal.toFixed(1));
  console.log(`Node report invoicedHours (${mode} mode):`, nodeInvoicedHours.toFixed(1));
  console.log('Difference (Node - Python):', (nodeInvoicedHours - pythonTotal).toFixed(1));
  if (monthData) {
    console.log('Node workedHours:', monthData.workedHours, 'utilization:', monthData.utilization);
  }
  if (pythonTotal !== nodeInvoicedHours) {
    console.log('\nInvoices contributing in Python (top 20 by hours):');
    const top = Object.entries(pythonByInvoice).sort((a,b)=>b[1]-a[1]).slice(0,20);
    for (const [inv, hrs] of top) console.log(inv, hrs.toFixed(1));
  }
  console.log('\n(Note) For full line item diff, call the debug endpoint once enabled: /api/debug/invoice-items?plumber=' + plumber + '&month=' + monthPeriod);
}

main().catch(e=>{ console.error('Fatal error in reconciliation script:', e); process.exit(1); });
