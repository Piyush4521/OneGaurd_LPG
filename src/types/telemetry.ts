export type SensorStatus = 'ok' | 'fault' | 'warming' | 'unknown';

export type SystemSafetyState = 
  | 'normal'
  | 'caution'
  | 'critical_leak'
  | 'stale'
  | 'offline'
  | 'sensor_fault';

export interface DeviceTelemetry {
  deviceId: string;
  weightKg: number;
  totalMassKg: number;
  tareMassKg: number;
  gasRaw: number;
  gasPpm: number | null;
  gasThresholdRaw: number;
  leak: boolean;
  sensorStatus: SensorStatus;
  online: boolean;
  timestamp: number;
  lastHeartbeat: number;
  eventId: string;
  firmwareVersion: string;
  batteryVoltage?: number;
  wifiRssi?: number;
  seq?: number;
}

export interface DeviceMetadata {
  deviceId: string;
  name: string;
  location: string;
  registeredAt: string;
  lastSeenAt: string;
  firmwareVersion: string;
  calibrationVersion: string;
  cylinderCapacityKg: number;
  tareMassKg: number;
  enabled: boolean;
  hardwareModel: string;
}

export interface AlertEvent {
  id: string;
  deviceId: string;
  type: 'leak_detected' | 'low_gas' | 'sensor_fault' | 'heartbeat_lost' | 'test_alert';
  severity: 'critical' | 'warning' | 'info';
  createdAt: string;
  message: string;
  gasRaw: number;
  weightKg: number;
  acknowledged: boolean;
  deliveryStatus: {
    push: 'delivered' | 'failed' | 'disabled';
    sms: 'delivered' | 'failed' | 'disabled';
    voice: 'delivered' | 'failed' | 'disabled';
    telegram?: 'delivered' | 'failed' | 'disabled' | 'skipped';
    androidCallBridge?: 'accepted' | 'failed' | 'disabled' | 'skipped' | 'unknown';
  };
}

export interface UserSettings {
  gasThresholdRaw: number;
  debounceSeconds: number;
  lowWeightKg: number;
  cylinderCapacityKg: number;
  alerts: {
    push: boolean;
    sms: boolean;
    voice: boolean;
  };
  emergencyPhone: string;
  customDomain: string;
  quietHoursEnabled: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  isDemoUser: boolean;
}
