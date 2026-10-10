import React from 'react';
import { AlertTriangle, PhoneCall, CheckCircle } from 'lucide-react';
import { DeviceTelemetry } from '../types/telemetry';

interface CriticalBannerProps {
  telemetry: DeviceTelemetry;
  onAcknowledge: () => void;
}

export const CriticalBanner: React.FC<CriticalBannerProps> = ({ telemetry, onAcknowledge }) => {
  if (!telemetry.leak) return null;

  return (
    <div className="critical-leak-banner" role="alert">
      <div className="critical-banner-content">
        <AlertTriangle size={28} strokeWidth={2.5} />
        <div>
          <div className="critical-banner-title">
            CRITICAL EMERGENCY: LPG LEAK DETECTED (GAS SENSOR READING: {telemetry.gasRaw})
          </div>
          <div className="critical-banner-text">
            Immediate safety steps: Extinguish open flames. Do not operate electrical switches or phones near the cylinder. Shut manual gas valve and ventilate the room.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <a
          href="tel:911"
          className="btn btn-secondary btn-sm"
          style={{ color: '#991b1b', fontWeight: 700 }}
        >
          <PhoneCall size={14} />
          Emergency Call
        </a>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onAcknowledge}
        >
          <CheckCircle size={14} />
          Acknowledge Alert
        </button>
      </div>
    </div>
  );
};
