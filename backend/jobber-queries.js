// GraphQL queries for Jobber API based on Python implementation
// Matches the exact structure used in the working Python scripts
// Updated: 2025-09-14 to fix CustomFieldUnion issue

const DEBUG = process.env.JOBBER_DEBUG === 'true';
if (DEBUG) console.log('[JOBBER-QUERIES] Module loaded at:', new Date().toISOString());

const fs = require('fs');
const path = require('path');

// ----------------------------------------------------------------------------
// On-disk month slice caching
//   Path pattern: backend/cache/reports/{plumber}-{year}-{month}.json
//   Only re-fetch past months if file missing, expired, or refresh requested.
//   Always re-fetch current month unless within TTL & not refresh (configurable).
// ----------------------------------------------------------------------------
const CACHE_BASE_DIR = path.join(__dirname, 'cache', 'reports');
const MONTH_CACHE_TTL_MS = parseInt(process.env.MONTH_CACHE_TTL_MS || (6 * 60 * 60 * 1000).toString(), 10); // default 6h
// Increment this when month slice structure or aggregation logic changes so old slices are invalidated automatically
const SLICE_SCHEMA_VERSION = 3; // v1 = pre-pagination-cap removal; v2 = post-cap removal / reconciliation tooling; v3 = actual-revenue profit calc (Option B)

function ensureCacheDir() {
  try { fs.mkdirSync(CACHE_BASE_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

function monthSlicePath(plumberName, year, month) {
  const safePlumber = plumberName.replace(/[^a-z0-9_-]/gi, '_');
  return path.join(CACHE_BASE_DIR, `${safePlumber}-${year}-${String(month).padStart(2,'0')}.json`);
}

function readMonthSlice(plumberName, year, month) {
  const file = monthSlicePath(plumberName, year, month);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return { file, data };
  } catch (e) {
    console.warn('[JOBBER-QUERIES][CACHE] Failed to read slice', file, e.message);
    return null;
  }
}

function writeMonthSlice(plumberName, year, month, payload) {
  ensureCacheDir();
  const file = monthSlicePath(plumberName, year, month);
  // Never persist debug invoice item arrays to disk (keep slice lean)
  const clone = { ...payload };
  delete clone.invoiceItems; // safety if future logic attaches
  delete clone.rawInvoiceLineItems;
  const wrapped = { meta: { savedAt: new Date().toISOString(), ttlMs: MONTH_CACHE_TTL_MS, sliceSchemaVersion: SLICE_SCHEMA_VERSION }, month: clone };
  try {
    fs.writeFileSync(file, JSON.stringify(wrapped, null, 2));
  } catch (e) {
    console.warn('[JOBBER-QUERIES][CACHE] Failed to write slice', file, e.message);
  }
  return file;
}

function sliceFreshEnough(slice, isCurrentMonth, refreshRequested) {
  if (!slice || !slice.data || !slice.data.meta) return false;
  if (refreshRequested) return false;
  if (slice.data.meta.sliceSchemaVersion !== SLICE_SCHEMA_VERSION) return false;
  if (isCurrentMonth) {
    // For current month allow reuse only if within TTL to reduce churn
    const savedAt = new Date(slice.data.meta.savedAt).getTime();
    return Date.now() - savedAt < MONTH_CACHE_TTL_MS;
  }
  // Past months: once saved treat as immutable unless refresh forced
  return true;
}

// Business rate constants - now configurable via environment variables
const BUSINESS_RATES = {
  LEAD_PLUMBER_RATES: {
    "Wes": parseFloat(process.env.LEAD_PLUMBER_RATE_WES) || 34.85,
    "Lorin": parseFloat(process.env.LEAD_PLUMBER_RATE_LORIN) || 24.76,
    "Elijah": parseFloat(process.env.LEAD_PLUMBER_RATE_ELIJAH) || 23.78
  },
  SUPPORT_PLUMBER_RATE: parseFloat(process.env.SUPPORT_PLUMBER_RATE) || 16.70,
  FIXED_OVERHEAD_RATE: parseFloat(process.env.FIXED_OVERHEAD_RATE) || 18.07
};

// Log current rates on startup for verification
if (DEBUG) console.log('[JOBBER-QUERIES] Current business rates:', {
  supportPlumberRate: BUSINESS_RATES.SUPPORT_PLUMBER_RATE,
  fixedOverheadRate: BUSINESS_RATES.FIXED_OVERHEAD_RATE,
  leadPlumberRates: BUSINESS_RATES.LEAD_PLUMBER_RATES,
  profitModel: 'ACTUAL_REVENUE_OPTION_B',
  note: 'BILLABLE_RATE deprecated 2025-09-18'
});

// Plumber name mappings (invoice name -> timesheet name)
const PLUMBER_MAPPINGS = {
  "wes": "Wes Transier",
  "lorin": "Lorin Sharpless", 
  "elijah": "Elijah Yanez"
};

// Helper to format dates for GraphQL
function formatDate(date) {
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
}

// Custom field value helper (matches Python _cf_value function)
function getCustomFieldValue(customFields, fieldName) {
  if (!customFields || !Array.isArray(customFields)) return null;
  
  const field = customFields.find(cf => cf.label === fieldName);
  if (!field) return null;
  
  // Handle dropdown fields (Lead Plumber is likely a dropdown)
  if (field.valueDropdown !== undefined) return field.valueDropdown;
  
  // Handle text custom fields
  if (field.valueText !== undefined) return field.valueText;
  
  return null;
}

// Invoice query with line items and custom fields - FIXED VERSION - text fields only
// NOTE: Date field controlled by INVOICE_DATE_FIELD environment variable:
//   - 'createdAt' = filter by creation date 
//   - 'sentAt' = filter by issued/sent date (only includes sent invoices)
function getInvoicesQueryV2(startDate, endDate) {
  const dateField = process.env.INVOICE_DATE_FIELD || 'createdAt';
  const filterField = dateField === 'sentAt' ? 'sentAt' : 'createdAt';
  const includeSentAtField = filterField === 'sentAt';
  
  console.log(`[INVOICE-QUERY] Using ${filterField} for date filtering`);
  
  return `
    query($after: String, $invFirst: Int!, $liFirst: Int!) {
      invoices(
        first: $invFirst, 
        after: $after,
        filter: {
          ${filterField}: {
            after: "${formatDate(startDate)}"
            before: "${formatDate(endDate)}"
          }
        }
      ) {
        edges {
          node {
            id
            invoiceNumber
            total
            paymentsTotal
            createdAt
            ${includeSentAtField ? 'sentAt' : ''}
            client {
              id
              companyName
              firstName
              lastName
            }
            customFields {
              ... on CustomFieldDropdown {
                label
                valueDropdown
              }
              ... on CustomFieldText {
                label
                valueText
              }
            }
            lineItems(first: $liFirst) {
              edges {
                node {
                  id
                  description
                  quantity
                  unitPrice
                  linkedProductOrService {
                    name
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
}

// Timesheet entries query - matches Python implementation exactly
function getTimesheetEntriesQuery(startDate, endDate) {
  return `
    query($after: String) {
      timeSheetEntries(first: 20, after: $after, filter: {
        startAt: { 
          after: "${formatDate(startDate)}", 
          before: "${formatDate(endDate)}" 
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
}

// Process invoice data - converts GraphQL response to business logic format
// Respects INVOICE_DATE_FIELD environment variable for date handling
function processInvoiceData(invoices) {
  const dataList = [];
  const dateField = process.env.INVOICE_DATE_FIELD || 'createdAt';
  const useSentDate = dateField === 'sentAt';
  
  if (DEBUG) console.log(`[INVOICE-PROCESSING] Using ${dateField} for date calculations`);
  
  for (const invoice of invoices) {
    const node = invoice.node;
    
    // Determine effective date based on configuration
    let effectiveDate;
    let dateType;
    
    if (useSentDate) {
      // When using sentAt, skip invoices that haven't been sent yet
      if (!node.sentAt) {
        if (DEBUG) console.log(`[DEBUG] Skipping invoice ${node.invoiceNumber} - not yet sent (sentAt is null)`);
        continue;
      }
      effectiveDate = new Date(node.sentAt);
      dateType = 'sentAt (issued)';
    } else {
      // Use creation date
      effectiveDate = new Date(node.createdAt);
      dateType = 'createdAt (created)';
    }
    
    const invoiceNumber = node.invoiceNumber;
    const invoiceTotal = node.total;
    const paymentsTotal = node.paymentsTotal;
    
    // ISO week calculation based on effective date (matches Python implementation)
    const year = effectiveDate.getFullYear();
    const start = new Date(year, 0, 1);
    const days = Math.floor((effectiveDate - start) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    
    // Customer name logic (matches Python)
    const client = node.client || {};
    const customerName = (client.companyName || "").trim() 
      || [client.firstName, client.lastName].filter(x => x && x.trim()).join(" ").trim()
      || "Unknown";
    
    // Extract lead plumbers from custom fields
    const customFields = node.customFields || [];
    
    // DEBUG: Log all available custom fields for first few invoices
    if (DEBUG && dataList.length < 3) {
      console.log(`[DEBUG] Invoice ${invoiceNumber} custom fields:`, customFields.map(cf => `"${cf.label}": "${cf.valueDropdown || cf.valueText}"`));
    }
    
    const leadPlumber1 = getCustomFieldValue(customFields, "Lead Plumber") || "Unknown";
    const leadPlumber2 = getCustomFieldValue(customFields, "Lead Plumber 2") || "";
    
    // Two leads logic (matches Python)
    const twoLeads = leadPlumber1 && leadPlumber2 && 
                     leadPlumber1.toLowerCase() !== leadPlumber2.toLowerCase();
    
    // Process line items
    let invoiceTotalQty = 0;
    let invoiceTotalQtyExcl = 0;
    let nonJobDetailsTotal = 0;
    const firstLineIndex = dataList.length;
    
    for (const lineItemEdge of node.lineItems.edges) {
      const lineNode = lineItemEdge.node;
      const desc = (lineNode.description || "").trim();
      const qty = lineNode.quantity || 0;
      const price = lineNode.unitPrice || 0;
      const lineTotal = qty * price;
      
      const productOrService = lineNode.linkedProductOrService || {};
      const name = productOrService.name || "";
      
      const isJobDetails = name === "Job Details";
      const isCreditCardFee = (desc === "Credit Card Service Fee") || (name === "Credit Card Service Fee");
      const isExcavation = (desc === "Excavation") || (name === "Excavation");
      
      // Excavation gets 8x multiplier (matches Python)
      const adjustedQty = isExcavation ? (qty * 8) : qty;
      
      if (!isJobDetails && !isCreditCardFee) {
        nonJobDetailsTotal += lineTotal;
        invoiceTotalQtyExcl += adjustedQty;
      }
      invoiceTotalQty += qty;
      
      // Handle lead plumber splitting
      const recipients = twoLeads ? [leadPlumber1, leadPlumber2] : [leadPlumber1];
      const splitFactor = recipients.length === 1 ? 1.0 : 0.5;
      
      for (const lp of recipients) {
        dataList.push({
          invoiceNumber,
          date: effectiveDate.toISOString().split('T')[0],
          customer: customerName,
          leadPlumber: lp || "Unknown",
          leadPlumber2: leadPlumber2 || "",
          isoYear: year,
          isoWeek: week,
          isoYearWeek: `${year}-W${week.toString().padStart(2, '0')}`,
          description: desc,
          quantity: qty,
          adjustedQuantity: adjustedQty * splitFactor,
          unitPrice: price,
          lineTotal: lineTotal,
          isJobDetails: isJobDetails,
          invoiceTotal: invoiceTotal,
          paymentsTotal: paymentsTotal
        });
      }
    }
    
    // Add totals to first line item (matches Python)
    if (dataList.length > firstLineIndex) {
      dataList[firstLineIndex].invoicedExclJobDetails = nonJobDetailsTotal;
      dataList[firstLineIndex].totalQuantityInvoiced = invoiceTotalQty;
      dataList[firstLineIndex].totalQuantityInvoicedExcludingJobDetails = invoiceTotalQtyExcl;
    }
  }
  
  return dataList;
}

// Process timesheet data - converts GraphQL response to business logic format
function processTimesheetData(entries) {
  return entries.map(entry => {
    const node = entry.node;
    const user = node.user || {};
    const name = user.name || {};
    const startAt = new Date(node.startAt);
    
    // ISO week calculation
    const year = startAt.getFullYear();
    const start = new Date(year, 0, 1);
    const days = Math.floor((startAt - start) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    
    return {
      firstName: name.first || "Unknown",
      lastName: name.last || "Unknown", 
      startAt: startAt.toISOString(),
      finalDuration: node.finalDuration || 0,
      isoYear: year,
      isoWeek: week,
      isoYearWeek: `${year}-W${week.toString().padStart(2, '0')}`,
      plumber: `${name.first || "Unknown"} ${name.last || "Unknown"}`,
      hours: (node.finalDuration || 0) / 3600 // Convert seconds to hours
    };
  });
}

// Calculate profit metrics (matches Python reporting logic)
function calculateProfitMetrics(invoicedHours, workedHours, plumberName, actualRevenue) {
  const leadRate = BUSINESS_RATES.LEAD_PLUMBER_RATES[plumberName] || 0;
  const totalHourlyCost = leadRate + BUSINESS_RATES.SUPPORT_PLUMBER_RATE + BUSINESS_RATES.FIXED_OVERHEAD_RATE;

  const revenue = actualRevenue || 0; // use actual revenue derived from invoice line items
  const totalCost = workedHours * totalHourlyCost;
  const profit = revenue - totalCost;
  const profitMargin = revenue > 0 ? (profit / revenue * 100) : 0;

  return {
    revenue: Math.round(revenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    profitMargin: Math.round(profitMargin * 10) / 10
  };
}

// Main function to generate plumber report with real data
async function generatePlumberReport(account, plumberName, options = {}) {
  const { refresh = false, year: yearOverride, includeInvoiceItems = false } = options;
  console.log(`[JOBBER-QUERIES] Generating report for ${plumberName} using account ${account.id} refresh=${refresh} yearOverride=${yearOverride || 'current'}`);
  
  try {
    // Determine year range
    const now = new Date();
    const targetYear = yearOverride ? parseInt(yearOverride, 10) : now.getFullYear();
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = (targetYear === now.getFullYear()) ? now : new Date(targetYear, 11, 31, 23, 59, 59, 999);
    const startDate = yearStart;
    const endDate = yearEnd;
    
    console.log(`[JOBBER-QUERIES] Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
    
    // Process each month with progress tracking and error resilience
    const months = [];
    let currentDate = new Date(startDate);
    let monthCount = 0;
    
    // Calculate total months to process for progress tracking
    const totalMonths = Math.ceil((endDate - startDate) / (30 * 24 * 60 * 60 * 1000));
    console.log(`[JOBBER-QUERIES] Processing ${totalMonths} months of data for ${plumberName}`);
    
    while (currentDate <= endDate) {
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      if (monthEnd > endDate) monthEnd.setTime(endDate.getTime());
      
      monthCount++;
      console.log(`[JOBBER-QUERIES] Processing month ${monthCount}/${totalMonths}: ${formatDate(currentDate)} to ${formatDate(monthEnd)}`);
      
      try {
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth() + 1;
        const isCurrentMonth = (y === now.getFullYear() && m === (now.getMonth() + 1));
        let monthData;
        // Attempt disk slice reuse
        const existing = readMonthSlice(plumberName, y, m);
        if (existing && sliceFreshEnough(existing, isCurrentMonth, refresh)) {
          monthData = existing.data.month;
          // Remove debug fields before returning to user
          delete monthData.cached;
          delete monthData.cacheFile;
        } else {
          // Fetch fresh and write slice
            monthData = await fetchMonthData(account, plumberName, currentDate, monthEnd, { includeInvoiceItems });
            writeMonthSlice(plumberName, y, m, monthData);
            // Remove debug fields before returning to user
            delete monthData.cached;
            delete monthData.cacheFile;
        }
        months.push(monthData);
        
        // Add delay between months to respect rate limits (Jobber restores 500 points/sec, our queries cost 145-685 points)
        if (monthCount < totalMonths) {
          console.log(`[JOBBER-QUERIES] Waiting 2 seconds before next month to respect API rate limits...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`[JOBBER-QUERIES] Error processing month ${monthCount}, using fallback data:`, error.message);
        // Add fallback month data to maintain report structure
        const monthCode = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
        months.push({
          month: monthCode,
          monthName: monthName,
          invoicedHours: 0,
            workedHours: 0,
          utilization: 0,
          revenue: 0,
          totalCost: 0,
          profit: 0,
          profitMargin: 0,
          hourlyRate: 0, // realized hourly rate (no legacy billable rate)
          error: true,
          errorMessage: error.message || 'unknown error'
        });
      }
      
      // Move to next month
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }
    
    // Calculate totals and return formatted data
    const totals = months.reduce((acc, month) => ({
      totalInvoicedHours: acc.totalInvoicedHours + month.invoicedHours,
      totalWorkedHours: acc.totalWorkedHours + month.workedHours,
      totalRevenue: acc.totalRevenue + month.revenue,
      totalProfit: acc.totalProfit + month.profit
    }), { totalInvoicedHours: 0, totalWorkedHours: 0, totalRevenue: 0, totalProfit: 0 });
    
    const avgUtilization = totals.totalWorkedHours > 0 ? 
      (totals.totalInvoicedHours / totals.totalWorkedHours) * 100 : 0;
    const avgMargin = totals.totalRevenue > 0 ? (totals.totalProfit / totals.totalRevenue) * 100 : 0;
    const avgHourlyRate = totals.totalInvoicedHours > 0 ? totals.totalRevenue / totals.totalInvoicedHours : 0;
    
    // Count successful vs error months
    const successfulMonths = months.filter(m => !m.error).length;
    const errorMonths = months.filter(m => m.error).length;
    const periodYear = targetYear;
    const periodLabel = errorMonths > 0 ? 
      `Year to Date ${periodYear} (REAL DATA - ${successfulMonths}/${monthCount} months successful)` :
      `Year to Date ${periodYear} (REAL DATA - ${monthCount} months)`;
    
    return {
      plumber: plumberName,
      summary: {
        periodLabel: periodLabel,
        totalInvoicedHours: Math.round(totals.totalInvoicedHours * 10) / 10,
        totalWorkedHours: Math.round(totals.totalWorkedHours * 10) / 10,
        totalProfit: Math.round(totals.totalProfit),
        totalRevenue: Math.round(totals.totalRevenue),
        avgProfitMargin: Math.round(avgMargin * 10) / 10,
        avgUtilization: Math.round(avgUtilization * 10) / 10,
        avgHourlyRate: Math.round(avgHourlyRate * 100) / 100
      },
      monthlyData: months,
      meta: { year: periodYear, refreshRequested: !!refresh, monthCacheTtlMs: MONTH_CACHE_TTL_MS, successfulMonths, errorMonths, totalMonths: monthCount }
    };
    
  } catch (error) {
    console.error(`[JOBBER-QUERIES] Error generating report for ${plumberName}:`, error);
    throw error;
  }
}

// Simplified month data fetching (avoids complex GraphQL CustomFieldUnion issues)
async function fetchMonthData(account, plumberName, startDate, endDate, options = {}) {
  const { includeInvoiceItems = false } = options;
  try {
    console.log(`[JOBBER-QUERIES] Fetching REAL Jobber data for ${plumberName} from ${formatDate(startDate)} to ${formatDate(endDate)}`);
    const monthName = startDate.toLocaleDateString('en-US', { month: 'long' });
    const monthCode = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

    // 1. Fetch timesheet entries for this plumber in this month
    const JobberAPIService = require('./JobberAPIService');
    const service = new JobberAPIService();
    await service.ensureValidToken();

    // Fetch all timesheet entries for the month with pagination
    const timesheetQuery = getTimesheetEntriesQuery(startDate, endDate);
    let allEntries = [];
    let tsHasNextPage = true;
    let tsCursor = null;
    let tsQueryCount = 0;
    const tsMaxQueries = 15; // Increased from 2 to handle larger datasets (15 * 20 = 300 entries max)

    while (tsHasNextPage && tsQueryCount < tsMaxQueries) {
      const variables = { after: tsCursor };
      const timesheetResult = await service.query(timesheetQuery, variables);
      const timesheetData = timesheetResult.timeSheetEntries || {};
      const timesheetEdges = timesheetData.edges || [];
      
      allEntries.push(...timesheetEdges);
      
      tsHasNextPage = timesheetData.pageInfo?.hasNextPage || false;
      tsCursor = timesheetData.pageInfo?.endCursor || null;
      tsQueryCount++;
      
      console.log(`[JOBBER-QUERIES] Fetched ${timesheetEdges.length} timesheet entries (batch ${tsQueryCount})`);
      
      // Small delay to avoid hitting rate limits (Jobber API: 500 points restored per second)
      if (tsHasNextPage && tsQueryCount < tsMaxQueries) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`[JOBBER-QUERIES] Total timesheet entries fetched: ${allEntries.length}`);
    // Filter for this plumber
    const plumberFullName = PLUMBER_MAPPINGS[plumberName.toLowerCase()] || plumberName;
    const plumberEntries = allEntries.filter(e => {
      const n = e.node.user?.name || {};
      return `${n.first} ${n.last}`.toLowerCase().includes(plumberFullName.toLowerCase());
    });
    const workedHours = plumberEntries.reduce((sum, e) => sum + ((e.node.finalDuration || 0) / 3600), 0);

    // 2. Fetch invoices for this month with pagination support (UNBOUNDED unless env limit set)
  const invoicesQuery = getInvoicesQueryV2(startDate, endDate);
    let allInvoices = [];
    let invHasNextPage = true;
    let invCursor = null;
    let invQueryCount = 0;
    const pageLimitEnv = process.env.INVOICE_PAGE_LIMIT ? parseInt(process.env.INVOICE_PAGE_LIMIT, 10) : null;
    const invoicePageSize = process.env.INVOICE_PAGE_SIZE ? parseInt(process.env.INVOICE_PAGE_SIZE, 10) : 20;
    const lineItemPageSize = process.env.INVOICE_LINEITEM_PAGE_SIZE ? parseInt(process.env.INVOICE_LINEITEM_PAGE_SIZE, 10) : 50; // was 20

    while (invHasNextPage && (pageLimitEnv == null || invQueryCount < pageLimitEnv)) {
      const variables = { 
        invFirst: invoicePageSize,
        liFirst: lineItemPageSize,
        after: invCursor 
      };
      if (DEBUG) console.log(`[CRITICAL-DEBUG] Invoice page vars: ${JSON.stringify(variables)}`);

      const invoicesResult = await service.query(invoicesQuery, variables);
      const invoicesData = invoicesResult.invoices || {};
      const invoiceEdges = invoicesData.edges || [];
      allInvoices.push(...invoiceEdges);

      invHasNextPage = invoicesData.pageInfo?.hasNextPage || false;
      invCursor = invoicesData.pageInfo?.endCursor || null;
      invQueryCount++;
      console.log(`[JOBBER-QUERIES] Fetched ${invoiceEdges.length} invoices (page ${invQueryCount}) hasNext=${invHasNextPage}`);

      if (invHasNextPage && (pageLimitEnv == null || invQueryCount < pageLimitEnv)) {
        // Slight delay for rate limit friendliness
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    if (pageLimitEnv != null && invHasNextPage) {
      console.warn(`[JOBBER-QUERIES][WARN] Invoice pagination stopped early at configured limit INVOICE_PAGE_LIMIT=${pageLimitEnv}. Results may be incomplete.`);
    }
    console.log(`[JOBBER-QUERIES] Total invoices fetched: ${allInvoices.length} (pages=${invQueryCount})`);

    // Detect potential line item truncation (no secondary fetch implemented yet)
    if (DEBUG) {
      const truncated = allInvoices.filter(edge => {
        const li = edge.node.lineItems;
        const liEdges = li?.edges || [];
        const liHasNext = li?.pageInfo?.hasNextPage;
        return liHasNext === true || (liEdges.length === lineItemPageSize && lineItemPageSize >= 50); // heuristic
      }).map(e => e.node.invoiceNumber);
      if (truncated.length) {
        console.warn(`[JOBBER-QUERIES][DEBUG] Potentially truncated line items for invoices: ${truncated.join(', ')}`);
      }
    }
    
    // Process invoice data to exclude "Job Details" (matches Python reference logic)
    const invoiceLineItems = processInvoiceData(allInvoices);
    
    // Filter for this specific plumber and exclude "Job Details" line items
    // Check both short name (API input) and full name (invoice custom field) for matching
    const plumberInvoiceName = PLUMBER_MAPPINGS[plumberName.toLowerCase()] || plumberName;
    
    // DEBUG: Log invoice lead plumber names to identify the issue
  const uniqueLeadPlumbers = [...new Set(invoiceLineItems.map(item => item.leadPlumber))];
  if (DEBUG) console.log(`[DEBUG] Unique Lead Plumbers found in invoices: ${JSON.stringify(uniqueLeadPlumbers)}`);
  if (DEBUG) console.log(`[DEBUG] Looking for plumber: "${plumberName}" or "${plumberInvoiceName}"`);
    
    const plumberInvoiceItems = invoiceLineItems.filter(item => 
      (item.leadPlumber === plumberName || item.leadPlumber === plumberInvoiceName) && !item.isJobDetails
    );
    
    if (DEBUG) console.log(`[DEBUG] Matched ${plumberInvoiceItems.length} invoice items for ${plumberName}`);
    
    // Calculate revenue from adjusted quantities (matches Python: sum of adjustedQuantity * unitPrice)
    const revenue = plumberInvoiceItems.reduce((sum, item) => 
      sum + (item.adjustedQuantity * item.unitPrice), 0
    );
    
    // UPDATED: Use direct adjusted quantity sum method (like Python reference)
    // Instead of: invoicedHours = revenue / BILLABLE_RATE
    const invoicedHours = plumberInvoiceItems.reduce((sum, item) => 
      sum + item.adjustedQuantity, 0
    );

  const metrics = calculateProfitMetrics(invoicedHours, workedHours, plumberName, revenue);
    const utilization = workedHours > 0 ? (invoicedHours / workedHours) * 100 : 0;

    const monthPayload = {
      month: monthCode,
      monthName: monthName,
      invoicedHours: Math.round(invoicedHours * 10) / 10,
      workedHours: Math.round(workedHours * 10) / 10,
      utilization: Math.round(utilization * 10) / 10,
      revenue: Math.round(revenue * 100) / 100,
      totalCost: metrics.totalCost,
      profit: metrics.profit,
      profitMargin: metrics.profitMargin,
  // Realized hourly rate derived from actual revenue and invoiced hours (Option B)
  hourlyRate: invoicedHours > 0 ? Math.round((revenue / invoicedHours) * 100) / 100 : 0
    };
    if (includeInvoiceItems) {
      monthPayload.invoiceItems = plumberInvoiceItems;
      monthPayload.rawInvoiceLineItems = invoiceLineItems; // for deep diff if needed
    }
    return monthPayload;
  } catch (error) {
    console.error(`[JOBBER-QUERIES] Error fetching month data:`, error);
    throw error;
  }
}

module.exports = {
  BUSINESS_RATES,
  PLUMBER_MAPPINGS,
  getInvoicesQuery: getInvoicesQueryV2,
  getTimesheetEntriesQuery,
  processInvoiceData,
  processTimesheetData,
  calculateProfitMetrics,
  formatDate,
  getCustomFieldValue,
  generatePlumberReport,
  fetchMonthData
};