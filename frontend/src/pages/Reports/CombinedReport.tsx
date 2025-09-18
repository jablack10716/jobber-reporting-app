import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { Link } from 'react-router-dom';
import './CombinedReport.css';
import { PlumberName } from '../../types/reports';
import DataModeWatermark from '../../components/DataModeWatermark/DataModeWatermark';
import DataModeBadge from '../../components/DataModeBadge/DataModeBadge';

interface PlumberMonthlyData {
  month: string;
  monthName: string;
  invoicedHours: number;
  workedHours: number;
  revenue: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  hourlyRate: number;
  // Backend fallback months may include error flag
  error?: boolean;
}

interface PlumberSummary {
  totalInvoicedHours: number;
  totalWorkedHours: number;
  totalProfit: number;
  totalRevenue: number;
  avgProfitMargin: number;
  avgUtilization: number;
  avgHourlyRate: number;
  periodLabel: string;
}

interface PlumberApiResponse {
  monthlyData: PlumberMonthlyData[];
  plumber: string;
  summary: PlumberSummary;
}

interface PlumberDisplayData {
  plumber: PlumberName;
  invoicedHours: number;
  utilization: number;
  profitMargin: number;
}

const CombinedReport: React.FC = () => {
  const [currentMonthData, setCurrentMonthData] = useState<PlumberDisplayData[]>([]);
  const [lastMonthData, setLastMonthData] = useState<PlumberDisplayData[]>([]);
  const [ytdData, setYtdData] = useState<PlumberDisplayData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [notices, setNotices] = useState<string[]>([]);

  const [dataModeMeta, setDataModeMeta] = useState<any>(null);
  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true); setError(null); setDebugInfo('');
    const showDebug = window.location.search.includes('debug=1');
    const debug: string[] = [];
    const noticesLocal: string[] = [];
    try {
      // Use combined endpoint to leverage aggregate meta.anyMock
      const resp = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/reports/combined`);
      if (!resp.ok) throw new Error(`Failed to fetch combined: ${resp.status}`);
      const combined = await resp.json();
      setDataModeMeta(combined.meta || null);
  const responses: { plumber: string; json: any }[] = (combined.plumbers || []).map((p: any) => ({ plumber: p.plumber, json: p }));

      const curr: PlumberDisplayData[] = [];
      const prevArr: PlumberDisplayData[] = [];
      const ytdArr: PlumberDisplayData[] = [];

  responses.forEach(({ plumber, json }: { plumber: string; json: any }) => {
        const monthly = (json.monthlyData || []) as PlumberMonthlyData[];
        const summary = json.summary;
        ytdArr.push({
          plumber: plumber as PlumberName,
          invoicedHours: summary.totalInvoicedHours,
            utilization: summary.avgUtilization,
            profitMargin: summary.avgProfitMargin
        });

        // Filter out error fallback months
        const nonError = monthly.filter(m => !m.error);
        const anyNonZero = nonError.some(m => (m.invoicedHours || 0) > 0 || (m.workedHours || 0) > 0);
        const valid = anyNonZero ? nonError.filter(m => (m.invoicedHours || 0) > 0 || (m.workedHours || 0) > 0) : nonError;

        if (showDebug) {
          debug.push(`${plumber}: months=${monthly.length} nonError=${nonError.length} valid=${valid.length}`);
        }

        if (valid.length === 0) {
          const allErrored = monthly.every(m => m.error);
          if (allErrored) {
            const metaCounts = (json.meta && json.meta.totalMonths != null) ? ` (errors=${json.meta.errorMonths}/${json.meta.totalMonths})` : '';
            noticesLocal.push(`${plumber}: No valid month data - all months failed to fetch${metaCounts}.`);
          } else if (nonError.length > 0 && nonError.every(m => (m.invoicedHours || 0) === 0 && (m.workedHours || 0) === 0)) {
            noticesLocal.push(`${plumber}: No valid month data - fetched months are all zero (no timesheets or invoices matched).`);
          } else {
            noticesLocal.push(`${plumber}: No valid month data.`);
          }
          return;
        }
        const latest = valid[valid.length - 1];
        const previous = valid.length > 1 ? valid[valid.length - 2] : null;
        const latestUtil = latest.workedHours > 0 ? (latest.invoicedHours / latest.workedHours) * 100 : 0;
        curr.push({ plumber: plumber as PlumberName, invoicedHours: latest.invoicedHours, utilization: round1(latestUtil), profitMargin: latest.profitMargin });
        if (previous) {
          const prevUtil = previous.workedHours > 0 ? (previous.invoicedHours / previous.workedHours) * 100 : 0;
          prevArr.push({ plumber: plumber as PlumberName, invoicedHours: previous.invoicedHours, utilization: round1(prevUtil), profitMargin: previous.profitMargin });
        } else {
          noticesLocal.push(`${plumber}: Only one valid month of data.`);
        }
      });

      setCurrentMonthData(curr);
      setLastMonthData(prevArr);
      setYtdData(ytdArr);
      setNotices(noticesLocal);
      if (showDebug) setDebugInfo(debug.join('\n'));
    } catch (e: any) {
      console.error('Failed to load combined plumber data', e);
      setError(e?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const round1 = (n: number) => Math.round(n * 10) / 10;

  const exportToCsv = () => {
    const rows: any[] = [];
    currentMonthData.forEach(p => rows.push({ Period: 'Current Month', Plumber: p.plumber, 'Invoiced Hours': p.invoicedHours, 'Utilization %': p.utilization, 'Profit Margin %': p.profitMargin }));
    lastMonthData.forEach(p => rows.push({ Period: 'Last Month', Plumber: p.plumber, 'Invoiced Hours': p.invoicedHours, 'Utilization %': p.utilization, 'Profit Margin %': p.profitMargin }));
    ytdData.forEach(p => rows.push({ Period: 'Year-to-Date', Plumber: p.plumber, 'Invoiced Hours': p.invoicedHours, 'Utilization %': p.utilization, 'Profit Margin %': p.profitMargin }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `combined_plumber_comparison_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const renderSection = (title: string, data: PlumberDisplayData[]) => (
    <div className="summary-table-container">
      <h3>{title}</h3>
      <table className="summary-table">
        <thead>
          <tr>
            <th>Plumber</th>
            <th>Invoiced Hours</th>
            <th>Utilization</th>
            <th>Profit Margin</th>
          </tr>
        </thead>
        <tbody>
          {data.map(p => (
            <tr key={p.plumber}>
              <td className="plumber-name">{p.plumber}</td>
              <td>{p.invoicedHours.toFixed(1)}</td>
              <td>{p.utilization.toFixed(1)}%</td>
              <td className={p.profitMargin >= 0 ? 'profit-positive' : 'profit-negative'}>{p.profitMargin.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) return <div className="combined-report"><div className="loading">Loading combined plumber comparison...</div></div>;
  if (error) return (
    <div className="combined-report">
      <div className="error">
        <h2>Error loading report</h2>
        <p>{error}</p>
        <button onClick={fetchAll} className="retry-button">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="combined-report">
      <DataModeWatermark meta={dataModeMeta && dataModeMeta.anyMock ? { dataMode: 'mock', reason: (dataModeMeta.mockReasons && dataModeMeta.mockReasons[0]) || 'mixed_mock' } : undefined} compact />
      <div className="report-header">
        <Link to="/reports" className="back-link">← Back to Reports</Link>
        <h1>Combined Plumber Comparison {dataModeMeta?.anyMock && <DataModeBadge anyMock={true} reasons={dataModeMeta.mockReasons} />}</h1>
        <button onClick={exportToCsv} className="export-button">Export to CSV</button>
      </div>
      {notices.length > 0 && (
        <div style={{ backgroundColor: '#fff8e1', border: '1px solid #f0c36d', padding: '10px', margin: '10px 0', borderRadius: 4 }}>
          <strong>Data Notices:</strong>
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            {notices.map(n => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}
      {debugInfo && (
        <details style={{ background: '#f5f5f5', padding: '8px 12px', margin: '12px 0', borderRadius: 4 }}>
          <summary style={{ cursor: 'pointer' }}>Debug Info</summary>
          <pre style={{ fontSize: 11, lineHeight: 1.3 }}>{debugInfo}</pre>
        </details>
      )}
      {renderSection('Current Month Performance', currentMonthData)}
      {renderSection('Last Month Performance', lastMonthData)}
      {renderSection('Year-to-Date Performance', ytdData)}
    </div>
  );
};

export default CombinedReport;