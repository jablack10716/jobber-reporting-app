import React from 'react';
import { Link } from 'react-router-dom';
import './Reports.css';

const Reports: React.FC = () => {
  return (
    <div className="reports-page">
      <div className="container">
        <h1>Jobber Reports</h1>
        <p className="reports-description">
          View detailed performance analytics for each plumber including invoiced vs worked hours, 
          profitability, and utilization metrics.
        </p>
        
        <div className="report-cards">
          <div className="report-card">
            <h2>Combined Plumber Comparison</h2>
            <p>Compare all three plumbers side-by-side with monthly hours and profitability</p>
            <Link to="/reports/combined" className="report-button">
              View Combined Report
            </Link>
          </div>
          
          <div className="report-card">
            <h2>Lorin Report</h2>
            <p>Individual performance metrics and year-to-date summary for Lorin</p>
            <Link to="/reports/lorin" className="report-button">
              View Lorin's Report
            </Link>
          </div>
          
          <div className="report-card">
            <h2>Wes Report</h2>
            <p>Individual performance metrics and year-to-date summary for Wes</p>
            <Link to="/reports/wes" className="report-button">
              View Wes's Report
            </Link>
          </div>
          
          <div className="report-card">
            <h2>Elijah Report</h2>
            <p>Individual performance metrics and year-to-date summary for Elijah</p>
            <Link to="/reports/elijah" className="report-button">
              View Elijah's Report
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
