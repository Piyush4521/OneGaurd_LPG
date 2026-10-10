# OneGaurd LPG — Hardware Integration & Engineering Guide

This document outlines the hardware architecture, wiring connections, electrical protection circuits, sensor calibration procedures, and autonomous local safety logic for the **OneGaurd LPG Monitoring System**.

---

## 1. Pin Mapping Summary (ESP32 DevKit V1)

| Subsystem | Signal / Function | ESP32 GPIO | Operating Voltage | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **HX711 Load Cell** | Data Out (DOUT / DT) | **GPIO 25** | 3.3V / 5.0V | 24-bit ADC output from Combinator |
| **HX711 Load Cell** | Clock (SCK) | **GPIO 26** | 3.3V | Pulled low when idle |
| **DS3231 RTC** | I2C Data (SDA) | **GPIO 21** | 3.3V | 4.7 kΩ internal/external pull-up |
| **DS3231 RTC** | I2C Clock (SCL) | **GPIO 22** | 3.3V | 4.7 kΩ internal/external pull-up |
| **MQ-6 Gas Sensor** | Analog Output (AOUT) | **GPIO 34** | **3.3V Max (via Divider)** | **ADC1_CH6** (Input-only, no pullup) |
| **Local Alarm Buzzer**| Piezo Driver | **GPIO 27** | 3.3V / 5.0V via Transistor | Autonomous immediate safety trip |
| **Gas Valve Relay** | Solenoid Valve Control | **GPIO 14** | 3.3V / 5.0V via Optocoupler | Autonomous cutoff mechanism |
| **System Status LED** | Health / Alarm Strobe | **GPIO 2** | 3.3V | Onboard LED (Heartbeat / Strobe) |

---

## 2. MQ-6 Gas Sensor — Voltage Protection & Divider Circuit

### The Problem:
- The **MQ-6 heater coil** requires **5.0V DC** to maintain its internal catalytic sensor temperature ($\sim 150^\circ\text{C}$).
- When exposed to gas concentrations, the MQ-6 analog output ($V_{out}$) can swing between **0.2V up to 5.0V**.
- The **ESP32 ADC pins (GPIO 34) tolerate a maximum of 3.3V to 3.6V**. Connecting a raw 5.0V signal directly to GPIO 34 will cause latch-up and degrade or permanently damage the ESP32 microcontroller silicon.

### The Voltage Divider Solution:
Use a 2-resistor voltage divider to attenuate the 0–5.0V signal down to the safe 0–3.3V range:

```
MQ-6 AOUT (0 - 5.0V)
       |
      [R1] = 10 kΩ  (1/4W, 1% tolerance)
       |
       +-----> Connect to ESP32 GPIO 34 (ADC1_CH6)  [Max: 3.33V]
       |
      [R2] = 20 kΩ  (1/4W, 1% tolerance)
       |
      GND (Common Ground)
```

$$\text{Voltage at GPIO 34} = V_{\text{MQ6}} \times \frac{R_2}{R_1 + R_2} = 5.0\text{V} \times \frac{20}{10 + 20} = 3.333\text{V}$$

> **Alternative standard resistor values:**
> - $R_1 = 1.0\text{ k}\Omega$, $R_2 = 2.0\text{ k}\Omega$
> - $R_1 = 4.7\text{ k}\Omega$, $R_2 = 10\text{ k}\Omega$ ($V_{out} = 3.4\text{V}$)
> - For additional spike clamping, place a **3.3V 500mW Zener diode** in parallel with $R_2$ (Cathode to GPIO 34, Anode to GND).

---

## 3. Power Decoupling & Noise Suppression

The ESP32 Wi-Fi radio draws short current spikes (up to 300–500 mA during RF transmission bursts). These bursts cause voltage dips on the power rails, creating noise on the sensitive 24-bit HX711 ADC and analog MQ-6 readings.

### Required Decoupling:
1. Place a **10 µF electrolytic capacitor** directly across the **5V to GND** input rails near the ESP32 and MQ-6 module.
2. Place a **100 nF (0.1 µF) ceramic capacitor** directly across the **3.3V to GND** rails close to the HX711 and DS3231 modules.
3. Use a **common ground (GND)** plane connecting the power supply, ESP32, Combinator, HX711, DS3231, and MQ-6.

---

## 4. Four 50kg Load Cells & Combinator Wiring (BOB-13878)

Four 3-wire half-bridge load cells (50 kg each, 200 kg total capacity) are combined into a full Wheatstone bridge using the SparkFun Combinator board:

```
[Load Cell 1 (Upper Left)]   [Load Cell 2 (Upper Right)]
       \                              /
        \                            /
      [SparkFun Combinator BOB-13878]
        /                            \
       /                              \
[Load Cell 3 (Lower Left)]   [Load Cell 4 (Lower Right)]
                    |
              RED  --> E+ (Excitation +)
              BLK  --> E- (Excitation -)
              WHT  --> A+ (Signal +)
              GRN  --> A- (Signal -)
                    |
              [HX711 Amplifier Module]
              VCC  --> 3.3V
              GND  --> Common GND
              DT   --> ESP32 GPIO 25
              SCK  --> ESP32 GPIO 26
```

### Cable Shielding:
- For long cable runs ($\approx 1\text{ m}$ of 4-core shielded cable between the platform and enclosure), connect the **cable outer braided shield** to **GND at one end only** (near the ESP32) to prevent ground loops while blocking 50Hz/60Hz electromagnetic interference.

---

## 5. Load Cell Calibration Routine (Serial Terminal)

Open the Arduino Serial Monitor at **115200 baud**:

1. **Step 1 — Zero Tare**:
   - Ensure the platform is completely empty.
   - Send command `t` or `tare`.
   - The ESP32 sets the tare offset to `0.000 kg`.
2. **Step 2 — Known Weight Placement**:
   - Place an accurately known reference mass on the platform (e.g., a certified 5.0 kg test weight or calibrated water bottle).
3. **Step 3 — Compute Calibration Factor**:
   - Send command: `cal 5.0` (replace `5.0` with your exact weight in kg).
   - The firmware computes the exact factor:
     $$\text{New Factor} = \frac{\text{Raw HX711 ADC Output}}{\text{Known Weight in kg}}$$
   - Copy the printed factor (e.g., `-22668.4f`) into `config.h`:
     ```c
     #define CALIBRATION_FACTOR_INIT  -22668.4f
     ```

---

## 6. DS3231 Precision Real-Time Clock Integration

- **I2C Address**: `0x68`
- **Backup Coin Cell**: CR2032 (maintains clock running during power disconnects).
- **Time Format**: ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) attached to every telemetry frame.
- **Failover Logic**: If the DS3231 is missing or battery is dead, the firmware logs a warning and uses elapsed boot seconds (`BOOT+<seconds>`) as a fallback without halting sensor operations.

---

## 7. Autonomous Local Safety Operation (Offline Contract)

```
        +----------------------------------------+
        | MQ-6 Analog Read (GPIO 34, 12-bit ADC) |
        +----------------------------------------+
                           |
                           v
        +----------------------------------------+
        |  Exponential Moving Average Filtering  |
        +----------------------------------------+
                           |
                 Is Gas >= 2200 ADC?
                /                   \
              YES                    NO
              /                       \
    Start Breach Timer           Reset Breach Timer
    Has condition sustained      Is Gas < 2100 ADC (Hysteresis)?
    for >= 3 seconds?                 |
         /           \             Reset Alarm
       YES            NO
       /               \
[BUZZER ON (GPIO 27)]  Keep Monitoring
[RELAY CUTOFF (GPIO 14)]
```

- **Zero Network Delay**: Buzzer and valve shutoff activate autonomously on the ESP32 in $<100\text{ ms}$ upon sustained breach confirmation.
- **Non-blocking Telemetry**: If Wi-Fi is lost, `WiFi.reconnect()` runs periodically in the background while the local safety loop continues running at 50 ms cycles.
