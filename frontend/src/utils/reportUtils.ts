import { PlumberData, YearToDateSummary, PlumberName } from '../types/reports';
import { getPlumberRates, calculateProfit, BUSINESS_RATES } from '../constants/rates';

/**
 * Formats currency values with proper negative handling
 */
export const formatCurrency = (value: number): string => {
  if (value < 0) {
    return `($${Math.abs(value).toLocaleString()})`;
  }
  return `$${value.toLocaleString()}`;
};

/**
 * Formats percentage values with one decimal place
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Generate mock data for a specific plumber (matching Python logic)
 */
export const generateMockData = (plumber: PlumberName): PlumberData[] => {
  const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const data: PlumberData[] = [];
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-based (0 = January, 8 = September)
  const currentYear = currentDate.getFullYear();
  
  // Only generate data up to the current month for 2025
  const maxMonth = currentYear === 2025 ? currentMonth : 11; // If not 2025, show all months
  
  // Different patterns for each plumber to show realistic variations
  const plumberPatterns = {
    'Lorin': { baseHours: 140, variation: 25, efficiency: 0.88, seasonality: 1.0 },
    'Wes': { baseHours: 125, variation: 30, efficiency: 0.82, seasonality: 1.1 },
    'Elijah': { baseHours: 110, variation: 20, efficiency: 0.75, seasonality: 0.9 }
  };
  
  const pattern = plumberPatterns[plumber] || plumberPatterns['Lorin'];
  
  for (let i = 0; i <= maxMonth; i++) {
    // Skip months before July for Elijah (starts July 2025)
    if (plumber === 'Elijah' && i < 6) {
      continue;
    }
    
    // Seasonal adjustments (winter slower, summer busier)
    const seasonalMultiplier = 0.85 + 0.3 * Math.sin((i + 3) * Math.PI / 6) * pattern.seasonality;
    
    // Generate realistic monthly hours with variations
    const invoicedHours = Math.round(pattern.baseHours * seasonalMultiplier * (0.8 + Math.random() * 0.4));
    const workedHours = Math.round(invoicedHours * pattern.efficiency * (0.95 + Math.random() * 0.1));
    
    // Use proper business rates for calculations
    const rates = getPlumberRates(plumber);
    const financial = calculateProfit(plumber, invoicedHours, workedHours);
    const utilization = invoicedHours > 0 ? (workedHours / invoicedHours) * 100 : 0;
    
    data.push({
      month: months[i],
      monthName: monthNames[i],
      invoicedHours,
      workedHours,
      profit: Math.round(financial.profit),
      profitMargin: Math.round(financial.margin * 10) / 10,
      utilization: Math.round(utilization * 10) / 10,
      revenue: Math.round(financial.revenue),
      totalCost: Math.round(financial.totalCost),
      hourlyRate: rates.billableRate
    });
  }
  
  return data;
};

/**
 * Generate Year-to-Date summary from monthly data with proper business calculations
 */
export const generateYTDSummary = (data: PlumberData[], plumber: PlumberName): YearToDateSummary => {
  // Sum up all the totals for the year
  const totals = data.reduce((acc, item) => ({
    totalInvoicedHours: acc.totalInvoicedHours + item.invoicedHours,
    totalWorkedHours: acc.totalWorkedHours + item.workedHours,
    totalProfit: acc.totalProfit + item.profit,
    totalRevenue: acc.totalRevenue + item.revenue
  }), { 
    totalInvoicedHours: 0, 
    totalWorkedHours: 0, 
    totalProfit: 0, 
    totalRevenue: 0
  });
  
  // Get the plumber's rates for calculations
  const rates = getPlumberRates(plumber);
  
  // Calculate utilization (Worked Hours / Invoiced Hours) as percentage
  const plumberUtilization = totals.totalInvoicedHours > 0 ? 
    (totals.totalWorkedHours / totals.totalInvoicedHours) * 100 : 0;
  
  // Ensure utilization is a valid number
  const validUtilization = isNaN(plumberUtilization) ? 0 : plumberUtilization;
  
  // Calculate average profit margin
  const avgMargin = totals.totalRevenue > 0 ? (totals.totalProfit / totals.totalRevenue) * 100 : 0;
  
  // The billable rate is consistent per plumber from our rates system
  const avgHourlyRate = rates.billableRate;

  // Generate proper period label based on actual data range
  let periodLabel: string;
  if (plumber === 'Elijah') {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-based
    const endMonth = currentMonth === 8 ? 'Sep' : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonth];
    periodLabel = `Jul-${endMonth} 2025`;
  } else {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-based  
    const endMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentMonth];
    periodLabel = `Jan-${endMonth} 2025`;
  }
  
  return {
    totalInvoicedHours: Math.round(totals.totalInvoicedHours * 10) / 10,
    totalWorkedHours: Math.round(totals.totalWorkedHours * 10) / 10,
    totalProfit: Math.round(totals.totalProfit),
    totalRevenue: Math.round(totals.totalRevenue),
    avgProfitMargin: Math.round(avgMargin * 10) / 10,
    avgUtilization: Math.round(validUtilization * 10) / 10,
    avgHourlyRate: avgHourlyRate,
    periodLabel
  };
};

/**
 * Export data to CSV format
 */
export const exportToCSV = (data: PlumberData[], plumber: string): string => {
  const headers = ['Month', 'Invoiced Hours', 'Worked Hours', 'Utilization %', 'Hourly Rate', 'Revenue', 'Total Cost', 'Profit', 'Profit Margin %'];
  const csvData = data.map(row => [
    row.monthName || row.month,
    row.invoicedHours,
    row.workedHours,
    row.utilization,
    row.hourlyRate ? `$${row.hourlyRate}` : 'N/A',
    `$${row.revenue}`,
    `$${row.totalCost}`,
    `$${row.profit}`,
    `${row.profitMargin}%`
  ]);

  return [headers, ...csvData].map(row => row.join(',')).join('\n');
};