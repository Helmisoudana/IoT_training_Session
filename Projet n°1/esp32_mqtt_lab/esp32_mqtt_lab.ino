// IoT MQTT Lab - ESP32 + DHT22 + MQ gaz + relais pompe
// Bibliotheques : PubSubClient (Nick O'Leary), DHT sensor library (Adafruit)
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ======== A MODIFIER ========
const char* WIFI_SSID = "Wifi_IoT";
const char* WIFI_PASS = "AAA111BBB";
const char* BROKER_IP = "192.168.1.52";   // IP du PC (hotspot Windows)
// ==============================
#define PIN_DHT    4
#define PIN_GAZ    34
#define PIN_RELAIS 26
#define RELAIS_ON  HIGH   // mettre LOW si le module relais est actif a l'etat bas

WiFiClient net; PubSubClient mqtt(net); DHT dht(PIN_DHT, DHT22);
String P;                       // prefixe = IP de l'ESP32
String q[12]; int qn = 0;       // traces gardees avant la connexion MQTT
unsigned long tLast = 0;

void trace(const char* step, String d) {   // envoie une trace vers le dashboard
  String j = "{\"step\":\"" + String(step) + "\",\"ms\":" + millis() + ",\"d\":\"" + d + "\"}";
  if (mqtt.connected()) mqtt.publish((P + "/esp/trace").c_str(), j.c_str());
  else if (qn < 12) q[qn++] = j;
}
void pub(const char* sub, String v) { mqtt.publish((P + "/esp/" + sub).c_str(), v.c_str()); }

void onMsg(char* topic, byte* pl, unsigned int len) {
  String v; for (unsigned i = 0; i < len; i++) v += (char)pl[i];
  trace("RX_CMD", "payload recu = " + v);
  bool on = (v == "ON");
  digitalWrite(PIN_RELAIS, on ? RELAIS_ON : !RELAIS_ON);
  trace("GPIO", String("digitalWrite relais = ") + (on ? "ON" : "OFF"));
  pub("pompe/etat", on ? "ON" : "OFF");
  trace("PUB_ETAT", String("publish pompe/etat = ") + (on ? "ON" : "OFF"));
}

void connectMqtt() {
  while (!mqtt.connected()) {
    trace("MQTT_CONNECT", "client.connect() : envoi du paquet CONNECT");
    String id = "esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (mqtt.connect(id.c_str())) {
      trace("MQTT_CONNACK", "CONNACK recu, code 0");
      mqtt.subscribe((P + "/esp/pompe/cmd").c_str());
      trace("SUBSCRIBE", "subscribe " + P + "/esp/pompe/cmd");
      for (int i = 0; i < qn; i++) mqtt.publish((P + "/esp/trace").c_str(), q[i].c_str());
      qn = 0;
    } else { Serial.println("MQTT KO, nouvel essai..."); delay(2000); }
  }
}

// ---------- LES 3 MODES ----------
void mode1_lecture() {                 // capteurs -> broker
  if (millis() - tLast < 2000) return; tLast = millis();
  trace("READ", "dht.readTemperature() + analogRead(GAZ)");
  float t = dht.readTemperature(), h = dht.readHumidity(); int g = analogRead(PIN_GAZ);
  if (isnan(t) || isnan(h)) { trace("READ", "DHT22 illisible"); return; }
  String js = "{\"t\":" + String(t, 1) + ",\"h\":" + String(h, 1) + "}";
  trace("JSON", js);
  pub("dht22", js);  trace("PUB_DHT", "publish dht22");
  pub("gas", String(g)); trace("PUB_GAS", "publish gas = " + String(g));
}
void mode2_actionneur() {              // broker -> relais (gere par onMsg)
}
void mode3_global() { mode1_lecture(); mode2_actionneur(); }

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELAIS, OUTPUT); digitalWrite(PIN_RELAIS, !RELAIS_ON);
  dht.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  P = WiFi.localIP().toString();
  Serial.println("\n==============================");
  Serial.println("IP ESP32 (a saisir dans le dashboard) : " + P);
  Serial.println("==============================");
  trace("WIFI", String("connecte a ") + WIFI_SSID);
  trace("IP", "WiFi.localIP() = " + P);
  WiFiClient t;                                   // test TCP seul : 3-way handshake
  bool ok = t.connect(BROKER_IP, 1883); t.stop();
  trace("TCP", ok ? "SYN, SYN-ACK, ACK vers broker:1883 OK" : "TCP KO (broker lance ? pare-feu ?)");
  mqtt.setServer(BROKER_IP, 1883); mqtt.setCallback(onMsg);
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();
  // >>> Les etudiants choisissent UNE fonction (decommenter) :
  //mode1_lecture();
  // mode2_actionneur();
  mode3_global();
}
// final