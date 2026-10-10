import React from 'react';
import { Globe } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
            OneGaurd LPG Telemetry Platform
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Production build v1.4.2 (Node 22 LTS / Vite / PWA). Direct hardware fail-safe active.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#475569' }}>
            <Globe size={14} />
            <span>Domain: app.onegaurd.com (SSL Active)</span>
          </div>

          <div className="footer-links">
            <button className="footer-link" onClick={() => onNavigate('privacy')}>
              Privacy Policy
            </button>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <button className="footer-link" onClick={() => onNavigate('terms')}>
              Terms &amp; Conditions
            </button>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <button className="footer-link" onClick={() => onNavigate('settings')}>
              System Settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
