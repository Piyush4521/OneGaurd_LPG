import React, { useState } from 'react';
import { Save, Bell, Globe, Shield, Radio } from 'lucide-react';
import { UserSettings } from '../types/telemetry';

interface SettingsViewProps {
  settings: UserSettings;
  onSaveSettings: (settings: UserSettings) => void;
  onTriggerTestAlert: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onTriggerTestAlert,
}) => {
  const [formData, setFormData] = useState<UserSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleTestAlert = () => {
    onTriggerTestAlert();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
          System Configuration &amp; Telemetry Thresholds
        </h1>
        <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
          Configure sensor limits, tare math, carrier notifications, and custom domain bindings
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid-2col">
          {/* Sensor & Scale Parameters */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Shield size={18} color="#0d9488" />
                <span>Detection &amp; Calibration Limits</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Gas Alarm Threshold (MQ-6 Raw ADC Units)
              </label>
              <input
                type="number"
                min="200"
                max="1023"
                className="form-input"
                value={formData.gasThresholdRaw}
                onChange={(e) =>
                  setFormData({ ...formData, gasThresholdRaw: Number(e.target.value) })
                }
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                Nominal clean air baseline: 120-220. Dangerous concentration: 450+.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Detection Debounce Filter (Seconds)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-input"
                value={formData.debounceSeconds}
                onChange={(e) =>
                  setFormData({ ...formData, debounceSeconds: Number(e.target.value) })
                }
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                Readings must remain above threshold continuously before triggering critical alarm.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Cylinder Gas Net Capacity (Kilograms)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="50"
                className="form-input"
                value={formData.cylinderCapacityKg}
                onChange={(e) =>
                  setFormData({ ...formData, cylinderCapacityKg: Number(e.target.value) })
                }
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                Standard domestic cylinder capacity: 14.2 kg or 5.0 kg commercial.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Low-Weight Refill Alert Trigger (Kilograms)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10"
                className="form-input"
                value={formData.lowWeightKg}
                onChange={(e) =>
                  setFormData({ ...formData, lowWeightKg: Number(e.target.value) })
                }
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                Issues a low fuel warning when remaining gas drops to this mass.
              </span>
            </div>
          </div>

          {/* Alert Channels & Telecom Verification */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Bell size={18} color="#0d9488" />
                <span>Alert Notification Channels</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.alerts.push}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      alerts: { ...formData.alerts, push: e.target.checked },
                    })
                  }
                />
                <span>Web Push Notifications (Instant Browser Alert)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.alerts.sms}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      alerts: { ...formData.alerts, sms: e.target.checked },
                    })
                  }
                />
                <span>Carrier SMS Dispatch (Telecom Provider)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.alerts.voice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      alerts: { ...formData.alerts, voice: e.target.checked },
                    })
                  }
                />
                <span>Automated Voice Call (High Urgency)</span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">
                Emergency Alert Phone Number (E.164 Format)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="+15551234567"
                value={formData.emergencyPhone}
                onChange={(e) =>
                  setFormData({ ...formData, emergencyPhone: e.target.value })
                }
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                Must be an authenticated phone number with verified emergency dispatch consent.
              </span>
            </div>

            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '4px', padding: '0.75rem', fontSize: '0.75rem', color: '#92400e' }}>
              <strong>Carrier Notice:</strong> SMS and Voice services require paid provider credentials (Twilio). Critical leak alerts will always bypass quiet hours and activate local hardware buzzers immediately.
            </div>
          </div>
        </div>

        {/* Custom Domain & Network Binding */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <div className="card-title">
              <Globe size={18} color="#0d9488" />
              <span>Production Custom Domain &amp; SSL Configuration</span>
            </div>
            <span className="status-pill normal" style={{ fontSize: '0.75rem' }}>
              <span className="status-dot normal" />
              CNAME Bound
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Active Custom Domain</label>
              <input
                type="text"
                className="form-input"
                value={formData.customDomain}
                onChange={(e) =>
                  setFormData({ ...formData, customDomain: e.target.value })
                }
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                DNS Target: <code>cname.onegaurd.cloud</code> | TLS 1.3 Strict HTTPS
              </span>
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.75rem', fontSize: '0.8125rem' }}>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
                Host Status
              </div>
              <div style={{ color: '#475569', fontSize: '0.75rem' }}>
                Domain: <strong>{formData.customDomain}</strong><br />
                SSL Provider: Let's Encrypt Automated Renewal<br />
                PWA Service Worker: Enabled (Offline Cache v1.4.2)
              </div>
            </div>
          </div>
        </div>

        {/* Actions Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestAlert}
          >
            <Radio size={16} />
            <span>Send Safe Test Alert Event</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {testSent && (
              <span style={{ color: '#059669', fontSize: '0.8125rem', fontWeight: 600 }}>
                Test event recorded in event log.
              </span>
            )}
            {saveSuccess && (
              <span style={{ color: '#059669', fontSize: '0.8125rem', fontWeight: 600 }}>
                Settings successfully persisted.
              </span>
            )}
            <button type="submit" className="btn btn-primary">
              <Save size={16} />
              <span>Save System Settings</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
