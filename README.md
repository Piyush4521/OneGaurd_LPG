# OneGaurd — Smart LPG Leak Detection & Cylinder Mass Telemetry Platform

> **Safety Warning:** OneGaurd is an engineering prototype designed for research and demonstration. It is not a certified industrial life-safety alarm. **The ESP32 hardware executes immediate local leak shutoff and buzzer alarms completely autonomously without relying on Wi-Fi, the cloud, or mobile apps.** Never release LPG intentionally for testing.

---

## 1. System Overview

OneGaurd is a mobile-first LPG telemetry monitoring platform connecting **ESP32 microcontroller hardware** to a **React PWA** through a **Node.js/Express API Gateway** and **Firebase**.

```
                  LOCAL SAFETY PATH — 100% OFFLINE RESILIENT
        ┌────────────────────────────────────────────────┐
        │                     ESP32                      │
        │ MQ-6 sampling • load-cell sampling • filtering │
        │ calibrated threshold logic • local fault state │
        │ local alarm / safe output • watchdog           │
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
                                  │ verify device ID    │
                                  │ authenticate device │
                                  │ validate payload    │
                                  │ store events        │
                                  │ deduplicate alerts  │
                                  └─────────┬───────────┘
                                            │
                              ┌─────────────┴─────────────┐
                              ▼                           ▼
                    Firebase RTDB                  Cloud Firestore
                    latest live state              users/devices/
                    online status                  metadata/history/
                    realtime UI state              settings/events
                              │                           │
                              └─────────────┬─────────────┘
                                            ▼
                                  React / Vite Web PWA
                                  mobile-first dashboard
                                  auth • live state • history
                                  device health • settings
```

---

## 2. Key Architecture Principles

1. **Hardware Independence:** Hardware detects and reacts; cloud records and communicates; app explains the current state clearly.
2. **True Tare Math:** Gas mass is calculated via `max(0, totalMassKg - tareMassKg)`. Never confuse total gross cylinder weight with usable gas mass.
3. **Cryptographic Identity & Isolation:** Device owner UIDs are resolved strictly server-side from the server device registry. IoT hardware cannot forge arbitrary ownership.
4. **Least-Privilege Database Rules:** Firebase RTDB and Firestore enforce `auth.uid == userId` with default-deny rules.
5. **Fail-Safe & Accessible:** Telemetry marks stale packets after 60 seconds; open-circuit sensor conditions display as `sensor_fault` rather than false `ok`; accessible UI supports `prefers-reduced-motion`.

---

## 3. Quick Start & Commands

All dependencies and local caching are isolated strictly to the **D: drive** (`.npm-cache` & `d:\OneGaurd_LPG`).

```bash
# 1. Install dependencies (runs against local D: cache)
npm install

# 2. Run test suites (telemetry math, API integration, and security rules)
npm run test

# 3. Type check TypeScript
npm run typecheck

# 4. Build production bundle
npm run build

# 5. Start development dashboard (Vite on http://localhost:5173)
npm run dev

# 6. Start telemetry ingestion backend (Express on http://localhost:5000)
npm run server

# 7. Start full stack concurrently (Client + Server)
npm start
```

---

## 4. Hardware Pin Mapping & Firmware

Located at `firmware/esp32_onegaurd/esp32_onegaurd.ino`:

| Component | ESP32 Pin | Mode | Description |
|---|---|---|---|
| **MQ-6 Analog Out** | GPIO 34 | `ANALOG_IN` (12-bit ADC) | Combustible gas concentration voltage |
| **Piezo Buzzer** | GPIO 25 | `OUTPUT` | Immediate audible alarm (offline) |
| **Alarm Strobe LED** | GPIO 26 | `OUTPUT` | High-visibility warning indicator |
| **Valve Solenoid Relay**| GPIO 27 | `OUTPUT` | Physical cut-off signal on trip point |
| **HX711 Load Cell DT** | GPIO 19 | `INPUT` | Digital scale amplifier serial data |
| **HX711 Load Cell SCK**| GPIO 18 | `OUTPUT` | Digital scale clock |

---

## 5. Master Roadmap & Detailed Documentation

For the complete multi-phase engineering plan, test matrix (T01–T20), and calibration requirements, see:
* [docs/ONEGAURD_MASTER_PLAN.md](file:///d:/OneGaurd_LPG/docs/ONEGAURD_MASTER_PLAN.md)
