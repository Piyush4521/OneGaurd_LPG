import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../server/index';

describe('OneGaurd Node.js REST API & Ingestion Gateway', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('GET /health returns 200 with service information and uptime', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('onegaurd-api');
    expect(body.version).toBe('1.4.2');
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /api/me returns current authenticated user profile', async () => {
    const res = await fetch(`${baseUrl}/api/me`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uid).toBe('usr_prod_demo_982');
    expect(body.email).toBe('engineer@onegaurd.internal');
    expect(body.role).toBe('operator');
  });

  it('GET /api/devices returns registered user devices and latest state', async () => {
    const res = await fetch(`${baseUrl}/api/devices`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.devices)).toBe(true);
    expect(body.devices.length).toBeGreaterThan(0);
    expect(body.devices[0].deviceId).toBe('ESP32-LPG-01');
    expect(body.devices[0].name).toBe('Kitchen Main Cylinder');
  });

  it('GET /api/devices/:deviceId/latest returns 200 for registered device', async () => {
    const res = await fetch(`${baseUrl}/api/devices/ESP32-LPG-01/latest`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deviceId).toBe('ESP32-LPG-01');
    expect(typeof body.weightKg).toBe('number');
    expect(typeof body.gasRaw).toBe('number');
  });

  it('GET /api/devices/:deviceId/latest returns 404 for unknown device', async () => {
    const res = await fetch(`${baseUrl}/api/devices/UNKNOWN-DEV-999/latest`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('T08: POST /api/device/:deviceId/telemetry rejects missing or invalid hardware credentials with 401', async () => {
    // Missing token
    const res1 = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasRaw: 180, totalMassKg: 23.5 }),
    });
    expect(res1.status).toBe(401);
    const body1 = await res1.json();
    expect(body1.error.code).toBe('UNAUTHORIZED_DEVICE');

    // Invalid token
    const res2 = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'wrong_token_123',
      },
      body: JSON.stringify({ gasRaw: 180, totalMassKg: 23.5 }),
    });
    expect(res2.status).toBe(401);
  });

  it('T10: POST /api/device/:deviceId/telemetry rejects non-numeric or malformed payload with 400', async () => {
    const res = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'esp32_dev_token_4892bc',
      },
      body: JSON.stringify({ gasRaw: 'not_a_number', totalMassKg: 23.5 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PAYLOAD');
  });

  it('T10: POST /api/device/:deviceId/telemetry rejects out-of-bounds physical values with 400', async () => {
    // ADC exceeds 4095
    const res1 = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'esp32_dev_token_4892bc',
      },
      body: JSON.stringify({ gasRaw: 5000, totalMassKg: 23.5 }),
    });
    expect(res1.status).toBe(400);
    const body1 = await res1.json();
    expect(body1.error.code).toBe('OUT_OF_BOUNDS');

    // Total mass exceeds 150kg
    const res2 = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'esp32_dev_token_4892bc',
      },
      body: JSON.stringify({ gasRaw: 200, totalMassKg: 300 }),
    });
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2.error.code).toBe('OUT_OF_BOUNDS');
  });

  it('T07: POST /api/device/:deviceId/telemetry accepts valid telemetry and calculates net gas mass', async () => {
    const res = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'esp32_dev_token_4892bc',
      },
      body: JSON.stringify({
        gasRaw: 185,
        totalMassKg: 23.55,
        tareMassKg: 15.10,
        sensorStatus: 'ok',
        batteryVoltage: 3.29,
        eventId: 'EVT-TEST-001',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('accepted');
    expect(body.deviceId).toBe('ESP32-LPG-01');

    // Verify stored state in /latest
    const latestRes = await fetch(`${baseUrl}/api/devices/ESP32-LPG-01/latest`);
    const latest = await latestRes.json();
    expect(latest.gasRaw).toBe(185);
    expect(latest.weightKg).toBe(8.45);
    expect(latest.leak).toBe(false);
  });

  it('T12 & T13: Ingestion triggers leak event on threshold breach and deduplicates rapid repeated alerts', async () => {
    // First leak packet triggers new incident event
    const res1 = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'esp32_dev_token_4892bc',
      },
      body: JSON.stringify({
        gasRaw: 620,
        totalMassKg: 23.55,
        tareMassKg: 15.10,
        sensorStatus: 'ok',
      }),
    });
    expect(res1.status).toBe(200);

    // Fetch events
    const eventsRes1 = await fetch(`${baseUrl}/api/devices/ESP32-LPG-01/events`);
    const events1 = await eventsRes1.json();
    const leakEventCount1 = events1.events.filter((e: any) => e.type === 'leak_detected').length;
    expect(leakEventCount1).toBeGreaterThanOrEqual(1);

    // Immediate second leak packet should be deduplicated (within 30s window)
    const res2 = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'esp32_dev_token_4892bc',
      },
      body: JSON.stringify({
        gasRaw: 640,
        totalMassKg: 23.55,
        tareMassKg: 15.10,
        sensorStatus: 'ok',
      }),
    });
    expect(res2.status).toBe(200);

    const eventsRes2 = await fetch(`${baseUrl}/api/devices/ESP32-LPG-01/events`);
    const events2 = await eventsRes2.json();
    const leakEventCount2 = events2.events.filter((e: any) => e.type === 'leak_detected').length;
    expect(leakEventCount2).toBe(leakEventCount1); // Deduplicated!
  }, 15000);

  it('POST /api/alerts/test creates safe diagnostic event without triggering real emergency channels', async () => {
    const res = await fetch(`${baseUrl}/api/alerts/test`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.event.type).toBe('test_alert');
    expect(body.event.severity).toBe('info');
    expect(body.event.message).toContain('alert transmission test');
  });
});
