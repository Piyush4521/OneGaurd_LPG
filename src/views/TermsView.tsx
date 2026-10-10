import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface TermsViewProps {
  onBack: () => void;
}

export const TermsView: React.FC<TermsViewProps> = ({ onBack }) => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={onBack}
        style={{ marginBottom: '1.25rem' }}
      >
        <ArrowLeft size={14} />
        <span>Return to Dashboard</span>
      </button>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={18} color="#dc2626" />
            <span>Terms and Conditions &amp; Safety Disclaimer</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Version: 1.0 (October 2026)
          </span>
        </div>

        <div style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '1rem', color: '#991b1b' }}>
            <strong>CRITICAL SAFETY NOTICE:</strong> OneGaurd is an engineering prototype and educational telemetry platform. It is not an officially certified life-safety gas alarm. The system must never be used as the sole protection mechanism for life, property, or certified industrial compliance.
          </div>

          <section>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By commissioning, installing, or interacting with the OneGaurd software or ESP32 hardware firmware, you acknowledge and agree to comply with all terms, safety limits, and testing restrictions outlined herein.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              2. Offline Local Safety Architecture
            </h2>
            <p>
              You understand and acknowledge that all immediate gas leak reactions (audible alarms, visual indicators, physical valve shutoff actuators) must operate completely offline directly on the ESP32 microcontroller. Cloud connectivity, Wi-Fi hotspots, mobile notifications, and web browser dashboards are informational secondary channels that must never be relied upon for immediate life-safety intervention.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              3. Prohibition on Intentional Gas Release
            </h2>
            <p>
              Users and operators must NEVER intentionally release unburned LPG, propane, or butane into any enclosed or unenclosed area for system testing. All sensor validation must follow safe, controlled non-combustible test procedures or qualified technician protocols.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              4. Tare and Load-Cell Calibration Obligations
            </h2>
            <p>
              The platform weight calculation relies entirely upon correct user tare calibration. A load cell measures total gross force. OneGaurd does not warrant remaining gas percentage accuracy without physical reference mass calibration and tare verification.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              5. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, OneGaurd and its contributors disclaim all liability for any direct, indirect, incidental, consequential, or punitive damages arising from the use, failure, or delay of gas detection, network loss, hardware malfunction, or incorrect mass readings.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
