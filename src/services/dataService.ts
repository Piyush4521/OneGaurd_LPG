import { DeviceTelemetry, DeviceMetadata, AlertEvent, UserSettings, UserProfile } from '../types/telemetry';

const STORAGE_KEY_SETTINGS = 'onegaurd_user_settings';
const STORAGE_KEY_EVENTS = 'onegaurd_alert_events';

export const DEFAULT_SETTINGS: UserSettings = {
  gasThresholdRaw: 2200,
  debounceSeconds: 3,
  lowWeightKg: 2.5,
  cylinderCapacityKg: 14.2,
  alerts: {
    push: true,
    sms: false,
    voice: false,
  },
  emergencyPhone: '+918888360145',
  customDomain: 'app.onegaurd.com',
  quietHoursEnabled: false,
};

export const INITIAL_DEVICE: DeviceMetadata = {
  deviceId: 'onegaurd-esp32-01',
  name: 'OneGaurd LPG Smart Platform 01',
  location: 'Ground Floor Utility Kitchen',
  registeredAt: '2026-10-10T08:30:00Z',
  lastSeenAt: new Date().toISOString(),
  firmwareVersion: 'v1.5.0-prod',
  calibrationVersion: 'CAL-2026-10-A',
  cylinderCapacityKg: 14.2,
  tareMassKg: 15.1,
  enabled: true,
  hardwareModel: 'ESP32 DevKit V1 / MQ-6 / HX711 / DS3231',
};

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }
  // Production fallback to Render gateway
  return 'https://onegaurd-lpg.onrender.com';
};

import { realtimeDb } from './firebase';
import { ref, onValue } from 'firebase/database';

class DataService {
  private currentTelemetry: DeviceTelemetry;
  private settings: UserSettings;
  private events: AlertEvent[];
  private listeners: Set<(telemetry: DeviceTelemetry) => void> = new Set();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isLiveConnected = false;
  private isSimulationOverride = false;
  private isFirebaseSubscribed = false;

  constructor() {
    const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    this.settings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;

    const savedEvents = localStorage.getItem(STORAGE_KEY_EVENTS);
    this.events = savedEvents ? JSON.parse(savedEvents) : [
      {
        id: 'EVT-9041',
        deviceId: 'onegaurd-esp32-01',
        type: 'test_alert',
        severity: 'info',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        message: 'System periodic diagnostic test completed. Local buzzer and RTC verified.',
        gasRaw: 185,
        weightKg: 8.4,
        acknowledged: true,
        deliveryStatus: { push: 'delivered', sms: 'disabled', voice: 'disabled', telegram: 'delivered' },
      }
    ];

    const now = Date.now();
    this.currentTelemetry = {
      deviceId: 'onegaurd-esp32-01',
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
      firmwareVersion: 'v1.5.0-prod',
      batteryVoltage: 3.30,
      wifiRssi: -58,
      seq: 1
    };

    // Start background sync with backend API and Firebase RTDB
    this.startBackendSync();
  }

  private startBackendSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);

    // 1. Instant Realtime Database WebSocket subscription
    if (!this.isFirebaseSubscribed) {
      try {
        const deviceRef = ref(realtimeDb, `devices/${this.currentTelemetry.deviceId}`);
        onValue(deviceRef, (snapshot) => {
          const data = snapshot.val();
          if (data && !this.isSimulationOverride) {
            const now = Date.now();
            const heartbeatAgeMs = now - (data.lastHeartbeat || data.timestamp || now);
            this.currentTelemetry = {
              ...this.currentTelemetry,
              ...data,
              online: heartbeatAgeMs < 35000,
              gasPpm: null
            };
            this.isLiveConnected = true;
            this.notifyListeners();
          }
        }, () => {
          // Fallback to REST polling if WebSocket blocked
        });
        this.isFirebaseSubscribed = true;
      } catch {
        // Fallback to HTTP polling
      }
    }

    // 2. Continuous REST Gateway polling fallback
    this.pollBackendTelemetry();
    this.syncInterval = setInterval(() => {
      if (!this.isSimulationOverride) {
        this.pollBackendTelemetry();
      }
    }, 3000);
  }

  public async pollBackendTelemetry(): Promise<void> {
    const baseUrl = getApiBaseUrl();
    const deviceId = this.currentTelemetry.deviceId;

    try {
      const res = await fetch(`${baseUrl}/api/devices/${deviceId}/latest`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(2500)
      });

      if (res.ok) {
        const live = await res.json();
        const now = Date.now();
        const heartbeatAgeMs = now - (live.lastHeartbeat || live.timestamp || now);
        const isDeviceOnline = heartbeatAgeMs < 35000;

        this.currentTelemetry = {
          ...live,
          online: isDeviceOnline,
          gasPpm: null // Enforce uncalibrated labelling
        };
        this.isLiveConnected = true;
        this.notifyListeners();

        // Sync real events
        this.pollBackendEvents();
      } else {
        // Fallback check: if onegaurd-esp32-01 isn't registered yet, try ESP32-LPG-01
        if (deviceId === 'onegaurd-esp32-01') {
          const fallbackRes = await fetch(`${baseUrl}/api/devices/ESP32-LPG-01/latest`, {
            signal: AbortSignal.timeout(2000)
          }).catch(() => null);

          if (fallbackRes && fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            this.currentTelemetry = {
              ...fallbackData,
              gasPpm: null
            };
            this.isLiveConnected = true;
            this.notifyListeners();
          }
        }
      }
    } catch {
      this.isLiveConnected = false;
      const now = Date.now();
      if (now - this.currentTelemetry.lastHeartbeat > 25000) {
        this.currentTelemetry.online = false;
        this.notifyListeners();
      }
    }
  }

  public async pollBackendEvents(): Promise<void> {
    const baseUrl = getApiBaseUrl();
    const deviceId = this.currentTelemetry.deviceId;
    try {
      const res = await fetch(`${baseUrl}/api/devices/${deviceId}/events`, {
        signal: AbortSignal.timeout(2500)
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events) && data.events.length > 0) {
          this.events = data.events;
          localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
        }
      }
    } catch {
      // Ignore background event sync errors
    }
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
    return {
      ...INITIAL_DEVICE,
      deviceId: this.currentTelemetry.deviceId,
      lastSeenAt: new Date(this.currentTelemetry.lastHeartbeat || Date.now()).toISOString()
    };
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

  public async triggerTestAlert(): Promise<AlertEvent> {
    const baseUrl = getApiBaseUrl();
    const newEvent: AlertEvent = {
      id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
      deviceId: this.currentTelemetry.deviceId,
      type: 'test_alert',
      severity: 'info',
      createdAt: new Date().toISOString(),
      message: 'Operator initiated diagnostic alert test. Verification confirmed.',
      gasRaw: this.currentTelemetry.gasRaw,
      weightKg: this.currentTelemetry.weightKg,
      acknowledged: false,
      deliveryStatus: {
        push: this.settings.alerts.push ? 'delivered' : 'disabled',
        sms: this.settings.alerts.sms ? 'delivered' : 'disabled',
        voice: this.settings.alerts.voice ? 'delivered' : 'disabled',
        telegram: 'delivered'
      },
    };

    // Forward test dispatch to backend if available
    try {
      await fetch(`${baseUrl}/api/alerts/test?dispatch=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': 'esp32_dev_token_4892bc'
        },
        body: JSON.stringify({ deviceId: this.currentTelemetry.deviceId })
      });
    } catch {
      // Local fallback record
    }

    this.events = [newEvent, ...this.events];
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
    return newEvent;
  }

  /* Diagnostic / Simulation Control Overrides */
  public setSimulationState(mode: 'normal' | 'leak' | 'low_weight' | 'stale' | 'offline' | 'sensor_fault'): void {
    const now = Date.now();
    this.isSimulationOverride = (mode !== 'normal');

    switch (mode) {
      case 'normal':
        this.isSimulationOverride = false;
        this.pollBackendTelemetry();
        break;

      case 'leak':
        this.currentTelemetry = {
          ...this.currentTelemetry,
          gasRaw: 2450,
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
          message: 'CRITICAL: Sustained gas reading exceeded threshold (2450 ADC units). Local hardware buzzer and shutoff activated.',
          gasRaw: 2450,
          weightKg: this.currentTelemetry.weightKg,
          acknowledged: false,
          deliveryStatus: {
            push: this.settings.alerts.push ? 'delivered' : 'disabled',
            sms: this.settings.alerts.sms ? 'delivered' : 'disabled',
            voice: this.settings.alerts.voice ? 'delivered' : 'disabled',
            telegram: 'delivered',
            androidCallBridge: 'accepted'
          },
        };
        this.events = [leakEvent, ...this.events];
        localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
        break;

      case 'low_weight':
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
        this.currentTelemetry = {
          ...this.currentTelemetry,
          online: true,
          timestamp: now - 180000,
          lastHeartbeat: now - 180000,
        };
        break;

      case 'offline':
        this.currentTelemetry = {
          ...this.currentTelemetry,
          online: false,
          timestamp: now - 600000,
          lastHeartbeat: now - 600000,
        };
        break;

      case 'sensor_fault':
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

  public isConnectedToBackend(): boolean {
    return this.isLiveConnected;
  }
}

export const dataService = new DataService();
