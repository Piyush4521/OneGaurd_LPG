/**
 * OneGaurd LPG Notification Service
 * 
 * Handles urgent dispatch of LPG safety alerts via:
 * 1. Telegram Bot API (Direct HTTPS sendMessage)
 * 2. Android Jio Call Bridge (MacroDroid Webhook)
 * 
 * Guarantees:
 * - Independent execution (failure in Telegram does not block call bridge)
 * - Strict secret redaction (tokens & full phone numbers never printed in logs or errors)
 * - Debounce / Cooldown idempotency
 * - Honest status reporting (MacroDroid webhook 200 => TRIGGER_ACCEPTED, never fake call-connected)
 * - Safe timeouts and bounded retries
 */

export interface NotificationEvent {
  eventId: string;
  deviceId: string;
  reading: number;
  threshold: number;
  timestamp: string;
  isTest?: boolean;
}

export type DeliveryStatus = 'DELIVERED' | 'TRIGGER_ACCEPTED' | 'FAILED' | 'SKIPPED' | 'UNKNOWN';

export interface NotificationResult {
  success: boolean;
  status: DeliveryStatus;
  attemptedAt: string;
  provider: 'telegram' | 'android_macrodroid';
  statusCode?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface DispatchResult {
  eventId: string;
  cooldownSuppressed: boolean;
  telegram: NotificationResult;
  callBridge: NotificationResult;
}

// In-Memory Cooldown & Deduplication State
let lastAlertTimestamp = 0;
const processedEventIds = new Map<string, number>(); // eventId -> processedAt

/**
 * Mask sensitive phone number for logs / telemetry audit
 * Example: +918888360145 -> +918888****45
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return '[NOT_CONFIGURED]';
  const clean = phone.trim();
  if (clean.length < 7) return '****';
  const prefix = clean.slice(0, clean.length - 6);
  const suffix = clean.slice(-2);
  return `${prefix}****${suffix}`;
}

/**
 * Sanitize error messages to ensure bot tokens or credentials never leak
 */
export function sanitizeSecretError(err: unknown, tokenToScrub?: string): string {
  let message = err instanceof Error ? err.message : String(err);
  if (tokenToScrub && tokenToScrub.length > 5) {
    message = message.split(tokenToScrub).join('[REDACTED_BOT_TOKEN]');
  }
  // Scrub any accidental bot token patterns (e.g. 123456789:ABC...)
  message = message.replace(/\b\d{8,11}:[A-Za-z0-9_-]{25,}\b/g, '[REDACTED_BOT_TOKEN]');
  return message;
}

/**
 * Format telegram message according to the exact project specification
 */
export function formatTelegramMessage(event: NotificationEvent, isTest = false): string {
  if (isTest) {
    return [
      'ℹ️ ONEGAURD TEST ALERT',
      '',
      'Manual diagnostic alert test.',
      '',
      `Device: ${event.deviceId}`,
      `Sensor reading: ${event.reading}`,
      `Configured threshold: ${event.threshold}`,
      `Time: ${event.timestamp}`,
      `Event ID: ${event.eventId}`,
      '',
      'This is a non-emergency test message. No gas leak detected.'
    ].join('\n');
  }

  return [
    '🚨 ONEGAURD LPG LEAK ALERT',
    '',
    'Possible gas leak detected.',
    '',
    `Device: ${event.deviceId}`,
    `Sensor reading: ${event.reading}`,
    `Configured threshold: ${event.threshold}`,
    `Time: ${event.timestamp}`,
    `Event ID: ${event.eventId}`,
    '',
    'Check the area and follow your LPG emergency procedure. Do not operate electrical switches or use flames if a leak is suspected.'
  ].join('\n');
}

/**
 * Dispatches Telegram Bot alert using official Telegram Bot API
 */
export async function sendTelegramAlert(
  event: NotificationEvent,
  options: { isTest?: boolean; maxRetries?: number } = {}
): Promise<NotificationResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const maxRetries = options.maxRetries ?? 1;

  if (!token || !chatId) {
    return {
      success: false,
      status: 'SKIPPED',
      attemptedAt: new Date().toISOString(),
      provider: 'telegram',
      error: 'Telegram alert skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.'
    };
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const text = formatTelegramMessage(event, options.isTest);

  let attempt = 0;
  let lastError = '';
  let lastStatusCode: number | undefined;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          disable_web_page_preview: true
        }),
        signal: AbortSignal.timeout(8000)
      });

      lastStatusCode = response.status;
      const data: any = await response.json().catch(() => ({}));

      if (response.ok && data.ok) {
        return {
          success: true,
          status: 'DELIVERED',
          attemptedAt: new Date().toISOString(),
          provider: 'telegram',
          statusCode: response.status,
          details: {
            messageId: data.result?.message_id,
            chatId: chatId
          }
        };
      }

      lastError = sanitizeSecretError(data.description || `HTTP ${response.status} from Telegram API`, token);

      // Do not retry on client errors like 400 (Bad Request), 401 (Unauthorized), 404 (Not Found)
      if (response.status >= 400 && response.status < 500) {
        break;
      }
    } catch (err: any) {
      lastError = sanitizeSecretError(err, token);
      if (err.name === 'TimeoutError') {
        lastError = 'Telegram API request timed out after 8000ms';
      }
    }

    if (attempt <= maxRetries) {
      // Short backoff before retry
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return {
    success: false,
    status: 'FAILED',
    attemptedAt: new Date().toISOString(),
    provider: 'telegram',
    statusCode: lastStatusCode,
    error: lastError || 'Telegram alert transmission failed'
  };
}

/**
 * Triggers Android MacroDroid Webhook to initiate Jio outgoing call
 */
export async function triggerAndroidCallBridge(
  event: NotificationEvent,
  options: { isTest?: boolean; maxRetries?: number } = {}
): Promise<NotificationResult> {
  const webhookUrl = process.env.MACRODROID_WEBHOOK_URL?.trim();
  const maxRetries = options.maxRetries ?? 1;

  if (!webhookUrl) {
    return {
      success: false,
      status: 'SKIPPED',
      attemptedAt: new Date().toISOString(),
      provider: 'android_macrodroid',
      error: 'MacroDroid call bridge skipped: MACRODROID_WEBHOOK_URL is not configured.'
    };
  }

  // Ensure clean URL without duplicate trailing query marks
  const urlObj = new URL(webhookUrl);
  urlObj.searchParams.set('event', options.isTest ? 'test_alert' : 'leak_detected');
  urlObj.searchParams.set('deviceId', event.deviceId);
  urlObj.searchParams.set('gasRaw', String(event.reading));
  urlObj.searchParams.set('eventId', event.eventId);

  const payload = {
    event: options.isTest ? 'test_alert' : 'leak_detected',
    deviceId: event.deviceId,
    gasRaw: event.reading,
    threshold: event.threshold,
    timestamp: event.timestamp,
    eventId: event.eventId,
    emergencyPhoneMasked: maskPhoneNumber(process.env.EMERGENCY_PHONE_NUMBER)
  };

  let attempt = 0;
  let lastError = '';
  let lastStatusCode: number | undefined;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      const response = await fetch(urlObj.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });

      lastStatusCode = response.status;

      if (response.ok) {
        // IMPORTANT: HTTP 200 indicates MacroDroid cloud trigger reception, NOT call answered.
        return {
          success: true,
          status: 'TRIGGER_ACCEPTED',
          attemptedAt: new Date().toISOString(),
          provider: 'android_macrodroid',
          statusCode: response.status,
          details: {
            note: 'Webhook trigger accepted by MacroDroid gateway. Call execution handled locally by Android OS & Jio SIM.',
            phoneMasked: maskPhoneNumber(process.env.EMERGENCY_PHONE_NUMBER)
          }
        };
      }

      lastError = `MacroDroid Webhook returned HTTP ${response.status}`;
      if (response.status >= 400 && response.status < 500) {
        break; // Do not retry bad requests or not found
      }
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        lastError = 'MacroDroid webhook request timed out after 8000ms';
      } else {
        lastError = sanitizeSecretError(err);
      }
    }

    if (attempt <= maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return {
    success: false,
    status: 'FAILED',
    attemptedAt: new Date().toISOString(),
    provider: 'android_macrodroid',
    statusCode: lastStatusCode,
    error: lastError || 'MacroDroid webhook transmission failed'
  };
}

/**
 * Orchestrates independent alert delivery across Telegram and Android Call Bridge.
 * Enforces cooldown suppression to avoid flooding and duplicate phone calls.
 */
export async function dispatchLeakAlerts(
  event: NotificationEvent,
  options: { bypassCooldown?: boolean; isTest?: boolean } = {}
): Promise<DispatchResult> {
  const cooldownSeconds = parseInt(process.env.ALERT_COOLDOWN_SECONDS || '60', 10);
  const cooldownMs = (isNaN(cooldownSeconds) ? 60 : cooldownSeconds) * 1000;
  const now = Date.now();

  // Clean stale event IDs older than 10 minutes
  for (const [id, time] of processedEventIds.entries()) {
    if (now - time > 600000) {
      processedEventIds.delete(id);
    }
  }

  // Idempotency & Cooldown Verification
  const isDuplicateId = processedEventIds.has(event.eventId);
  const isWithinCooldown = now - lastAlertTimestamp < cooldownMs;

  if (!options.bypassCooldown && (isDuplicateId || isWithinCooldown)) {
    const reason = isDuplicateId
      ? `Duplicate event ID ${event.eventId} suppressed.`
      : `Alert throttled: active cooldown (${cooldownSeconds}s window).`;

    return {
      eventId: event.eventId,
      cooldownSuppressed: true,
      telegram: {
        success: false,
        status: 'SKIPPED',
        attemptedAt: new Date().toISOString(),
        provider: 'telegram',
        error: reason
      },
      callBridge: {
        success: false,
        status: 'SKIPPED',
        attemptedAt: new Date().toISOString(),
        provider: 'android_macrodroid',
        error: reason
      }
    };
  }

  // Mark event as active
  lastAlertTimestamp = now;
  processedEventIds.set(event.eventId, now);

  // Run Telegram and MacroDroid concurrently and independently
  const [telegramOutcome, callBridgeOutcome] = await Promise.allSettled([
    sendTelegramAlert(event, { isTest: options.isTest }),
    triggerAndroidCallBridge(event, { isTest: options.isTest })
  ]);

  const telegramResult: NotificationResult =
    telegramOutcome.status === 'fulfilled'
      ? telegramOutcome.value
      : {
          success: false,
          status: 'FAILED',
          attemptedAt: new Date().toISOString(),
          provider: 'telegram',
          error: sanitizeSecretError(telegramOutcome.reason)
        };

  const callBridgeResult: NotificationResult =
    callBridgeOutcome.status === 'fulfilled'
      ? callBridgeOutcome.value
      : {
          success: false,
          status: 'FAILED',
          attemptedAt: new Date().toISOString(),
          provider: 'android_macrodroid',
          error: sanitizeSecretError(callBridgeOutcome.reason)
        };

  return {
    eventId: event.eventId,
    cooldownSuppressed: false,
    telegram: telegramResult,
    callBridge: callBridgeResult
  };
}

/**
 * Resets alert cooldown state for automated tests
 */
export function resetAlertCooldownState(): void {
  lastAlertTimestamp = 0;
  processedEventIds.clear();
}
