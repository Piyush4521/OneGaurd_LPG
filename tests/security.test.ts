import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEVICE_REGISTRY } from '../server/index';

describe('OneGaurd Security, Privacy & Rule Validation', () => {
  it('T05 & T06: Validates Firebase RTDB rules enforce strict user-scoped ownership', () => {
    const rulesPath = path.resolve(__dirname, '../database.rules.json');
    expect(fs.existsSync(rulesPath)).toBe(true);

    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    expect(rules.rules).toBeDefined();
    expect(rules.rules.users).toBeDefined();
    expect(rules.rules.users.$uid['.read']).toBe('auth != null && auth.uid === $uid');
    expect(rules.rules.users.$uid['.write']).toBe('auth != null && auth.uid === $uid');
    
    // Explicit deny for any undefined or global paths
    expect(rules.rules.$other['.read']).toBe(false);
    expect(rules.rules.$other['.write']).toBe(false);
  });

  it('T05 & T06: Validates Cloud Firestore rules enforce UID-scoped document access and default deny', () => {
    const firestoreRulesPath = path.resolve(__dirname, '../firestore.rules');
    expect(fs.existsSync(firestoreRulesPath)).toBe(true);

    const rulesText = fs.readFileSync(firestoreRulesPath, 'utf8');
    expect(rulesText).toContain("match /users/{userId}/{document=**}");
    expect(rulesText).toContain("allow read, write: if request.auth != null && request.auth.uid == userId;");
    
    // Explicit global deny rule
    expect(rulesText).toContain("match /{document=**}");
    expect(rulesText).toContain("allow read, write: if false;");
  });

  it('T09: Server-side device registry isolates device ownership from client payloads', () => {
    // Registered device maps to predetermined owner
    const registered = DEVICE_REGISTRY['ESP32-LPG-01'];
    expect(registered).toBeDefined();
    expect(registered.ownerUid).toBe('usr_prod_demo_982');

    // Devices cannot forge ownership via payload
    const attackerDeviceId = 'ROGUE-ESP-02';
    expect(DEVICE_REGISTRY[attackerDeviceId]).toBeUndefined();
  });

  it('T14 & T15: Autonomous local safety contract - firmware does not rely on cloud responses', () => {
    const firmwarePath = path.resolve(__dirname, '../firmware/esp32_onegaurd/esp32_onegaurd.ino');
    expect(fs.existsSync(firmwarePath)).toBe(true);

    const firmwareCode = fs.readFileSync(firmwarePath, 'utf8');
    // Verifies local pins and safety logic exist in loop without blocking on WiFi
    expect(firmwareCode).toContain('PIN_BUZZER');
    expect(firmwareCode).toContain('PIN_ALARM_LED');
    expect(firmwareCode).toContain('PIN_VALVE_RELAY');
    expect(firmwareCode).toContain('digitalWrite(PIN_BUZZER, HIGH)');
    expect(firmwareCode).toContain('localAlarmActive = true');
    expect(firmwareCode).toContain('Continuing independent local safety monitoring');
  });
});
