import React from 'react';
import { Shield, Activity, HardDrive, History, Settings, User, Flame } from 'lucide-react';
import { DeviceTelemetry } from '../types/telemetry';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  telemetry: DeviceTelemetry;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, telemetry }) => {
  const isStale = Date.now() - telemetry.lastHeartbeat > 60000;
  const isOnline = telemetry.online && !isStale;

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-section">
          <div className="brand-logo">
            <Shield size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">
              OneGaurd
              <span className="brand-subtitle">LPG Monitor</span>
            </div>
          </div>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
          >
            <Activity size={16} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-link ${currentView === 'devices' ? 'active' : ''}`}
            onClick={() => onNavigate('devices')}
          >
            <HardDrive size={16} />
            <span>Devices</span>
          </button>

          <button
            className={`nav-link ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => onNavigate('history')}
          >
            <History size={16} />
            <span>Event Log</span>
          </button>

          <button
            className={`nav-link ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => onNavigate('settings')}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          <button
            className={`nav-link ${currentView === 'account' ? 'active' : ''}`}
            onClick={() => onNavigate('account')}
          >
            <User size={16} />
            <span>Account</span>
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('account')}
            className="status-pill normal"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.15)', cursor: 'pointer', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            title="Connected Firebase: onegaurd-e63c0 (piyushsonawane.nbnscoe.entc@gmail.com)"
          >
            <Flame size={12} color="#14b8a6" />
            <span>onegaurd-e63c0</span>
          </button>

          <div
            className={`status-pill ${isOnline ? 'normal' : 'offline'}`}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            <span className={`status-dot ${isOnline ? 'normal' : 'offline'}`} />
            {isOnline ? 'System Online' : 'Hardware Disconnected'}
          </div>
        </div>
      </div>
    </header>
  );
};
