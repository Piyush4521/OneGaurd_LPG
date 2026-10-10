import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import {
  app,
  dispatchLeakAlerts,
  sendTelegramAlert,
  triggerAndroidCallBridge,
  resetAlertCooldownState
} from '../server/index';
import { maskPhoneNumber, sanitizeSecretError } from '../server/services/notificationService';

describe('OneGaurd Notifications & Call Bridge Engine', () => {
  let server: Server;
  let baseUrl: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.restoreAllMocks();
    resetAlertCooldownState();

    process.env.TELEGRAM_BOT_TOKEN = 'mock_telegram_bot_token_99999';
    process.env.TELEGRAM_CHAT_ID = '987654321';
    process.env.MACRODROID_WEBHOOK_URL = 'https://trigger.macrodroid.com/mock-uuid-12345/';
    process.env.EMERGENCY_PHONE_NUMBER = '+918888360145';
    process.env.ALERT_COOLDOWN_SECONDS = '60';

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('masks phone numbers safely without exposing sensitive digits', () => {
    expect(maskPhoneNumber('+918888360145')).toBe('+918888****45');
    expect(maskPhoneNumber('12345')).toBe('****');
    expect(maskPhoneNumber(undefined)).toBe('[NOT_CONFIGURED]');
  });

  it('sanitizes and redacts bot tokens from error messages', () => {
    const rawError = 'Error calling https://api.telegram.org/bot8741497212:AAHiIsneC4zuS8xIrmLgyi4WxUODSRG88Ec/sendMessage: Unauthorized';
    const sanitized = sanitizeSecretError(rawError, '8741497212:AAHiIsneC4zuS8xIrmLgyi4WxUODSRG88Ec');
    expect(sanitized).not.toContain('8741497212:AAHiIsneC4zuS8xIrmLgyi4WxUODSRG88Ec');
    expect(sanitized).toContain('[REDACTED_BOT_TOKEN]');
  });

  it('dispatches both Telegram and MacroDroid concurrently when both services respond successfully', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('api.telegram.org')) {
        return new Response(JSON.stringify({ ok: true, result: { message_id: 8821 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (urlStr.includes('trigger.macrodroid.com')) {
        return new Response('Trigger accepted', { status: 200 });
      }
      return originalFetch(url, init);
    });

    const result = await dispatchLeakAlerts({
      eventId: 'EVT-TEST-CONCURRENT-01',
      deviceId: 'ESP32-LPG-01',
      reading: 680,
      threshold: 450,
      timestamp: new Date().toISOString()
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.cooldownSuppressed).toBe(false);
    expect(result.telegram.status).toBe('DELIVERED');
    expect(result.telegram.success).toBe(true);
    expect(result.telegram.details?.messageId).toBe(8821);

    // Call bridge must honestly report TRIGGER_ACCEPTED, never fake call-connected
    expect(result.callBridge.status).toBe('TRIGGER_ACCEPTED');
    expect(result.callBridge.success).toBe(true);
    expect(result.callBridge.details?.phoneMasked).toBe('+918888****45');
  });

  it('partial failure: Telegram fails but MacroDroid Call Bridge still executes independently', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('api.telegram.org')) {
        return new Response(JSON.stringify({ ok: false, description: 'Unauthorized bot token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (urlStr.includes('trigger.macrodroid.com')) {
        return new Response('Trigger accepted', { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const result = await dispatchLeakAlerts({
      eventId: 'EVT-PARTIAL-FAIL-01',
      deviceId: 'ESP32-LPG-01',
      reading: 720,
      threshold: 450,
      timestamp: new Date().toISOString()
    });

    expect(result.telegram.success).toBe(false);
    expect(result.telegram.status).toBe('FAILED');
    expect(result.telegram.error).toContain('Unauthorized bot token');

    // Call bridge must succeed despite Telegram failure
    expect(result.callBridge.success).toBe(true);
    expect(result.callBridge.status).toBe('TRIGGER_ACCEPTED');
  });

  it('partial failure: MacroDroid times out but Telegram still delivers successfully', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('api.telegram.org')) {
        return new Response(JSON.stringify({ ok: true, result: { message_id: 9912 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (urlStr.includes('trigger.macrodroid.com')) {
        const timeoutError = new Error('The operation was aborted');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      return new Response('Not Found', { status: 404 });
    });

    const result = await dispatchLeakAlerts({
      eventId: 'EVT-PARTIAL-FAIL-02',
      deviceId: 'ESP32-LPG-01',
      reading: 750,
      threshold: 450,
      timestamp: new Date().toISOString()
    });

    expect(result.telegram.success).toBe(true);
    expect(result.telegram.status).toBe('DELIVERED');

    // Call bridge reports timeout failure
    expect(result.callBridge.success).toBe(false);
    expect(result.callBridge.status).toBe('FAILED');
    expect(result.callBridge.error).toContain('timed out');
  });

  it('suppresses duplicate events and respects configurable cooldown period', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify({ ok: true, result: { message_id: 110 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    // 1st dispatch: Should succeed
    const res1 = await dispatchLeakAlerts({
      eventId: 'EVT-COOLDOWN-01',
      deviceId: 'ESP32-LPG-01',
      reading: 520,
      threshold: 450,
      timestamp: new Date().toISOString()
    });
    expect(res1.cooldownSuppressed).toBe(false);
    expect(callCount).toBe(2); // 1 Telegram + 1 MacroDroid

    // 2nd dispatch immediately: Should be suppressed by cooldown
    const res2 = await dispatchLeakAlerts({
      eventId: 'EVT-COOLDOWN-02',
      deviceId: 'ESP32-LPG-01',
      reading: 530,
      threshold: 450,
      timestamp: new Date().toISOString()
    });
    expect(res2.cooldownSuppressed).toBe(true);
    expect(res2.telegram.status).toBe('SKIPPED');
    expect(res2.callBridge.status).toBe('SKIPPED');
    expect(callCount).toBe(2); // No new network calls!

    // 3rd dispatch with same eventId: Should be suppressed as duplicate
    const res3 = await dispatchLeakAlerts({
      eventId: 'EVT-COOLDOWN-01',
      deviceId: 'ESP32-LPG-01',
      reading: 540,
      threshold: 450,
      timestamp: new Date().toISOString()
    });
    expect(res3.cooldownSuppressed).toBe(true);
    expect(callCount).toBe(2);

    // 4th dispatch with bypassCooldown: Should dispatch despite cooldown
    const res4 = await dispatchLeakAlerts(
      {
        eventId: 'EVT-BYPASS-01',
        deviceId: 'ESP32-LPG-01',
        reading: 550,
        threshold: 450,
        timestamp: new Date().toISOString()
      },
      { bypassCooldown: true }
    );
    expect(res4.cooldownSuppressed).toBe(false);
    expect(callCount).toBe(4);
  });

  it('gracefully handles missing credentials by skipping without throwing unhandled exceptions', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.MACRODROID_WEBHOOK_URL;

    const res = await dispatchLeakAlerts({
      eventId: 'EVT-NO-CREDS-01',
      deviceId: 'ESP32-LPG-01',
      reading: 600,
      threshold: 450,
      timestamp: new Date().toISOString()
    });

    expect(res.cooldownSuppressed).toBe(false);
    expect(res.telegram.status).toBe('SKIPPED');
    expect(res.telegram.error).toContain('not configured');
    expect(res.callBridge.status).toBe('SKIPPED');
    expect(res.callBridge.error).toContain('not configured');
  });

  it('rejects unauthenticated device telemetry and does NOT dispatch notifications', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Attempt telemetry with no credentials
    const resNoToken = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasRaw: 800, totalMassKg: 20 })
    });
    expect(resNoToken.status).toBe(401);

    // Attempt telemetry with invalid token
    const resBadToken = await fetch(`${baseUrl}/api/device/ESP32-LPG-01/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'attacker_fake_token_123'
      },
      body: JSON.stringify({ gasRaw: 800, totalMassKg: 20 })
    });
    expect(resBadToken.status).toBe(401);

    // Verify no external notification calls to Telegram or MacroDroid occurred
    const externalCalls = fetchSpy.mock.calls.filter(([url]) => {
      const u = url.toString();
      return u.includes('api.telegram.org') || u.includes('trigger.macrodroid.com');
    });
    expect(externalCalls.length).toBe(0);
  });

  it('secured test endpoint rejects unauthorized dispatch attempts', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Attempt test alert with dispatch=true but bad credentials
    const resBadAuth = await fetch(`${baseUrl}/api/alerts/test?dispatch=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'bad_token'
      }
    });
    expect(resBadAuth.status).toBe(401);

    // Attempt test alert with dispatch=true and no credentials
    const resNoAuth = await fetch(`${baseUrl}/api/alerts/test?dispatch=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    expect(resNoAuth.status).toBe(401);

    const externalCalls = fetchSpy.mock.calls.filter(([url]) => {
      const u = url.toString();
      return u.includes('api.telegram.org') || u.includes('trigger.macrodroid.com');
    });
    expect(externalCalls.length).toBe(0);
  });

  it('secured test endpoint executes test dispatch when provided valid credentials', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('api.telegram.org')) {
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1234 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (urlStr.includes('trigger.macrodroid.com')) {
        return new Response('Trigger accepted', { status: 200 });
      }
      return originalFetch(url, init);
    });

    const res = await fetch(`${baseUrl}/api/alerts/test?dispatch=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': 'esp32_dev_token_4892bc'
      },
      body: JSON.stringify({ deviceId: 'ESP32-LPG-01' })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.notifications).toBeDefined();
    expect(body.notifications.telegram.status).toBe('DELIVERED');
    expect(body.notifications.callBridge.status).toBe('TRIGGER_ACCEPTED');

    const externalCalls = fetchSpy.mock.calls.filter(([url]) => {
      const u = url.toString();
      return u.includes('api.telegram.org') || u.includes('trigger.macrodroid.com');
    });
    expect(externalCalls.length).toBe(2);
  });
});

