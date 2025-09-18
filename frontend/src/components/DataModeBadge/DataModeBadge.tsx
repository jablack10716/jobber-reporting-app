import React from 'react';
import './DataModeBadge.css';

interface Props {
  anyMock: boolean;
  reasons?: string[];
  className?: string;
}

export const DataModeBadge: React.FC<Props> = ({ anyMock, reasons = [], className }) => {
  if (!anyMock) return null;
  const label = reasons.length ? reasons.join(', ') : 'mock data active';
  return (
    <span className={`data-mode-badge ${className || ''}`} title={label}>MOCK DATA</span>
  );
};

export default DataModeBadge;