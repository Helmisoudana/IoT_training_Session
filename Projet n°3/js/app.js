/* =====================================================================
   APPLICATION : barre d'outils, statut de connexion, réglages broker,
   mode démo (données simulées)
   ===================================================================== */
(function () {
  'use strict';

  var E = window.Editor, MQ = window.MQ, W = window.IoTWidgets, CFG = window.DASHBOARD_CONFIG || {};
  function $(s) { return document.querySelector(s); }

  E.init();

  /* ---------- titre ---------- */
  $('#dash-title').addEventListener('input', function (e) {
    E.state.title = e.target.value; document.title = e.target.value + ' — IoT Dashboard';
    clearTimeout(E._tt2); E._tt2 = setTimeout(E.commit, 500);
  });

  /* ---------- mode édition / aperçu ---------- */
  var btnMode = $('#btn-mode');
  function paintMode() {
    btnMode.innerHTML = E.editing ? '▶ Aperçu' : '✏️ Éditer';
    btnMode.title = E.editing ? 'Tester le dashboard (les boutons et interrupteurs deviennent actifs)' : 'Revenir à l\'édition';
  }
  btnMode.addEventListener('click', function () { E.setEditing(!E.editing); paintMode(); });
  paintMode();

  /* ---------- annuler / rétablir ---------- */
  var bUndo = $('#btn-undo'), bRedo = $('#btn-redo');
  function paintHistory() { bUndo.disabled = !E.canUndo(); bRedo.disabled = !E.canRedo(); }
  E.onChange = paintHistory; paintHistory();
  bUndo.addEventListener('click', E.undo);
  bRedo.addEventListener('click', E.redo);

  /* ---------- fichier ---------- */
  $('#btn-export').addEventListener('click', function () { E.exportJSON(); E.toast('Dashboard exporté (.json)'); });
  var fileIn = $('#file-in');
  $('#btn-import').addEventListener('click', function () { fileIn.click(); });
  fileIn.addEventListener('change', function () {
    var f = fileIn.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try { E.importJSON(r.result); E.toast('Dashboard importé ✔'); }
      catch (e) { E.toast('Import impossible : ' + e.message); }
      fileIn.value = '';
    };
    r.readAsText(f);
  });
  $('#btn-example').addEventListener('click', function () {
    confirmBox('Charger l\'exemple ?', 'Votre dashboard actuel sera remplacé (vous pourrez annuler avec Ctrl+Z).', function () { E.example(); E.toast('Exemple chargé'); });
  });
  $('#btn-clear').addEventListener('click', function () {
    confirmBox('Tout effacer ?', 'Tous les composants seront supprimés (vous pourrez annuler avec Ctrl+Z).', function () { E.reset(); E.toast('Dashboard vidé'); });
  });

  /* ---------- modales ---------- */
  function modal(title, body, buttons) {
    var root = $('#modal-root');
    root.innerHTML = '';
    var box = document.createElement('div'); box.className = 'modal';
    var h = document.createElement('h3'); h.textContent = title; box.append(h);
    box.append(body);
    var bar = document.createElement('div'); bar.className = 'modal-bar';
    buttons.forEach(function (b) {
      var el = document.createElement('button'); el.className = 'btn-m ' + (b.cls || ''); el.textContent = b.label;
      el.addEventListener('click', function () { if (!b.fn || b.fn() !== false) close(); });
      bar.append(el);
    });
    box.append(bar);
    var wrap = document.createElement('div'); wrap.className = 'overlay';
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    wrap.append(box); root.append(wrap);
    function close() { root.innerHTML = ''; }
    var first = box.querySelector('input'); if (first) first.focus();
    return close;
  }
  function confirmBox(title, text, ok) {
    var p = document.createElement('p'); p.textContent = text;
    modal(title, p, [{ label: 'Annuler' }, { label: 'Confirmer', cls: 'primary', fn: function () { ok(); } }]);
  }

  /* ---------- broker ---------- */
  var bBroker = $('#btn-broker');
  if (CFG.lockBroker) bBroker.style.display = 'none';
  bBroker.addEventListener('click', function () {
    var c = MQ.getConfig();
    var body = document.createElement('div');
    body.innerHTML =
      '<p class="m-hint">Le dashboard utilise <b>un seul broker</b> pour tous les composants. Le navigateur se connecte en <b>MQTT sur WebSocket</b> (port 9001 par défaut avec Mosquitto).</p>' +
      '<label>Adresse du broker</label><input id="br-url" type="text" placeholder="ws://192.168.137.1:9001">' +
      '<label>Utilisateur (optionnel)</label><input id="br-user" type="text" autocomplete="off">' +
      '<label>Mot de passe (optionnel)</label><input id="br-pass" type="password" autocomplete="off">' +
      '<p class="m-hint">Valeur par défaut définie par le formateur dans <code>js/config.js</code>.</p>';
    body.querySelector('#br-url').value = c.url;
    body.querySelector('#br-user').value = c.username || '';
    body.querySelector('#br-pass').value = c.password || '';
    modal('⚙️ Broker MQTT', body, [
      { label: 'Valeur par défaut', fn: function () { MQ.resetConfig(); MQ.connect(); E.toast('Broker par défaut rétabli'); } },
      { label: 'Annuler' },
      { label: 'Enregistrer & connecter', cls: 'primary', fn: function () {
        var url = body.querySelector('#br-url').value.trim();
        if (!/^wss?:\/\//i.test(url)) { E.toast('L\'adresse doit commencer par ws:// ou wss://'); return false; }
        MQ.saveConfig({ url: url, username: body.querySelector('#br-user').value.trim(), password: body.querySelector('#br-pass').value });
        MQ.connect(); E.toast('Connexion à ' + url + '…');
      } }
    ]);
  });

  /* ---------- statut de connexion ---------- */
  var conn = $('#conn'), connText = $('#conn-text');
  var LABELS = { connected: 'Connecté', connecting: 'Connexion…', disconnected: 'Déconnecté', error: 'Erreur' };
  MQ.onStatus(function (s, detail) {
    conn.className = 'conn ' + s;
    connText.textContent = LABELS[s] + (detail && s !== 'error' ? ' · ' + detail.replace(/^wss?:\/\//, '') : '');
    conn.title = s === 'error' ? detail + '\nVérifiez que Mosquitto a un listener WebSocket (port 9001) et que l\'adresse est correcte.' : (detail || '');
    if (s === 'connected') E.updateSubscriptions();
  });
  conn.addEventListener('click', function () { if (!CFG.lockBroker) bBroker.click(); });

  /* ---------- mode démo ---------- */
  var demoTimer = null, bDemo = $('#btn-demo'), sim = {};
  function buildPayload(w, topic, filterIsStatic) {
    var p = w.props, v;
    if (w.type === 'led' || w.type === 'switch') {
      if (w.type === 'switch') return Math.random() > 0.5 ? p.onPayload : p.offPayload;
      v = Math.random() > 0.5 ? '1' : '0';
    } else {
      var lo = parseFloat(p.min), hi = parseFloat(p.max);
      if (!Number.isFinite(lo)) lo = 0;
      if (!Number.isFinite(hi) || hi <= lo) hi = lo + 100;
      var k = w.id + topic;
      var cur = sim[k] == null ? lo + (hi - lo) * (0.3 + Math.random() * 0.4) : sim[k];
      cur += (Math.random() - 0.5) * (hi - lo) * 0.12;
      cur = Math.max(lo, Math.min(hi, cur));
      sim[k] = cur; v = cur.toFixed(1);
    }
    if (p.jsonKey) {
      var o = {}, parts = String(p.jsonKey).split('.'), ref = o;
      parts.forEach(function (key, i) { if (i === parts.length - 1) ref[key] = Number.isNaN(Number(v)) ? v : Number(v); else { ref[key] = {}; ref = ref[key]; } });
      return JSON.stringify(o);
    }
    return v;
  }
  function tickDemo() {
    E.state.widgets.forEach(function (w) {
      W.listen(w).forEach(function (t) {
        if (/[+#]/.test(t)) return;
        E.dispatch(t, buildPayload(w, t), { sim: true });
      });
    });
  }
  bDemo.addEventListener('click', function () {
    E.demo = !E.demo;
    document.body.classList.toggle('demo', E.demo);
    bDemo.classList.toggle('active', E.demo);
    clearInterval(demoTimer);
    if (E.demo) { tickDemo(); demoTimer = setInterval(tickDemo, 1000); E.toast('Mode démo : données simulées (aucun message n\'est envoyé au broker)'); }
    else E.toast('Mode démo désactivé');
  });

  /* ---------- connexion ---------- */
  MQ.connect();
})();
