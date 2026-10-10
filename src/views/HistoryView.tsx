import React, { useState } from 'react';
import { Filter, CheckCircle2 } from 'lucide-react';
import { AlertEvent } from '../types/telemetry';

interface HistoryViewProps {
  events: AlertEvent[];
  onAcknowledge: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ events, onAcknowledge }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const filteredEvents = events.filter((evt) => {
    if (filterSeverity === 'all') return true;
    return evt.severity === filterSeverity;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
            Safety Incident &amp; Telemetry Audit Log
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Immutable chronological record of threshold triggers, hardware diagnostic events, and alert dispatches
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={14} color="#64748b" />
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Filter:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.375rem 0.625rem', fontSize: '0.8125rem' }}
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="all">All Events ({events.length})</option>
            <option value="critical">Critical Leaks Only</option>
            <option value="warning">Warnings Only</option>
            <option value="info">System Info / Diagnostics</option>
          </select>
        </div>
      </div>

      <div className="card">
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
            <p style={{ fontSize: '0.875rem' }}>No incident events match the selected filter criteria.</p>
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Timestamp</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Incident Report</th>
                  <th>Telemetry Snapshot</th>
                  <th>Notification Delivery</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((evt) => (
                  <tr key={evt.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{evt.id}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(evt.createdAt).toLocaleString()}</td>
                    <td>
                      <span
                        className={`status-pill ${evt.severity === 'critical' ? 'critical' : evt.severity === 'warning' ? 'caution' : 'normal'}`}
                        style={{ fontSize: '0.6875rem', padding: '0.125rem 0.375rem' }}
                      >
                        {evt.severity}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize', fontSize: '0.75rem', color: '#475569' }}>
                      {evt.type.replace('_', ' ')}
                    </td>
                    <td style={{ maxWidth: '300px' }}>{evt.message}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      Gas: {evt.gasRaw} ADC | Mass: {evt.weightKg.toFixed(2)} kg
                    </td>
                    <td>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        <div>Push: <span style={{ color: evt.deliveryStatus.push === 'delivered' ? '#059669' : '#64748b' }}>{evt.deliveryStatus.push}</span></div>
                        <div>SMS: <span style={{ color: evt.deliveryStatus.sms === 'delivered' ? '#059669' : '#64748b' }}>{evt.deliveryStatus.sms}</span></div>
                        <div>Voice: <span style={{ color: evt.deliveryStatus.voice === 'delivered' ? '#059669' : '#64748b' }}>{evt.deliveryStatus.voice}</span></div>
                      </div>
                    </td>
                    <td>
                      {evt.acknowledged ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>
                          <CheckCircle2 size={12} />
                          <span>Acknowledged</span>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onAcknowledge(evt.id)}
                        >
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
