// Business rates configuration
export type PlumberName = 'Lorin' | 'Wes' | 'Elijah';

export const BUSINESS_RATES = {
  // Billable rates per plumber (what clients are charged)
  billableRates: {
    'Lorin': 85,    // Master plumber rate
    'Wes': 75,      // Journeyman rate  
    'Elijah': 70    // Apprentice rate
  } as Record<PlumberName, number>,
  
  // Labor costs (what plumbers are paid)
  laborRates: {
    'Lorin': 35,    // Lorin's hourly wage
    'Wes': 28,      // Wes's hourly wage
    'Elijah': 22    // Elijah's hourly wage
  } as Record<PlumberName, number>,
  
  // Overhead costs per billable hour
  overhead: {
    // Variable overhead per plumber per billable hour
    plumberOverhead: {
      'Lorin': 12,    // Tools, truck maintenance, insurance per hour
      'Wes': 10,      // Tools, truck maintenance, insurance per hour  
      'Elijah': 8     // Tools, truck maintenance, insurance per hour
    } as Record<PlumberName, number>,
    
    // Fixed overhead allocated per billable hour across all plumbers
    fixedOverheadPerHour: 15  // Office rent, utilities, admin costs, etc.
  },
  
  // Utilization targets (worked hours / invoiced hours)
  utilizationTargets: {
    excellent: 85,  // 85%+ utilization
    good: 75,       // 75-84% utilization
    poor: 75        // Below 75% needs improvement
  }
};

// Helper function to get all rates for a plumber
export const getPlumberRates = (plumberName: PlumberName) => {
  return {
    billableRate: BUSINESS_RATES.billableRates[plumberName] || BUSINESS_RATES.billableRates['Lorin'],
    laborRate: BUSINESS_RATES.laborRates[plumberName] || BUSINESS_RATES.laborRates['Lorin'],
    plumberOverhead: BUSINESS_RATES.overhead.plumberOverhead[plumberName] || BUSINESS_RATES.overhead.plumberOverhead['Lorin'],
    fixedOverhead: BUSINESS_RATES.overhead.fixedOverheadPerHour
  };
};

// Calculate total cost per worked hour for a plumber
export const calculateHourlyCost = (plumberName: PlumberName) => {
  const rates = getPlumberRates(plumberName);
  return rates.laborRate + rates.plumberOverhead + rates.fixedOverhead;
};

// Calculate profit for a given hours scenario
export const calculateProfit = (plumberName: PlumberName, invoicedHours: number, workedHours: number) => {
  const rates = getPlumberRates(plumberName);
  
  // Revenue = invoiced hours * billable rate
  const revenue = invoicedHours * rates.billableRate;
  
  // Total cost = worked hours * (labor rate + plumber overhead + fixed overhead)
  const totalCost = workedHours * (rates.laborRate + rates.plumberOverhead + rates.fixedOverhead);
  
  return {
    revenue,
    totalCost,
    profit: revenue - totalCost,
    margin: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0
  };
};