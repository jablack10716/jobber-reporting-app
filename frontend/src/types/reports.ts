// Shared types for the reporting system
export interface PlumberData {
  month: string;
  monthName?: string;
  invoicedHours: number;
  workedHours: number;
  profit: number;
  profitMargin: number;
  utilization: number;
  revenue: number;
  totalCost: number;
  hourlyRate?: number;
}

export interface YearToDateSummary {
  totalInvoicedHours: number;
  totalWorkedHours: number;
  totalProfit: number;
  totalRevenue: number;
  avgProfitMargin: number;
  avgUtilization: number;
  avgHourlyRate: number;
  periodLabel: string;
}

export interface CombinedData extends PlumberData {
  plumber: string;
}

export interface PlumberColors {
  main: string;
  light: string;
  invoiced: string;
  worked: string;
}

export type PlumberName = 'Lorin' | 'Wes' | 'Elijah';