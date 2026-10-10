import React from 'react';
import { Sliders, Check, AlertOctagon, BatteryLow, Clock, WifiOff, AlertCircle } from 'lucide-react';
import { dataService } from '../services/dataService';

export const SimulationBar: React.FC = () => {
  return (
    <div className="dev-simulation-panel">
      <div className="dev-simulation-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sliders size={16} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            Hardware Simulation &amp; Test Suite
          </span>
          <span className="dev-tag">Developer Mode</span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Allows testing UI and safety responses safely without releasing gas
        </span>
      </div>

      <div className="sim-buttons-row">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => dataService.setSimulationState('normal')}
        >
          <Check size={14} color="#059669" />
          Simulate Normal
        </button>

        <button
          className="btn btn-danger btn-sm"
          onClick={() => dataService.setSimulationState('leak')}
        >
          <AlertOctagon size={14} />
          Simulate Gas Leak
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => dataService.setSimulationState('low_weight')}
        >
          <BatteryLow size={14} color="#d97706" />
          Simulate Low Weight
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => dataService.setSimulationState('stale')}
        >
          <Clock size={14} color="#b45309" />
          Simulate Stale Telemetry
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => dataService.setSimulationState('offline')}
        >
          <WifiOff size={14} color="#64748b" />
          Simulate Hardware Offline
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => dataService.setSimulationState('sensor_fault')}
        >
          <AlertCircle size={14} color="#dc2626" />
          Simulate Sensor Fault
        </button>
      </div>
    </div>
  );
};
