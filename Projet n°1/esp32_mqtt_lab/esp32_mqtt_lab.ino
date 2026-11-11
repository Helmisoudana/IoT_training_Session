
// IoT MQTT Lab - ESP32 + Capteurs simules + relais pompe
// Bibliotheque : PubSubClient

#include <WiFi.h>
#include <PubSubClient.h>

// ======== CONFIGURATION ========
const char* WIFI_SSID = "✨B.H✨";
const char* WIFI_PASS = "0000000000";
const char* BROKER_IP = "10.117.127.154";

// ==============================
#define PIN_RELAIS 26
#define RELAIS_ON HIGH

WiFiClient net;
PubSubClient mqtt(net);

String P;
String q[12];
int qn = 0;

unsigned long tLast = 0;

// ======== VARIABLES SIMULEES ========
float temperature = 24.0;
float humidity = 55.0;
int gas = 300;

// ======== GENERATION DES VALEURS ========

void simulateSensors() {

    // Variation aleatoire de temperature
    temperature += random(-10, 11) / 10.0;

    // Variation aleatoire d'humidite
    humidity += random(-20, 21) / 10.0;

    // Variation aleatoire du gaz
    gas += random(-30, 31);

    // Limitation des valeurs
    temperature = constrain(temperature, 18.0, 40.0);
    humidity = constrain(humidity, 30.0, 90.0);
    gas = constrain(gas, 100, 2000);
}

// ======== TRACE ========

void trace(const char* step, String d) {

    String j = "{\"step\":\"" + String(step) +
               "\",\"ms\":" + millis() +
               ",\"d\":\"" + d + "\"}";

    if (mqtt.connected())
        mqtt.publish((P + "/esp/trace").c_str(), j.c_str());

    else if (qn < 12)
        q[qn++] = j;
}

// ======== PUBLICATION MQTT ========

void pub(const char* sub, String v) {

    mqtt.publish((P + "/esp/" + sub).c_str(), v.c_str());
}

// ======== RECEPTION DES COMMANDES ========

void onMsg(char* topic, byte* pl, unsigned int len) {

    String v;

    for (unsigned i = 0; i < len; i++)
        v += (char)pl[i];

    trace("RX_CMD", "payload recu = " + v);

    bool on = (v == "ON");

    digitalWrite(PIN_RELAIS, on ? RELAIS_ON : !RELAIS_ON);

    trace("GPIO", String("digitalWrite relais = ") +
          (on ? "ON" : "OFF"));

    pub("pompe/etat", on ? "ON" : "OFF");

    trace("PUB_ETAT", String("publish pompe/etat = ") +
          (on ? "ON" : "OFF"));
}

// ======== CONNEXION MQTT ========

void connectMqtt() {

    while (!mqtt.connected()) {

        trace("MQTT_CONNECT",
              "client.connect() : envoi du paquet CONNECT");

        String id = "esp32-" +
                    String((uint32_t)ESP.getEfuseMac(), HEX);

        if (mqtt.connect(id.c_str())) {

            trace("MQTT_CONNACK", "CONNACK recu, code 0");

            mqtt.subscribe((P + "/esp/pompe/cmd").c_str());

            trace("SUBSCRIBE",
                  "subscribe " + P + "/esp/pompe/cmd");

            for (int i = 0; i < qn; i++)
                mqtt.publish((P + "/esp/trace").c_str(),
                             q[i].c_str());

            qn = 0;

        } else {

            Serial.println("MQTT KO, nouvel essai...");
            delay(2000);
        }
    }
}

// ---------- LES 3 MODES ----------

void mode1_lecture() {

    if (millis() - tLast < 2000) return;

    tLast = millis();

    trace("READ", "simulation temperature, humidite et gaz");

    // Generation des valeurs simulees
    simulateSensors();

    String js = "{\"t\":" + String(temperature, 1) +
                ",\"h\":" + String(humidity, 1) + "}";

    trace("JSON", js);

    pub("dht22", js);

    trace("PUB_DHT", "publish dht22");

    pub("gas", String(gas));

    trace("PUB_GAS", "publish gas = " + String(gas));
}

void mode2_actionneur() {
    // Commandes gerees par onMsg()
}

void mode3_global() {

    mode1_lecture();
    mode2_actionneur();
}

// ======== SETUP ========

void setup() {

    Serial.begin(115200);

    randomSeed(analogRead(0) + micros());

    pinMode(PIN_RELAIS, OUTPUT);

    digitalWrite(PIN_RELAIS, !RELAIS_ON);

    WiFi.begin(WIFI_SSID, WIFI_PASS);

    while (WiFi.status() != WL_CONNECTED) {

        delay(300);
        Serial.print(".");
    }

    P = WiFi.localIP().toString();

    Serial.println("\n==============================");
    Serial.println("IP ESP32 : " + P);
    Serial.println("==============================");

    trace("WIFI", String("connecte a ") + WIFI_SSID);

    trace("IP", "WiFi.localIP() = " + P);

    WiFiClient t;

    bool ok = t.connect(BROKER_IP, 1883);

    t.stop();

    trace("TCP", ok ?
          "SYN, SYN-ACK, ACK vers broker:1883 OK" :
          "TCP KO (broker lance ? pare-feu ?)");

    mqtt.setServer(BROKER_IP, 1883);

    mqtt.setCallback(onMsg);
}

// ======== LOOP ========

void loop() {

    if (!mqtt.connected())
        connectMqtt();

    mqtt.loop();

    // Choisir un seul mode

    //mode1_lecture();

    mode2_actionneur();
    // mode3_global();
}
