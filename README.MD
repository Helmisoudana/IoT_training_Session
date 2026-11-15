
# Formation IoT – Initiation à l'Internet of Things

Bienvenue dans ce repository dédié à la formation **Initiation à l'Internet of Things (IoT)**.

Ce dépôt regroupe les supports pédagogiques, les présentations, les ressources documentaires et les applications pratiques développées dans le cadre de cette formation.

L'objectif est de découvrir les fondamentaux de l'IoT, comprendre l'architecture d'un système connecté et mettre en pratique les concepts étudiés à travers des projets concrets.

---

## Objectifs de la formation

- Comprendre le concept de l'Internet of Things et son évolution.
- Distinguer un système embarqué d'un système IoT.
- Découvrir les différentes couches d'une architecture IoT.
- Comprendre le fonctionnement des capteurs, actionneurs et microcontrôleurs.
- Découvrir les protocoles de communication IoT.
- Développer des applications IoT simples.
- Explorer des concepts avancés comme le Digital Twin et l'Applied AI.

## Programme de la formation

**Durée estimée : 2h30 à 3h**

### 1. Introduction à l'IoT (20 min)

- Définition de l'IoT.
- Historique et évolution de l'IoT.
- Différence entre un système embarqué et un système IoT.

### 2. Architecture d'un système IoT : les 5 couches (45 min)

#### 2.1. Couche physique (Perception Layer)

- Microcontrôleurs et processeurs.
- Capteurs et actionneurs.
- Protocoles de communication embarqués.

#### 2.2. Couche liaison et passerelle (Connectivity Layer)

- TCP et UDP.
- Protocoles basés sur TCP : MQTT, HTTP, etc.
- Protocoles basés sur UDP : CoAP, etc.
- Rôle des passerelles IoT.

#### 2.3. Couche traitement (Processing Layer)

- Cloud Computing.
- Firebase.
- Développement de serveurs avec Python, Java, etc.
- Collecte, traitement et stockage des données.

#### 2.4. Couche présentation (Application Layer)

- Node-RED.
- Blynk.
- Arduino IoT Cloud.
- Développement de dashboards avec React, Angular, etc.

#### 2.5. Couche sécurité (Security Layer)

- Qualité de service (QoS) dans MQTT.
- Sécurisation des communications.
- SSL/TLS.

### 3. Applications de l'IoT

- Smart Home.
- Smart City.
- Industrie 4.0.
- Agriculture intelligente.
- Santé connectée.
- Transport intelligent.

### 4. Applications pratiques (45 min)

Mise en pratique des concepts à travers trois scénarios :

- **Lecture :** acquisition et consultation des données des capteurs.
- **Écriture :** envoi de commandes vers un actionneur.
- **Lecture & écriture :** communication bidirectionnelle entre les objets connectés et une application.

### 5. Concepts avancés (20 min)

- Digital Twin (Jumeau numérique).
- Modélisation des systèmes IoT.
- Applied AI : intégration de l'intelligence artificielle dans les systèmes IoT.

---

## Structure du repository

```text
.
├── Internet-of-things-a-hands-on-approach- Arshadeep.pdf
│
├── Projet n°1/
│   ├── Dashboard/
│   │   ├── app.js
│   │   ├── index.html
│   │   └── style.css
│   │
│   └── esp32_mqtt_lab/
│       └── esp32_mqtt_lab.ino
│
└── Projet n°2/
    ├── assets/
    │   ├── site.js
    │   └── theme.css
    │
    ├── index.html
    ├── LICENSE.txt
    │
    ├── page1/
    │   ├── app.js
    │   ├── index.html
    │   └── style.css
    │
    ├── page2/
    │   ├── index.html
    │   ├── script.js
    │   └── style.css
    │
    └── README.md
```

---

## Projets pratiques

### Projet n°1 – ESP32 MQTT Lab

Ce projet permet de découvrir la communication entre un ESP32 et une application Dashboard à travers le protocole MQTT.

**Technologies utilisées :**
- ESP32
- Arduino IDE
- MQTT
- HTML, CSS et JavaScript

**Fonctionnalités :**
- Acquisition et simulation de données de capteurs.
- Publication des données via MQTT.
- Réception de commandes depuis le Dashboard.
- Interaction avec un actionneur.
- Visualisation des données.

### Projet n°2 – Simulateur MQTT

Ce projet propose une interface pédagogique permettant de découvrir et de comprendre le fonctionnement du protocole MQTT à travers des simulations interactives.

**Technologies utilisées :**
- HTML5
- CSS3
- JavaScript

**Contenu :**
- Simulation des connexions MQTT.
- Découverte des échanges entre clients et broker.
- Visualisation des publications et abonnements.
- Exploration des mécanismes de communication MQTT.
- Présentation de scénarios de systèmes IoT.

---

## Ressources pédagogiques

Ce repository contient également des ressources complémentaires :

- **Livre de référence :** *Internet of Things – A Hands-on Approach* par Arshdeep Bahga et Vijay Madisetti.
- **Présentations :** supports de cours et documents pédagogiques.
- **Applications :** projets et démonstrations pratiques.

Les ressources et les supports sont modifiables et peuvent être enrichis au fur et à mesure de l'évolution de la formation.

---

## Outils et technologies

| Outil / Technologie | Utilisation |
|---|---|
| Arduino IDE | Programmation de l'ESP32 |
| ESP32 | Carte de développement IoT |
| MQTT | Communication entre objets connectés |
| Mosquitto | Broker MQTT |
| HTML / CSS / JavaScript | Développement des interfaces |
| Python / Java | Développement côté serveur |
| Firebase | Services Cloud |

---

## Utilisation

1. Cloner ou télécharger ce repository.
2. Consulter les ressources pédagogiques.
3. Accéder aux dossiers des projets.
4. Suivre les instructions et exécuter les applications.
5. Modifier le code et expérimenter les différents scénarios IoT.

---

## Contribution et évolution

Ce repository est conçu comme un support pédagogique évolutif.

Il peut être enrichi avec :

- De nouveaux projets IoT.
- Des présentations et supports de cours.
- Des exemples de communication entre objets connectés.
- De nouveaux protocoles et technologies.
- Des démonstrations autour du Digital Twin et de l'Intelligence Artificielle.

---

**Formation : Initiation à l'IoT**

*Learn. Build. Connect.*
