/**
 * OneGaurd LPG Safety Monitoring System
 * Firmware Configuration Template (config.example.h)
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to `config.h` in the same directory:
 *    cp config.example.h config.h
 * 2. Enter your real Wi-Fi credentials and endpoint settings in config.h.
 * 3. Never commit `config.h` to source control (it is ignored by .gitignore).
 */

#ifndef ONEGAURD_CONFIG_H
#define ONEGAURD_CONFIG_H

// ==========================================
// 1. Wi-Fi & Network Credentials
// ==========================================
#define WIFI_SSID_CONFIG            "YOUR_WIFI_OR_HOTSPOT_SSID"
#define WIFI_PASSWORD_CONFIG        "YOUR_WIFI_PASSWORD"

// ==========================================
// 2. OneGaurd Backend Gateway
// ==========================================
// Production Render Gateway or Local Testing IP:
// e.g., "https://onegaurd-lpg.onrender.com" or "http://192.168.1.50:5000"
#define BACKEND_BASE_URL_CONFIG     "https://onegaurd-lpg.onrender.com"
#define DEVICE_ID_CONFIG            "onegaurd-esp32-01"
#define DEVICE_SECRET_TOKEN_CONFIG  "esp32_dev_token_4892bc"
#define FIRMWARE_VERSION_CONFIG     "v1.5.0-prod"

// ==========================================
// 3. Hardware Pin Mapping (ESP32 DevKit V1)
// ==========================================
#define PIN_HX711_DOUT              25      // Load Cell Amplifier Data (DT)
#define PIN_HX711_SCK               26      // Load Cell Amplifier Clock (SCK)
#define PIN_DS3231_SDA              21      // I2C SDA for DS3231 RTC
#define PIN_DS3231_SCL              22      // I2C SCL for DS3231 RTC
#define PIN_MQ6_ANALOG              34      // MQ-6 Analog Output (via Voltage Divider)
#define PIN_BUZZER_ALARM            27      // Local Piezo Buzzer Actuator
#define PIN_VALVE_RELAY             14      // Solenoid / Relay Valve Actuator
#define PIN_STATUS_LED              2       // Onboard Status LED

// ==========================================
// 4. Load Cell (HX711 + SparkFun Combinator)
// ==========================================
// Existing provisional calibration factor (subject to multi-point field calibration)
#define CALIBRATION_FACTOR_INIT     -22668.4f
#define WEIGHT_DEADBAND_KG          0.003f   // Filter out micro-jitter under 3 grams
#define DEFAULT_PLATFORM_TARE_KG    15.10f   // Tare weight of empty platform & cylinder tare

// ==========================================
// 5. MQ-6 LPG Gas Sensor & Safety Timers
// ==========================================
#define MQ6_ALARM_THRESHOLD_RAW     2200     // 12-bit ADC threshold (0-4095)
#define MQ6_HYSTERESIS_RAW          100      // Reset at threshold - 100 to prevent chatter
#define MQ6_FAULT_LOW_RAW           30       // Below 30 ADC indicates disconnected/open pin
#define MQ6_WARMUP_SECONDS          180      // 180s (3 min) heater stabilization period
#define SUSTAINED_LEAK_CONFIRM_SEC  3        // Sustained breach required before alert
#define TELEMETRY_INTERVAL_SEC      5        // Ingestion reporting cadence (seconds)
#define WIFI_RETRY_INTERVAL_SEC     10       // Non-blocking reconnect interval (seconds)

// ==========================================
// 6. TLS / HTTPS Security Policy
// ==========================================
// NOTE: Set to true for initial workbench lab bringup without installing the root CA.
// For production, set to false and provide the valid Root CA certificate below.
#define USE_INSECURE_TLS            true

// Optional: ISRG Root X1 (Let's Encrypt) CA certificate for Render HTTPS validation
static const char* RENDER_ROOT_CA_CERT = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" \
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n" \
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n" \
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n" \
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n" \
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n" \
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n" \
"A5/TR5d8S5JlCd893/y8eMmPFssHyJ3lkNTIssBBdbVNzsTWurpK8EdsVngU038w\n" \
"mw1xT/9YnSp4nQTXXYTUrvmYVQNwBWNYBaW4V5PQrU68/gyZxdzyMWsH36N1E3aH\n" \
"z0bx6tHLo70Zsflx45NJgyYRwMtBFia3B9AJKaxyR73+f+4Ph2wReWtfeFJa0eqP\n" \
"6hQRcgNfEvYZqhtTKTxBuQuQR0CuwSonEQvg9ZqyOVHbdBVCZmwUC8H6P/ZZLA8A\n" \
"R35508sLK20t00WdiIbQvtpuW71ebsG6Wf1/5zUi3h+oyA52B1SQZmwWXYHr168T\n" \
"6kJ1VdmCHWU6DuvBpUInstantL+B8mVaHHmozWgPB15IZ9MW= \n" \
"-----END CERTIFICATE-----\n";

#endif // ONEGAURD_CONFIG_H
