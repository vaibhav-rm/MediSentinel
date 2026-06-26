#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HTTPUpdate.h>   // real OTA: download + flash firmware image
#include "MAX30100_PulseOximeter.h"

// Firmware version — set per build via platformio build_flags (-DFW_VERSION=...).
#ifndef FW_VERSION
#define FW_VERSION "v1.0.0"
#endif

#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>

#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

#include "mbedtls/md.h"   // HMAC-SHA256 for secure firmware update verification

// =====================================================
// FORWARD DECLARATIONS
// =====================================================
void drawUI();
void updateVitals(float hr, float spo2);
void updateStatus(const char* status, uint16_t color);
void updateLog(const char* logMsg, uint16_t color);
void mqttCallback(char* topic, byte* payload, unsigned int length);
void printWrappedText(int startX, int startY, int maxCharsPerLine, int maxLines, const char* text);
String computeHMAC(const String& message);
void publishFirmwareAck(const char* version, const char* status);
void performOTA(const char* version, const char* url, bool isRollback);
void drawDashboardPage();
void drawNetworkPage();
void drawSecurityPage();
void drawDeviceInfoPage();
void drawMenuPage(uint8_t page);
void beep(int duration);
void handleButton1Press();
void handleButton2Press();

// =====================================================
// WIFI & MQTT  ---  EDIT THESE FOR YOUR NETWORK
// =====================================================
//  ssid / password : your 2.4 GHz WiFi (ESP32 has no 5 GHz radio)
//  mqtt_server      : IP address of the computer running the Docker
//                     stack (the MediSentinel MQTT broker). Find it with
//                     `hostname -I` on that machine. NOT 127.0.0.1 — the
//                     ESP32 must reach it over the LAN. Port 1883 must be
//                     free on the host (stop any host-level mosquitto).
const char* ssid = "Sri Krishna Pg 41";
const char* password = "srikrishnafour";
const char* mqtt_server = "192.168.0.130";  // laptop's LAN IP on 'Sri Krishna Pg 41' (Docker host running the MQTT broker)
const int mqtt_port = 18833;

const char* device_id = "esp32-hr-sim-001";
const char* mqtt_topic_telemetry = "medisentinel/iot/telemetry";
const char* mqtt_topic_discovery = "medisentinel/iot/discovery";
const char* mqtt_topic_toggle = "medisentinel/iot/attack/toggle";
const char* mqtt_topic_fw_ack  = "medisentinel/iot/firmware/ack";

// Shared HMAC key for verifying secure firmware updates — MUST match the backend
// FIRMWARE_SIGNING_KEY. The device only applies an image whose signature it can
// recompute, so forged/unauthorized firmware pushes are rejected.
const char* FW_SIGN_KEY = "medisentinel_fw_signing_key_2026";

// =====================================================
// TFT, BUTTONS, & BUZZER PINS
// =====================================================
#define TFT_CS    5
#define TFT_RST   4
#define TFT_DC    2
#define BUTTON1   26
#define BUTTON2   27
#define BUZZER    25

Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);

// =====================================================
// SENSOR & GLOBALS
// =====================================================
PulseOximeter pox;
#define REPORTING_PERIOD_MS 2000

WiFiClient espClient;
PubSubClient client(espClient);

uint32_t tsLastReport = 0;
uint32_t tsLastMQTTTelemetry = 0;
volatile bool beatDetected = false;
bool isQuarantined = false;
bool sensorAvailable = false;
bool attackSimulationActive = false;

// Running firmware version (compiled in; changes after a real OTA reboot).
char firmwareVersion[16] = FW_VERSION;

// Power Saving and Menu State
bool screenOn = true;
uint8_t currentMenuPage = 0;
unsigned long lastActivityTime = 0;
const unsigned long INACTIVITY_TIMEOUT = 10000; // 10 seconds

// Cached variables for redrawing UI
float globalHR = 0.0;
float globalSpO2 = 0.0;
char currentLogStr[128] = "System online and monitoring...";
uint16_t currentLogColor = ST77XX_WHITE;

// UI State
float lastHR = -1;
float lastSpO2 = -1;

// Smoothing filters for the noisy MAX30100 readings (EMA) — kept stable so the
// displayed HR/SpO2 don't jump around between samples.
float hrEMA = 0;
float spo2EMA = 0;
char currentStatusStr[32] = "INITIALIZING";
uint16_t currentStatusColor = ST77XX_WHITE;

// =====================================================
// SAFE HEARTBEAT CALLBACK
// =====================================================
void onBeatDetected() {
    beatDetected = true;
}

// =====================================================
// UI UPDATE FUNCTIONS
// =====================================================

void beep(int duration) {
    digitalWrite(BUZZER, HIGH);
    delay(duration);
    digitalWrite(BUZZER, LOW);
}

void drawDashboardPage() {
    tft.fillScreen(ST77XX_BLACK);
    
    // Header
    tft.fillRect(0, 0, 160, 16, ST77XX_BLUE);
    tft.setCursor(6, 4);
    tft.setTextColor(ST77XX_WHITE);
    tft.setTextSize(1);
    tft.print("MediSentinel ");
    tft.print(firmwareVersion);

    // Dividers
    tft.drawLine(0, 16, 160, 16, ST77XX_WHITE);
    tft.drawLine(78, 16, 78, 88, ST77XX_WHITE);
    tft.drawLine(0, 88, 160, 88, ST77XX_WHITE);

    // Left Column Labels
    tft.setCursor(5, 20);
    tft.setTextColor(ST77XX_CYAN);
    tft.print("Heart Rate");
    tft.setCursor(5, 55);
    tft.print("SpO2 Level");

    // Right Column Labels
    tft.setCursor(82, 20);
    tft.setTextColor(ST77XX_CYAN);
    tft.print("System Status");

    // Bottom Section Labels
    tft.setCursor(2, 92);
    tft.setTextColor(ST77XX_CYAN);
    tft.print("Latest Agent Log:");
    
    // Force redraw of vitals, status, and log
    lastHR = -2.0; 
    lastSpO2 = -2.0;
    updateVitals(globalHR, globalSpO2);
    
    tft.fillRect(82, 40, 76, 32, ST77XX_BLACK);
    tft.setTextColor(currentStatusColor);
    tft.setTextSize(1);
    printWrappedText(82, 40, 12, 4, currentStatusStr);

    tft.fillRect(0, 102, 160, 26, ST77XX_BLACK);
    tft.setTextColor(currentLogColor);
    tft.setTextSize(1);
    printWrappedText(2, 104, 26, 3, currentLogStr);
}

void drawNetworkPage() {
    tft.fillScreen(ST77XX_BLACK);
    
    // Header
    tft.fillRect(0, 0, 160, 16, ST77XX_BLUE);
    tft.setCursor(6, 4);
    tft.setTextColor(ST77XX_WHITE);
    tft.setTextSize(1);
    tft.print("Network Info");
    tft.drawLine(0, 16, 160, 16, ST77XX_WHITE);

    tft.setTextSize(1);
    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 25);
    tft.print("SSID: ");
    tft.setTextColor(ST77XX_WHITE);
    tft.print(ssid);

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 40);
    tft.print("IP: ");
    tft.setTextColor(ST77XX_WHITE);
    if (WiFi.status() == WL_CONNECTED) {
        tft.print(WiFi.localIP().toString());
    } else {
        tft.print("Disconnected");
    }

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 55);
    tft.print("MQTT Broker: ");
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(5, 68);
    tft.print(mqtt_server);
    tft.print(":");
    tft.print(mqtt_port);

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 85);
    tft.print("MQTT Client: ");
    tft.setTextColor(client.connected() ? ST77XX_GREEN : ST77XX_RED);
    tft.print(client.connected() ? "CONNECTED" : "DISCONNECTED");

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 105);
    tft.print("Signal RSSI: ");
    tft.setTextColor(ST77XX_WHITE);
    if (WiFi.status() == WL_CONNECTED) {
        tft.print(WiFi.RSSI());
        tft.print(" dBm");
    } else {
        tft.print("N/A");
    }
}

void drawSecurityPage() {
    tft.fillScreen(ST77XX_BLACK);
    
    // Header
    tft.fillRect(0, 0, 160, 16, ST77XX_BLUE);
    tft.setCursor(6, 4);
    tft.setTextColor(ST77XX_WHITE);
    tft.setTextSize(1);
    tft.print("Security Details");
    tft.drawLine(0, 16, 160, 16, ST77XX_WHITE);

    tft.setTextSize(1);
    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 25);
    tft.print("Device Status: ");
    if (isQuarantined) {
        tft.setTextColor(ST77XX_RED);
        tft.print("QUARANTINED");
    } else {
        tft.setTextColor(ST77XX_GREEN);
        tft.print("SECURE");
    }

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 40);
    tft.print("Attack Sim: ");
    if (attackSimulationActive) {
        tft.setTextColor(ST77XX_RED);
        tft.print("ACTIVE");
    } else {
        tft.setTextColor(ST77XX_GREEN);
        tft.print("INACTIVE");
    }

    tft.setTextColor(ST77XX_YELLOW);
    tft.setCursor(5, 60);
    tft.print("--- Traffic Stats ---");

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 75);
    tft.print("Packet Rate: ");
    tft.setTextColor(ST77XX_WHITE);
    tft.print(attackSimulationActive ? "130 pkts/s" : "15 pkts/s");

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 90);
    tft.print("Byte Rate: ");
    tft.setTextColor(ST77XX_WHITE);
    tft.print(attackSimulationActive ? "14000 B/s" : "1300 B/s");

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 105);
    tft.print("Jitter: ");
    tft.setTextColor(ST77XX_WHITE);
    tft.print(attackSimulationActive ? "40 ms" : "4 ms");
}

void drawDeviceInfoPage() {
    tft.fillScreen(ST77XX_BLACK);
    
    // Header
    tft.fillRect(0, 0, 160, 16, ST77XX_BLUE);
    tft.setCursor(6, 4);
    tft.setTextColor(ST77XX_WHITE);
    tft.setTextSize(1);
    tft.print("System Info");
    tft.drawLine(0, 16, 160, 16, ST77XX_WHITE);

    tft.setTextSize(1);
    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 25);
    tft.print("Device ID: ");
    tft.setTextColor(ST77XX_WHITE);
    tft.print(device_id);

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 40);
    tft.print("Firmware Ver: ");
    tft.setTextColor(ST77XX_GREEN);
    tft.print(firmwareVersion);

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 55);
    tft.print("MAX30100 Sensor: ");
    if (sensorAvailable) {
        tft.setTextColor(ST77XX_GREEN);
        tft.print("FOUND & OK");
    } else {
        tft.setTextColor(ST77XX_RED);
        tft.print("NOT FOUND");
    }

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 70);
    tft.print("FW Verification: ");
    tft.setTextColor(ST77XX_WHITE);
    tft.print("HMAC-SHA256");

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 85);
    tft.print("HMAC Key Signature: ");
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(5, 95);
    tft.print("medisentinel_fw..."); // Masked for UI

    tft.setTextColor(ST77XX_CYAN);
    tft.setCursor(5, 110);
    tft.print("Uptime: ");
    tft.setTextColor(ST77XX_WHITE);
    tft.print(millis() / 1000);
    tft.print("s");
}

void drawMenuPage(uint8_t page) {
    if (!screenOn) return;
    switch (page) {
        case 0:
            drawDashboardPage();
            break;
        case 1:
            drawNetworkPage();
            break;
        case 2:
            drawSecurityPage();
            break;
        case 3:
            drawDeviceInfoPage();
            break;
    }
}

void drawUI() {
    drawDashboardPage();
}

void printWrappedText(int startX, int startY, int maxCharsPerLine, int maxLines, const char* text) {
    int len = strlen(text);
    int lineCount = 0;
    int charCount = 0;
    int wordStart = 0;
    
    tft.setCursor(startX, startY);
    
    while (wordStart < len) {
        int wordEnd = wordStart;
        while (wordEnd < len && text[wordEnd] != ' ') {
            wordEnd++;
        }
        
        int wordLen = wordEnd - wordStart;
        
        if (wordLen > maxCharsPerLine) {
            for (int i = 0; i < wordLen; i++) {
                if (charCount >= maxCharsPerLine) {
                    lineCount++;
                    if (lineCount >= maxLines) return;
                    tft.setCursor(startX, startY + lineCount * 8);
                    charCount = 0;
                }
                tft.print(text[wordStart + i]);
                charCount++;
            }
        } else {
            int spaceNeeded = (charCount > 0) ? 1 : 0;
            if (charCount + spaceNeeded + wordLen > maxCharsPerLine) {
                lineCount++;
                if (lineCount >= maxLines) return;
                tft.setCursor(startX, startY + lineCount * 8);
                charCount = 0;
                spaceNeeded = 0;
            }
            
            if (spaceNeeded) {
                tft.print(' ');
                charCount++;
            }
            
            for (int i = 0; i < wordLen; i++) {
                tft.print(text[wordStart + i]);
            }
            charCount += wordLen;
        }
        
        wordStart = wordEnd;
        if (wordStart < len && text[wordStart] == ' ') {
            wordStart++;
        }
    }
}

void updateVitals(float hr, float spo2) {
    globalHR = hr;
    globalSpO2 = spo2;

    if (!screenOn || currentMenuPage != 0) return;
    if (hr == lastHR && spo2 == lastSpO2) return;
    lastHR = hr;
    lastSpO2 = spo2;

    // HR
    tft.fillRect(5, 32, 70, 16, ST77XX_BLACK);
    tft.setCursor(5, 32);
    tft.setTextColor(ST77XX_GREEN);
    tft.setTextSize(2);
    if (hr > 0) tft.print((int)hr); else tft.print("--");
    
    // SpO2
    tft.fillRect(5, 67, 70, 16, ST77XX_BLACK);
    tft.setCursor(5, 67);
    tft.setTextColor(ST77XX_YELLOW);
    tft.setTextSize(2);
    if (spo2 > 0) tft.print((int)spo2); else tft.print("--");
}

void updateStatus(const char* status, uint16_t color) {
    strncpy(currentStatusStr, status, sizeof(currentStatusStr) - 1);
    currentStatusStr[sizeof(currentStatusStr) - 1] = '\0';
    currentStatusColor = color;
    
    if (!screenOn || currentMenuPage != 0) return;
    
    tft.fillRect(82, 40, 76, 32, ST77XX_BLACK);
    tft.setTextColor(color);
    tft.setTextSize(1);
    
    printWrappedText(82, 40, 12, 4, status);
}

void updateLog(const char* logMsg, uint16_t color) {
    strncpy(currentLogStr, logMsg, sizeof(currentLogStr) - 1);
    currentLogStr[sizeof(currentLogStr) - 1] = '\0';
    currentLogColor = color;

    if (!screenOn || currentMenuPage != 0) return;
    
    tft.fillRect(0, 102, 160, 26, ST77XX_BLACK);
    tft.setTextColor(color);
    tft.setTextSize(1);
    
    printWrappedText(2, 104, 26, 3, logMsg);
}

// =====================================================
// SECURE FIRMWARE HELPERS
// =====================================================

// HMAC-SHA256(message) using the shared FW_SIGN_KEY, returned as lowercase hex.
String computeHMAC(const String& message) {
    byte hmacResult[32];
    mbedtls_md_context_t ctx;
    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
    mbedtls_md_hmac_starts(&ctx, (const unsigned char*)FW_SIGN_KEY, strlen(FW_SIGN_KEY));
    mbedtls_md_hmac_update(&ctx, (const unsigned char*)message.c_str(), message.length());
    mbedtls_md_hmac_finish(&ctx, hmacResult);
    mbedtls_md_free(&ctx);

    String hex = "";
    for (int i = 0; i < 32; i++) {
        char b[3];
        sprintf(b, "%02x", hmacResult[i]);
        hex += b;
    }
    return hex;
}

void publishFirmwareAck(const char* version, const char* status) {
    StaticJsonDocument<192> ack;
    ack["device_id"] = device_id;
    ack["version"] = version;
    ack["status"] = status;
    char buffer[192];
    serializeJson(ack, buffer);
    client.publish(mqtt_topic_fw_ack, buffer);
}

// Download the firmware image from `url` over HTTP and flash it to the inactive OTA
// partition. On success the ESP32 reboots into the new image automatically; on the
// next boot it reports the new FW_VERSION (which confirms the update to the backend).
void performOTA(const char* version, const char* url, bool isRollback) {
    char buf[56];
    snprintf(buf, sizeof(buf), "%s -> %s", isRollback ? "Rollback" : "OTA update", version);
    updateStatus(isRollback ? "ROLLING BACK" : "UPDATING FW", ST77XX_CYAN);
    updateLog(buf, ST77XX_CYAN);
    updateLog("Downloading & flashing image...", ST77XX_CYAN);

    WiFiClient otaClient;
    httpUpdate.rebootOnUpdate(true);
    t_httpUpdate_return ret = httpUpdate.update(otaClient, String(url));

    // Only reached on failure (a successful flash reboots into the new firmware).
    if (ret == HTTP_UPDATE_FAILED) {
        char err[64];
        snprintf(err, sizeof(err), "OTA FAILED: %s", httpUpdate.getLastErrorString().c_str());
        updateStatus("OTA FAILED", ST77XX_RED);
        updateLog(err, ST77XX_RED);
        publishFirmwareAck(version, "failed");
    } else if (ret == HTTP_UPDATE_NO_UPDATES) {
        updateLog("OTA: no update returned by server", ST77XX_ORANGE);
        publishFirmwareAck(version, "failed");
    }
}

// =====================================================
// MQTT CALLBACK
// =====================================================

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    char message[length + 1];
    for (unsigned int i = 0; i < length; i++) {
        message[i] = (char)payload[i];
    }
    message[length] = '\0';

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, message);
    
    Serial.print("MQTT Topic: ");
    Serial.println(topic);
    Serial.print("MQTT Payload: ");
    Serial.println(message);
    if (error) {
        Serial.print("JSON Error: ");
        Serial.println(error.c_str());
    }

    if (!error) {
        if (strcmp(topic, mqtt_topic_toggle) == 0) {
            attackSimulationActive = doc["attack_active"];
            if (attackSimulationActive) {
                updateStatus("ATTACK DETECTED", ST77XX_RED);
            } else if (!isQuarantined) {
                updateStatus("SECURE", ST77XX_GREEN);
            }
        } 
        else if (strcmp(topic, "medisentinel/iot/control/esp32-hr-sim-001") == 0) {
            if (doc.containsKey("action")) {
                // ---- Real secure OTA: update / rollback ----
                const char* action = doc["action"];
                const char* version = doc["version"] | "";
                const char* url = doc["url"] | "";
                const char* sig = doc["signature"] | "";

                if (strcmp(action, "firmware_update") != 0 && strcmp(action, "firmware_rollback") != 0) {
                    return;
                }

                // Authorise the command: HMAC over "device_id:version:url".
                String expected = computeHMAC(String(device_id) + ":" + String(version) + ":" + String(url));
                if (expected != String(sig) || strlen(url) == 0) {
                    updateLog("Firmware REJECTED: invalid signature", ST77XX_RED);
                    publishFirmwareAck(version, "rejected");
                    return;
                }

                performOTA(version, url, strcmp(action, "firmware_rollback") == 0);
            }
            else if (doc.containsKey("agent_name")) {
                const char* status = doc["status"];
                const char* msg = doc["message"];
                
                uint16_t color = ST77XX_WHITE;
                if (strcmp(status, "anomaly") == 0) color = ST77XX_RED;
                else if (strcmp(status, "mitigated") == 0) color = ST77XX_GREEN;
                else if (strcmp(status, "logged") == 0) color = ST77XX_YELLOW;
                else color = ST77XX_CYAN;
                
                updateLog(msg, color);
            } 
            else if (doc.containsKey("status")) {
                const char* status = doc["status"];
                if (strcmp(status, "active") == 0 || strcmp(status, "online") == 0) {
                    // Cleared by the AI agents — back to normal operation
                    isQuarantined = false;
                    updateStatus("SECURE", ST77XX_GREEN);
                    updateLog("System restored to normal operation.", ST77XX_GREEN);
                } else if (strcmp(status, "quarantined") == 0) {
                    isQuarantined = true;
                    updateStatus("QUARANTINED (ISOLATED)", ST77XX_ORANGE);
                } else if (strcmp(status, "blocked") == 0) {
                    isQuarantined = true;
                    updateStatus("TRAFFIC BLOCKED", ST77XX_RED);
                } else if (strcmp(status, "restricted") == 0) {
                    isQuarantined = true;
                    updateStatus("EGRESS RESTRICTED", ST77XX_ORANGE);
                } else {
                    // Any other non-active status => contained by the agents
                    isQuarantined = true;
                    updateStatus("CONTAINED", ST77XX_ORANGE);
                }
            }
        } 
        else if (strcmp(topic, mqtt_topic_telemetry) == 0) {
            // Mirror the MQTT telemetry if:
            // 1. We have no physical sensor (sensorAvailable == false)
            // 2. Or we have a physical sensor, but there is currently no active finger reading on it (hrEMA and spo2EMA are 0)
            float hr = doc["heart_rate"];
            float spo2 = doc["spo2"];
            bool incomingHasVitals = (hr > 30.0 && spo2 > 50.0);
            bool localHasVitals = (hrEMA > 30.0 || spo2EMA > 50.0);
            
            if (!sensorAvailable || (!localHasVitals && incomingHasVitals)) {
                tsLastMQTTTelemetry = millis();
                updateVitals(hr, spo2);
            }
        }
    }
}

void handleButton1Press() {
    beep(80);
    lastActivityTime = millis();
    if (!screenOn) {
        // Wake display
        tft.sendCommand(ST77XX_SLPOUT);
        tft.sendCommand(ST77XX_DISPON);
        screenOn = true;
        drawMenuPage(currentMenuPage);
        Serial.println("Screen woken up by Button 1");
    } else {
        // Put display to sleep immediately (Power off)
        tft.sendCommand(ST77XX_SLPIN);
        tft.sendCommand(ST77XX_DISPOFF);
        screenOn = false;
        Serial.println("Screen turned off by Button 1");
    }
}

void handleButton2Press() {
    if (!screenOn) {
        return;
    }
    beep(80);
    lastActivityTime = millis();
    currentMenuPage = (currentMenuPage + 1) % 4;
    drawMenuPage(currentMenuPage);
    Serial.print("Menu scrolled to: ");
    Serial.println(currentMenuPage);
}

// =====================================================
// WIFI & MQTT SETUP
// =====================================================

void setup_wifi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        if (millis() - startAttempt > 20000) {
            ESP.restart();
        }
    }
}

void reconnect() {
    static unsigned long lastAttempt = 0;
    if (client.connected() || (millis() - lastAttempt < 5000)) return;

    lastAttempt = millis();
    if (client.connect(device_id)) {
        StaticJsonDocument<256> doc;
        doc["device_id"] = device_id;
        doc["device_type"] = "HeartRateMonitor";
        doc["status"] = "online";
        doc["firmware"] = firmwareVersion;
        char buffer[256];
        serializeJson(doc, buffer);
        
        client.publish(mqtt_topic_discovery, buffer, true);
        client.subscribe("medisentinel/iot/control/esp32-hr-sim-001");
        client.subscribe(mqtt_topic_toggle);
        client.subscribe(mqtt_topic_telemetry);
        
        updateLog("Connected to Cloud", ST77XX_GREEN);
    }
}

// =====================================================
// SETUP
// =====================================================

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200);

    // Initialize button and buzzer pins
    pinMode(BUTTON1, INPUT_PULLUP);
    pinMode(BUTTON2, INPUT_PULLUP);
    pinMode(BUZZER, OUTPUT);
    digitalWrite(BUZZER, LOW);

    // Startup beep sequence
    beep(150);
    delay(200);
    beep(150);

    lastActivityTime = millis();

    Wire.begin(21, 22);
    Wire.setClock(100000);

    tft.initR(INITR_BLACKTAB);
    tft.setRotation(3);
    tft.setTextWrap(false);
    
    // Initial Boot Screen
    tft.fillScreen(ST77XX_BLACK);
    tft.setCursor(10, 20);
    tft.setTextColor(ST77XX_GREEN);
    tft.setTextSize(2);
    tft.println("Booting...");

    setup_wifi();
    
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(mqttCallback);

    if (!pox.begin()) {
        sensorAvailable = false;
    } else {
        sensorAvailable = true;
        // Higher IR LED current => stronger signal / better SpO2 + HR accuracy than
        // the 7.6 mA example default (lower it again if your readings saturate).
        pox.setIRLedCurrent(MAX30100_LED_CURR_11MA);
        pox.setOnBeatDetectedCallback(onBeatDetected);
    }

    drawUI();
    if (!sensorAvailable) {
        updateLog("No hardware sensor. Receiver mode active.", ST77XX_ORANGE);
    }
}

// =====================================================
// LOOP
// =====================================================

void loop() {
    static unsigned long lastWiFiCheck = 0;
    if (WiFi.status() != WL_CONNECTED) {
        if (millis() - lastWiFiCheck > 10000) {
            lastWiFiCheck = millis();
            WiFi.disconnect();
            WiFi.begin(ssid, password);
        }
    }

    reconnect();
    client.loop();

    // Button 1 Input & Debounce (Power / Wake)
    static unsigned long lastBtn1Time = 0;
    if (digitalRead(BUTTON1) == LOW) {
        if (millis() - lastBtn1Time > 250) {
            lastBtn1Time = millis();
            handleButton1Press();
        }
    }

    // Button 2 Input & Debounce (Menu scroll)
    static unsigned long lastBtn2Time = 0;
    if (digitalRead(BUTTON2) == LOW) {
        if (millis() - lastBtn2Time > 250) {
            lastBtn2Time = millis();
            handleButton2Press();
        }
    }

    // Screen Inactivity Auto-Off (Disabled per user request)
    /*
    if (screenOn && (millis() - lastActivityTime >= INACTIVITY_TIMEOUT)) {
        tft.sendCommand(ST77XX_SLPIN);
        tft.sendCommand(ST77XX_DISPOFF);
        screenOn = false;
        Serial.println("Screen disabled (inactivity)");
    }
    */

    // Periodic Dynamic Menu Refresh (Pages 1, 2, 3)
    static unsigned long lastScreenRefresh = 0;
    if (screenOn && currentMenuPage != 0 && (millis() - lastScreenRefresh > 2000)) {
        lastScreenRefresh = millis();
        drawMenuPage(currentMenuPage);
    }

    if (sensorAvailable) {
        pox.update();
    }

    if (beatDetected) {
        beatDetected = false;
        lastActivityTime = millis(); // Reset inactivity timer on oximeter beat detection
        if (screenOn && currentMenuPage == 0) {
            tft.fillCircle(145, 10, 5, ST77XX_RED);
            delay(20);
            tft.fillCircle(145, 10, 5, ST77XX_BLACK);
            tft.drawCircle(145, 10, 5, ST77XX_RED);
        }
    }

    if (sensorAvailable && (millis() - tsLastReport > REPORTING_PERIOD_MS)) {
        float rawHr = pox.getHeartRate();
        float rawSpo2 = pox.getSpO2();

        float hr = 0;
        float spo2 = 0;

        if (attackSimulationActive && !isQuarantined) {
            // Under an ACTIVE (not-yet-contained) attack the device telemetry is
            // spoofed — these are the "ruined" values. Once the agents quarantine
            // the device (isQuarantined), we stop spoofing and resume real readings.
            hr = random(210, 230);
            spo2 = random(80, 84);
            hrEMA = 0;
            spo2EMA = 0;
        } else {
            // Evaluate Heart Rate independently
            if (rawHr > 30.0 && rawHr < 220.0) {
                hrEMA = (hrEMA == 0) ? rawHr : (0.75f * hrEMA + 0.25f * rawHr);
                hr = hrEMA;
            } else {
                hrEMA = 0;
            }

            // Evaluate SpO2 independently
            if (rawSpo2 > 50.0 && rawSpo2 <= 100.0) {
                spo2EMA = (spo2EMA == 0) ? rawSpo2 : (0.75f * spo2EMA + 0.25f * rawSpo2);
                spo2 = spo2EMA;
            } else {
                spo2EMA = 0;
            }
        }

        if (hr > 0 || spo2 > 0) {
            lastActivityTime = millis(); // Reset inactivity timer when finger is detected on oximeter
            updateVitals(hr, spo2);
        } else if (millis() - tsLastMQTTTelemetry > 5000) {
            updateVitals(0, 0);
        }

        StaticJsonDocument<384> doc;
        doc["device_id"] = device_id;
        doc["heart_rate"] = hr;
        doc["spo2"] = spo2;
        doc["timestamp"] = millis();
        doc["firmware"] = firmwareVersion;

        JsonObject network = doc.createNestedObject("network");
        network["packet_rate"] = attackSimulationActive ? 130 : 15;
        network["byte_rate"] = attackSimulationActive ? 14000 : 1300;
        network["jitter"] = attackSimulationActive ? 40 : 4;

        char buffer[256];
        serializeJson(doc, buffer);
        client.publish(mqtt_topic_telemetry, buffer);

        tsLastReport = millis();
    }

    yield();
}
