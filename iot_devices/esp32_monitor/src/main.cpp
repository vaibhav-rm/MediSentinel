#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "MAX30100_PulseOximeter.h"

#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>

#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// =====================================================
// FORWARD DECLARATIONS
// =====================================================
void drawUI();
void updateVitals(float hr, float spo2);
void updateStatus(const char* status, uint16_t color);
void updateLog(const char* logMsg, uint16_t color);
void mqttCallback(char* topic, byte* payload, unsigned int length);
void printWrappedText(int startX, int startY, int maxCharsPerLine, int maxLines, const char* text);

// =====================================================
// WIFI & MQTT
// =====================================================
const char* ssid = "Nuvvu Kavalayya";
const char* password = "23277868";
const char* mqtt_server = "10.195.152.157";
const int mqtt_port = 1883;

const char* device_id = "esp32-hr-sim-001";
const char* mqtt_topic_telemetry = "medisentinel/iot/telemetry";
const char* mqtt_topic_discovery = "medisentinel/iot/discovery";
const char* mqtt_topic_toggle = "medisentinel/iot/attack/toggle";

// =====================================================
// TFT PINS
// =====================================================
#define TFT_CS    5
#define TFT_RST   4
#define TFT_DC    2

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

// UI State
float lastHR = -1;
float lastSpO2 = -1;
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

void drawUI() {
    tft.fillScreen(ST77XX_BLACK);
    
    // Header
    tft.fillRect(0, 0, 160, 16, ST77XX_BLUE);
    tft.setCursor(15, 4);
    tft.setTextColor(ST77XX_WHITE);
    tft.setTextSize(1);
    tft.println("MediSentinel Shield");

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
    
    // Initial Values
    updateVitals(0, 0);
    updateStatus("SECURE", ST77XX_GREEN);
    updateLog("System online and monitoring...", ST77XX_WHITE);
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
    if (strcmp(status, currentStatusStr) == 0 && color == currentStatusColor) return;
    strncpy(currentStatusStr, status, sizeof(currentStatusStr));
    currentStatusColor = color;
    
    tft.fillRect(82, 40, 76, 32, ST77XX_BLACK);
    tft.setTextColor(color);
    tft.setTextSize(1);
    
    printWrappedText(82, 40, 12, 4, status);
}

void updateLog(const char* logMsg, uint16_t color) {
    tft.fillRect(0, 102, 160, 26, ST77XX_BLACK);
    tft.setTextColor(color);
    tft.setTextSize(1);
    
    printWrappedText(2, 104, 26, 3, logMsg);
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
            if (doc.containsKey("agent_name")) {
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
                if (strcmp(status, "quarantined") == 0) {
                    isQuarantined = true;
                    updateStatus("QUARANTINED (ISOLATED)", ST77XX_ORANGE);
                } else if (strcmp(status, "active") == 0 || strcmp(status, "online") == 0) {
                    isQuarantined = false;
                    updateStatus("SECURE", ST77XX_GREEN);
                    updateLog("System restored to normal operation.", ST77XX_GREEN);
                }
            }
        } 
        else if (strcmp(topic, mqtt_topic_telemetry) == 0) {
            float hr = doc["heart_rate"];
            float spo2 = doc["spo2"];
            // Display MQTT telemetry if local sensor is missing, or if it has no valid reading (meaning no finger on it)
            if (!sensorAvailable || pox.getHeartRate() < 40 || pox.getHeartRate() > 180) {
                tsLastMQTTTelemetry = millis();
                updateVitals(hr, spo2);
            }
        }
    }
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

    Wire.begin(21, 22);
    Wire.setClock(100000);

    tft.initR(INITR_BLACKTAB);
    tft.setRotation(1);
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
        pox.setIRLedCurrent(MAX30100_LED_CURR_7_6MA);
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

    if (sensorAvailable) {
        pox.update();
    }

    if (beatDetected) {
        beatDetected = false;
        tft.fillCircle(145, 10, 5, ST77XX_RED);
        delay(20);
        tft.fillCircle(145, 10, 5, ST77XX_BLACK);
        tft.drawCircle(145, 10, 5, ST77XX_RED);
    }

    if (sensorAvailable && (millis() - tsLastReport > REPORTING_PERIOD_MS)) {
        float hr = pox.getHeartRate();
        float spo2 = pox.getSpO2();

        bool hasFinger = (hr > 30.0 && hr < 220.0 && spo2 > 50.0);
        if (!hasFinger) {
            hr = 0;
            spo2 = 0;
        }

        if (attackSimulationActive) {
            hr = random(210, 230);
            spo2 = random(80, 84);
        } else {
            if (hr < 40 || hr > 180) hr = 0;
            if (spo2 < 70 || spo2 > 100) spo2 = 0;
        }

        // Only update local vitals on screen if we have a valid local reading,
        // or if we haven't received any MQTT telemetry in the last 5 seconds.
        if (hr > 0 || (millis() - tsLastMQTTTelemetry > 5000)) {
            updateVitals(hr, spo2);
        }

        StaticJsonDocument<256> doc;
        doc["device_id"] = device_id;
        doc["heart_rate"] = hr;
        doc["spo2"] = spo2;
        doc["timestamp"] = millis();
        
        JsonObject network = doc.createNestedObject("network");
        network["packet_rate"] = attackSimulationActive ? 130 : 15;
        network["byte_rate"] = attackSimulationActive ? 14000 : 1300;
        network["jitter"] = attackSimulationActive ? 40 : 4;

        char buffer[256];
        serializeJson(doc, buffer);
        client.publish(mqtt_topic_telemetry, buffer);

        tsLastReport = millis();
    }

    delay(5);
}
