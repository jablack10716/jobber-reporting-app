/**
 * Validate invoices against an external Excel report by computing
 * per-invoice adjusted hours (excluding Job Details and CC fee) using createdAt.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { getInvoicesQuery } = require('./jobber-queries.js');
const JobberAPIService = require('./JobberAPIService.js');

// Config
const EXCEL_PATH = 'C:/Users/jabla/OneDrive/Documents/Advanced/Python/jobber-plumbing-app/Invoices_Report_2025-09-16.xlsx';
const OUT_DIR = path.join(__dirname, 'reports');
const OUT_CSV = path.join(OUT_DIR, 'invoice_validation_createdAt.csv');

// Date window – adjust if needed
const START_DATE = process.env.VALIDATE_START || '2025-08-01';
const END_DATE = process.env.VALIDATE_END || '2025-09-16';

function formatDate(d) { return new Date(d).toISOString().slice(0,10); }

async function fetchInvoicesRaw() {
  // Force createdAt for this validation regardless of .env
  process.env.INVOICE_DATE_FIELD = 'createdAt';
  const q = getInvoicesQuery(new Date(START_DATE), new Date(END_DATE));

  const service = new JobberAPIService();
  const tokens = service.loadTokens();
  if (!tokens || !tokens.access_token) {
    throw new Error('Missing/invalid access token. Please authenticate.');
  }
  service.initializeClient(tokens.access_token);

  let all = [];
  let after = null;
  let page = 0;
  const invFirst = 20; const liFirst = 20;
  do {
    const res = await service.query(q, { after, invFirst, liFirst });
    const edges = res?.invoices?.edges || [];
    all.push(...edges);
    const pi = res?.invoices?.pageInfo || {};
    after = pi.endCursor || null;
    page++;
    if (!pi.hasNextPage) break;
    await new Promise(r => setTimeout(r, 350));
  } while (page < 6);
  return all;
}

function computePerInvoiceHours(invoiceEdges) {
  // adjusted hours = sum(adjustedQuantity) across non-Job Details, non-CC fee
  const perInvoice = new Map();
  for (const e of invoiceEdges) {
    const n = e.node;
    const inv = n.invoiceNumber;
    let sumAdj = 0;
    for (const li of (n.lineItems?.edges || [])) {
      const ln = li.node;
      const desc = (ln.description || '').trim();
      const product = ln.linkedProductOrService || {};
      const name = product.name || '';
      const isJobDetails = name === 'Job Details';
      const isCreditCardFee = (desc === 'Credit Card Service Fee') || (name === 'Credit Card Service Fee');
      if (isJobDetails || isCreditCardFee) continue;
      const qty = ln.quantity || 0;
      const isExcavation = (desc === 'Excavation') || (name === 'Excavation');
      const adjustedQty = isExcavation ? (qty * 8) : qty;
      sumAdj += adjustedQty;
    }
    perInvoice.set(inv, (perInvoice.get(inv) || 0) + sumAdj);
  }
  return perInvoice;
}

function readExcelExpectedHours() {
  // Expect a column with invoice number and one with Invoiced Hours (less Job Details)
  const wb = XLSX.readFile(EXCEL_PATH);
  // Use the first sheet
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  // Try common column names
  // We’ll heuristically locate columns: invoice/invoice number, issued/created date, and hours
  let invoiceCol = null;
  let hoursCol = null;
  const header = Object.keys(rows[0] || {});
  for (const k of header) {
    const kLower = k.toLowerCase();
    // Invoice number detection: 'invoice', 'invoice number', 'invoice #'
    if (!invoiceCol) {
      const hasInvoice = kLower.includes('invoice');
      const looksLikeNumber = kLower.includes('number') || kLower.includes('#') || kLower.trim() === 'invoice';
      if (hasInvoice && looksLikeNumber) invoiceCol = k;
    }
    // Hours detection: 'invoiced hours', 'hours', 'qty'
    if (!hoursCol) {
      const isHours = kLower.includes('hour') || kLower.includes('qty') || kLower.includes('invoiced');
      if (isHours) hoursCol = k;
    }
  }
  if (!invoiceCol) throw new Error('Could not find Invoice Number column in Excel');
  if (!hoursCol) throw new Error('Could not find Hours column in Excel');

  const map = new Map();
  rows.forEach(r => {
    const invStr = String(r[invoiceCol] || '').trim();
    if (!invStr) return;
    const hrs = Number(r[hoursCol] || 0);
    if (!Number.isFinite(hrs)) return;
    map.set(invStr, hrs);
  });
  return { perInvoice: map, columns: { invoiceCol, hoursCol }, sheetName };
}

function toCsvRow(fields) { return fields.map(f => (String(f).includes(',') ? '"'+String(f).replaceAll('"','""')+'"' : f)).join(','); }

(async () => {
  try {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    console.log(`[VALIDATE] Window ${START_DATE}..${END_DATE} (createdAt)`);
    const invoices = await fetchInvoicesRaw();
    console.log(`[VALIDATE] Invoices fetched: ${invoices.length}`);
    const perInvoiceHours = computePerInvoiceHours(invoices);

    let excel = null;
    try {
      excel = readExcelExpectedHours();
      console.log(`[VALIDATE] Excel loaded: sheet "${excel.sheetName}" with ${excel.perInvoice.size} invoices`);
    } catch (e) {
      console.warn(`[VALIDATE] Excel load warning: ${e.message}`);
    }

    const rows = [];
    rows.push(['InvoiceNumber','ComputedHours','ExcelHours','Delta','Source']);
    const seen = new Set();
    let matched = 0, equal = 0, mismatched = 0, apiOnly = 0, excelOnly = 0;
    // All from API
    for (const [inv, hrs] of perInvoiceHours.entries()) {
      const excelHrs = excel?.perInvoice.get(inv);
      const hasExcel = (excelHrs != null);
      const delta = hasExcel ? (hrs - excelHrs) : '';
      rows.push([inv, hrs, (hasExcel ? excelHrs : ''), delta, 'API']);
      if (hasExcel) {
        matched++;
        if (Math.abs(delta) < 1e-6) equal++; else mismatched++;
      } else {
        apiOnly++;
      }
      seen.add(inv);
    }
    // Add invoices present only in Excel
    if (excel) {
      for (const [inv, hrs] of excel.perInvoice.entries()) {
        if (seen.has(inv)) continue;
        rows.push([inv, '', hrs, '', 'ExcelOnly']);
        excelOnly++;
      }
    }

    fs.writeFileSync(OUT_CSV, rows.map(toCsvRow).join('\n'), 'utf8');
    console.log(`[VALIDATE] Wrote ${OUT_CSV}`);
    console.log(`[VALIDATE] Summary: matched=${matched} equal=${equal} mismatched=${mismatched} apiOnly=${apiOnly} excelOnly=${excelOnly}`);
  } catch (err) {
    console.error('[VALIDATE][ERROR]', err.message);
    process.exitCode = 1;
  }
})();
