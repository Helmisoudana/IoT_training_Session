/* =====================================================================
   BIBLIOTHÈQUE DE COMPOSANTS
   Chaque composant = { label, icon, group, w, h, props, fields, mount() }
   Pour ajouter un composant : copier un bloc def('...', {...}) ci-dessous.
   ===================================================================== */
(function (global) {
  'use strict';

  var PALETTES = {
    accent: ['#4f8cff', '#34c38f', '#ff9f43', '#ef5b5b', '#9b7bff', '#2ec4b6', '#ff7eb6', '#8a96ad'],
    bg:     ['#ffffff', '#f1f6ff', '#eefaf4', '#fff6ea', '#fdeff0', '#f4f0ff', '#eafaf8', '#f5f6f8'],
    soft:   ['#dbe8ff', '#d6f5e6', '#ffe8cc', '#ffdcde', '#e8e0ff', '#d3f3ef', '#ffdeed', '#e4e8ef', '#ffffff']
  };

  var W = { types: {}, order: [], PALETTES: PALETTES };

  /* ---------- utilitaires ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v, d) { var n = parseFloat(v); return Number.isFinite(n) ? n : d; }
  function optNum(v) { var n = parseFloat(v); return (v === '' || v == null || !Number.isFinite(n)) ? null : n; }
  function splitTopics(s) { return String(s || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean); }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString('fr-FR'); }
  function fmt(info, dec) {
    if (Number.isFinite(info.num)) return info.num.toFixed(Math.max(0, Math.min(6, num(dec, 1))));
    return info.text || info.raw || '--';
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function levelColor(p, n) {
    var a = optNum(p.alertAbove), b = optNum(p.alertBelow);
    if (Number.isFinite(n)) {
      if (a !== null && n > a) return p.alertColor;
      if (b !== null && n < b) return p.alertColor;
    }
    return p.color;
  }

  /* Extrait une valeur d'un message : texte brut, nombre ou champ JSON */
  function extract(raw, key) {
    var v = raw;
    if (key) {
      try {
        var o = JSON.parse(raw);
        v = String(key).split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o);
      } catch (e) { v = undefined; }
    }
    if (v === undefined || v === null) return { text: '', num: NaN };
    if (typeof v === 'object') v = JSON.stringify(v);
    var text = String(v).trim();
    var n = Number(text.replace(',', '.'));
    return { text: text, num: (text !== '' && Number.isFinite(n)) ? n : NaN };
  }

  function def(type, spec) {
    spec.type = type;
    spec.linkable = spec.fields.some(function (f) { return f.isTopic; });
    W.types[type] = spec;
    W.order.push(type);
  }

  /* topics écoutés par un composant */
  W.listen = function (w) {
    var s = W.types[w.type];
    if (!s) return [];
    return s.listen ? s.listen(w.props) : splitTopics(w.props.topic);
  };
  W.extract = extract;
  W.splitTopics = splitTopics;
  W.fmtTime = fmtTime;
  W.esc = esc;

  /* ---------- fabriques de champs ---------- */
  var F = {
    title: function (def) { return { key: 'title', label: 'Titre', type: 'text' }; },
    topic: function (label, key, o) {
      return Object.assign({ key: key || 'topic', label: label || 'Topic MQTT', type: 'text', section: 'mqtt',
        isTopic: true, placeholder: 'ex : maison/salon/temperature' }, o || {});
    },
    json: function () {
      return { key: 'jsonKey', label: 'Champ JSON (optionnel)', type: 'text', section: 'mqtt',
        placeholder: 'ex : temp   (pour {"temp":23})' };
    },
    color: function (key, label, pal) { return { key: key, label: label, type: 'color', palette: pal || 'accent' }; },
    num: function (key, label, o) { return Object.assign({ key: key, label: label, type: 'number' }, o || {}); },
    txt: function (key, label, o) { return Object.assign({ key: key, label: label, type: 'text' }, o || {}); },
    chk: function (key, label, section) { return { key: key, label: label, type: 'checkbox', section: section }; },
    sel: function (key, label, options) { return { key: key, label: label, type: 'select', options: options }; }
  };
  var alertFields = [
    F.num('alertAbove', 'Alerte si valeur >', { placeholder: 'vide = pas d\'alerte' }),
    F.num('alertBelow', 'Alerte si valeur <', { placeholder: 'vide = pas d\'alerte' }),
    F.color('alertColor', 'Couleur d\'alerte')
  ];

  /* =====================================================================
     AFFICHAGE
     ===================================================================== */
  def('value', {
    label: 'Valeur', icon: '🔢', group: 'Affichage', w: 200, h: 120,
    props: { title: 'Température', topic: '', jsonKey: '', unit: '°C', decimals: 1, color: '#4f8cff',
      alertAbove: '', alertBelow: '', alertColor: '#ef5b5b', bg: '#ffffff' },
    fields: [F.title(), F.topic(), F.json(), F.txt('unit', 'Unité'), F.num('decimals', 'Décimales', { min: 0, max: 6 }),
      F.color('color', 'Couleur du chiffre')].concat(alertFields),
    mount: function (box, w) {
      var p = w.props;
      box.innerHTML = '<div class="wt">' + esc(p.title) + '</div>' +
        '<div class="wmain"><span class="wv" style="color:' + esc(p.color) + '">--</span><span class="wu">' + esc(p.unit) + '</span></div>' +
        '<div class="wsub">en attente…</div>';
      var v = box.querySelector('.wv'), sub = box.querySelector('.wsub');
      return { update: function (i) {
        v.textContent = fmt(i, p.decimals);
        v.style.color = levelColor(p, i.num);
        sub.textContent = 'màj ' + fmtTime(i.time);
      } };
    }
  });

  def('gauge', {
    label: 'Jauge', icon: '🎛️', group: 'Affichage', w: 240, h: 170,
    props: { title: 'Humidité', topic: '', jsonKey: '', unit: '%', min: 0, max: 100, decimals: 0, color: '#34c38f',
      alertAbove: '', alertBelow: '', alertColor: '#ef5b5b', bg: '#ffffff' },
    fields: [F.title(), F.topic(), F.json(), F.txt('unit', 'Unité'), F.num('min', 'Minimum'), F.num('max', 'Maximum'),
      F.num('decimals', 'Décimales', { min: 0, max: 6 }), F.color('color', 'Couleur de la jauge')].concat(alertFields),
    mount: function (box, w) {
      var p = w.props, mn = num(p.min, 0), mx = num(p.max, 100);
      var arc = 'M10 62 A50 50 0 0 1 110 62';
      box.innerHTML = '<div class="wt">' + esc(p.title) + '</div><div class="gwrap">' +
        '<svg viewBox="0 0 120 76" preserveAspectRatio="xMidYMid meet">' +
        '<path d="' + arc + '" pathLength="100" fill="none" stroke="#e9eef7" stroke-width="11" stroke-linecap="round"/>' +
        '<path class="g-fg" d="' + arc + '" pathLength="100" fill="none" stroke="' + esc(p.color) + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="0 100"/>' +
        '<text class="g-val" x="60" y="56" text-anchor="middle">--</text>' +
        '<text class="g-lim" x="10" y="74" text-anchor="middle">' + esc(mn) + '</text>' +
        '<text class="g-lim" x="110" y="74" text-anchor="middle">' + esc(mx) + '</text></svg></div>';
      var fg = box.querySelector('.g-fg'), tv = box.querySelector('.g-val');
      return { update: function (i) {
        var pct = Number.isFinite(i.num) ? clamp((i.num - mn) / ((mx - mn) || 1), 0, 1) : 0;
        fg.setAttribute('stroke-dasharray', (pct * 100) + ' 100');
        fg.setAttribute('stroke', levelColor(p, i.num));
        tv.textContent = fmt(i, p.decimals) + (p.unit && Number.isFinite(i.num) ? ' ' + p.unit : '');
      } };
    }
  });

  def('level', {
    label: 'Barre / Niveau', icon: '📊', group: 'Affichage', w: 260, h: 110,
    props: { title: 'Niveau', topic: '', jsonKey: '', unit: '%', min: 0, max: 100, decimals: 0, orientation: 'h', color: '#ff9f43',
      alertAbove: '', alertBelow: '', alertColor: '#ef5b5b', bg: '#ffffff' },
    fields: [F.title(), F.topic(), F.json(), F.txt('unit', 'Unité'), F.num('min', 'Minimum'), F.num('max', 'Maximum'),
      F.num('decimals', 'Décimales', { min: 0, max: 6 }),
      F.sel('orientation', 'Orientation', [['h', 'Horizontale'], ['v', 'Verticale (thermomètre)']]),
      F.color('color', 'Couleur de la barre')].concat(alertFields),
    mount: function (box, w) {
      var p = w.props, mn = num(p.min, 0), mx = num(p.max, 100);
      box.innerHTML = '<div class="wt">' + esc(p.title) + '</div><div class="bar ' + (p.orientation === 'v' ? 'bar-v' : 'bar-h') + '">' +
        '<div class="bar-track"><div class="bar-fill" style="background:' + esc(p.color) + '"></div></div><div class="bar-val">--</div></div>';
      var fill = box.querySelector('.bar-fill'), val = box.querySelector('.bar-val');
      return { update: function (i) {
        var pct = Number.isFinite(i.num) ? clamp((i.num - mn) / ((mx - mn) || 1), 0, 1) * 100 : 0;
        if (p.orientation === 'v') fill.style.height = pct + '%'; else fill.style.width = pct + '%';
        fill.style.background = levelColor(p, i.num);
        val.textContent = fmt(i, p.decimals) + (p.unit && Number.isFinite(i.num) ? ' ' + p.unit : '');
      } };
    }
  });

  def('led', {
    label: 'Voyant (LED)', icon: '💡', group: 'Affichage', w: 150, h: 130,
    props: { title: 'Pompe', topic: '', jsonKey: '', onValues: '1, ON, true', onAbove: '', onColor: '#34c38f', offColor: '#d5dbe6',
      onLabel: 'Actif', offLabel: 'Inactif', bg: '#ffffff' },
    fields: [F.title(), F.topic(), F.json(),
      F.txt('onValues', 'Valeurs « allumé »', { section: 'mqtt', placeholder: '1, ON, true' }),
      F.num('onAbove', 'Ou allumé si nombre >', { section: 'mqtt', placeholder: 'optionnel' }),
      F.txt('onLabel', 'Texte allumé'), F.txt('offLabel', 'Texte éteint'),
      F.color('onColor', 'Couleur allumé'), F.color('offColor', 'Couleur éteint')],
    mount: function (box, w) {
      var p = w.props;
      box.innerHTML = '<div class="wt">' + esc(p.title) + '</div><div class="wmain col"><div class="led" style="background:' + esc(p.offColor) + '"></div>' +
        '<div class="wsub led-st">' + esc(p.offLabel) + '</div></div>';
      var led = box.querySelector('.led'), st = box.querySelector('.led-st');
      return { update: function (i) {
        var list = String(p.onValues).split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
        var th = optNum(p.onAbove);
        var on = list.indexOf(String(i.text).toLowerCase()) >= 0 || (th !== null && i.num > th);
        led.style.background = on ? p.onColor : p.offColor;
        led.style.boxShadow = on ? '0 0 22px ' + p.onColor : 'none';
        st.textContent = on ? p.onLabel : p.offLabel;
      } };
    }
  });

  def('table', {
    label: 'Tableau de topics', icon: '🗂️', group: 'Affichage', w: 340, h: 220,
    props: { title: 'Mes capteurs', topic: 'lab/#', jsonKey: '', bg: '#ffffff' },
    fields: [F.title(), F.topic('Topic(s) — jokers + et # autorisés', 'topic', { multi: true, placeholder: 'ex : lab/#  ou  maison/+/temp' }), F.json()],
    mount: function (box, w, api, rt) {
      var p = w.props;
      rt.rows = rt.rows || {};
      box.innerHTML = '<div class="wt">' + esc(p.title) + '</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Topic</th><th>Valeur</th><th>Heure</th></tr></thead><tbody></tbody></table></div>';
      var tb = box.querySelector('tbody');
      function draw() {
        tb.innerHTML = Object.keys(rt.rows).sort().map(function (t) {
          var r = rt.rows[t];
          return '<tr><td>' + esc(t) + '</td><td><b>' + esc(r.text) + '</b></td><td>' + fmtTime(r.time) + '</td></tr>';
        }).join('');
      }
      draw();
      return { update: function (i) { rt.rows[i.topic] = { text: i.text || i.raw, time: i.time }; draw(); } };
    }
  });

  def('log', {
    label: 'Journal de messages', icon: '📜', group: 'Affichage', w: 340, h: 220,
    props: { title: 'Journal', topic: '#', jsonKey: '', maxLines: 40, showTopic: true, bg: '#ffffff' },
    fields: [F.title(), F.topic('Topic(s) — jokers + et # autorisés', 'topic', { multi: true, placeholder: '#  = tous les messages' }),
      F.num('maxLines', 'Nombre de lignes', { min: 5, max: 500 }), F.chk('showTopic', 'Afficher le topic')],
    mount: function (box, w, api, rt) {
      var p = w.props;
      rt.lines = rt.lines || [];
      box.innerHTML = '<div class="wt">' + esc(p.title) + '</div><div class="logbox"></div>';
      var lb = box.querySelector('.logbox');
      function draw() {
        lb.innerHTML = rt.lines.slice(0, Math.max(5, num(p.maxLines, 40))).map(function (l) {
          return '<div class="logline"><span class="lt">' + fmtTime(l.time) + '</span> ' +
            (p.showTopic ? '<span class="ltp">' + esc(l.topic) + '</span> ' : '') + '<span class="lv">' + esc(l.raw) + '</span></div>';
        }).join('');
      }
      draw();
      return { update: function (i) {
        if (i.replay) return;
        rt.lines.unshift({ time: i.time, topic: i.topic, raw: i.raw });
        rt.lines.length = Math.min(rt.lines.length, 500);
        draw();
      } };
    }
  });

  /* =====================================================================
     GRAPHIQUES  (Chart.js)
     Plusieurs topics séparés par une virgule = plusieurs courbes.
     ===================================================================== */
  function chartDef(kind, label, icon, w, h) {
    def(kind, {
      label: label, icon: icon, group: 'Graphiques', w: w, h: h,
      props: { title: label, topic: '', jsonKey: '', unit: '', color: '#4f8cff', maxPoints: 30, min: '', max: '', smooth: true, bg: '#ffffff' },
      fields: [F.title(),
        F.topic('Topic(s)', 'topic', { multi: true, placeholder: 'topic1, topic2 → plusieurs courbes' }), F.json(),
        F.txt('unit', 'Unité'), F.color('color', 'Couleur (1ère courbe)'),
        F.num('maxPoints', 'Points affichés', { min: 5, max: 500 }),
        F.num('min', kind === 'doughnut' ? 'Minimum' : 'Axe Y minimum', { placeholder: 'vide = auto' }),
        F.num('max', kind === 'doughnut' ? 'Maximum' : 'Axe Y maximum', { placeholder: 'vide = auto' })]
        .concat(kind === 'line' || kind === 'area' ? [F.chk('smooth', 'Courbe lissée')] : []),
      mount: function (box, w, api, rt) {
        var p = w.props;
        box.innerHTML = '<div class="wt">' + esc(p.title) + '</div><div class="chart-wrap"><canvas></canvas></div>';
        if (typeof Chart === 'undefined') {
          box.querySelector('.chart-wrap').innerHTML = '<div class="wsub">Chart.js introuvable (libs/chart.umd.js)</div>';
          return {};
        }
        var topics = splitTopics(p.topic), n = Math.max(1, topics.length);
        var maxP = Math.max(5, num(p.maxPoints, 30));
        var key = p.topic + '|' + p.jsonKey;
        if (rt.key !== key) { rt.key = key; rt.data = []; }
        for (var k = 0; k < n; k++) rt.data[k] = rt.data[k] || [];
        var others = PALETTES.accent.filter(function (c) { return c !== p.color; });
        var colors = []; for (k = 0; k < n; k++) colors.push(k === 0 ? p.color : others[(k - 1) % others.length]);
        var unit = p.unit ? ' ' + p.unit : '';
        var yMin = optNum(p.min), yMax = optNum(p.max);
        var tick = { color: '#8a96ad', font: { size: 11 } };
        var chart;

        if (kind === 'doughnut') {
          var lo = yMin === null ? 0 : yMin, hi = yMax === null ? 100 : yMax;
          var single = topics.length <= 1;
          var last = function (k) { var a = rt.data[k]; return a.length ? a[a.length - 1].y : 0; };
          var build = function () {
            if (single) { var v = clamp(last(0), lo, hi); return { labels: ['Valeur', 'Reste'], data: [v - lo, hi - v], colors: [colors[0], '#e9eef7'] }; }
            return { labels: topics, data: topics.map(function (t, k) { return last(k); }), colors: colors };
          };
          var b0 = build();
          chart = new Chart(box.querySelector('canvas'), {
            type: 'doughnut',
            data: { labels: b0.labels, datasets: [{ data: b0.data, backgroundColor: b0.colors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '68%',
              plugins: { legend: { display: !single, position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } } },
            plugins: [{ id: 'centerText', afterDraw: function (c) {
              if (!single) return;
              var a = c.chartArea, g = c.ctx;
              g.save(); g.fillStyle = '#27324a'; g.textAlign = 'center'; g.textBaseline = 'middle';
              g.font = '600 ' + Math.max(14, Math.min(a.width, a.height) / 6) + 'px system-ui,sans-serif';
              g.fillText(last(0).toFixed(1) + unit, (a.left + a.right) / 2, (a.top + a.bottom) / 2);
              g.restore();
            } }]
          });
          var refreshD = function () { var b = build(); chart.data.labels = b.labels; chart.data.datasets[0].data = b.data; chart.data.datasets[0].backgroundColor = b.colors; chart.update('none'); };
          return { update: function (i) { push(i); refreshD(); }, destroy: function () { chart.destroy(); } };
        }

        var timeFmt = function (v) { return new Date(v).toLocaleTimeString('fr-FR'); };
        var yScale = { grid: { color: '#eef2f8' }, ticks: tick };
        if (yMin !== null) yScale.min = yMin;
        if (yMax !== null) yScale.max = yMax;
        var common = {
          responsive: true, maintainAspectRatio: false, animation: false,
          plugins: {
            legend: { display: topics.length > 1, labels: { boxWidth: 10, usePointStyle: true } },
            tooltip: { callbacks: { label: function (c) { return (topics.length > 1 ? c.dataset.label + ': ' : '') + c.parsed.y + unit; } } }
          }
        };

        if (kind === 'bar') {
          chart = new Chart(box.querySelector('canvas'), {
            type: 'bar', data: { labels: [], datasets: [] },
            options: Object.assign({}, common, { scales: { x: { grid: { display: false }, ticks: tick }, y: yScale } })
          });
          var refreshB = function () {
            var len = Math.max.apply(null, rt.data.map(function (a) { return a.length; }));
            chart.data.labels = Array.apply(null, Array(len)).map(function (_, j) {
              for (var s = 0; s < rt.data.length; s++) if (rt.data[s][j]) return timeFmt(rt.data[s][j].x);
              return '';
            });
            chart.data.datasets = rt.data.map(function (a, s) {
              return { label: topics[s] || 'Série', data: a.map(function (pt) { return pt.y; }), backgroundColor: colors[s], borderRadius: 5 };
            });
            chart.update('none');
          };
          refreshB();
          return { update: function (i) { push(i); refreshB(); }, destroy: function () { chart.destroy(); } };
        }

        /* line / area */
        chart = new Chart(box.querySelector('canvas'), {
          type: 'line',
          data: { datasets: rt.data.map(function (a, s) {
            return { label: topics[s] || 'Série', data: a, borderColor: colors[s], backgroundColor: colors[s] + '2e',
              fill: kind === 'area', tension: 0, cubicInterpolationMode: p.smooth ? 'monotone' : 'default', pointRadius: 2, pointHoverRadius: 4, borderWidth: 2 };
          }) },
          options: Object.assign({}, common, { parsing: false, scales: {
            x: { type: 'linear', grid: { display: false },
              afterBuildTicks: function (sc) {
                var cnt = 4; sc.ticks = [];
                for (var q = 0; q <= cnt; q++) sc.ticks.push({ value: sc.min + (sc.max - sc.min) * q / cnt });
              },
              ticks: Object.assign({ callback: timeFmt, maxRotation: 0 }, tick) }, y: yScale } })
        });
        chart.options.plugins.tooltip.callbacks.title = function (it) { return timeFmt(it[0].parsed.x); };

        function push(i) {
          var idx = Math.max(0, topics.indexOf(i.filter));
          if (!Number.isFinite(i.num)) return;
          var arr = rt.data[idx] || (rt.data[idx] = []);
          if (i.replay && arr.length) return;
          arr.push({ x: i.time, y: i.num });
          while (arr.length > maxP) arr.shift();
        }
        function fitX() {
          var lo = Infinity, hi = -Infinity;
          rt.data.forEach(function (a) { if (a.length) { lo = Math.min(lo, a[0].x); hi = Math.max(hi, a[a.length - 1].x); } });
          if (lo === Infinity) return;
          if (hi - lo < 10000) { hi = lo + 10000; }
          chart.options.scales.x.min = lo; chart.options.scales.x.max = hi;
        }
        fitX(); chart.update('none');
        return { update: function (i) { push(i); fitX(); chart.update('none'); }, destroy: function () { chart.destroy(); } };

      }
    });
  }
  chartDef('line', 'Graphique courbe', '📈', 400, 250);
  chartDef('area', 'Graphique aire', '🏔️', 400, 250);
  chartDef('bar', 'Graphique barres', '📶', 400, 250);
  chartDef('doughnut', 'Graphique anneau', '🍩', 260, 260);

  /* =====================================================================
     CONTRÔLES  (publient vers le broker)
     ===================================================================== */
  def('switch', {
    label: 'Interrupteur', icon: '🔘', group: 'Contrôle', w: 170, h: 120,
    props: { title: 'Pompe', topic: '', stateTopic: '', onPayload: 'ON', offPayload: 'OFF', retain: false, bg: '#ffffff' },
    listen: function (p) { return splitTopics(p.stateTopic); },
    fields: [F.title(), F.topic('Topic de commande (publier)', 'topic'),
      F.topic('Topic d\'état (optionnel)', 'stateTopic', { placeholder: 'pour suivre l\'état réel' }),
      F.txt('onPayload', 'Message « ON »', { section: 'mqtt' }), F.txt('offPayload', 'Message « OFF »', { section: 'mqtt' }),
      F.chk('retain', 'Conserver le message (retain)', 'mqtt')],
    mount: function (box, w, api) {
      var p = w.props;
      box.innerHTML = '<div class="wt">' + esc(p.title) + '</div><div class="wmain col"><label class="sw"><input type="checkbox"><span class="sw-knob"></span></label><div class="wsub sw-st"></div></div>';
      var cb = box.querySelector('input'), st = box.querySelector('.sw-st');
      function paint() { st.textContent = cb.checked ? p.onPayload : p.offPayload; }
      paint();
      cb.addEventListener('change', function () { paint(); api.publish(p.topic, cb.checked ? p.onPayload : p.offPayload, p.retain); });
      return { update: function (i) {
        var t = String(i.text).toLowerCase();
        if (t === String(p.onPayload).toLowerCase()) { cb.checked = true; paint(); }
        else if (t === String(p.offPayload).toLowerCase()) { cb.checked = false; paint(); }
      } };
    }
  });

  def('button', {
    label: 'Bouton', icon: '👆', group: 'Contrôle', w: 170, h: 100,
    props: { title: '', label: 'Envoyer', topic: '', payload: '1', retain: false, color: '#4f8cff', bg: '#ffffff' },
    listen: function () { return []; },
    fields: [F.title(), F.topic('Topic (publier)', 'topic'), F.txt('payload', 'Message envoyé', { section: 'mqtt' }),
      F.chk('retain', 'Conserver le message (retain)', 'mqtt'), F.txt('label', 'Texte du bouton'), F.color('color', 'Couleur du bouton')],
    mount: function (box, w, api) {
      var p = w.props;
      box.innerHTML = (p.title ? '<div class="wt">' + esc(p.title) + '</div>' : '') +
        '<div class="wmain col"><button class="btn" style="background:' + esc(p.color) + '">' + esc(p.label) + '</button></div>';
      box.querySelector('.btn').addEventListener('click', function () { api.publish(p.topic, p.payload, p.retain); });
      return {};
    }
  });

  def('slider', {
    label: 'Curseur', icon: '🎚️', group: 'Contrôle', w: 260, h: 120,
    props: { title: 'Vitesse', topic: '', min: 0, max: 100, step: 1, value: 50, unit: '%', retain: false, color: '#9b7bff', bg: '#ffffff' },
    listen: function () { return []; },
    fields: [F.title(), F.topic('Topic (publier)', 'topic'), F.chk('retain', 'Conserver le message (retain)', 'mqtt'),
      F.num('min', 'Minimum'), F.num('max', 'Maximum'), F.num('step', 'Pas', { min: 0.01 }), F.txt('unit', 'Unité'),
      F.color('color', 'Couleur')],
    mount: function (box, w, api, rt) {
      var p = w.props;
      var cur = rt.value != null ? rt.value : num(p.value, 50);
      box.innerHTML = '<div class="wt">' + esc(p.title) + '</div><div class="wmain col"><div class="sl-val"><span>' + cur + '</span><small>' + esc(p.unit) + '</small></div>' +
        '<input type="range" class="sl" min="' + num(p.min, 0) + '" max="' + num(p.max, 100) + '" step="' + num(p.step, 1) + '" value="' + cur + '" style="accent-color:' + esc(p.color) + '"></div>';
      var inp = box.querySelector('.sl'), lab = box.querySelector('.sl-val span'), tm = null;
      inp.addEventListener('input', function () {
        lab.textContent = inp.value; rt.value = inp.value;
        clearTimeout(tm); tm = setTimeout(function () { api.publish(p.topic, inp.value, p.retain); }, 120);
      });
      return {};
    }
  });

  def('sender', {
    label: 'Envoi de texte', icon: '✉️', group: 'Contrôle', w: 280, h: 110,
    props: { title: 'Commande', topic: '', placeholder: 'Écrire un message…', retain: false, color: '#4f8cff', bg: '#ffffff' },
    listen: function () { return []; },
    fields: [F.title(), F.topic('Topic (publier)', 'topic'), F.chk('retain', 'Conserver le message (retain)', 'mqtt'),
      F.txt('placeholder', 'Texte d\'aide'), F.color('color', 'Couleur du bouton')],
    mount: function (box, w, api) {
      var p = w.props;
      box.innerHTML = '<div class="wt">' + esc(p.title) + '</div><div class="wmain row"><input type="text" class="snd" placeholder="' + esc(p.placeholder) + '">' +
        '<button class="btn sm" style="background:' + esc(p.color) + '">Envoyer</button></div>';
      var inp = box.querySelector('.snd');
      function send() { if (inp.value === '') return; api.publish(p.topic, inp.value, p.retain); inp.value = ''; }
      box.querySelector('.btn').addEventListener('click', send);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      return {};
    }
  });

  /* =====================================================================
     DÉCOR  (sans carte, sans topic)
     ===================================================================== */
  def('text', {
    label: 'Texte', icon: '🔤', group: 'Décor', w: 260, h: 60, bare: true,
    props: { text: 'Mon titre', size: 28, color: '#27324a', align: 'left', bold: true },
    fields: [{ key: 'text', label: 'Texte', type: 'textarea' }, F.num('size', 'Taille (px)', { min: 8, max: 200 }),
      F.color('color', 'Couleur'), F.sel('align', 'Alignement', [['left', 'Gauche'], ['center', 'Centre'], ['right', 'Droite']]),
      F.chk('bold', 'Gras')],
    mount: function (box, w) {
      var p = w.props;
      box.innerHTML = '<div class="txt" style="font-size:' + num(p.size, 28) + 'px;color:' + esc(p.color) + ';text-align:' + esc(p.align) +
        ';font-weight:' + (p.bold ? 700 : 400) + '">' + esc(p.text).replace(/\n/g, '<br>') + '</div>';
      return {};
    }
  });

  def('shape', {
    label: 'Forme', icon: '🔷', group: 'Décor', w: 160, h: 120, bare: true,
    props: { shape: 'round', fill: '#dbe8ff', stroke: '#4f8cff', strokeWidth: 0, opacity: 100, text: '', textColor: '#27324a' },
    fields: [F.sel('shape', 'Forme', [['rect', 'Rectangle'], ['round', 'Rectangle arrondi'], ['circle', 'Cercle / ellipse'],
        ['triangle', 'Triangle'], ['hline', 'Ligne horizontale'], ['vline', 'Ligne verticale']]),
      F.color('fill', 'Couleur de remplissage', 'soft'), F.color('stroke', 'Couleur du contour'),
      F.num('strokeWidth', 'Épaisseur du contour', { min: 0, max: 20 }), F.num('opacity', 'Opacité (%)', { min: 5, max: 100 }),
      F.txt('text', 'Texte dans la forme'), F.color('textColor', 'Couleur du texte')],
    mount: function (box, w) {
      var p = w.props, sw = num(p.strokeWidth, 0), op = clamp(num(p.opacity, 100), 5, 100) / 100;
      var html;
      if (p.shape === 'hline' || p.shape === 'vline') {
        var thick = Math.max(2, sw || 4);
        html = '<div class="shape-lines"><div style="background:' + esc(p.stroke) + ';opacity:' + op + ';' +
          (p.shape === 'hline' ? 'height:' + thick + 'px;width:100%' : 'width:' + thick + 'px;height:100%') + ';border-radius:99px"></div></div>';
      } else {
        var rad = p.shape === 'circle' ? '50%' : p.shape === 'round' ? '22px' : '0';
        var clip = p.shape === 'triangle' ? 'clip-path:polygon(50% 0,100% 100%,0 100%);' : '';
        html = '<div class="shape" style="background:' + esc(p.fill) + ';opacity:' + op + ';border-radius:' + rad + ';' + clip +
          'border:' + sw + 'px solid ' + esc(p.stroke) + ';color:' + esc(p.textColor) + '">' + esc(p.text) + '</div>';
      }
      box.innerHTML = html;
      return {};
    }
  });

  global.IoTWidgets = W;
})(window);
