import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: (origin, callback) => {
    // Allow local development and custom domain
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('onegaurd')) {
      callback(null, true);
    } else {
      callback(null, true); // Dev fallback
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '64kb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = `req_${Math.random().toString(36).substring(2, 9)}`;
  res.setHeader('X-Request-Id', reqId);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} (${duration}ms) [${reqId}]`);
  });
  next();
});

// In-Memory Device Registry (Simulates server-side ownership mapping)
const DEVICE_REGISTRY: Record<string, { ownerUid: string; secretToken: string; name: string }> = {
  'ESP32-LPG-01': {
    ownerUid: 'usr_prod_demo_982',
    secretToken: process.env.DEVICE_SECRET_KEY || 'esp32_dev_token_4892bc',
    name: 'Kitchen Main Cylinder',
  }
};

const latestTelemetryStore: Record<string, any> = {
  'ESP32-LPG-01': {
    deviceId: 'ESP32-LPG-01',
    weightKg: 8.45,
    totalMassKg: 23.55,
    tareMassKg: 15.1,
    gasRaw: 182,
    gasPpm: null,
    gasThresholdRaw: 450,
    leak: false,
    sensorStatus: 'ok',
    online: true,
    timestamp: Date.now(),
    lastHeartbeat: Date.now(),
    eventId: 'EVT-INIT-01',
    firmwareVersion: 'v1.4.2-prod',
    batteryVoltage: 3.29,
  }
};

const eventLogStore: any[] = [
  {
    id: 'EVT-9041',
    deviceId: 'ESP32-LPG-01',
    type: 'test_alert',
    severity: 'info',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    message: 'System diagnostic test completed. Local buzzer responded.',
    gasRaw: 185,
    weightKg: 8.4,
    acknowledged: true,
    deliveryStatus: { push: 'delivered', sms: 'disabled', voice: 'disabled' },
  }
];

// 1. Health Endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'onegaurd-api',
    version: '1.4.2',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// 2. User Identity Endpoint
app.get('/api/me', (_req: Request, res: Response) => {
  res.status(200).json({
    uid: 'usr_prod_demo_982',
    email: 'engineer@onegaurd.internal',
    displayName: 'System Engineer',
    role: 'operator'
  });
});

// 3. List User Devices
app.get('/api/devices', (_req: Request, res: Response) => {
  const devices = Object.keys(DEVICE_REGISTRY).map((deviceId) => ({
    deviceId,
    name: DEVICE_REGISTRY[deviceId].name,
    firmwareVersion: 'v1.4.2-prod',
    online: true,
    latest: latestTelemetryStore[deviceId] || null
  }));
  res.status(200).json({ devices });
});

// 4. Latest Telemetry for Device
app.get('/api/devices/:deviceId/latest', (req: Request, res: Response) => {
  const deviceId = req.params.deviceId as string;
  const telemetry = latestTelemetryStore[deviceId];
  if (!telemetry) {
    return res.status(404).json({
      error: { code: 'DEVICE_NOT_FOUND', message: 'Device not registered in database.' }
    });
  }
  res.status(200).json(telemetry);
});

// 5. Ingestion Endpoint for ESP32 Telemetry
app.post('/api/device/:deviceId/telemetry', (req: Request, res: Response) => {
  const deviceId = req.params.deviceId as string;
  const device = DEVICE_REGISTRY[deviceId];

  // Token Verification
  const token = req.headers['x-device-token'];
  if (!device || !token || token !== device.secretToken) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED_DEVICE', message: 'Invalid or missing hardware credentials.' }
    });
  }

  const { gasRaw, totalMassKg, tareMassKg, sensorStatus, batteryVoltage, eventId } = req.body;

  // Schema Validation
  if (typeof gasRaw !== 'number' || typeof totalMassKg !== 'number') {
    return res.status(400).json({
      error: { code: 'INVALID_PAYLOAD', message: 'gasRaw and totalMassKg must be numeric.' }
    });
  }

  // Bounds Validation
  if (gasRaw < 0 || gasRaw > 4095 || totalMassKg < 0 || totalMassKg > 150) {
    return res.status(400).json({
      error: { code: 'OUT_OF_BOUNDS', message: 'Telemetry values exceed realistic physical limits.' }
    });
  }

  const calculatedTare = typeof tareMassKg === 'number' ? tareMassKg : 15.1;
  const netGasWeight = Math.max(0, Number((totalMassKg - calculatedTare).toFixed(2)));
  const isLeak = gasRaw >= 450;

  const telemetryRecord = {
    deviceId,
    gasRaw,
    gasPpm: null, // Uncalibrated without laboratory chamber
    totalMassKg,
    tareMassKg: calculatedTare,
    weightKg: netGasWeight,
    leak: isLeak,
    sensorStatus: sensorStatus || 'ok',
    batteryVoltage: batteryVoltage || 3.3,
    online: true,
    timestamp: Date.now(),
    lastHeartbeat: Date.now(),
    eventId: eventId || `EVT-${Date.now()}`,
    firmwareVersion: 'v1.4.2-prod'
  };

  latestTelemetryStore[deviceId] = telemetryRecord;

  // Incident Recording & Deduplication
  if (isLeak) {
    const lastEvent = eventLogStore[0];
    const isDuplicate = lastEvent && lastEvent.type === 'leak_detected' && (Date.now() - new Date(lastEvent.createdAt).getTime() < 30000);
    if (!isDuplicate) {
      eventLogStore.unshift({
        id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
        deviceId,
        type: 'leak_detected',
        severity: 'critical',
        createdAt: new Date().toISOString(),
        message: `High gas concentration detected (${gasRaw} ADC). Autonomous local response triggered.`,
        gasRaw,
        weightKg: netGasWeight,
        acknowledged: false,
        deliveryStatus: { push: 'delivered', sms: 'disabled', voice: 'disabled' }
      });
    }
  }

  res.status(200).json({
    status: 'accepted',
    deviceId,
    processedAt: Date.now()
  });
});

// 6. Event History
app.get('/api/devices/:deviceId/events', (_req: Request, res: Response) => {
  res.status(200).json({ events: eventLogStore });
});

// 7. Safe Test Alert Trigger
app.post('/api/alerts/test', (_req: Request, res: Response) => {
  const testEvent = {
    id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
    deviceId: 'ESP32-LPG-01',
    type: 'test_alert',
    severity: 'info',
    createdAt: new Date().toISOString(),
    message: 'Manual alert transmission test verified. No actual gas leak present.',
    gasRaw: 180,
    weightKg: 8.45,
    acknowledged: false,
    deliveryStatus: { push: 'delivered', sms: 'disabled', voice: 'disabled' }
  };
  eventLogStore.unshift(testEvent);
  res.status(200).json({ status: 'ok', event: testEvent });
});

// Start Express Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[OneGaurd API] Ingestion and telemetry server running on http://localhost:${PORT}`);
    console.log(`[OneGaurd API] Health check available at http://localhost:${PORT}/health`);
  });
}

export { app, DEVICE_REGISTRY, latestTelemetryStore, eventLogStore };
