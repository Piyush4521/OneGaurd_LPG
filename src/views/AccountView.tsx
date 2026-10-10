import React, { useState } from 'react';
import { User, Download, Trash2, ShieldCheck, FileText, Flame } from 'lucide-react';
import { dataService } from '../services/dataService';

interface AccountViewProps {
  onNavigate: (view: string) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({ onNavigate }) => {
  const user = dataService.getCurrentUser();
  const [purged, setPurged] = useState(false);

  const handleExportData = () => {
    const data = {
      user: dataService.getCurrentUser(),
      device: dataService.getDeviceMetadata(),
      telemetry: dataService.getTelemetry(),
      events: dataService.getEvents(),
      settings: dataService.getSettings(),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onegaurd_telemetry_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePurgeData = () => {
    if (window.confirm('Are you sure you want to purge all stored telemetry and events? This action cannot be undone.')) {
      localStorage.removeItem('onegaurd_alert_events');
      setPurged(true);
      setTimeout(() => setPurged(false), 3000);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
          Account &amp; Cryptographic Identity
        </h1>
        <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
          Manage your authenticated session, data export workflows, and privacy controls
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <User size={18} color="#0d9488" />
            <span>Profile Information</span>
          </div>
          <span className="status-pill normal" style={{ fontSize: '0.75rem' }}>
            Authenticated Session
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>User Display Name</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginTop: '0.25rem' }}>
              {user.displayName}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Email Address</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginTop: '0.25rem' }}>
              {user.email}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Firebase UID (Owner Key)</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#0f172a', marginTop: '0.25rem' }}>
              {user.uid}
            </div>
          </div>
        </div>
      </div>

      {/* Firebase Production Cloud Infrastructure Card */}
      <div className="card glass-card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <Flame size={18} color="#0d9488" />
            <span>Connected Firebase Project Infrastructure</span>
          </div>
          <span className="status-pill normal" style={{ fontSize: '0.75rem' }}>
            Live Sync Active
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
          <div className="firebase-meta-chip">
            <span className="chip-label">Project ID</span>
            <span className="chip-value text-glow-cyan">onegaurd-e63c0</span>
          </div>
          <div className="firebase-meta-chip">
            <span className="chip-label">Auth Domain</span>
            <span className="chip-value">onegaurd-e63c0.firebaseapp.com</span>
          </div>
          <div className="firebase-meta-chip">
            <span className="chip-label">Storage Bucket</span>
            <span className="chip-value">onegaurd-e63c0.firebasestorage.app</span>
          </div>
          <div className="firebase-meta-chip">
            <span className="chip-label">Measurement ID</span>
            <span className="chip-value">G-SF2QEKN3BL</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <ShieldCheck size={18} color="#0d9488" />
            <span>Data Sovereignty &amp; Privacy Governance</span>
          </div>
        </div>

        <p style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '1rem' }}>
          Download your complete cryptographic device ledger and telemetry records or purge your stored incident history.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportData}>
            <Download size={16} />
            <span>Export Telemetry Records (JSON)</span>
          </button>

          <button className="btn btn-danger" onClick={handlePurgeData}>
            <Trash2 size={16} />
            <span>Purge Incident History</span>
          </button>
        </div>

        {purged && (
          <div style={{ marginTop: '1rem', color: '#059669', fontSize: '0.8125rem', fontWeight: 600 }}>
            Incident history purged successfully.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileText size={18} color="#64748b" />
            <span>Compliance &amp; Legal Policies</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('privacy')}
          >
            <span>Review Privacy Policy</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('terms')}
          >
            <span>Review Terms and Conditions</span>
          </button>
        </div>
      </div>
    </div>
  );
};
