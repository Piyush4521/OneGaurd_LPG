# OneGaurd LPG — Telegram Alerts & Android Jio Call Bridge Guide

This guide documents the setup, architecture, security policies, and manual testing procedures for the **Telegram Bot Alert Gateway** and **Android Motorola MacroDroid Jio Call Bridge** integrated into the OneGaurd LPG Safety System.

---

## 1. Safety Principles & System Architecture

```
+-------------------------------------------------------------------------+
|                         ESP32 Edge Hardware                             |
|  - Analog MQ-6 LPG Gas Sensor                                           |
|  - Autonomous Buzzer & Relay Valve (Immediate local cutoff, <100ms)    |
|  - ZERO dependence on WiFi or Cloud for immediate local safety         |
+------------------------------------+------------------------------------+
                                     |
                                     | Authenticated HTTPS Telemetry
                                     v
+-------------------------------------------------------------------------+
|                      OneGaurd Backend Gateway                           |
|  - Token Authentication (`x-device-token`)                             |
|  - Sensor Bounds & Tare Mass Calculation                                |
|  - Idempotency & Cooldown Engine (`ALERT_COOLDOWN_SECONDS`)            |
|  - Independent Asynchronous Notification Dispatch (Promise.allSettled)  |
+-------------------+---------------------------------+-------------------+
                    |                                 |
                    v                                 v
+------------------------------------+   +------------------------------------+
|        Telegram Bot API            |   |   MacroDroid Android Call Bridge   |
| - HTTPS POST /bot<TOKEN>/sendMessage|   | - HTTPS POST /trigger.macrodroid...|
| - Markdown/Plain format message    |   | - Motorola phone triggers Jio call |
| - Instant delivery to group/user   |   | - Result: TRIGGER_ACCEPTED         |
+------------------------------------+   +------------------------------------+
```

### Safety Rules:
1. **Local Safety Decoupling**: If WiFi, the Internet, Telegram, or the Android phone is offline, the ESP32 hardware continues to trigger its local alarm and cut off gas autonomously. Cloud notifications are an informative extension, never a prerequisite for local safety.
2. **Honest Status Reporting**: When the MacroDroid webhook returns HTTP 200, the backend records the status as `TRIGGER_ACCEPTED`. An HTTP 200 from MacroDroid indicates the cloud gateway accepted the trigger; it is **never** recorded as a connected or answered phone call.
3. **Zero Secrets in Git**: Bot tokens, phone numbers, and device secrets live strictly in local `.env` files and are never committed to version control.

---

## 2. Configuration & Environment Variables

Add or verify the following keys in your `.env` file (see `.env.example` for reference):

```env
# Telegram Bot Alert Gateway
TELEGRAM_BOT_TOKEN=8741497212:AAHiIsneC4zuS8xIrmLgyi4WxUODSRG88Ec
TELEGRAM_CHAT_ID=your_chat_id_here

# Android MacroDroid Jio Call Bridge
MACRODROID_WEBHOOK_URL=https://trigger.macrodroid.com/39931516-ecee-46af-8657-caca17cfd761/
EMERGENCY_PHONE_NUMBER=+918888360145
ALERT_COOLDOWN_SECONDS=60
```

---

## 3. Telegram Bot Configuration

### Step 1: Create or Confirm Your Bot with BotFather
1. Open Telegram and search for `@BotFather`.
2. Send `/start` and then `/newbot` (or use your existing token).
3. Copy the Bot Token provided by BotFather into `TELEGRAM_BOT_TOKEN`.

### Step 2: Obtain Destination Chat ID
1. Open your Telegram bot in the Telegram app and send `/start` or any test message.
2. Search for `@userinfobot` or `@RawDataBot` on Telegram and send a message to it to instantly see your numeric `id` (e.g., `987654321`).
3. Alternatively, visit in your browser:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   Look for `"chat":{"id":123456789}` in the JSON response.
4. Paste the numeric ID into `TELEGRAM_CHAT_ID` in your `.env`.

---

## 4. Android Motorola & MacroDroid Setup (Jio SIM Call Bridge)

### Step 1: Install MacroDroid
1. On your Motorola Android phone, install **MacroDroid - Device Automation** from the Google Play Store.

### Step 2: Create the Emergency Call Macro
1. Open MacroDroid and tap **Add Macro**.
2. **Trigger**:
   - Tap `+` under Triggers -> **Connectivity** -> **Webhook (URL)**.
   - Tap **Create URL** or note your unique Webhook ID (e.g. `39931516-ecee-46af-8657-caca17cfd761`).
   - Copy this URL into `MACRODROID_WEBHOOK_URL` in your `.env`.
3. **Action 1 (Screen Wakeup)**:
   - Tap `+` under Actions -> **Screen** -> **Screen On** (or **Wake Device**).
   - This ensures Motorola background power restrictions do not prevent the dialer intent.
4. **Action 2 (Make Call)**:
   - Tap `+` under Actions -> **Phone** -> **Make Call**.
   - Select **Select Number** -> Enter your emergency phone number (`+918888360145`).
   - If prompted for SIM selection, choose your **Jio SIM** (SIM 1 or SIM 2).
5. **Constraints / Rate Limit**:
   - Tap `+` under Constraints -> **MacroDroid Specific** -> **Rate Limit** -> Limit to 1 execution per 1 minute.
   - This provides hardware-level duplicate dialing suppression.
6. Save and name the Macro: `OneGaurd LPG Jio Emergency Caller`.

### Step 3: Critical Android Permissions (Motorola Specific)
Motorola Android builds enforce aggressive battery and background call restrictions. Configure the following:
1. **Phone Call Permission**:
   - Go to Android **Settings** -> **Apps** -> **MacroDroid** -> **Permissions** -> **Phone** -> Select **Allow**.
2. **Display Over Other Apps**:
   - Go to Android **Settings** -> **Apps** -> **Special App Access** -> **Display over other apps** -> Turn ON for **MacroDroid**.
3. **Battery Optimization (Prevent Deep Sleep)**:
   - Go to Android **Settings** -> **Apps** -> **MacroDroid** -> **Battery** -> Select **Unrestricted**.
4. **Lock Screen / Unattended Call Behavior**:
   - In modern Android versions (Android 10+), outgoing calls from background apps require the screen to be unlocked or require standard dialer intent permissions. If your device displays a dialer confirmation screen instead of auto-dialing, ensure the MacroDroid Accessibility Service is enabled in **Settings -> Accessibility -> MacroDroid**.

---

## 5. Safe Manual Testing (Zero Gas Required)

You do **not** need to release gas or trigger real sensors to test the full pipeline. Use the following test workflows:

### Method A: Secured Diagnostic Test Endpoint (Recommended)
Triggers labelled test messages over Telegram and the MacroDroid call bridge without affecting sensor history:

```bash
curl -X POST "http://localhost:5000/api/alerts/test?dispatch=true" \
  -H "Content-Type: application/json" \
  -H "x-device-token: esp32_dev_token_4892bc" \
  -d "{\"deviceId\": \"ESP32-LPG-01\"}"
```

**Expected Result**:
- Backend returns HTTP `200 OK` with JSON payload containing:
  ```json
  {
    "status": "ok",
    "notifications": {
      "telegram": { "status": "DELIVERED", "success": true },
      "callBridge": { "status": "TRIGGER_ACCEPTED", "success": true }
    }
  }
  ```
- Your Telegram receives:
  ```
  ℹ️ ONEGAURD TEST ALERT
  Manual diagnostic alert test.
  Device: ESP32-LPG-01
  ...
  This is a non-emergency test message. No gas leak detected.
  ```
- Your Motorola phone triggers MacroDroid and places an outgoing call via its Jio SIM.

### Method B: Simulated High Gas ADC Reading (Simulate Leak Event)
Simulate an analog MQ-6 threshold breach (ADC > 450):

```bash
curl -X POST "http://localhost:5000/api/device/ESP32-LPG-01/telemetry" \
  -H "Content-Type: application/json" \
  -H "x-device-token: esp32_dev_token_4892bc" \
  -d "{\"gasRaw\": 620, \"totalMassKg\": 23.5, \"tareMassKg\": 15.1}"
```

**Expected Result**:
- Backend detects `gasRaw: 620 >= 450` (`leak: true`).
- Sends Telegram emergency alert message:
  ```
  🚨 ONEGAURD LPG LEAK ALERT
  Possible gas leak detected.
  Device: ESP32-LPG-01
  Sensor reading: 620
  ...
  ```
- Triggers MacroDroid webhook.
- Incident logged in `/api/devices/ESP32-LPG-01/events` with statuses.

### Method C: Cooldown Verification
Send the simulation command twice within 60 seconds:
- 1st call: Dispatches Telegram and MacroDroid.
- 2nd call: Logs suppressed by cooldown (`cooldownSuppressed: true`), preventing repeated spam dials.

---

## 6. Automated Test Suite

Run the comprehensive unit and integration test suite:

```bash
# Run all vitest suites
npm test

# Typecheck backend and frontend
npm run typecheck

# Build production bundle
npm run build
```
