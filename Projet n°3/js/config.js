/* =====================================================================
   CONFIGURATION DU DASHBOARD  —  à modifier UNE SEULE FOIS par le formateur
   ===================================================================== */
window.DASHBOARD_CONFIG = {

  /* Le broker MQTT unique utilisé par TOUS les composants du dashboard.
     Le navigateur parle à Mosquitto en MQTT sur WebSocket (pas en TCP 1883).
       - Dashboard ouvert sur le même PC que Mosquitto :  ws://localhost:9001
       - Dashboard ouvert sur un autre PC (hotspot)    :  ws://IP_DU_PC:9001
         ex : ws://192.168.137.1:9001                                         */
  broker: {
    url: 'ws://localhost:9001',
    username: '',
    password: '',
    clientIdPrefix: 'dashboard_'
  },

  /* true  = les étudiants ne peuvent pas changer le broker (bouton caché)
     false = bouton « Broker » visible (pratique si l'IP du PC change)      */
  lockBroker: false,

  /* true  = le dashboard écoute tout le broker (#) et propose la liste des
             topics détectés quand on clique sur un composant (conseillé)
     false = il ne s'abonne qu'aux topics utilisés par les composants        */
  discoverTopics: true,

  /* Taille de la grille d'alignement (px) */
  grid: 20,

  /* Titre par défaut d'un nouveau dashboard */
  defaultTitle: 'Mon Dashboard IoT'
};
