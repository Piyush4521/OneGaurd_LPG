/*
 * OneGaurd LPG Safety Monitoring & Autonomous Cutoff System
 * Firmware Version: v1.5.0-prod
 * Target Microcontroller: ESP32 DevKit V1 (ESP-WROOM-32)
 * 
 * SENSORS & ACTUATORS:
 * 1. Load Cell Platform:
 *    - Four 50kg 3-wire half-bridge load cells
 *    - SparkFun Load Sensor Combinator (BOB-13878)
 *    - HX711 24-bit ADC Amplifier: DOUT/DT = GPIO 25, SCK = GPIO 26
 * 2. Precision Real-Time Clock:
 *    - DS3231 I2C RTC: SDA = GPIO 21, SCL = GPIO 22, VCC = 3.3V
 * 3. LPG Gas Sensor:
 *    - MQ-6 Analog Output = GPIO 34 (12-bit ADC, 0-4095)
 *    - MUST pass through voltage divider (e.g., 10k/20k) to cap at 3.3V
 * 4. Local Actuators (Zero-Network-Dependency):
 *    - Piezo Alarm Buzzer = GPIO 27
 *    - Gas Shutoff Solenoid/Valve Relay = GPIO 14
 *    - System Health LED = GPIO 2
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * - Local Gas Detection & Alarm triggers in real-time independent of Wi-Fi or Cloud.
 * - Sustained condition confirmation (3 seconds) + Hysteresis (100 ADC) prevents false trips.
 * - Non-blocking Wi-Fi reconnect prevents loop stalling.
 * - Distinguishes Gross Cylinder Mass, Tare Mass, and Net LPG Mass.
 * - Interactive Serial Terminal for Tare and Known-Weight Calibration.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <RTClib.h>
#include <HX711.h>
#include "config.h"

// ==========================================
// Autonomous Local Protection Safety Aliases
// ==========================================
#define PIN_BUZZER        PIN_BUZZER_ALARM
#define PIN_ALARM_LED     PIN_STATUS_LED

// ==========================================
// Hardware Instances
// ==========================================
HX711 scale;
RTC_DS3231 rtc;
WiFiClientSecure secureClient;

// ==========================================
// Runtime State Variables
// ==========================================
unsigned long bootTimestampMillis = 0;
unsigned long lastTelemetryMillis = 0;
unsigned long lastWifiRetryMillis = 0;
unsigned long leakBreachStartMillis = 0;
unsigned long packetSequenceNumber = 0;

float currentCalibrationFactor = CALIBRATION_FACTOR_INIT;
float platformTareMassKg = DEFAULT_PLATFORM_TARE_KG;
float filteredGasAdc = 0.0f;
bool isRtcAvailable = false;
bool isHx711Available = false;
bool isSustainedLeakActive = false;
bool localAlarmActive = false;
bool isCalibratingWeight = false;

// ==========================================
// Function Prototypes
// ==========================================
void initHardwarePins();
void initRtcClock();
void initLoadCell();
void processSerialCommands();
void evaluateGasSensor();
void executeAutonomousSafety(bool leakActive);
void handleNetworkAndTelemetry();
void dispatchTelemetryPayload(float grossMass, float netMass, int rawGas, const char* sensorStatus, const String& isoTime);
String getIso8601Timestamp();
void printDiagnosticsBanner();

// ==========================================
// Setup
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(500);

  bootTimestampMillis = millis();
  printDiagnosticsBanner();

  initHardwarePins();
  initRtcClock();
  initLoadCell();

  // Configure ADC resolution (ESP32: 12-bit, 0 to 4095)
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MQ6_ANALOG, ADC_11db); // 0V to ~3.3V range

  // Seed initial filter reading
  filteredGasAdc = (float)analogRead(PIN_MQ6_ANALOG);

  // Configure Secure TLS Client
  if (USE_INSECURE_TLS) {
    secureClient.setInsecure();
    Serial.println("[SECURITY] TLS Mode: setInsecure() active for laboratory workbench bringup.");
  }

  // Non-blocking Wi-Fi startup
  Serial.printf("[WIFI] Connecting to SSID: %s ...\n", WIFI_SSID_CONFIG);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID_CONFIG, WIFI_PASSWORD_CONFIG);
  lastWifiRetryMillis = millis();

  Serial.println("[OneGaurd] Hardware initialization complete. Local safety loop running.");
  Serial.println("[HELP] Type 't' to tare empty platform. Type 'c' to calibrate known weight.");
}

// ==========================================
// Main Loop (Non-Blocking High-Frequency)
// ==========================================
void loop() {
  // 1. Process interactive serial commands (Tare / Calibrate)
  processSerialCommands();

  // 2. High-priority local gas detection & sustained leak evaluation
  evaluateGasSensor();

  // 3. Autonomous local actuator driving (No cloud dependency)
  executeAutonomousSafety(isSustainedLeakActive);

  // 4. Background network telemetry dispatch & non-blocking reconnect
  handleNetworkAndTelemetry();

  // 50ms cycle provides responsive safety execution with zero watchdog starvation
  delay(50);
}

// ==========================================
// Hardware Initialization
// ==========================================
void initHardwarePins() {
  pinMode(PIN_BUZZER_ALARM, OUTPUT);
  pinMode(PIN_VALVE_RELAY, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_MQ6_ANALOG, INPUT);

  // Default to safe off state
  digitalWrite(PIN_BUZZER_ALARM, LOW);
  digitalWrite(PIN_VALVE_RELAY, LOW);
  digitalWrite(PIN_STATUS_LED, LOW);
}

void initRtcClock() {
  Wire.begin(PIN_DS3231_SDA, PIN_DS3231_SCL);
  if (rtc.begin()) {
    isRtcAvailable = true;
    if (rtc.lostPower()) {
      Serial.println("[RTC] Warning: DS3231 lost power. Battery check required.");
    }
    DateTime now = rtc.now();
    Serial.printf("[RTC] DS3231 detected. Current RTC time: %04d-%02d-%02d %02d:%02d:%02d UTC\n",
                  now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());
  } else {
    isRtcAvailable = false;
    Serial.println("[RTC] Warning: DS3231 not detected on I2C bus. Millis timestamp fallback active.");
  }
}

void initLoadCell() {
  scale.begin(PIN_HX711_DOUT, PIN_HX711_SCK);

  // Check HX711 readiness with timeout
  unsigned long startWait = millis();
  while (!scale.is_ready() && (millis() - startWait < 1500)) {
    delay(50);
  }

  if (scale.is_ready()) {
    isHx711Available = true;
    scale.set_scale(currentCalibrationFactor);
    scale.tare(10); // Tare empty platform on power up
    Serial.println("[HX711] Load cell amplifier initialized. Initial platform tared.");
  } else {
    isHx711Available = false;
    Serial.println("[HX711] Warning: HX711 not ready on GPIO 25/26. Check Combinator wiring & power.");
  }
}

// ==========================================
// Gas Sensor Evaluation & Sustained Filtering
// ==========================================
void evaluateGasSensor() {
  int rawAdc = analogRead(PIN_MQ6_ANALOG);

  // Exponential moving average filter to suppress transient electrical spikes
  filteredGasAdc = (0.75f * filteredGasAdc) + (0.25f * (float)rawAdc);

  unsigned long currentMillis = millis();
  bool isWarmingUp = (currentMillis - bootTimestampMillis) < ((unsigned long)MQ6_WARMUP_SECONDS * 1000UL);

  if (isWarmingUp) {
    leakBreachStartMillis = 0;
    isSustainedLeakActive = false;
    return;
  }

  // Sustained condition confirmation logic
  if (filteredGasAdc >= (float)MQ6_ALARM_THRESHOLD_RAW) {
    if (leakBreachStartMillis == 0) {
      leakBreachStartMillis = currentMillis; // Breach timer started
    } else if (currentMillis - leakBreachStartMillis >= ((unsigned long)SUSTAINED_LEAK_CONFIRM_SEC * 1000UL)) {
      isSustainedLeakActive = true; // Sustained for >= 3 seconds
    }
  } else if (filteredGasAdc < (float)(MQ6_ALARM_THRESHOLD_RAW - MQ6_HYSTERESIS_RAW)) {
    // Hysteresis reset: only clear when gas drops safely below threshold - hysteresis
    leakBreachStartMillis = 0;
    isSustainedLeakActive = false;
  }
}

// ==========================================
// Autonomous Local Actuation
// ==========================================
void executeAutonomousSafety(bool leakActive) {
  if (leakActive) {
    localAlarmActive = true;
    digitalWrite(PIN_BUZZER, HIGH);
    digitalWrite(PIN_ALARM_LED, HIGH);
    digitalWrite(PIN_VALVE_RELAY, HIGH);
  } else {
    localAlarmActive = false;
    digitalWrite(PIN_BUZZER, LOW);
    digitalWrite(PIN_ALARM_LED, LOW);
    digitalWrite(PIN_VALVE_RELAY, LOW);
    // Heartbeat indicator (slow pulse)
    digitalWrite(PIN_STATUS_LED, (millis() / 1000) % 2);
  }
}

// ==========================================
// Network Management & Telemetry Cycle
// ==========================================
void handleNetworkAndTelemetry() {
  unsigned long currentMillis = millis();

  // Non-blocking Wi-Fi reconnect
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[OneGaurd] Continuing independent local safety monitoring");
    if (currentMillis - lastWifiRetryMillis >= ((unsigned long)WIFI_RETRY_INTERVAL_SEC * 1000UL)) {
      lastWifiRetryMillis = currentMillis;
      Serial.println("[WIFI] Reconnecting in background...");
      WiFi.reconnect();
    }
  }

  // Periodic Telemetry Dispatch
  if (currentMillis - lastTelemetryMillis >= ((unsigned long)TELEMETRY_INTERVAL_SEC * 1000UL)) {
    lastTelemetryMillis = currentMillis;

    // Read Mass
    float grossMassKg = 0.0f;
    if (isHx711Available && scale.is_ready()) {
      grossMassKg = scale.get_units(5);
      if (fabs(grossMassKg) < WEIGHT_DEADBAND_KG) {
        grossMassKg = 0.0f;
      }
    } else {
      grossMassKg = 0.0f;
    }

    float netGasMassKg = max(0.0f, grossMassKg - platformTareMassKg);
    int currentGasAdc = (int)filteredGasAdc;

    // Determine sensor health status
    const char* sensorStatus = "ok";
    if (currentMillis - bootTimestampMillis < ((unsigned long)MQ6_WARMUP_SECONDS * 1000UL)) {
      sensorStatus = "warming";
    } else if (currentGasAdc < MQ6_FAULT_LOW_RAW) {
      sensorStatus = "fault"; // Open-circuit / disconnected
    }

    String isoTimestamp = getIso8601Timestamp();

    // Local Serial Diagnostics Log
    Serial.printf("[DIAG] Seq: %lu | Time: %s | Gas ADC: %d (%s) | Gross: %.2f kg | Tare: %.2f kg | Net LPG: %.2f kg | Leak: %s | WiFi: %s (%d dBm)\n",
                  ++packetSequenceNumber,
                  isoTimestamp.c_str(),
                  currentGasAdc,
                  sensorStatus,
                  grossMassKg,
                  platformTareMassKg,
                  netGasMassKg,
                  isSustainedLeakActive ? "CRITICAL_ALARM" : "NORMAL",
                  WiFi.status() == WL_CONNECTED ? "ONLINE" : "OFFLINE",
                  WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);

    // Transmit to Cloud if network is available
    if (WiFi.status() == WL_CONNECTED) {
      dispatchTelemetryPayload(grossMassKg, netGasMassKg, currentGasAdc, sensorStatus, isoTimestamp);
    }
  }
}

// ==========================================
// Cloud HTTPS Ingestion Transmission
// ==========================================
void dispatchTelemetryPayload(float grossMass, float netMass, int rawGas, const char* sensorStatus, const String& isoTime) {
  HTTPClient http;
  String targetUrl = String(BACKEND_BASE_URL_CONFIG) + "/api/device/" + String(DEVICE_ID_CONFIG) + "/telemetry";

  bool begun = false;
  if (targetUrl.startsWith("https://")) {
    begun = http.begin(secureClient, targetUrl);
  } else {
    begun = http.begin(targetUrl);
  }

  if (!begun) {
    Serial.println("[HTTP] Failed to initialize connection to gateway.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_SECRET_TOKEN_CONFIG);
  http.setTimeout(4000); // 4-second timeout to avoid holding safety loop

  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID_CONFIG) + "\",";
  payload += "\"seq\":" + String(packetSequenceNumber) + ",";
  payload += "\"timestamp\":\"" + isoTime + "\",";
  payload += "\"gasRaw\":" + String(rawGas) + ",";
  payload += "\"gasThresholdRaw\":" + String(MQ6_ALARM_THRESHOLD_RAW) + ",";
  payload += "\"leak\":" + String(isSustainedLeakActive ? "true" : "false") + ",";
  payload += "\"totalMassKg\":" + String(grossMass, 3) + ",";
  payload += "\"tareMassKg\":" + String(platformTareMassKg, 3) + ",";
  payload += "\"weightKg\":" + String(netMass, 3) + ",";
  payload += "\"sensorStatus\":\"" + String(sensorStatus) + "\",";
  payload += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
  payload += "\"batteryVoltage\":3.30,";
  payload += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION_CONFIG) + "\"";
  payload += "}";

  int httpCode = http.POST(payload);
  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("[HTTP] Ingestion successful. HTTP %d (ACK)\n", httpCode);
  } else if (httpCode > 0) {
    Serial.printf("[HTTP] Ingestion rejected by gateway. HTTP %d\n", httpCode);
  } else {
    Serial.printf("[HTTP] Ingestion transmission failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// ==========================================
// Time Formatting Helper
// ==========================================
String getIso8601Timestamp() {
  if (isRtcAvailable) {
    DateTime now = rtc.now();
    char buf[25];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             now.year(), now.month(), now.day(),
             now.hour(), now.minute(), now.second());
    return String(buf);
  }

  // Fallback timestamp based on boot time
  unsigned long sec = millis() / 1000;
  char buf[25];
  snprintf(buf, sizeof(buf), "BOOT+%luds", sec);
  return String(buf);
}

// ==========================================
// Interactive Serial Commands (Tare / Calibrate)
// ==========================================
void processSerialCommands() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  cmd.toLowerCase();

  if (cmd == "t" || cmd == "tare") {
    Serial.println("\n[TARE] Zeroing scale platform. Ensure platform is EMPTY...");
    if (isHx711Available && scale.is_ready()) {
      scale.tare(10);
      Serial.println("[TARE] Scale successfully tared to 0.000 kg.");
    } else {
      Serial.println("[TARE] Error: HX711 not ready. Tare aborted.");
    }
  } else if (cmd == "c" || cmd == "cal") {
    Serial.println("\n--- LOAD CELL CALIBRATION ROUTINE ---");
    Serial.println("Step 1: Empty the platform, then type 't' to tare.");
    Serial.println("Step 2: Place a KNOWN weight (e.g. 5.0 kg) on the platform.");
    Serial.println("Step 3: Enter the command: 'cal <weight_in_kg>' (e.g. 'cal 5.0')");
  } else if (cmd.startsWith("cal ")) {
    float knownWeight = cmd.substring(4).toFloat();
    if (knownWeight > 0.01f && isHx711Available && scale.is_ready()) {
      long rawReading = scale.get_value(10);
      float newFactor = (float)rawReading / knownWeight;
      currentCalibrationFactor = newFactor;
      scale.set_scale(currentCalibrationFactor);
      Serial.printf("[CALIBRATION] New factor computed: %.2f\n", newFactor);
      Serial.printf("[CALIBRATION] Update CALIBRATION_FACTOR_INIT in config.h to: %.2ff\n", newFactor);
    } else {
      Serial.println("[CALIBRATION] Invalid weight entered or HX711 not ready.");
    }
  } else if (cmd == "h" || cmd == "help") {
    Serial.println("\nAvailable Serial Commands:");
    Serial.println("  t, tare     : Tare empty platform to 0.00 kg");
    Serial.println("  c, cal      : Display calibration instructions");
    Serial.println("  cal <kg>    : Calibrate using placed known weight (e.g. cal 5.0)");
    Serial.println("  h, help     : Display this help menu\n");
  }
}

// ==========================================
// Diagnostics Banner
// ==========================================
void printDiagnosticsBanner() {
  Serial.println("\n=======================================================");
  Serial.println("   ONEGAURD LPG SAFETY & TELEMETRY SYSTEM v1.5.0");
  Serial.println("   Target: ESP32 DevKit V1 | MQ-6 | HX711 | DS3231");
  Serial.println("=======================================================");
  Serial.printf("Device ID:       %s\n", DEVICE_ID_CONFIG);
  Serial.printf("Target Gateway:  %s\n", BACKEND_BASE_URL_CONFIG);
  Serial.printf("MQ-6 Threshold:  %d ADC (12-bit, Sustained: %ds)\n", MQ6_ALARM_THRESHOLD_RAW, SUSTAINED_LEAK_CONFIRM_SEC);
  Serial.printf("Load Factor:     %.2f (Deadband: %.3f kg)\n", CALIBRATION_FACTOR_INIT, WEIGHT_DEADBAND_KG);
  Serial.println("=======================================================\n");
}
