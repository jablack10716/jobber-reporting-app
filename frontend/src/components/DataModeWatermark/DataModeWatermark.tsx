import React from 'react';
import './DataModeWatermark.css';

export interface DataModeMeta {
  dataMode: 'mock' | 'real';
  reason?: string;
  authError?: string;
  generatedAt?: string;
}

type Props = {
  meta?: DataModeMeta | null;
  compact?: boolean;
};

const reasonLabels: Record<string, string> = {
  config_USE_REAL_DATA_false: 'Disabled by configuration (USE_REAL_DATA=false)',
  oauth_auth_failure: 'OAuth authentication failure (token expired/invalid)'
};

export const DataModeWatermark: React.FC<Props> = ({ meta, compact }) => {
  if (!meta || meta.dataMode !== 'mock') return null;
  const reason = meta.reason ? (reasonLabels[meta.reason] || meta.reason) : 'Unknown';
  return (
    <div className={`data-mode-watermark ${compact ? 'compact' : ''}`}> 
      <div className="banner">MOCK DATA</div>
      <div className="details">
        <strong>Mock Mode Active</strong>
        <div>Reason: {reason}</div>
        {meta.authError && <div className="auth-error">Auth Error: {meta.authError}</div>}
        {meta.generatedAt && <div className="ts">Generated: {new Date(meta.generatedAt).toLocaleString()}</div>}
        <div className="hint">Set USE_REAL_DATA=true and ensure valid OAuth tokens for live figures.</div>
      </div>
    </div>
  );
};

export default DataModeWatermark;