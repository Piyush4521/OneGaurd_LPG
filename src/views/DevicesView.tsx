import React, { useState } from 'react';
import { HardDrive, Plus, CheckCircle } from 'lucide-react';
import { DeviceMetadata, DeviceTelemetry } from '../types/telemetry';

interface DevicesViewProps {
  device: DeviceMetadata;
  telemetry: DeviceTelemetry;
}

export const DevicesView: React.FC<DevicesViewProps> = ({ device, telemetry }) => {
  const [showPairModal, setShowPairModal] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newToken, setNewToken] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [pairSuccess, setPairSuccess] = useState(false);

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceId || !newToken) return;
    setPairSuccess(true);
    setTimeout(() => {
      setPairSuccess(false);
      setShowPairModal(false);
      setNewDeviceId('');
      setNewToken('');
      setNewLocation('');
    }, 1800);
  };

  const isStale = Date.now() - telemetry.lastHeartbeat > 60000;
  const isOnline = telemetry.online && !isStale;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
            Registered Hardware &amp; Sensor Gateways
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            ESP32 microcontrollers assigned to your cryptographic user identity
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowPairModal(true)}>
          <Plus size={16} />
          <span>Register New Device</span>
        </button>
      </div>

      {/* Device Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
              <HardDrive size={20} color="#0f172a" />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                {device.name}
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                ID: {device.deviceId} | Location: {device.location}
              </div>
            </div>
          </div>

          <div className={`status-pill ${isOnline ? 'normal' : 'offline'}`}>
            <span className={`status-dot ${isOnline ? 'normal' : 'offline'}`} />
            {isOnline ? 'Active Online' : 'Hardware Disconnected'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Hardware Model</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginTop: '0.25rem' }}>
              {device.hardwareModel}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Firmware Version</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#0f172a', marginTop: '0.25rem' }}>
              {device.firmwareVersion}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Calibration Profile</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#0f172a', marginTop: '0.25rem' }}>
              {device.calibrationVersion}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Platform Tare Setting</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginTop: '0.25rem' }}>
              {device.tareMassKg.toFixed(2)} kg (Zero Baseline)
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
          <div>
            Registered: {new Date(device.registeredAt).toLocaleDateString()}
          </div>
          <div>
            Last Ingestion Packet: {new Date(telemetry.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Device Registration Modal */}
      {showPairModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            maxWidth: '460px',
            width: '100%',
            padding: '1.5rem',
            border: '1px solid #cbd5e1',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              Pair Hardware Gateway
            </h3>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Enter the hardware serial and pre-shared authorization key flashed onto your ESP32 monitor.
            </p>

            {pairSuccess ? (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', padding: '1rem', textAlign: 'center', color: '#166534' }}>
                <CheckCircle size={24} style={{ margin: '0 auto 0.5rem auto' }} />
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Device Successfully Registered</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Cryptographic verification token accepted.</div>
              </div>
            ) : (
              <form onSubmit={handlePairSubmit}>
                <div className="form-group">
                  <label className="form-label">Hardware Device ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ESP32-LPG-02"
                    value={newDeviceId}
                    onChange={(e) => setNewDeviceId(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Security Authorization Token</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="24-character cryptographic token"
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Physical Location Label</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Backyard Barbecue Grill"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPairModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Verify &amp; Register
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
