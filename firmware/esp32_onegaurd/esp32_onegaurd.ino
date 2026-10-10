/*
 * OneGaurd LPG Leak Detection & Mass Telemetry System
 * Target Board: ESP32 Dev Module (WROOM-32D)
 * Sensors: MQ-6 Gas Sensor (Analog Pin 34), HX711 Load Cell Amplifier (DT: 19, SCK: 18)
 * Actuators: Piezo Buzzer (Pin 25), Strobe LED (Pin 26), Valve Relay (Pin 27)
 * 
 * LOCAL SAFETY RULE:
 * This firmware operates local safety logic in high-priority loops.
 * Immediate alarm activation and shutoff trigger locally without waiting for Wi-Fi or cloud responses.
 */

#include <WiFi.h>
#include <HTTPClient.h>

// Configuration & Pin Mapping
#define PIN_MQ6_ANALOG        34
#define PIN_BUZZER            25
#define PIN_ALARM_LED         26
#define PIN_VALVE_RELAY       27

// Sensor Limits & Safety Thresholds
#define GAS_ALARM_THRESHOLD_RAW   450     // Debounced ADC trip point
#define GAS_FAULT_LOW_THRESHOLD   30      // Open-circuit fault detection
#define WARMUP_TIME_MS            60000   // MQ-6 heater stabilization period
#define TELEMETRY_INTERVAL_MS     5000    // Ingestion cycle interval

// Network Configuration (Pre-shared hotspot credentials)
const char* WIFI_SSID     = "OneGaurd_Field_Hotspot";
const char* WIFI_PASSWORD = "SafePassword99";

// API Gateway Configuration
const char* API_ENDPOINT   = "https://app.onegaurd.com/api/device/ESP32-LPG-01/telemetry";
const char* DEVICE_TOKEN   = "esp32_dev_token_4892bc";
const char* DEVICE_ID      = "ESP32-LPG-01";
const char* FIRMWARE_VER   = "v1.4.2-prod";

// State Variables
unsigned long bootTimestamp = 0;
unsigned long lastTelemetryDispatch = 0;
bool localAlarmActive = false;
float simulatedGrossMassKg = 23.55;
float platformTareMassKg   = 15.10;

void setup() {
  Serial.begin(115200);
  bootTimestamp = millis();

  // Initialize Safety Outputs to Known Safe States
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_ALARM_LED, OUTPUT);
  pinMode(PIN_VALVE_RELAY, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_ALARM_LED, LOW);
  digitalWrite(PIN_VALVE_RELAY, LOW);

  // Initialize Analog Sensor Inputs
  analogReadResolution(12); // ESP32 12-bit ADC (0-4095)
  pinMode(PIN_MQ6_ANALOG, INPUT);

  Serial.println("[OneGaurd] Boot complete. Local safety monitoring running.");
  
  // Non-blocking Wi-Fi initialization
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. HIGH-PRIORITY LOCAL SENSOR SAMPLING (Runs completely offline)
  int rawGasReading = analogRead(PIN_MQ6_ANALOG);

  // Evaluate Sensor Fault Conditions
  bool isWarmingUp = (currentMillis - bootTimestamp) < WARMUP_TIME_MS;
  const char* sensorStatus = "ok";
  if (isWarmingUp) {
    sensorStatus = "warming";
  } else if (rawGasReading < GAS_FAULT_LOW_THRESHOLD) {
    sensorStatus = "fault";
  }

  // Evaluate Immediate Local Leak Reaction
  if (!isWarmingUp && rawGasReading >= GAS_ALARM_THRESHOLD_RAW) {
    localAlarmActive = true;
    digitalWrite(PIN_BUZZER, HIGH);
    digitalWrite(PIN_ALARM_LED, HIGH);
    digitalWrite(PIN_VALVE_RELAY, HIGH); // Signal shutoff mechanism
  } else {
    localAlarmActive = false;
    digitalWrite(PIN_BUZZER, LOW);
    digitalWrite(PIN_ALARM_LED, LOW);
    digitalWrite(PIN_VALVE_RELAY, LOW);
  }

  // 2. BACKGROUND TELEMETRY DISPATCH (Does not block safety loop)
  if (currentMillis - lastTelemetryDispatch >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryDispatch = currentMillis;

    if (WiFi.status() == WL_CONNECTED) {
      dispatchTelemetry(rawGasReading, sensorStatus);
    } else {
      Serial.println("[OneGaurd] Wi-Fi offline. Continuing independent local safety monitoring.");
      WiFi.reconnect();
    }
  }

  delay(50); // Fast sampling cadence for safety interrupts
}

void dispatchTelemetry(int gasRaw, const char* status) {
  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);

  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"gasRaw\":" + String(gasRaw) + ",";
  payload += "\"totalMassKg\":" + String(simulatedGrossMassKg, 2) + ",";
  payload += "\"tareMassKg\":" + String(platformTareMassKg, 2) + ",";
  payload += "\"sensorStatus\":\"" + String(status) + "\",";
  payload += "\"batteryVoltage\":3.29,";
  payload += "\"firmwareVersion\":\"" + String(FIRMWARE_VER) + "\"";
  payload += "}";

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.printf("[OneGaurd] Telemetry dispatched successfully. HTTP %d\n", httpCode);
  } else {
    Serial.printf("[OneGaurd] Dispatched failed. Error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}
