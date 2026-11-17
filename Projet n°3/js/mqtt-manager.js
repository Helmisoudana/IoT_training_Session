/* =====================================================================
   Gestionnaire MQTT — UNE seule connexion partagée par tout le dashboard
   ===================================================================== */
(function (global) {
  'use strict';

  var LS_KEY = 'iot-dashboard-broker';
  var CFG = global.DASHBOARD_CONFIG || {};

  function getConfig() {
    var base = { url: 'ws://localhost:9001', username: '', password: '', clientIdPrefix: 'dashboard_' };
    var over = {};
    if (!CFG.lockBroker) {
      try { over = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { over = {}; }
    }
    return Object.assign(base, CFG.broker || {}, over);
  }

  /* Filtre MQTT avec jokers + et # */
  function match(filter, topic) {
    var f = String(filter).split('/'), t = String(topic).split('/');
    for (var i = 0; i < f.length; i++) {
      if (f[i] === '#') return true;
      if (i >= t.length) return false;
      if (f[i] !== '+' && f[i] !== t[i]) return false;
    }
    return f.length === t.length;
  }

  var MQ = {
    client: null,
    status: 'disconnected',
    detail: '',
    subscribed: new Set(),
    wanted: new Set(),
    msgHandlers: [],
    statusHandlers: [],

    getConfig: getConfig,
    match: match,

    saveConfig: function (o) { localStorage.setItem(LS_KEY, JSON.stringify(o)); },
    resetConfig: function () { localStorage.removeItem(LS_KEY); },

    onMessage: function (fn) { this.msgHandlers.push(fn); },
    onStatus: function (fn) { this.statusHandlers.push(fn); },

    setStatus: function (s, detail) {
      this.status = s;
      this.detail = detail || '';
      this.statusHandlers.forEach(function (fn) { fn(s, detail || ''); });
    },

    connect: function () {
      var self = this;
      this.disconnect();
      var c = getConfig();

      if (typeof global.mqtt === 'undefined') {
        this.setStatus('error', 'Bibliothèque MQTT introuvable (libs/mqtt.min.js)');
        return;
      }
      var opts = {
        clientId: (c.clientIdPrefix || 'dashboard_') + Math.random().toString(16).slice(2, 10),
        reconnectPeriod: 2000,
        connectTimeout: 8000,
        clean: true
      };
      if (c.username) opts.username = c.username;
      if (c.password) opts.password = c.password;

      this.setStatus('connecting', c.url);
      var cl;
      try { cl = global.mqtt.connect(c.url, opts); }
      catch (e) { this.setStatus('error', e.message); return; }
      this.client = cl;

      cl.on('connect', function () {
        self.subscribed.clear();
        self.setStatus('connected', c.url);
        self.syncSubscriptions();
      });
      cl.on('reconnect', function () { self.setStatus('connecting', c.url); });
      cl.on('close', function () { if (self.client === cl) self.setStatus('disconnected', c.url); });
      cl.on('error', function (err) { self.setStatus('error', (err && err.message) || 'Erreur de connexion'); });
      cl.on('message', function (topic, payload) {
        var raw = payload.toString();
        self.msgHandlers.forEach(function (fn) { fn(topic, raw); });
      });
    },

    disconnect: function () {
      if (this.client) {
        var cl = this.client;
        this.client = null;
        try { cl.removeAllListeners(); cl.end(true); } catch (e) { /* ignore */ }
      }
      this.subscribed.clear();
      this.setStatus('disconnected', '');
    },

    /* Liste des topics réellement utilisés par les composants */
    setWanted: function (arr) {
      this.wanted = new Set(arr);
      this.syncSubscriptions();
    },

    syncSubscriptions: function () {
      var cl = this.client;
      if (!cl || !cl.connected) return;
      var want = CFG.discoverTopics === false ? new Set(this.wanted) : new Set(['#']);
      var self = this;
      Array.from(this.subscribed).forEach(function (t) {
        if (!want.has(t)) { cl.unsubscribe(t); self.subscribed.delete(t); }
      });
      want.forEach(function (t) {
        if (!self.subscribed.has(t)) { cl.subscribe(t, { qos: 0 }); self.subscribed.add(t); }
      });
    },

    publish: function (topic, payload, retain) {
      if (!this.client || !this.client.connected) return false;
      this.client.publish(topic, String(payload), { qos: 0, retain: !!retain });
      return true;
    }
  };

  global.MQ = MQ;
})(window);
