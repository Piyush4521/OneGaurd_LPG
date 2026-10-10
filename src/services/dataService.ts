import { DeviceTelemetry, DeviceMetadata, AlertEvent, UserSettings, UserProfile } from '../types/telemetry';

const STORAGE_KEY_SETTINGS = 'onegaurd_user_settings';
const STORAGE_KEY_EVENTS = 'onegaurd_alert_events';

export const DEFAULT_SETTINGS: UserSettings = {
  gasThresholdRaw: 450,
  debounceSeconds: 3,
  lowWeightKg: 2.5,
  cylinderCapacityKg: 14.2,
  alerts: {
    push: true,
    sms: false,
    voice: false,
  },
  emergencyPhone: '+1-555-0199',
  customDomain: 'app.onegaurd.com',
  quietHoursEnabled: false,
};

export const INITIAL_DEVICE: DeviceMetadata = {
  deviceId: 'ESP32-LPG-01',
  name: 'Kitchen Main Cylinder',
  location: 'Ground Floor Utility Kitchen',
  registeredAt: '2026-09-15T08:30:00Z',
  lastSeenAt: new Date().toISOString(),
  firmwareVersion: 'v1.4.2-prod',
  calibrationVersion: 'CAL-2026-09-A',
  cylinderCapacityKg: 14.2,
  tareMassKg: 15.1,
  enabled: true,
  hardwareModel: 'ESP32-WROOM-32D / MQ-6 / HX711',
};

class DataService {
  private currentTelemetry: DeviceTelemetry;
  private settings: UserSettings;
  private events: AlertEvent[];
  private listeners: Set<(telemetry: DeviceTelemetry) => void> = new Set();
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private isSimulatingJitter = true;

  constructor() {
    const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    this.settings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;

    const savedEvents = localStorage.getItem(STORAGE_KEY_EVENTS);
    this.events = savedEvents ? JSON.parse(savedEvents) : [
      {
        id: 'EVT-9041',
        deviceId: 'ESP32-LPG-01',
        type: 'test_alert',
        severity: 'info',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        message: 'System periodic diagnostic test completed. Local buzzer responded.',
        gasRaw: 185,
        weightKg: 8.4,
        acknowledged: true,
        deliveryStatus: { push: 'delivered', sms: 'disabled', voice: 'disabled' },
      },
      {
        id: 'EVT-8920',
        deviceId: 'ESP32-LPG-01',
        type: 'low_gas',
        severity: 'warning',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        message: 'Cylinder level warning: remaining gas mass reached 2.4 kg threshold.',
        gasRaw: 190,
        weightKg: 2.4,
        acknowledged: true,
        deliveryStatus: { push: 'delivered', sms: 'disabled', voice: 'disabled' },
      }
    ];

    const now = Date.now();
    this.currentTelemetry = {
      deviceId: 'ESP32-LPG-01',
      weightKg: 8.45,
      totalMassKg: 23.55,
      tareMassKg: 15.1,
      gasRaw: 182,
      gasPpm: null,
      gasThresholdRaw: this.settings.gasThresholdRaw,
      leak: false,
      sensorStatus: 'ok',
      online: true,
      timestamp: now,
      lastHeartbeat: now,
      eventId: 'TEL-INITIAL-01',
      firmwareVersion: 'v1.4.2-prod',
      batteryVoltage: 3.29,
    };

    this.startBackgroundJitter();
  }

  private startBackgroundJitter() {
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    this.simulationInterval = setInterval(() => {
      if (!this.isSimulatingJitter || !this.currentTelemetry.online) return;

      const jitter = (Math.random() - 0.5) * 4;
      const weightJitter = (Math.random() - 0.5) * 0.02;

      this.currentTelemetry = {
        ...this.currentTelemetry,
        gasRaw: Math.max(120, Math.min(this.currentTelemetry.gasThresholdRaw - 50, Math.round(this.currentTelemetry.gasRaw + jitter))),
        weightKg: Number(Math.max(0, this.currentTelemetry.weightKg + weightJitter).toFixed(2)),
        timestamp: Date.now(),
        lastHeartbeat: Date.now(),
      };

      this.notifyListeners();
    }, 4000);
  }

  public subscribeTelemetry(listener: (telemetry: DeviceTelemetry) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentTelemetry);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn(this.currentTelemetry));
  }

  public getTelemetry(): DeviceTelemetry {
    return { ...this.currentTelemetry };
  }

  public getDeviceMetadata(): DeviceMetadata {
    return { ...INITIAL_DEVICE };
  }

  public getSettings(): UserSettings {
    return { ...this.settings };
  }

  public saveSettings(newSettings: UserSettings): void {
    this.settings = newSettings;
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    this.currentTelemetry.gasThresholdRaw = newSettings.gasThresholdRaw;
    this.notifyListeners();
  }

  public getEvents(): AlertEvent[] {
    return [...this.events];
  }

  public acknowledgeEvent(id: string): void {
    this.events = this.events.map((evt) =>
      evt.id === id ? { ...evt, acknowledged: true } : evt
    );
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
  }

  public triggerTestAlert(): AlertEvent {
    const newEvent: AlertEvent = {
      id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
      deviceId: this.currentTelemetry.deviceId,
      type: 'test_alert',
      severity: 'info',
      createdAt: new Date().toISOString(),
      message: 'Operator initiated alert transmission test. Verification confirmed.',
      gasRaw: this.currentTelemetry.gasRaw,
      weightKg: this.currentTelemetry.weightKg,
      acknowledged: false,
      deliveryStatus: {
        push: this.settings.alerts.push ? 'delivered' : 'disabled',
        sms: this.settings.alerts.sms ? 'delivered' : 'disabled',
        voice: this.settings.alerts.voice ? 'delivered' : 'disabled',
      },
    };
    this.events = [newEvent, ...this.events];
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
    return newEvent;
  }

  /* Diagnostic / Simulation Control Overrides */
  public setSimulationState(mode: 'normal' | 'leak' | 'low_weight' | 'stale' | 'offline' | 'sensor_fault'): void {
    const now = Date.now();
    switch (mode) {
      case 'normal':
        this.isSimulatingJitter = true;
        this.currentTelemetry = {
          ...this.currentTelemetry,
          gasRaw: 182,
          gasPpm: null,
          leak: false,
          weightKg: 8.45,
          totalMassKg: 23.55,
          sensorStatus: 'ok',
          online: true,
          timestamp: now,
          lastHeartbeat: now,
        };
        break;

      case 'leak':
        this.isSimulatingJitter = false;
        this.currentTelemetry = {
          ...this.currentTelemetry,
          gasRaw: 720,
          gasPpm: null,
          leak: true,
          sensorStatus: 'ok',
          online: true,
          timestamp: now,
          lastHeartbeat: now,
        };
        const leakEvent: AlertEvent = {
          id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
          deviceId: this.currentTelemetry.deviceId,
          type: 'leak_detected',
          severity: 'critical',
          createdAt: new Date().toISOString(),
          message: 'CRITICAL: Gas sensor concentration exceeded safety threshold (720 ADC units). Local hardware buzzer and shutoff activated.',
          gasRaw: 720,
          weightKg: this.currentTelemetry.weightKg,
          acknowledged: false,
          deliveryStatus: {
            push: this.settings.alerts.push ? 'delivered' : 'disabled',
            sms: this.settings.alerts.sms ? 'delivered' : 'disabled',
            voice: this.settings.alerts.voice ? 'delivered' : 'disabled',
          },
        };
        this.events = [leakEvent, ...this.events];
        localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
        break;

      case 'low_weight':
        this.isSimulatingJitter = false;
        this.currentTelemetry = {
          ...this.currentTelemetry,
          weightKg: 1.2,
          totalMassKg: 16.3,
          leak: false,
          gasRaw: 180,
          sensorStatus: 'ok',
          online: true,
          timestamp: now,
          lastHeartbeat: now,
        };
        break;

      case 'stale':
        this.isSimulatingJitter = false;
        this.currentTelemetry = {
          ...this.currentTelemetry,
          online: true,
          timestamp: now - 180000, // 3 minutes ago
          lastHeartbeat: now - 180000,
        };
        break;

      case 'offline':
        this.isSimulatingJitter = false;
        this.currentTelemetry = {
          ...this.currentTelemetry,
          online: false,
          timestamp: now - 600000, // 10 minutes ago
          lastHeartbeat: now - 600000,
        };
        break;

      case 'sensor_fault':
        this.isSimulatingJitter = false;
        this.currentTelemetry = {
          ...this.currentTelemetry,
          sensorStatus: 'fault',
          gasRaw: 0,
          leak: false,
          online: true,
          timestamp: now,
          lastHeartbeat: now,
        };
        break;
    }

    this.notifyListeners();
  }

  public getCurrentUser(): UserProfile {
    return {
      uid: 'usr_piyush_onegaurd_e63c0',
      email: 'piyushsonawane.nbnscoe.entc@gmail.com',
      displayName: 'Piyush Sonawane',
      createdAt: '2026-10-10T09:00:00Z',
      isDemoUser: false,
    };
  }
}

export const dataService = new DataService();
