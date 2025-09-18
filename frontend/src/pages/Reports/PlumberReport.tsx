import React, { useEffect, useState, useCallback } from 'react';
import { 
  BarChart,
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { Link } from 'react-router-dom';
import './PlumberReport.css';
import { PlumberData, YearToDateSummary, PlumberName } from '../../types/reports';
import { PLUMBER_COLORS, CHART_CONFIG, API_CONFIG } from '../../constants/reports';
import { formatCurrency, formatPercentage, generateMockData, generateYTDSummary, exportToCSV } from '../../utils/reportUtils';
import DataModeWatermark from '../../components/DataModeWatermark/DataModeWatermark';

type Props = {
  plumber: string;
};

const PlumberReport: React.FC<Props> = ({ plumber }) => {
  const [data, setData] = useState<PlumberData[]>([]);
  const [ytdSummary, setYtdSummary] = useState<YearToDateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataModeMeta, setDataModeMeta] = useState<any>(null);

  const fetchPlumberData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching data for plumber:', plumber);
      const response = await fetch(`${API_CONFIG.baseUrl}/api/reports/plumber?name=${plumber}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      const result = await response.json();
      console.log('API response:', result);
      
      // Fix: API returns monthlyData, not data
      const monthlyData = result.monthlyData || [];
      // Normalize summary field naming (backend recently renamed avgMargin -> avgProfitMargin)
      let summary = result.summary || null;
      if (summary) {
        if (summary.avgMargin !== undefined && summary.avgProfitMargin === undefined) {
          summary = { ...summary, avgProfitMargin: summary.avgMargin };
        }
      }
      
      console.log('Monthly data length:', monthlyData.length);
      console.log('Summary:', summary);
      console.log('Raw monthly data:', monthlyData);
      
      // Transform API data to match chart expectations - compute a fallback margin if missing / zero
      const transformedData = monthlyData.map((item: any) => {
        const revenue = item.revenue ?? 0;
        const profit = item.profit ?? 0;
        // Accept backend margin only if it is non-null/undefined, otherwise compute
        let margin = (typeof item.profitMargin === 'number') ? item.profitMargin : (revenue > 0 ? (profit / revenue) * 100 : 0);
        // If backend supplied 0 but profit & revenue suggest a non-zero margin due to rounding, recompute
        if (margin === 0 && revenue > 0 && profit !== 0) {
          margin = (profit / revenue) * 100;
        }
        // Keep one decimal place rounding here; original raw kept via computedMarginRaw if needed
        const computedMargin = Math.round(margin * 10) / 10;
        return {
          monthName: item.monthName || item.month,  // Use monthName for display, fallback to month code
          invoicedHours: item.invoicedHours ?? 0,
          workedHours: item.workedHours ?? 0,
            revenue,
            profit,
            // Maintain both original backend value and computed margin for debugging
            profitMargin: computedMargin,
            computedMarginRaw: margin,
            // Provide a dedicated display field (future-proof if formatting changes)
            displayProfitMargin: computedMargin,
          utilization: item.utilization ?? 0
        };
      });
      
      console.log('Transformed data for chart:', transformedData);
      
  setData(transformedData);
      setYtdSummary(summary);
  setDataModeMeta(result.meta || null);
      // Expose for DevTools debugging
      if (typeof window !== 'undefined') {
        (window as any).__plumberReportData = {
          plumber,
          summary,
          monthlyDataRaw: monthlyData,
          transformedData
        };
      }
    } catch (err) {
      console.warn('Backend not available, using mock data:', err);
      // Use mock data as fallback when backend is not available
      const mockData = generateMockData(plumber as PlumberName);
  const mockSummary = generateYTDSummary(mockData, plumber as PlumberName);
      setData(mockData);
      setYtdSummary(mockSummary);
  setDataModeMeta({ dataMode: 'mock', reason: 'frontend_offline_fallback' });
      // Don't set error state since we have fallback data
    } finally {
      setLoading(false);
    }
  }, [plumber]);

  useEffect(() => {
    fetchPlumberData();
  }, [fetchPlumberData]);

  const exportToCsv = () => {
    const csv = exportToCSV(data, plumber);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${plumber}_monthly_report_${new Date().getFullYear()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const colors = PLUMBER_COLORS[plumber as PlumberName] || PLUMBER_COLORS.Default;

  if (loading) {
    return (
      <div className="plumber-report">
        <div className="loading">Loading {plumber}'s report...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plumber-report">
        <div className="error">
          <h2>Error loading report</h2>
          <p>{error}</p>
          <button onClick={fetchPlumberData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="plumber-report">
      <DataModeWatermark meta={dataModeMeta} />
      <div className="report-header">
        <Link to="/reports" className="back-link">← Back to Reports</Link>
        <h1>{plumber} Monthly Performance Report</h1>
        <button onClick={exportToCsv} className="export-button">
          Export to CSV
        </button>
      </div>

      {ytdSummary && (
        <div className="ytd-summary">
          <h3>{ytdSummary.periodLabel} Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Total Hours Invoiced:</span>
              <span className="summary-value">
                {ytdSummary.totalInvoicedHours ? ytdSummary.totalInvoicedHours.toFixed(1) : 'N/A'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Hours Worked:</span>
              <span className="summary-value">
                {ytdSummary.totalWorkedHours ? ytdSummary.totalWorkedHours.toFixed(1) : 'N/A'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Plumber Utilization (Worked/Invoiced):</span>
              <span className={`summary-value ${
                ytdSummary.avgUtilization && ytdSummary.avgUtilization >= 40 ? 'good' : 'needs-improvement'
              }`}>
                {ytdSummary.avgUtilization ? ytdSummary.avgUtilization.toFixed(1) + '%' : 'N/A'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Revenue:</span>
              <span className="summary-value">
                {ytdSummary.totalRevenue ? formatCurrency(ytdSummary.totalRevenue) : 'N/A'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Profit:</span>
              <span className={`summary-value ${ytdSummary.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(ytdSummary.totalProfit)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Profit Margin:</span>
              <span className={`summary-value ${ytdSummary.avgProfitMargin >= 0 ? 'positive' : 'negative'}`}>
                {ytdSummary.avgProfitMargin ? ytdSummary.avgProfitMargin.toFixed(1) + '%' : 'N/A'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Billable Rate:</span>
              <span className="summary-value">
                {ytdSummary.avgHourlyRate ? `$${ytdSummary.avgHourlyRate.toFixed(0)}/hr` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="chart-container">
        <h3>Monthly Hours Performance</h3>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={data}
              margin={{ top: 80, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="monthName" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                tickFormatter={(value) => value || 'N/A'}
              />
              <YAxis 
                domain={[0, 250]}
              />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name === 'Invoiced Hours' || name === 'Worked Hours') {
                    return [`${value.toFixed(1)} hours`, name];
                  }
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0] && payload[0].payload) {
                    return `Month: ${payload[0].payload.monthName || payload[0].payload.month}`;
                  }
                  return `Month: ${label}`;
                }}
              />
              <Legend />
              <Bar 
                dataKey="invoicedHours" 
                fill={colors.light} 
                name="Invoiced Hours"
              >
                <LabelList 
                  dataKey="invoicedHours" 
                  position="top" 
                  formatter={(value: number) => value.toFixed(1)}
                  style={{ fontSize: '12px', fontWeight: 'bold', fill: '#333' }}
                />
              </Bar>
              <Bar 
                dataKey="workedHours" 
                fill={colors.main} 
                name="Worked Hours"
              >
                <LabelList 
                  dataKey="workedHours" 
                  position="top" 
                  formatter={(value: number) => value.toFixed(1)}
                  style={{ fontSize: '12px', fontWeight: 'bold', fill: '#333' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-data">No data available for the selected period</div>
        )}
      </div>

      <div className="chart-container">
        <h3>Monthly Utilization Rate</h3>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="monthName" 
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
                tickFormatter={(value) => value || 'N/A'}
              />
              <YAxis 
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                formatter={(value: any) => [`${value.toFixed(1)}%`, 'Utilization Rate']}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0] && payload[0].payload) {
                    return `Month: ${payload[0].payload.monthName || payload[0].payload.month}`;
                  }
                  return `Month: ${label}`;
                }}
              />
              <Bar 
                dataKey="utilization" 
                name="Utilization Rate"
              >
                <LabelList 
                  dataKey="utilization" 
                  position="top" 
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  style={{ fontSize: '12px', fontWeight: 'bold', fill: '#333' }}
                />
                {data.map((entry, index) => {
                  const value = entry.utilization || 0;
                  // New thresholds (2025-09-18): >=40% green, <40% yellow
                  const fillColor = value >= 40 ? '#28a745' : '#ffc107';
                  return <Cell key={`cell-${index}`} fill={fillColor} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-data">No utilization data available</div>
        )}
      </div>

      <div className="chart-container">
        <h3>Monthly Profit / Loss</h3>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data}
              margin={{ top: 60, right: 30, left: 20, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="monthName" 
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
                tickFormatter={(value) => value || 'N/A'}
              />
              <YAxis 
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip 
                formatter={(value: any, name: any, props: any) => {
                  const margin = props?.payload?.profitMargin || 0;
                  return [`$${value.toLocaleString()} (${margin.toFixed(1)}%)`, 'Profit/Loss'];
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0] && payload[0].payload) {
                    return `Month: ${payload[0].payload.monthName || payload[0].payload.month}`;
                  }
                  return `Month: ${label}`;
                }}
              />
              <Bar 
                dataKey="profit" 
                name="Profit/Loss"
              >
                <LabelList
                  dataKey="profit"
                  content={(props: any) => {
                    const { x, y, width, value, index } = props;
                    
                    // Get the data item directly from the chart data using index
                    const dataItem = data[index];
                    
                    if (value === undefined || value === null || !dataItem) return null;
                    
                    const profitValue = typeof value === 'number' ? value : Number(value) || 0;
                    const marginPct = dataItem.profitMargin || 0;
                    
                    const isPositive = profitValue >= 0;
                    // For negative values, position labels above the X-axis instead of on the bar
                    const baseY = isPositive ? y - 14 : Math.max(y - 30, 20); // Above X-axis for negatives, with minimum Y position
                    const currency = formatCurrency(profitValue);
                    const percent = `${marginPct.toFixed(1)}%`;
                    
                    return (
                      <g>
                        <text
                          x={x + width / 2}
                          y={baseY}
                          textAnchor="middle"
                          fill="#222"
                          fontSize={12}
                          fontWeight="bold"
                        >
                          {currency}
                        </text>
                        <text
                          x={x + width / 2}
                          y={baseY + 12}
                          textAnchor="middle"
                          fill="#333"
                          fontSize={11}
                          fontWeight="normal"
                        >
                          {percent}
                        </text>
                      </g>
                    );
                  }}
                />
                {data.map((entry, index) => {
                  const value = entry.profit || 0;
                  let fillColor = '#dc3545'; // Red for loss
                  if (value > 0) fillColor = '#28a745'; // Green for profit
                  else if (value === 0) fillColor = '#6c757d'; // Gray for break-even
                  return <Cell key={`cell-${index}`} fill={fillColor} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-data">No profit data available</div>
        )}
      </div>
    </div>
  );
};

export default PlumberReport;