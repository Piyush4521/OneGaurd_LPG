# OneGaurd — Master Project Plan, Engineering Roadmap & Build Prompt Series

**Version:** 1.0  
**Prepared:** 10 October 2026  
**Project:** OneGaurd LPG Leak Detection and Cylinder Gas-Weight Monitoring  
**Build approach:** One phase at a time, test each phase, then proceed  
**Primary objective:** Build a functional, secure, mobile-first monitoring system that connects ESP32 sensor hardware to a PWA through a Node.js backend and Firebase.

> **Safety statement:** OneGaurd is a prototype until properly calibrated, independently reviewed, and validated. It is not a certified gas alarm. The ESP32 must perform immediate local leak response without relying on Wi-Fi, the cloud, a phone, or app animations. Never intentionally release LPG for testing. Use safe, controlled sensor-testing methods and qualified guidance.

---

# 1. Project vision

OneGaurd is a smart LPG monitoring system for a household or small installation. It combines local hardware sensing, a cloud-connected mobile dashboard, cylinder gas-weight estimation, device health monitoring, alert history, and optional remote notifications.

The project is designed around a practical principle: **hardware detects and reacts; the cloud records and communicates; the app explains the current state clearly.**

The user should be able to:
- Sign in using Google or email/password.
- Register and see their own ESP32 monitor.
- See a live gas-sensor reading and leak status.
- See measured weight and an estimated amount of gas remaining.
- See when the device last reported and whether it is online.
- Review sensor readings and safety events over time.
- Configure appropriate, validated thresholds.
- Receive in-app alerts and, once configured, optional push notifications, SMS, or a voice call for a leak event.
- Test the user interface safely using simulated readings before real hardware is connected.
- Continue to have local leak detection and an audible/physical safety response if internet connectivity fails.

## 1.1 The prototype weight assumption

For early software development, the platform will be treated as an empty baseline. The platform is zeroed while empty, and any added test mass is treated as the “gas weight” value shown by the prototype.

**Important engineering correction:** a load cell measures the total force/mass applied to it. A real cylinder placed on the platform normally includes the cylinder's tare mass plus the gas mass. A real system must either:
1. Measure an empty cylinder/platform tare and subtract it, or
2. Measure the cylinder tare value and subtract it from total measured cylinder mass, or
3. Use a dedicated, repeatable calibration process that records the correct baseline.

Do not silently label total cylinder weight as gas weight. The interface should explicitly show the measurement mode and tare/calibration status. The 14.2 kg value sometimes used in the prototype is an illustrative example, not a universal or verified cylinder specification. Make cylinder capacity configurable.

## 1.2 Hardware already discussed

- ESP32 development board.
- MQ-6 gas sensor module.
- Load cells, with mechanical mounting and balancing still to be validated.
- Load-cell amplifier/ADC board (exact model and wiring to be confirmed; HX711 is common but must not be assumed until checked).
- Servo motor intended as a demonstration actuator/valve mechanism.
- Phone hotspot as the initial Wi-Fi network.
- Prototype platform/mounting arrangement.

The exact pin mapping, amplifier model, load-cell count, servo model, and actuator behavior must be confirmed before final firmware is written. A hobby servo and 3D-printed mechanism must not be treated as a certified LPG shutoff valve.

---

# 2. System architecture

```text
                  LOCAL SAFETY PATH — MUST WORK OFFLINE
        ┌────────────────────────────────────────────────┐
        │                     ESP32                      │
        │ MQ-6 sampling • load-cell sampling • filtering  │
        │ calibrated threshold logic • local fault state │
        │ local alarm / safe output • watchdog            │
        └───────────────┬───────────────────┬────────────┘
                        │                   │
             local alarm/output       Wi-Fi over hotspot
                        │                   │
                        ▼                   ▼
                 Audible/physical      HTTPS/TLS telemetry
                 response (local)           │
                                             ▼
                                  ┌─────────────────────┐
                                  │ Node.js / Express   │
                                  │ verify device ID     │
                                  │ authenticate device │
                                  │ validate payload    │
                                  │ store events        │
                                  │ deduplicate alerts  │
                                  └─────────┬───────────┘
                                            │ Admin SDK
                              ┌─────────────┴─────────────┐
                              ▼                           ▼
                    Firebase RTDB                  Cloud Firestore
                    latest live state              users/devices/
                    online status                  metadata/history/
                    realtime UI state              settings/events
                              │                           │
                              └─────────────┬─────────────┘
                                            ▼
                                  React Native Web / PWA
                                  mobile-first dashboard
                                  auth • live state • history
                                  device health • settings
                                            │
                                            ▼
                               optional FCM / SMS / voice call
```

## 2.1 Technology choices

- **Frontend:** Expo + React Native + React Native Web, or a carefully maintained React/Vite web PWA if a web-only deployment is the priority. Avoid maintaining two separate UIs unnecessarily.
- **Mobile delivery:** installable PWA in supported browsers. Native app packaging can be added later if required.
- **Backend:** Node.js LTS + Express. Use HTTPS in deployment, schema validation, request size limits, rate limiting, structured logs, and clear health endpoints.
- **Identity:** Firebase Authentication (Google and email/password).
- **Live state:** Firebase Realtime Database (RTDB) for current readings, current alarm state, and connectivity status.
- **Durable metadata/history:** Cloud Firestore for user profile, registered devices, settings, event records, alert-delivery status, calibration metadata, and audit information. RTDB history may be used for an early prototype but retention must be designed.
- **Notifications:** Firebase Cloud Messaging (FCM) for browser/mobile push where supported. Optional SMS and voice calls through a provider such as Twilio or another locally available provider. No provider should be assumed to be free.
- **Testing:** unit tests, API tests, Firebase Emulator Suite where feasible, UI tests, and hardware-in-the-loop tests.

## 2.2 Why use both Firebase databases?

RTDB is optimized for simple realtime trees and listeners. It is suitable for each device's latest state and immediate dashboard updates.

Firestore is suitable for structured records, queries, metadata, alert history, user/device ownership, and settings. The project can start with RTDB only for the live path and add Firestore for durable records. Avoid writing every high-frequency sample to both services without a retention and cost plan.

## 2.3 Data ownership rule

Every signed-in user has a Firebase Authentication UID. All user data must be scoped to that UID. Client-side paths are not an authorization mechanism by themselves; Firebase Security Rules must enforce access. The backend must verify Firebase ID tokens for user APIs.

**Do not allow an ESP32 to choose an arbitrary owner UID in its payload.** The server must resolve the owner from a server-side device registry after verifying that device's credential. The web client must never contain service-account keys or backend secrets.

---

# 3. End-to-end behavior

## 3.1 Normal operation

1. ESP32 boots and initializes sensors and local safety output to a safe, defined state.
2. It checks sensor availability and runs startup/warm-up logic appropriate for the MQ-6 module.
3. It reads the load-cell amplifier, applies calibration and filtering, and computes a weight value.
4. It samples the MQ-6 analog output, filters noise, and evaluates the configured, validated leak-detection logic.
5. It performs the local safety response without waiting for cloud communication.
6. If Wi-Fi is available, it connects to the configured hotspot.
7. It sends a signed/authenticated telemetry payload to the backend over TLS.
8. Backend validates device identity, payload schema, timestamp, rate, and bounds.
9. Backend stores the latest state in RTDB and durable events/metadata in Firestore.
10. Authenticated app subscribes only to the current user's authorized device path and updates the UI.
11. App indicates the timestamp of the last valid reading and changes the device status to stale/offline if readings stop arriving.
12. If a safety event occurs, the backend records it and invokes configured alert channels with deduplication and delivery status.

## 3.2 Leak state

A leak event should not be based only on one noisy sample. Use a sensor-specific, calibrated strategy such as filtered readings, persistence over a validated interval, hysteresis, startup/warm-up handling, and sensor fault detection. The exact values must come from testing and qualified guidance—not arbitrary sample numbers in code.

On suspected leak:
- ESP32 executes the local response immediately.
- Local audible/visual alert activates as designed.
- App shows a high-contrast critical warning when the cloud receives the event.
- Backend writes a durable alert event and deduplicates repeated telemetry for the same incident.
- Optional push, SMS, and voice call are sent according to user preferences and verified destinations.
- User is instructed to follow safe emergency guidance. The app must not imply that a call was successfully delivered until the provider confirms its result.
- Clear/reset behavior must be explicit and safe. The cloud must not be able to silence or override local safety behavior.

## 3.3 Connectivity loss

- Local sensor evaluation and local alarm continue.
- Device marks itself disconnected from cloud when appropriate.
- App marks readings as stale after a defined heartbeat timeout; it must not continue to label old data “live.”
- Device reconnects with exponential backoff and jitter.
- If event buffering is implemented, queued events are sent with unique event IDs and original timestamps when connectivity returns.
- Backend deduplicates repeated/replayed events.
- The UI differentiates `online`, `stale`, `offline`, `sensor_fault`, and `unknown`.

## 3.4 Weight and refill estimate

- Calibrate the empty platform/tare and load-cell scale factor.
- Filter readings to reduce mechanical vibration.
- Record the calibration value, units, timestamp, and calibration version.
- Convert to kilograms only after calibration.
- Gas mass is `max(0, measured_total_mass - tare_mass)` when the system is measuring a cylinder on the platform and tare is known.
- Percentage remaining is `clamp(gas_mass / configured_gas_capacity_kg * 100, 0, 100)`.
- A refill estimate may use rolling average consumption over an appropriate period. If there is insufficient history, show “collecting usage data” rather than a misleading number.
- The estimate is informational; do not claim exact remaining days without enough data.

---

# 4. Product experience and UI/UX

## 4.1 Visual direction

Use the selected **hybrid monitoring** direction:
- Dark charcoal/navy safety hero.
- Calm white/light neutral content surfaces.
- Teal/green for normal state.
- Amber for caution and sensor/connection uncertainty.
- Red for a suspected leak or critical alarm.
- Minimal visual hierarchy, clear typography, restrained cards, and generous spacing.
- Motion should be subtle and purposeful. Respect `prefers-reduced-motion`; animations never delay safety warnings.

## 4.2 Screens

### A. Sign-in/onboarding
- Google sign-in and email/password.
- Explain what data is collected and how user/device data is separated.
- Clear Firebase configuration error state in development.
- Device pairing flow with an ownership check.

### B. Home dashboard
- Safety status as the first and most prominent item.
- Last updated timestamp and device connection status.
- Current gas sensor reading with units clearly marked as raw or calibrated.
- Gas weight, calibration status, configured capacity, and remaining percentage.
- Refill estimate only when enough valid data exists.
- Recent alerts/events.
- Demo-mode banner and test controls only in development mode.

### C. Devices
- Registered device list, friendly name, last seen, firmware version, battery/power state if available, sensor health, and connection status.
- Add/pair/remove device, with ownership checks and device-registration workflow.
- A disconnected device must not look safe just because the last reading was safe.

### D. History
- Leak and sensor-fault events.
- Weight samples/aggregates and historical trends.
- Filter by device and time period.
- Event time, source, acknowledgement status, and notification delivery status.

### E. Alerts/settings
- Configured thresholds with calibration status and warnings.
- Low-weight alert threshold.
- Push/SMS/voice preference and destination verification.
- Quiet-hour policy must never suppress critical leak calls unless explicitly designed and safety-reviewed; default is critical alerts bypass quiet hours.
- Alert test action must be labelled as a test and must not imitate a real leak without clear labeling.

### F. Account/privacy
- Signed-in account, devices owned, data export/delete workflow, sign-out, privacy information.
- Ensure all queries and rules enforce user ownership.

## 4.3 Motion and accessibility
- Short page transitions (roughly 150–250 ms) where appropriate.
- Gentle chart/number transitions that do not obscure values.
- Loading skeletons only while data is loading.
- Avoid constant flashing/pulsing except a deliberate, accessible critical indicator.
- Do not communicate status by color alone; use text and icons.
- Touch targets suitable for phones, keyboard focus, screen-reader labels, sufficient contrast, and reduced-motion support.

---

# 5. Security and privacy requirements

1. Firebase Authentication required for personal dashboards and user APIs.
2. Firestore and RTDB rules enforce `auth.uid == userId` for user-owned records.
3. Do not use public read/write rules.
4. Backend verifies Firebase ID tokens for user endpoints.
5. Device ingestion uses unique per-device credentials, mapped to owner UID on the server. Use TLS, rotation, rate limits, schema validation, replay protection, and secret storage.
6. Do not store provider credentials in frontend variables or source control.
7. Do not commit service-account JSON.
8. Phone numbers must be verified and alerting consent must be explicit.
9. Limit call/SMS frequency, deduplicate alerts, and impose cost caps.
10. Validate all values server-side, including weight, gas readings, timestamps, and device IDs.
11. Use least privilege for Firebase Admin/service accounts.
12. Log delivery status without exposing secrets or unnecessary personal data.
13. Provide a device revoke/rotation path.
14. Test cross-user access denial explicitly.

---

# 6. Free-tier and cost strategy

Aim for a free-first development workflow, but do not promise unlimited free service.

- Firebase has plan-specific limits and may change pricing/eligibility. Verify the current plan and required services in the Firebase console before launch.
- RTDB/Firestore use should be limited by sample frequency, retention, and number of devices.
- Local demo mode should work without cloud configuration.
- Firebase Emulator Suite can help test rules and backend logic locally.
- Push notification support depends on browser/platform, service-worker setup, HTTPS, and FCM configuration.
- SMS and voice calls generally involve telecom/provider costs; trial accounts may restrict destinations and message content.
- Use a voice/SMS provider only after verifying current prices, local availability, destination verification, and compliance requirements.
- Add cooldowns, incident deduplication, a daily/monthly spend limit, and a provider-disable switch.
- Do not call a paid provider during automated tests; use a mock provider or explicit test mode.

---

# 7. Implementation phases and acceptance criteria

Do not jump to the next phase until the current phase passes its tests.

## Phase 0 — Requirements and inventory
**Work**
- Confirm ESP32 board, sensor module, amplifier, load-cell count, servo, power supply, pins, and physical setup.
- Confirm the prototype measurement assumption and future tare approach.
- Decide web PWA only versus Expo + React Native Web; keep one shared UI codebase if possible.
- Define supported browsers and expected mobile devices.
- Define alert recipients and whether voice/SMS are required for the first demonstration.

**Pass criteria**
- Hardware inventory and wiring are documented.
- Sensor units and calibration plan are explicit.
- Local safety behavior is described and does not depend on the cloud.

## Phase 1 — Project foundation
**Work**
- Set up repository, environment templates, lint/type-check/build scripts, UI tokens, routing, PWA metadata.
- Add environment validation and a safe demo mode.
- Add CI checks where available.

**Pass criteria**
- Fresh clone installs and builds.
- No secrets in repository.
- PWA loads on a phone-sized viewport and supports reduced motion.

## Phase 2 — UI and simulation
**Work**
- Implement onboarding, dashboard, devices, history, settings, account.
- Create a typed telemetry model and realistic simulation service.
- Add safe controls for normal, stale, offline, sensor-fault, low-weight, and leak test states.
- Add responsive states, empty/loading/error states, accessibility and animations.

**Pass criteria**
- All main screens work without Firebase.
- Simulation updates readings and history predictably.
- Leak UI has highest priority and remains clear at small screen sizes.
- Reduced-motion mode works.

## Phase 3 — Firebase Authentication
**Work**
- Configure Google and email/password providers.
- Handle loading, sign-in, sign-up, sign-out, invalid credentials, disabled providers, and network errors.
- Store a minimal user profile.
- Ensure user UID is the ownership key.

**Pass criteria**
- Google and email/password flows work on authorized domains.
- Signed-out user cannot access personal device data.
- A second user cannot read or write the first user's data.

## Phase 4 — Firebase data layer
**Work**
- Establish RTDB schema for latest device state and connectivity.
- Establish Firestore schema for device metadata, events, settings, calibration, and alert delivery records.
- Add RTDB/Firestore rules.
- Implement listeners with cleanup, stale-state detection, reconnect handling, and errors.
- Avoid duplicate writes and uncontrolled high-frequency history storage.

**Pass criteria**
- A test reading updates only the owning user's dashboard.
- Unauthorized read/write attempts are denied.
- App distinguishes live, stale, offline, and missing readings.
- No listener leaks when navigating or signing out.

## Phase 5 — Node.js API
**Work**
- Add health endpoint, authenticated user endpoints, telemetry schema validation, rate limiting, structured logs, and error handling.
- Verify Firebase ID tokens for user routes.
- Implement server-side device registry and device credential validation.
- Store current state in RTDB and durable events in Firestore.
- Add idempotency/event IDs and timestamp validation.

**Pass criteria**
- Missing/invalid user token returns 401.
- Bad payloads return 400.
- Unknown/revoked device credentials return 401.
- A device cannot select another owner's UID.
- Valid telemetry is accepted and appears only under the registered owner's data.

## Phase 6 — ESP32 firmware integration
**Work**
- Implement Wi-Fi provisioning/hotspot connection and reconnect.
- Integrate the exact load-cell amplifier and MQ-6 module after verifying models/pins.
- Add sensor warm-up, calibration, filtering, fault detection, watchdog, and safe boot behavior.
- Run local leak logic and local alarm independently of Wi-Fi.
- Add authenticated telemetry and heartbeat with firmware version and event ID.
- Buffer critical events during temporary network loss if memory allows.

**Pass criteria**
- Device continues local alarm logic when router/hotspot is off.
- Invalid sensor values trigger a fault state rather than a false “safe.”
- Readings carry correct units, timestamps, and device ID.
- Device reconnects without duplicating incidents.

## Phase 7 — Alerts and notifications
**Work**
- Implement in-app event history and push notification path.
- Add optional SMS/voice provider adapters on the server.
- Add phone-number verification/consent, preference checks, delivery status, cooldown, deduplication, retry policy, and provider disable switch.
- Use mocked providers for development and automated tests.
- Add test-alert workflow clearly separate from real leak alerts.

**Pass criteria**
- One incident triggers no uncontrolled burst of repeated calls/messages.
- Provider failures are recorded and visible to the user/admin.
- A test event cannot accidentally call real recipients unless explicitly configured.
- User settings are respected.
- Critical alert copy is actionable and does not claim delivery before confirmation.

## Phase 8 — Calibration and measurement validation
**Work**
- Tare empty platform and calibrate with known reference masses.
- Check repeatability, creep, drift, mechanical balance, and load distribution.
- Confirm whether multiple load cells need summing and how the amplifier is wired.
- Determine the actual MQ-6 signal path, ADC behavior, warm-up, baseline, and safe controlled calibration method.
- Keep raw values and calibrated values distinct.
- Record calibration metadata/version.

**Pass criteria**
- Weight error and repeatability are measured and documented against a chosen acceptance tolerance.
- Sensor faults and disconnected wires are detectable where feasible.
- No arbitrary raw ADC value is labelled true ppm without validated calibration.
- Threshold settings are justified by tests and qualified guidance.

## Phase 9 — End-to-end verification
**Work**
- Test demo mode, auth, device ingestion, RTDB updates, history, stale/offline, alert deduplication, provider failures, sign-out, and user isolation.
- Test mobile layout on a real phone.
- Test poor Wi-Fi and hotspot loss.
- Test API and Firebase rules using emulators where feasible.
- Test production build and service-worker caching.
- Verify secrets, CORS, HTTPS, logging, and backup/retention.

**Pass criteria**
- All P0 tests pass.
- No known cross-user data exposure.
- No safety-critical logic relies on the cloud.
- Any untested items are clearly listed; no claim of full verification without evidence.

## Phase 10 — Deployment and handover
**Work**
- Deploy frontend to a static HTTPS host.
- Deploy backend to a supported Node hosting platform.
- Configure secrets, domains, Firebase authorized domains, CORS, database rules, provider callback/config, and monitoring.
- Add versioning, rollback instructions, backups, and a troubleshooting guide.
- Produce final wiring diagram, pin map, calibration checklist, API documentation, and user guide.

**Pass criteria**
- App loads over HTTPS and is installable where supported.
- Backend health endpoint is monitored.
- Revoke/rotate device credentials works.
- Deployment can be repeated from documentation.

---

# 8. Suggested data model

This is a proposed schema. Implement and validate it rather than assuming it already exists.

## Realtime Database
```text
users/{uid}/
  settings/
    gasThresholdConfig: { ... }
    lowWeightKg: number
    alerts: { push: boolean, sms: boolean, voice: boolean }
  devices/{deviceId}/
    latest/
      weightKg: number
      totalMassKg: number
      gasRaw: number
      gasPpm: number | null
      leak: boolean
      sensorStatus: "ok" | "fault" | "warming" | "unknown"
      online: boolean
      timestamp: number
      eventId: string
      firmwareVersion: string
```

## Cloud Firestore
```text
users/{uid}
  email, displayName, createdAt, updatedAt

users/{uid}/devices/{deviceId}
  name, registeredAt, lastSeenAt, firmwareVersion,
  calibrationVersion, enabled, hardwareMetadata

users/{uid}/events/{eventId}
  type, severity, createdAt, deviceId, telemetrySnapshot,
  acknowledgedAt, acknowledgedBy

users/{uid}/alertDeliveries/{deliveryId}
  eventId, channel, destinationMasked, providerStatus,
  providerMessageId, attemptCount, createdAt, updatedAt

users/{uid}/calibrations/{calibrationId}
  tareMassKg, scaleFactor, referenceMassKg, calibrationDate,
  calibrationVersion, performedBy, notes
```

Avoid storing phone numbers in widely readable telemetry paths. Protect personal information with strict rules and server-side access.

---

# 9. API contract (initial target)

- `GET /health` — public liveness check, no sensitive data.
- `GET /api/me` — Firebase ID token required.
- `GET /api/devices` — list only the authenticated user's devices.
- `POST /api/devices` — register a device using an authenticated and secure pairing workflow.
- `GET /api/devices/:deviceId/latest` — ownership-checked latest telemetry.
- `GET /api/devices/:deviceId/events` — paginated event history.
- `PATCH /api/devices/:deviceId/settings` — validate and persist user settings.
- `POST /api/device/:deviceId/telemetry` — device credential required; ownership resolved server-side.
- `POST /api/alerts/test` — authenticated, rate-limited test alert, disabled by default in production unless destination is verified.

Use consistent error bodies:
```json
{
  "error": {
    "code": "INVALID_TELEMETRY",
    "message": "Telemetry payload did not pass validation",
    "requestId": "server-generated-id"
  }
}
```

Never return secrets, raw stack traces, service-account details, or sensitive provider responses to clients.

---

# 10. Test matrix

| ID | Scenario | Expected result |
|---|---|---|
| T01 | Open app without Firebase config | Demo mode works; cloud sign-in clearly unavailable |
| T02 | Valid Google login | User signed in; profile saved |
| T03 | Valid email/password login | User signed in |
| T04 | Invalid credentials | Clear error; no private data exposed |
| T05 | User A reads own telemetry | Allowed |
| T06 | User A tries User B data | Denied by rules/API |
| T07 | Valid telemetry from registered device | Latest state and event stored for mapped owner |
| T08 | Missing/invalid device credential | 401; no database write |
| T09 | Device payload includes another owner UID | Ignored/rejected; owner comes from registry |
| T10 | Invalid weight/gas value | 400; no database write |
| T11 | No heartbeat beyond timeout | UI marks stale/offline |
| T12 | Gas alert event | Local response plus cloud event; optional configured alerts attempted once per incident |
| T13 | Repeated leak samples | Deduplicated; no call/SMS storm |
| T14 | Provider unavailable | Delivery failure logged; local alarm unaffected |
| T15 | Wi-Fi loss during suspected leak | Local safety response still works |
| T16 | Empty platform tared | Near-zero baseline within documented tolerance |
| T17 | Known test mass added | Weight within agreed tolerance |
| T18 | MQ sensor disconnected/faulty | Fault/unknown, never falsely presented as safe |
| T19 | Reduced motion enabled | Nonessential motion minimized |
| T20 | PWA refresh/offline shell | UI shell behaves as documented; stale sensor state is clearly labelled |

---

# 11. Master build prompt series

## How to use the prompts

1. Start with Prompt 0 in the coding environment that can access the project files.
2. Run exactly one phase prompt at a time.
3. Ask the coding agent to inspect existing files before editing.
4. Require tests and a concise report after each phase.
5. Do not accept “done” without commands executed and results reported.
6. Fix failures before moving to the next phase.
7. Keep credentials in local environment/secrets only.
8. For real hardware, confirm the component model and wiring before allowing firmware pin assumptions.

Each prompt below is designed to be pasted as a separate task.

---

## Prompt 0 — Project-wide engineering rules and repository audit

```text
Act as the senior software/embedded systems engineer for OneGaurd, an LPG leak detection and cylinder gas-weight monitoring prototype.

First inspect the entire existing repository, README, package files, source code, Firebase rules, server code, and environment examples. Do not assume previous claims are true. Do not overwrite working features without explaining why.

Project goals:
- Mobile-first installable PWA using Expo/React Native Web or the existing chosen compatible frontend.
- Node.js/Express backend.
- Firebase Authentication with Google and email/password.
- Firebase Realtime Database for live latest sensor state.
- Cloud Firestore for device metadata, durable events, calibration records, and alert delivery history.
- ESP32 with MQ-6 gas sensor and load-cell hardware; exact amplifier, pins, load-cell count, and servo must be confirmed.
- Optional push notifications, SMS, and voice calls; paid provider costs must be explicit.
- User data must be isolated by Firebase Auth UID.
- Local ESP32 leak response must work without internet/cloud/app.

Safety boundary:
The app is a prototype, not a certified gas alarm. Never rely on cloud connectivity for immediate leak response. Never perform uncontrolled LPG release tests. Do not treat a hobby servo/3D-printed assembly as a certified gas shutoff valve.

Weight assumption:
For simulation, empty platform can be zeroed and added mass represented as gas mass. In a real cylinder setup, subtract cylinder tare from total measured mass. Never silently confuse total cylinder weight with gas mass. Keep units and calibration status visible.

Engineering rules:
- No secrets in frontend code or source control.
- No public Firebase read/write rules.
- The device may not choose its own owner UID; server-side device registry maps credential to owner.
- Validate all API payloads and enforce ownership server-side.
- Distinguish live, stale, offline, sensor fault, and unknown.
- Use accessible UI, reduced-motion support, safe alert deduplication, and clear errors.
- No claim that tests pass unless commands were actually executed.

Deliver:
1. Repository inventory and current implementation status.
2. Architecture diagram in Markdown.
3. A list of P0 security/safety blockers.
4. Build/test commands available in this repo.
5. A phase-by-phase plan referencing docs/ONEGAURD_MASTER_PLAN.md.
Do not start broad refactoring in this phase. Fix only critical configuration/documentation contradictions discovered and explain changes.
```

## Prompt 1 — Establish a reproducible development foundation

```text
Implement Phase 1 from docs/ONEGAURD_MASTER_PLAN.md.

Inspect the repository first. Ensure a clean, reproducible local development setup:
- Correct package scripts for install, development, type-check, lint if configured, build, preview, and backend.
- Pin compatible dependency ranges and document supported Node version.
- Add .env.example files without real secrets.
- Validate required environment variables and clearly distinguish demo mode from configured Firebase mode.
- Ensure .gitignore excludes .env files, credentials, service-account JSON, build output, and local logs.
- Add a root README with exact setup instructions.
- Add CI checks if the repository has an existing CI platform; do not invent credentials.
- Confirm PWA metadata and installability configuration.
- Keep the existing selected hybrid design direction.

Run dependency installation if network/tool access permits, type-check, and production build. If dependencies cannot be installed, report the blocker honestly and do not claim a successful build. List files changed and exact command outputs.
```

## Prompt 2 — Complete the mobile UI and simulation

```text
Implement Phase 2 from docs/ONEGAURD_MASTER_PLAN.md. Preserve the selected OneGaurd hybrid monitoring visual direction: dark charcoal/navy safety hero, clean neutral surfaces, restrained teal, amber caution, red critical state, and uncluttered mobile-first layout.

Inspect existing UI before changing it. Build or complete:
- Sign-in/onboarding shell.
- Home dashboard.
- Devices screen.
- History screen.
- Settings/alerts screen.
- Account and empty/error/loading states.
- Typed telemetry model.
- Deterministic demo data service.
- Simulation controls for safe, suspected leak, low weight, stale, offline, and sensor-fault states.
- Accessible animation and reduced-motion support.

Behavior:
- Critical leak state is the highest visual priority.
- Old readings must never be called live.
- Raw MQ sensor values must not be labelled calibrated ppm without calibration.
- Gas mass and tare/calibration status must be explicit.
- Refill estimates must show “collecting usage data” when there is insufficient history.
- Simulation controls must be clearly marked and not be present as production controls unless an explicit development flag is enabled.

Add tests for key calculations and state transitions. Run type-check/build/tests and report results with exact commands.
```

## Prompt 3 — Firebase Authentication and account isolation

```text
Implement Phase 3 from docs/ONEGAURD_MASTER_PLAN.md.

Use Firebase Authentication for Google sign-in and email/password sign-up/sign-in. Inspect current Firebase initialization first.

Requirements:
- Correct environment configuration and clear missing-config errors.
- Handle loading, popup cancellation, network errors, invalid credentials, disabled providers, sign-out, and expired sessions.
- Save only minimal user profile metadata in Firestore.
- Use Firebase UID as the ownership key everywhere.
- Do not store passwords in application databases.
- No service-account credential in frontend.
- Make demo mode usable without Firebase but clearly label it as local simulation.
- Clear user-specific listeners and cached sensitive data on sign-out.
- Provide authorized-domain setup documentation.

Add tests or emulator tests for auth-state handling where feasible. Explicitly test that signed-out users cannot access user data and that one user cannot query another user's data. Do not use open Firebase rules as a workaround.
```

## Prompt 4 — Firebase schema, rules, live subscriptions, and history

```text
Implement Phase 4 from docs/ONEGAURD_MASTER_PLAN.md.

Create and document a typed schema for:
- RTDB latest telemetry and device online/heartbeat state.
- Firestore user profile, device metadata, events, calibration metadata, settings, and alert delivery records.

Requirements:
- Provide least-privilege RTDB and Firestore rules enforcing user ownership.
- Add emulator-based rules tests if feasible.
- Create one data-access layer instead of scattering Firebase calls across components.
- Add robust realtime listeners with unsubscribe cleanup.
- Show loading, no data, stale, offline, sensor fault, and permission-denied states.
- Define a heartbeat timeout and display the last-seen timestamp.
- Do not store every high-frequency sensor sample in multiple databases without an explicit retention/cost policy.
- Keep device history paginated or aggregated.
- Ensure demo mode cannot accidentally masquerade as cloud telemetry.

Run tests, validate rules, and document manual console setup. Do not claim live Firebase verification unless real project configuration and tests are available.
```

## Prompt 5 — Secure Node.js API and device registry

```text
Implement Phase 5 from docs/ONEGAURD_MASTER_PLAN.md.

Build a production-oriented Node.js/Express API with:
- GET /health.
- Firebase ID token verification for user endpoints.
- Ownership-checked device list/latest/events/settings endpoints.
- Device ingestion endpoint protected by a server-side device registry and per-device credential.
- Schema validation, request size limit, rate limiting, CORS configuration, structured logs, request IDs, and consistent error responses.
- Input bounds and timestamp/event ID validation.
- Idempotency and duplicate event handling.
- RTDB latest state writes and Firestore durable event writes.
- No service-account JSON in repository or client bundle.
- Device owner UID resolved only from the server-side registry; reject attempts by a device to select arbitrary owners.
- Secret rotation/revocation documentation.

Security tests must prove:
1. Missing/invalid user token is rejected.
2. User A cannot access User B data.
3. Unknown/revoked device credential is rejected.
4. Device cannot select a different owner UID.
5. Invalid telemetry is rejected without writes.
6. Duplicate event ID is idempotent.

Run API tests. Report any deployment-specific steps still required.
```

## Prompt 6 — ESP32 telemetry firmware and local safety behavior

```text
Implement Phase 6 from docs/ONEGAURD_MASTER_PLAN.md only after inspecting the actual hardware details and existing firmware. If board, amplifier model, pins, load-cell count, or actuator wiring are unknown, stop and list the exact missing details rather than guessing pin assignments.

Firmware requirements:
- ESP32 Wi-Fi/hotspot connection and reconnect with backoff.
- Correct driver for the confirmed load-cell amplifier.
- MQ-6 raw sampling, warm-up handling, filtering, calibration state, and sensor fault detection.
- Local leak detection and local alarm/output independent of cloud.
- Safe boot state, watchdog, brownout/restart behavior, and sensor error state.
- HTTPS telemetry to Node API using per-device credential and unique event ID.
- Heartbeat, timestamp, firmware version, calibrated values plus raw values, and units.
- Avoid blocking network requests in the safety sampling loop.
- Network failure must never disable local detection/alarm.
- Do not let a remote API command silence or override local safety response.
- Do not present a hobby servo or 3D-printed mechanism as a certified LPG valve.

Deliver wiring table, pin map, firmware configuration template, payload example, local-safety state machine, build instructions, and test procedure. Test with simulated sensor inputs first. Never use uncontrolled LPG release for testing.
```

## Prompt 7 — Alerts, push, SMS, and voice calls

```text
Implement Phase 7 from docs/ONEGAURD_MASTER_PLAN.md.

Build a reliable alert pipeline triggered by a validated, deduplicated leak incident:
1. Persist the event.
2. Trigger the app's critical state.
3. Attempt configured push/SMS/voice channels.
4. Persist delivery status and provider IDs.
5. Retry only where safe and according to a bounded policy.
6. Expose success/failure status without claiming delivery before confirmation.

Requirements:
- FCM/browser push setup documentation and HTTPS/service-worker requirements.
- Optional server-side SMS and voice provider adapters; use environment secrets only.
- Verify destination phone and record explicit consent.
- Respect user preferences.
- Per-incident deduplication, cooldown, rate limits, and configurable spending cap.
- A provider disable switch and mocked provider for tests.
- Test alert is visibly distinct and cannot contact a real destination unless the operator deliberately enables it.
- Provider errors must not block local alarm or telemetry storage.
- Clear emergency copy; avoid unnecessary repeated calls/messages.
- Explain that paid provider calls/SMS may not be free and verify regional availability/pricing before activation.

Add tests for duplicate events, preference off, provider failure, cooldown, and delivery status.
```

## Prompt 8 — Calibration, measurement correctness, and threshold validation

```text
Implement Phase 8 from docs/ONEGAURD_MASTER_PLAN.md.

First verify actual hardware models and wiring. Do not invent calibration constants or safety thresholds.

Load-cell requirements:
- Empty-platform zero/tare procedure.
- Calibration with known reference masses.
- Repeatability, linearity, drift, creep, and off-center loading tests.
- Clearly distinguish raw ADC, total measured mass, tare mass, calculated gas mass, and configured capacity.
- Store calibration version, date, reference mass, and scale factor.
- Make invalid/disconnected sensor readings a fault state.
- Document acceptable error tolerance chosen by the project.

MQ-6 requirements:
- Distinguish raw ADC/voltage/resistance from calibrated concentration.
- Document warm-up and baseline procedure for the exact module.
- Validate sensor behavior with safe, controlled methods and qualified guidance.
- Use persistence, filtering, hysteresis, sensor-fault handling, and test scenarios.
- Never claim ppm values or a safe threshold without validated calibration and reference basis.

Refill estimate requirements:
- Use consumption history only when sufficient valid data exists.
- Show uncertainty and “collecting usage data” for insufficient history.
- Keep the capacity configurable.

Deliver a calibration guide, results table template, test log, and updated UI labels. Do not claim accuracy without recorded measurements.
```

## Prompt 9 — End-to-end testing and hardening

```text
Implement Phase 9 from docs/ONEGAURD_MASTER_PLAN.md.

Run a complete test pass across frontend, backend, Firebase rules/emulators, telemetry validation, alert pipeline, and PWA behavior.

At minimum test all cases T01–T20 in the master plan. Add:
- Refresh while signed in/out.
- Expired token.
- Firebase permission denied.
- Slow network and dropped hotspot.
- Stale data and device clock skew.
- Duplicate/replayed event.
- Invalid/oversized payload.
- Provider timeout and rate limit.
- Two different users and two different devices.
- Reduced-motion and keyboard accessibility.
- Mobile viewport and installed PWA behavior.

Do not test a real call/SMS by default; use a mock provider. Real hardware safety tests must use a controlled, reviewed procedure and never uncontrolled LPG release.

Deliver a test report with pass/fail/blocked for every case, exact commands, observed outputs, remaining P0/P1 issues, and evidence. Do not claim a test passed if it was not executed.
```

## Prompt 10 — Deployment and operational handover

```text
Implement Phase 10 from docs/ONEGAURD_MASTER_PLAN.md.

Prepare deployable frontend and backend with:
- HTTPS and correct PWA hosting.
- Supported Node hosting and health monitoring.
- Environment-specific configuration and secret management.
- Firebase authorized domains, least-privilege rules, CORS, and service account permissions.
- Production device registry, credential rotation/revocation, and rate limits.
- Database retention, backups, and recovery plan.
- Logging, alert delivery monitoring, cost limits, and provider disable switch.
- Build/version metadata and rollback steps.
- No credentials committed to source control.

Deliver:
1. Deployment guide.
2. Environment variable reference.
3. Final architecture diagram.
4. API documentation.
5. ESP32 wiring/pin map based on verified hardware.
6. Calibration and safe test procedures.
7. User guide and troubleshooting guide.
8. Known limitations and unverified claims.
9. Final acceptance checklist.

Never claim the system is certified or production-safe without independent validation.
```

## Prompt 11 — Final independent senior-engineer review

```text
Act as an independent senior engineer reviewing OneGaurd before handover. Do not implement new features until the audit is complete.

Review:
- Architecture and data flows.
- Firebase security rules and user isolation.
- Device credential mapping and ingestion security.
- Local safety independence from cloud.
- Sensor fault behavior, calibration, raw/calibrated units, and tare math.
- Alert deduplication, consent, provider costs, rate limits, and delivery reporting.
- Refill estimate assumptions.
- Accessibility, reduced motion, mobile usability, offline/stale state.
- Tests, build reproducibility, documentation, secrets, dependency health, and deployment configuration.

Produce findings grouped by P0 critical, P1 high, P2 medium, P3 low. Every finding must identify the affected file/component, impact, reproduction/evidence, and recommended fix. Fix P0 items only after describing them; then rerun relevant tests. End with an evidence-based release recommendation: not ready, internal demo only, or ready for limited pilot. Do not call it production-safe or certified without appropriate independent validation.
```

---

# 12. Build order at a glance

1. **Confirm requirements and hardware inventory.**
2. Establish reproducible repo and environment.
3. Complete UI + deterministic simulation.
4. Configure Firebase Authentication.
5. Build database schemas and rules.
6. Secure the Node API and device registry.
7. Integrate ESP32 firmware with local safety behavior.
8. Add push/SMS/voice alert pipeline.
9. Calibrate sensors and validate measurement.
10. Run end-to-end tests.
11. Deploy and hand over.
12. Conduct independent review.

Do not reverse this order by starting with calls/SMS or live hardware before local safety, identity, and data ownership are validated.

---

# 13. Definition of done

OneGaurd is considered ready for a **limited pilot only** when:
- The PWA is usable on a phone and has accessible loading/error/offline states.
- Authentication works and cross-user access is denied.
- The ESP32 is securely registered and cannot write to another user's data.
- Realtime readings update with timestamps and stale/offline detection.
- Gas weight is calibrated, tare-corrected, and clearly labelled.
- Sensor fault states cannot be displayed as safe.
- Local leak detection/alarm works without Wi-Fi or cloud.
- Alert pipeline is deduplicated and delivery status is honest.
- Calls/SMS are deliberately configured, consented, cost-limited, and tested with controlled test destinations.
- Automated tests and hardware test results are documented.
- Secrets are managed outside source control.
- Remaining limitations are written down and reviewed.

This checklist does not by itself certify the hardware or make it suitable as the only safety device.

---

# 14. Immediate next action

Start with **Prompt 0 — Project-wide engineering rules and repository audit**. Run it against the current OneGaurd project folder, confirm what actually exists, and fix the critical discrepancies before proceeding to Prompt 1.

Keep `README.md` as the short entry point. Keep this detailed plan at `docs/ONEGAURD_MASTER_PLAN.md`. Update both when architecture or commands change.
