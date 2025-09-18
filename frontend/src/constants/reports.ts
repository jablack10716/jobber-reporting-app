import { PlumberColors, PlumberName } from '../types/reports';

// Business logic constants matching Python implementation
export const BUSINESS_CONSTANTS = {
  BILLABLE_RATE: 120, // $120/hour
  LEAD_PLUMBER_RATE: 35, // $35/hour
  SUPPORT_PLUMBER_RATE: 25, // $25/hour
  FIXED_OVERHEAD_RATE: 15, // $15/hour
} as const;

// Professional color palette matching Python charts
export const PLUMBER_COLORS: Record<PlumberName | 'Default', PlumberColors> = {
  'Lorin': { 
    main: '#445D6E', 
    light: '#8DA3B0',
    invoiced: '#8DA3B0',
    worked: '#445D6E'
  },
  'Wes': { 
    main: '#445D6E', 
    light: '#8DA3B0',
    invoiced: '#A8B8C8',
    worked: '#5A6D7E'
  },
  'Elijah': { 
    main: '#445D6E', 
    light: '#8DA3B0',
    invoiced: '#B8C8D8',
    worked: '#6A7D8E'
  },
  'Default': { 
    main: '#4F4F4F', 
    light: '#939393',
    invoiced: '#939393',
    worked: '#4F4F4F'
  }
} as const;

// Chart configuration
export const CHART_CONFIG = {
  height: 400,
  margin: { top: 20, right: 30, left: 20, bottom: 5 },
  barGap: 10,
  categoryGap: '20%'
} as const;

// API configuration
export const API_CONFIG = {
  baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  endpoints: {
    plumberReport: '/api/reports/plumber',
    combinedReport: '/api/reports/combined',
    health: '/api/health'
  }
} as const;