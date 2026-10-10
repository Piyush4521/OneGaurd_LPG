import React from 'react';
import {
  Flame,
  Scale,
  Cpu,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Radio,
  TrendingDown,
  Info,
  ChevronRight
} from 'lucide-react';
import { DeviceTelemetry, DeviceMetadata, AlertEvent, UserSettings } from '../types/telemetry';
import { AnimatedCylinder } from '../components/AnimatedCylinder';

interface DashboardViewProps {
  telemetry: DeviceTelemetry;
  device: DeviceMetadata;
  settings: UserSettings;
  events: AlertEvent[];
  onAcknowledgeEvent: (id: string) => void;
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  telemetry,
  device,
  settings,
  events,
  onAcknowledgeEvent,
  onNavigate,
}) => {
  const isStale = Date.now() - telemetry.lastHeartbeat > 60000;
  const isOffline = !telemetry.online;
  const isWarming = telemetry.sensorStatus === 'warming';
  const isFault = telemetry.sensorStatus === 'fault';
  const isLeak = telemetry.leak;
  const isLowWeight = telemetry.weightKg <= settings.lowWeightKg;

  // Derive system safety state
  let safetyStatusText = 'NORMAL: NO LPG LEAK DETECTED';
  let safetyStatusClass = 'normal';
  let safetyStatusDesc = 'Continuous monitoring active. Sensor output is within safe baseline limits.';

  if (isLeak) {
    safetyStatusText = 'CRITICAL: COMBUSTIBLE GAS DETECTED';
    safetyStatusClass = 'critical';
    safetyStatusDesc = 'Gas concentration has breached the defined threshold. Local shutoff activated.';
  } else if (isWarming) {
    safetyStatusText = 'SENSOR WARMING: HEATER COIL STABILIZING';
    safetyStatusClass = 'caution';
    safetyStatusDesc = 'MQ-6 sensor is in its 180-second stabilization cycle. Alarm armed upon completion.';
  } else if (isFault) {
    safetyStatusText = 'SENSOR FAULT: ANALOG LINE UNREADABLE';
    safetyStatusClass = 'caution';
    safetyStatusDesc = 'MQ-6 sensor module reports open circuit or voltage out of specification.';
  } else if (isOffline) {
    safetyStatusText = 'DISCONNECTED: HARDWARE GATEWAY OFFLINE';
    safetyStatusClass = 'offline';
    safetyStatusDesc = 'ESP32 has not checked in. Local safety watchdog continues running on-device.';
  } else if (isStale) {
    safetyStatusText = 'TELEMETRY STALE: HEARTBEAT EXPIRED';
    safetyStatusClass = 'caution';
    safetyStatusDesc = 'Device packet delayed over 60 seconds. Displaying last verified reading.';
  } else if (isLowWeight) {
    safetyStatusText = 'CAUTION: CYLINDER MASS BELOW THRESHOLD';
    safetyStatusClass = 'caution';
    safetyStatusDesc = `Gas mass has dropped below the ${settings.lowWeightKg} kg threshold. Arrange refill.`;
  }

  // Calculate cylinder percentage
  const percentageRemaining = Math.max(
    0,
    Math.min(100, Math.round((telemetry.weightKg / settings.cylinderCapacityKg) * 100))
  );

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff} seconds ago`;
    return `${Math.floor(diff / 60)} minutes ago`;
  };

  const recentEvents = events.slice(0, 3);

  return (
    <div>
      {/* Primary Safety Hero Panel */}
      <div className="hero-panel">
        <div className="hero-header">
          <div>
            <div className="hero-status-row">
              <div className={`status-pill ${safetyStatusClass}`}>
                <span className={`status-dot ${safetyStatusClass}`} />
                {safetyStatusText}
              </div>
            </div>
            <p style={{ marginTop: '0.5rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
              {safetyStatusDesc}
            </p>
          </div>

          <div style={{ textAlign: 'right', minWidth: '180px' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Monitor
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#f8fafc' }}>
              {device.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.125rem' }}>
              ID: {device.deviceId} ({device.location})
            </div>
          </div>
        </div>

        {/* Telemetry Metric Grid */}
        <div className="hero-metrics-grid">
          {/* Gas Concentration Card */}
          <div className="hero-metric-card">
            <div className="hero-metric-label">
              <span>MQ-6 Gas Sensor</span>
              <Flame size={14} color={isLeak ? '#ef4444' : '#14b8a6'} />
            </div>
            <div
              className="hero-metric-value"
              style={{ color: isLeak ? '#ef4444' : '#ffffff' }}
            >
              {telemetry.gasRaw} <span style={{ fontSize: '1rem', fontWeight: 400, color: '#94a3b8' }}>ADC</span>
            </div>
            <div className="hero-metric-meta">
              <span style={{ color: telemetry.gasRaw >= telemetry.gasThresholdRaw ? '#f87171' : '#a7f3d0' }}>
                Threshold: {telemetry.gasThresholdRaw} ADC
              </span>
              <span>|</span>
              <span>Raw ADC units</span>
            </div>
          </div>

          {/* Cylinder Net Gas Weight Card */}
          <div className="hero-metric-card">
            <div className="hero-metric-label">
              <span>Gas Mass Remaining</span>
              <Scale size={14} color="#14b8a6" />
            </div>
            <div className="hero-metric-value">
              {telemetry.weightKg.toFixed(2)} <span style={{ fontSize: '1rem', fontWeight: 400, color: '#94a3b8' }}>kg</span>
            </div>
            <div className="hero-metric-meta">
              <span>Total: {telemetry.totalMassKg.toFixed(2)} kg</span>
              <span>|</span>
              <span>Tare: {telemetry.tareMassKg.toFixed(2)} kg</span>
            </div>
          </div>

          {/* Capacity Percentage Gauge */}
          <div className="hero-metric-card">
            <div className="hero-metric-label">
              <span>Cylinder Capacity</span>
              <TrendingDown size={14} color="#14b8a6" />
            </div>
            <div className="hero-metric-value">
              {percentageRemaining}%
            </div>
            <div className="progress-bar-bg" style={{ backgroundColor: '#334155', height: '6px' }}>
              <div
                className={`progress-bar-fill ${percentageRemaining < 20 ? 'critical' : percentageRemaining < 35 ? 'caution' : 'normal'}`}
                style={{ width: `${percentageRemaining}%` }}
              />
            </div>
            <div className="hero-metric-meta">
              <span>Cap: {settings.cylinderCapacityKg} kg</span>
              <span>|</span>
              <span>{telemetry.weightKg < settings.lowWeightKg ? 'Refill Needed' : 'Nominal'}</span>
            </div>
          </div>

          {/* Hardware Telemetry Pulse Card */}
          <div className="hero-metric-card">
            <div className="hero-metric-label">
              <span>Hardware Link</span>
              <Radio size={14} color={telemetry.online ? '#14b8a6' : '#94a3b8'} />
            </div>
            <div className="hero-metric-value" style={{ fontSize: '1.25rem' }}>
              {telemetry.online ? (isStale ? 'Delayed' : 'Live Sync') : 'Offline'}
            </div>
            <div className="hero-metric-meta">
              <Clock size={12} />
              <span>Packet: {formatTime(telemetry.lastHeartbeat)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Animated Glassmorphism Cylinder Visualizer */}
      <AnimatedCylinder
        weightKg={telemetry.weightKg}
        totalMassKg={telemetry.totalMassKg}
        tareMassKg={telemetry.tareMassKg}
        capacityKg={settings.cylinderCapacityKg}
        isLeak={isLeak}
        isFault={isFault}
        isOnline={telemetry.online && !isStale}
      />

      {/* Detail Panels Grid */}
      <div className="grid-2col">
        {/* Load Cell & Refill Calibration Info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Scale size={18} color="#0d9488" />
              <span>Weight Measurement &amp; Refill Projection</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
              HX711 Amplifier
            </span>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
              <span style={{ color: '#64748b' }}>Usable Gas:</span>
              <span style={{ fontWeight: 600 }}>{telemetry.weightKg.toFixed(2)} kg</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
              <span style={{ color: '#64748b' }}>Cylinder Empty Tare:</span>
              <span style={{ fontWeight: 600 }}>{telemetry.tareMassKg.toFixed(2)} kg</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
              <span style={{ color: '#64748b' }}>Gross Scale Mass:</span>
              <span style={{ fontWeight: 600 }}>{telemetry.totalMassKg.toFixed(2)} kg</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
              <span style={{ color: '#64748b' }}>Low Weight Alarm Trigger:</span>
              <span style={{ fontWeight: 600, color: '#d97706' }}>&lt; {settings.lowWeightKg.toFixed(1)} kg</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>
              <Info size={14} color="#0284c7" />
              <span>Refill Forecast Status</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              Collecting usage history: A minimum of 72 hours of steady-state household burn rate is required before issuing linear day-to-empty estimates.
            </p>
          </div>
        </div>

        {/* Local Hardware Fail-Safe Specifications */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Cpu size={18} color="#0d9488" />
              <span>Autonomous Hardware Fail-Safe</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 600 }}>
              Independent Firmware Loop
            </span>
          </div>

          <p style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '0.75rem' }}>
            Safety protocol verification: The on-device ESP32 firmware executes real-time threshold evaluations in hardware interrupts.
          </p>

          <ul style={{ listStyle: 'none', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={16} color="#059669" />
              <span>Local buzzer and visual strobe activate without Wi-Fi connection</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={16} color="#059669" />
              <span>Solenoid valve driver signals physical shutoff on alarm trip</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={16} color="#059669" />
              <span>Hardware watchdog resets microcontroller if polling thread stalls</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Recent Safety Incidents Feed */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <AlertTriangle size={18} color="#d97706" />
            <span>Recent System Alerts &amp; Safety Events</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('history')}
          >
            <span>View Full Event Log</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {recentEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.875rem' }}>
            No incident events recorded. All telemetry nominal.
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Timestamp</th>
                  <th>Severity</th>
                  <th>Incident Details</th>
                  <th>Delivery</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((evt) => (
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
                    <td>{evt.message}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Push: {evt.deliveryStatus.push}
                      </span>
                    </td>
                    <td>
                      {evt.acknowledged ? (
                        <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                          Acknowledged
                        </span>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onAcknowledgeEvent(evt.id)}
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
