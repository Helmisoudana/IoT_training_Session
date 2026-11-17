/* =====================================================================
   ÉDITEUR : canvas, glisser-déposer, redimensionnement, panneau de
   propriétés, annuler/rétablir, sauvegarde automatique
   ===================================================================== */
(function (global) {
  'use strict';

  var W = global.IoTWidgets, MQ = global.MQ, CFG = global.DASHBOARD_CONFIG || {};
  var LS_KEY = 'iot-dashboard-v1';

  function $(s, r) { return (r || document).querySelector(s); }
  function uid() { return 'w' + Math.random().toString(36).slice(2, 9); }

  /* mini constructeur DOM */
  function h(tag, attrs) {
    var el = document.createElement(tag), k, v;
    attrs = attrs || {};
    for (k in attrs) {
      v = attrs[k];
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach(function (c) {
        if (c == null || c === false) return;
        el.append(c.nodeType ? c : document.createTextNode(c));
      });
    }
    return el;
  }

  var E = {
    state: null,
    selectedId: null,
    editing: true,
    runtime: {},      // données persistantes des composants (historique des graphiques…)
    inst: {},         // instances montées
    last: {},         // dernier message reçu par composant
    seen: {},         // topics détectés { topic: {raw,time} }
    history: [], hIdx: -1,
    canvas: null, stage: null, panel: null, palette: null,
    onChange: function () {}
  };

  /* ============================== ÉTAT ============================== */
  function newState() {
    return { v: 1, title: CFG.defaultTitle || 'Mon Dashboard IoT', bg: '#f4f7fb',
      grid: CFG.grid || 20, snap: true, showGrid: true, widgets: [] };
  }
  function byId(id) { return E.state.widgets.filter(function (w) { return w.id === id; })[0]; }
  E.byId = byId;

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(E.state)); } catch (e) { /* quota */ }
  }
  var commitTimer = null;
  function scheduleCommit() { clearTimeout(commitTimer); commitTimer = setTimeout(commit, 450); }
  function commit() {
    clearTimeout(commitTimer);
    var s = JSON.stringify(E.state);
    if (E.history[E.hIdx] === s) return;
    E.history = E.history.slice(0, E.hIdx + 1);
    E.history.push(s);
    if (E.history.length > 60) E.history.shift();
    E.hIdx = E.history.length - 1;
    save();
    E.onChange();
  }
  E.commit = commit;
  function restore(idx) {
    if (idx < 0 || idx >= E.history.length) return;
    E.hIdx = idx;
    E.state = JSON.parse(E.history[idx]);
    if (!byId(E.selectedId)) E.selectedId = null;
    renderAll(); save(); E.onChange();
  }
  E.undo = function () { clearTimeout(commitTimer); commit(); restore(E.hIdx - 1); };
  E.redo = function () { restore(E.hIdx + 1); };
  E.canUndo = function () { return E.hIdx > 0; };
  E.canRedo = function () { return E.hIdx < E.history.length - 1; };

  /* ============================ RENDU ============================ */
  function applySettings() {
    var s = E.state;
    E.canvas.style.setProperty('--grid', s.grid + 'px');
    E.canvas.classList.toggle('show-grid', !!s.showGrid);
    E.stage.style.background = s.bg;
    var t = $('#dash-title'); if (t && t.value !== s.title) t.value = s.title;
    document.title = s.title + ' — IoT Dashboard';
  }

  function fitCanvas() {
    var r = 0, b = 0;
    E.state.widgets.forEach(function (w) { r = Math.max(r, w.x + w.w); b = Math.max(b, w.y + w.h); });
    E.canvas.style.width = Math.max(E.stage.clientWidth, r + 300) + 'px';
    E.canvas.style.height = Math.max(E.stage.clientHeight, b + 300) + 'px';
  }
  E.fitCanvas = fitCanvas;

  function applyPos(w, el) {
    el = el || elOf(w.id);
    if (!el) return;
    el.style.left = w.x + 'px'; el.style.top = w.y + 'px';
    el.style.width = w.w + 'px'; el.style.height = w.h + 'px';
  }
  function elOf(id) { return E.canvas.querySelector('.w[data-id="' + id + '"]'); }

  function applyZ() {
    E.state.widgets.forEach(function (w, i) { var el = elOf(w.id); if (el) el.style.zIndex = i + 1; });
  }

  function chipText(w) {
    var spec = W.types[w.type];
    if (!spec || !spec.linkable) return null;
    var t = w.props.topic || w.props.stateTopic;
    return t ? { text: '🔗 ' + t, ok: true } : { text: '⚠ pas de topic', ok: false };
  }
  function updateChip(w) {
    var el = elOf(w.id); if (!el) return;
    var chip = $('.w-chip', el), c = chipText(w);
    if (!c) { chip.style.display = 'none'; return; }
    chip.style.display = ''; chip.textContent = c.text; chip.classList.toggle('unlinked', !c.ok);
  }

  var api = {
    publish: function (topic, payload, retain) {
      if (!topic) { E.toast('Ce composant n\'a pas encore de topic : cliquez dessus en mode Édition.'); return false; }
      if (E.demo) { E.toast('Mode démo : message non envoyé (' + topic + ' → ' + payload + ')'); return false; }
      var ok = MQ.publish(topic, payload, retain);
      if (!ok) E.toast('Non connecté au broker : message non envoyé.');
      return ok;
    },
    editing: function () { return E.editing; }
  };

  function mountBody(w) {
    var el = elOf(w.id), spec = W.types[w.type];
    if (!el || !spec) return;
    var old = E.inst[w.id];
    if (old && old.destroy) { try { old.destroy(); } catch (e) { /* ignore */ } }
    var body = $('.w-body', el);
    body.innerHTML = '';
    body.className = 'w-body' + (spec.bare ? ' bare' : '');
    body.style.background = spec.bare ? 'transparent' : (w.props.bg || '#fff');
    var rt = E.runtime[w.id] || (E.runtime[w.id] = {});
    var inst;
    try { inst = spec.mount(body, w, api, rt) || {}; }
    catch (e) { console.error(e); body.textContent = 'Erreur du composant : ' + e.message; inst = {}; }
    E.inst[w.id] = inst;
    if (E.last[w.id] && inst.update) {
      try { inst.update(Object.assign({}, E.last[w.id], { replay: true })); } catch (e) { console.error(e); }
    }
    updateChip(w);
  }

  function createEl(w) {
    var el = h('div', { class: 'w', 'data-id': w.id },
      h('div', { class: 'w-body' }),
      h('div', { class: 'w-shield' }),
      h('div', { class: 'w-chip' }),
      h('i', { class: 'rz rz-e', 'data-m': 'e' }),
      h('i', { class: 'rz rz-s', 'data-m': 's' }),
      h('i', { class: 'rz rz-se', 'data-m': 'se' }));
    E.canvas.append(el);
    applyPos(w, el);
    mountBody(w);
    return el;
  }

  function renderAll() {
    Object.keys(E.inst).forEach(function (id) {
      var i = E.inst[id]; if (i && i.destroy) { try { i.destroy(); } catch (e) { /* ignore */ } }
    });
    E.inst = {};
    E.canvas.innerHTML = '';
    E.state.widgets.forEach(createEl);
    applyZ(); applySettings(); fitCanvas();
    E.updateSubscriptions();
    markSelected();
    renderProps();
  }
  E.renderAll = renderAll;

  function markSelected() {
    [].forEach.call(E.canvas.querySelectorAll('.w'), function (el) {
      el.classList.toggle('selected', el.dataset.id === E.selectedId && E.editing);
    });
  }

  /* ========================== SÉLECTION / ACTIONS ========================== */
  E.select = function (id) {
    if (E.selectedId === id) return;
    E.selectedId = id; markSelected(); renderProps();
  };

  E.add = function (type, x, y) {
    var spec = W.types[type]; if (!spec) return;
    var n = E.state.widgets.length % 8;
    var g = E.state.grid;
    var w = {
      id: uid(), type: type,
      x: x != null ? x : E.stage.scrollLeft + 40 + n * g,
      y: y != null ? y : E.stage.scrollTop + 40 + n * g,
      w: spec.w, h: spec.h, props: JSON.parse(JSON.stringify(spec.props))
    };
    if (E.state.snap) { w.x = Math.round(w.x / g) * g; w.y = Math.round(w.y / g) * g; }
    w.x = Math.max(0, w.x); w.y = Math.max(0, w.y);
    if (spec.bare && type === 'shape') E.state.widgets.unshift(w); else E.state.widgets.push(w);
    createEl(w); applyZ(); fitCanvas(); commit();
    E.selectedId = null; E.select(w.id);
    E.updateSubscriptions();
    return w;
  };

  E.duplicate = function () {
    var w = byId(E.selectedId); if (!w) return;
    var c = JSON.parse(JSON.stringify(w));
    c.id = uid(); c.x += E.state.grid; c.y += E.state.grid;
    E.state.widgets.push(c);
    createEl(c); applyZ(); fitCanvas(); commit();
    E.selectedId = null; E.select(c.id);
    E.updateSubscriptions();
  };

  E.remove = function () {
    var w = byId(E.selectedId); if (!w) return;
    var i = E.inst[w.id]; if (i && i.destroy) i.destroy();
    delete E.inst[w.id]; delete E.runtime[w.id]; delete E.last[w.id];
    E.state.widgets = E.state.widgets.filter(function (x) { return x.id !== w.id; });
    var el = elOf(w.id); if (el) el.remove();
    E.selectedId = null; renderProps(); applyZ(); commit();
    E.updateSubscriptions();
  };

  E.reorder = function (dir) {
    var arr = E.state.widgets, i = arr.findIndex(function (w) { return w.id === E.selectedId; });
    if (i < 0) return;
    var w = arr.splice(i, 1)[0];
    if (dir === 'front') arr.push(w); else arr.unshift(w);
    applyZ(); commit();
  };

  E.nudge = function (dx, dy) {
    var w = byId(E.selectedId); if (!w) return;
    w.x = Math.max(0, w.x + dx); w.y = Math.max(0, w.y + dy);
    applyPos(w); syncGeom(); fitCanvas(); scheduleCommit();
  };

  E.setEditing = function (on) {
    E.editing = on;
    document.body.classList.toggle('edit', on);
    if (!on) { E.selectedId = null; }
    markSelected(); renderProps();
    setTimeout(fitCanvas, 30);
  };

  E.load = function (state) {
    E.state = Object.assign(newState(), state);
    E.state.widgets = (E.state.widgets || []).filter(function (w) { return W.types[w.type]; });
    E.runtime = {}; E.last = {}; E.selectedId = null;
    renderAll();
  };
  E.reset = function () { E.load(newState()); commit(); };
  E.newState = newState;

  /* ============================= ABONNEMENTS ============================= */
  E.updateSubscriptions = function () {
    var set = new Set();
    E.state.widgets.forEach(function (w) { W.listen(w).forEach(function (t) { set.add(t); }); });
    MQ.setWanted(Array.from(set));
  };

  /* Distribue un message à tous les composants concernés */
  E.dispatch = function (topic, raw, opts) {
    var time = Date.now();
    if (!(opts && opts.sim)) { E.seen[topic] = { raw: raw, time: time }; schedulePicker(); }
    E.state.widgets.forEach(function (w) {
      var filters = W.listen(w), f;
      for (var k = 0; k < filters.length; k++) { if (MQ.match(filters[k], topic)) { f = filters[k]; break; } }
      if (f === undefined) return;
      var ex = W.extract(raw, w.props.jsonKey);
      var info = { num: ex.num, text: ex.text, raw: raw, topic: topic, filter: f, time: time };
      E.last[w.id] = info;
      var inst = E.inst[w.id];
      if (inst && inst.update) { try { inst.update(info); } catch (e) { console.error(e); } }
    });
  };

  /* ============================ DRAG & RESIZE ============================ */
  var drag = null;

  function onDown(e) {
    if (!E.editing || e.button > 0) return;
    var el = e.target.closest('.w');
    if (!el) { E.select(null); return; }
    var w = byId(el.dataset.id); if (!w) return;
    E.select(w.id);
    var rz = e.target.closest('.rz');
    drag = { id: w.id, mode: rz ? rz.dataset.m : 'move', sx: e.clientX, sy: e.clientY,
      ox: w.x, oy: w.y, ow: w.w, oh: w.h, moved: false };
    e.preventDefault();
  }
  function onMove(e) {
    if (!drag) return;
    var w = byId(drag.id); if (!w) return;
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    var g = E.state.snap ? E.state.grid : 1;
    function sn(v) { return Math.round(v / g) * g; }
    var spec = W.types[w.type], minW = spec.bare ? 20 : 80, minH = spec.bare ? 20 : 60;
    if (drag.mode === 'move') {
      w.x = Math.max(0, sn(drag.ox + dx)); w.y = Math.max(0, sn(drag.oy + dy));
    } else {
      if (drag.mode.indexOf('e') >= 0) w.w = Math.max(minW, sn(drag.ow + dx));
      if (drag.mode.indexOf('s') >= 0) w.h = Math.max(minH, sn(drag.oh + dy));
    }
    applyPos(w); syncGeom();
  }
  function onUp() {
    if (!drag) return;
    var moved = drag.moved; drag = null;
    if (moved) { fitCanvas(); commit(); }
  }

  /* ============================ PANNEAU PROPRIÉTÉS ============================ */
  var remountTimer = null;

  /* Affiche tout de suite la dernière valeur déjà vue sur le nouveau topic */
  function prime(w) {
    var filters = W.listen(w), best = null, bestF = null;
    Object.keys(E.seen).forEach(function (t) {
      for (var k = 0; k < filters.length; k++) {
        if (MQ.match(filters[k], t) && (!best || E.seen[t].time > E.seen[best].time)) { best = t; bestF = filters[k]; }
      }
    });
    if (!best) return;
    var ex = W.extract(E.seen[best].raw, w.props.jsonKey);
    var info = { num: ex.num, text: ex.text, raw: E.seen[best].raw, topic: best, filter: bestF, time: E.seen[best].time };
    E.last[w.id] = info;
    var inst = E.inst[w.id];
    if (inst && inst.update) { try { inst.update(info); } catch (err) { console.error(err); } }
  }
  function propChanged(w, fd) {
    clearTimeout(remountTimer);
    remountTimer = setTimeout(function () {
      var relink = fd && (fd.isTopic || fd.key === 'jsonKey');
      if (relink) delete E.last[w.id];
      mountBody(w);
      if (relink) { E.updateSubscriptions(); prime(w); }
    }, 100);
    scheduleCommit();
  }

  function colorPicker(value, palName, cb) {
    var wrap = h('div', { class: 'colors' });
    var input = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff',
      oninput: function (e) { setActive(null); cb(e.target.value); } });
    function setActive(c) {
      [].forEach.call(wrap.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.c === c); });
    }
    (W.PALETTES[palName] || W.PALETTES.accent).forEach(function (c) {
      wrap.append(h('button', { type: 'button', class: 'sw-c', 'data-c': c, title: c, style: 'background:' + c,
        onclick: function () { setActive(c); input.value = c; cb(c); } }));
    });
    wrap.append(input);
    setActive(value);
    return wrap;
  }

  /* --- sélecteur de topics détectés --- */
  var pickerState = null, pickerTimer = null;
  function schedulePicker() {
    if (!pickerState || pickerTimer) return;
    pickerTimer = setTimeout(function () { pickerTimer = null; drawPicker(); }, 500);
  }
  function drawPicker() {
    if (!pickerState || !document.body.contains(pickerState.box)) { pickerState = null; return; }
    var box = pickerState.box, input = pickerState.input, multi = pickerState.multi;
    var topics = Object.keys(E.seen).sort();
    box.innerHTML = '';
    if (!topics.length) {
      box.append(h('div', { class: 'hint' }, MQ.status === 'connected'
        ? 'Aucun message reçu pour l\'instant. Démarrez votre ESP32 : ses topics apparaîtront ici.'
        : 'Pas de connexion au broker : tapez le topic à la main, ou vérifiez le bouton « Broker ».'));
      return;
    }
    topics.slice(0, 60).forEach(function (t) {
      box.append(h('button', { type: 'button', class: 'pick', onclick: function () {
        if (multi && input.value.trim()) {
          var cur = W.splitTopics(input.value);
          if (cur.indexOf(t) < 0) cur.push(t);
          input.value = cur.join(', ');
        } else input.value = t;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } }, h('b', {}, t), h('span', {}, E.seen[t].raw.slice(0, 24))));
    });
  }

  function fieldEl(w, fd) {
    var p = w.props, input, row = h('div', { class: 'fld' });
    function set(v) { p[fd.key] = v; propChanged(w, fd); }
    var label = h('label', {}, fd.label);
    switch (fd.type) {
      case 'textarea':
        input = h('textarea', { rows: 3, oninput: function (e) { set(e.target.value); } }); input.value = p[fd.key] == null ? '' : p[fd.key]; break;
      case 'number':
        input = h('input', { type: 'number', step: fd.step || 'any', min: fd.min, max: fd.max, placeholder: fd.placeholder || '',
          oninput: function (e) { set(e.target.value === '' ? '' : parseFloat(e.target.value)); } });
        input.value = p[fd.key] == null ? '' : p[fd.key]; break;
      case 'select':
        input = h('select', { onchange: function (e) { set(e.target.value); } },
          fd.options.map(function (o) { return h('option', { value: o[0] }, o[1]); }));
        input.value = p[fd.key]; break;
      case 'checkbox':
        input = h('input', { type: 'checkbox', onchange: function (e) { set(e.target.checked); } });
        input.checked = !!p[fd.key]; row.classList.add('inline'); break;
      case 'color':
        input = colorPicker(p[fd.key], fd.palette, set); break;
      default:
        input = h('input', { type: 'text', placeholder: fd.placeholder || '', list: (fd.isTopic && !fd.multi) ? 'topics-list' : null,
          autocomplete: 'off', spellcheck: 'false', oninput: function (e) { set(e.target.value); } });
        input.value = p[fd.key] == null ? '' : p[fd.key];
    }
    if (fd.type === 'checkbox') { row.append(input, label); return row; }
    row.append(label);
    if (fd.isTopic) {
      var pickBox = h('div', { class: 'picker', style: 'display:none' });
      var btn = h('button', { type: 'button', class: 'mini', onclick: function () {
        var open = pickBox.style.display === 'none';
        pickBox.style.display = open ? '' : 'none';
        if (open) { pickerState = { box: pickBox, input: input, multi: !!fd.multi }; drawPicker(); } else pickerState = null;
      } }, '📡 Choisir');
      row.append(h('div', { class: 'topic-wrap' }, input, btn), pickBox);
    } else row.append(input);
    return row;
  }

  function section(title, children) {
    if (!children.length) return null;
    return h('div', { class: 'sec' }, h('h4', {}, title), children);
  }

  function geomInput(w, key, label) {
    return h('div', { class: 'geo' }, h('label', {}, label),
      h('input', { type: 'number', id: 'pf-' + key, step: 1, value: w[key], onchange: function (e) {
        var v = parseInt(e.target.value, 10); if (!Number.isFinite(v)) return;
        w[key] = Math.max(key === 'w' || key === 'h' ? 20 : 0, v);
        applyPos(w); fitCanvas(); commit();
      } }));
  }
  function syncGeom() {
    var w = byId(E.selectedId); if (!w) return;
    ['x', 'y', 'w', 'h'].forEach(function (k) { var i = $('#pf-' + k); if (i) i.value = w[k]; });
  }

  function renderProps() {
    var P = E.panel; if (!P) return;
    pickerState = null;
    P.innerHTML = '';
    var w = byId(E.selectedId), spec = w && W.types[w.type];

    if (!w || !spec) {
      var s = E.state;
      P.append(
        h('div', { class: 'ph' }, h('span', { class: 'pi' }, '🧩'), h('div', {}, h('b', {}, 'Tableau de bord'), h('small', {}, s.widgets.length + ' composant(s)'))),
        h('div', { class: 'help' }, h('b', {}, 'Comment faire ?'), h('ol', {},
          h('li', {}, 'Glissez un composant depuis la gauche (ou cliquez dessus).'),
          h('li', {}, 'Cliquez sur le composant sur la zone de travail.'),
          h('li', {}, 'Dans ce panneau, choisissez son topic MQTT 🔗.'),
          h('li', {}, 'Cliquez sur ▶ Aperçu pour utiliser le dashboard.'))),
        h('div', { class: 'sec' }, h('h4', {}, 'Fond de la page'),
          h('div', { class: 'fld' }, colorPicker(s.bg, 'bg', function (c) { s.bg = c; applySettings(); scheduleCommit(); }))),
        h('div', { class: 'sec' }, h('h4', {}, 'Grille'),
          h('div', { class: 'fld inline' }, h('input', { type: 'checkbox', id: 'g-show', onchange: function (e) { s.showGrid = e.target.checked; applySettings(); scheduleCommit(); } }), h('label', { for: 'g-show' }, 'Afficher la grille')),
          h('div', { class: 'fld inline' }, h('input', { type: 'checkbox', id: 'g-snap', onchange: function (e) { s.snap = e.target.checked; scheduleCommit(); } }), h('label', { for: 'g-snap' }, 'Aimanter à la grille')),
          h('div', { class: 'fld' }, h('label', {}, 'Taille de la grille'), (function () {
            var sel = h('select', { onchange: function (e) { s.grid = parseInt(e.target.value, 10); applySettings(); scheduleCommit(); } },
              [10, 20, 30, 40].map(function (n) { return h('option', { value: n }, n + ' px'); }));
            sel.value = s.grid; return sel; })())),
        h('div', { class: 'help small' }, 'Raccourcis : Suppr = supprimer · Ctrl+D = dupliquer · Ctrl+Z / Ctrl+Y = annuler / rétablir · flèches = déplacer')
      );
      $('#g-show', P).checked = !!s.showGrid; $('#g-snap', P).checked = !!s.snap;
      return;
    }

    P.append(
      h('div', { class: 'ph' }, h('span', { class: 'pi' }, spec.icon), h('div', {}, h('b', {}, spec.label), h('small', {}, 'Composant sélectionné'))),
      h('div', { class: 'actions' },
        h('button', { class: 'mini', type: 'button', onclick: E.duplicate, title: 'Ctrl+D' }, '⧉ Dupliquer'),
        h('button', { class: 'mini', type: 'button', onclick: function () { E.reorder('front'); }, title: 'Mettre au premier plan' }, '⬆ Devant'),
        h('button', { class: 'mini', type: 'button', onclick: function () { E.reorder('back'); }, title: 'Mettre à l\'arrière-plan' }, '⬇ Derrière'),
        h('button', { class: 'mini danger', type: 'button', onclick: E.remove, title: 'Suppr' }, '🗑 Supprimer'))
    );

    var fields = spec.fields.slice();
    if (!spec.bare) fields.push({ key: 'bg', label: 'Fond de la carte', type: 'color', palette: 'bg' });
    var mqttF = fields.filter(function (f) { return f.section === 'mqtt'; }).map(function (f) { return fieldEl(w, f); });
    var styleF = fields.filter(function (f) { return f.section !== 'mqtt'; }).map(function (f) { return fieldEl(w, f); });

    var sm = section(spec.linkable ? '🔗 Liaison MQTT' : '', mqttF);
    if (spec.linkable) {
      // le premier champ « contenu » (titre) vient avant la liaison
      var titleF = styleF.length && spec.fields[0].key === 'title' ? styleF.shift() : null;
      if (titleF) P.append(h('div', { class: 'sec' }, titleF));
      if (sm) P.append(sm);
    }
    var ss = section('🎨 Apparence', styleF);
    if (ss) P.append(ss);
    P.append(h('div', { class: 'sec' }, h('h4', {}, '📐 Position & taille'),
      h('div', { class: 'geo-grid' }, geomInput(w, 'x', 'X'), geomInput(w, 'y', 'Y'), geomInput(w, 'w', 'Largeur'), geomInput(w, 'h', 'Hauteur'))));
  }
  E.renderProps = renderProps;

  /* ============================ PALETTE ============================ */
  function buildPalette() {
    var P = E.palette; P.innerHTML = '';
    P.append(h('div', { class: 'phint' }, 'Glissez un composant sur la zone de travail ', h('small', {}, '(ou cliquez dessus)')));
    var groups = {};
    W.order.forEach(function (t) { var g = W.types[t].group; (groups[g] = groups[g] || []).push(t); });
    Object.keys(groups).forEach(function (g) {
      P.append(h('h4', {}, g));
      var grid = h('div', { class: 'pal-grid' });
      groups[g].forEach(function (t) {
        var s = W.types[t];
        var it = h('div', { class: 'pal-item', draggable: 'true', title: s.label,
          ondragstart: function (e) { e.dataTransfer.setData('text/plain', 'widget:' + t); e.dataTransfer.effectAllowed = 'copy'; },
          onclick: function () { E.add(t); } },
          h('span', { class: 'pal-ic' }, s.icon), h('span', { class: 'pal-lb' }, s.label));
        grid.append(it);
      });
      P.append(grid);
    });
  }

  /* ============================ EXPORT / IMPORT ============================ */
  E.exportJSON = function () {
    var blob = new Blob([JSON.stringify(E.state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (E.state.title || 'dashboard').replace(/[^\w\-]+/g, '_') + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };
  E.importJSON = function (text) {
    var o = JSON.parse(text);
    if (!o || !Array.isArray(o.widgets)) throw new Error('Fichier de dashboard invalide');
    E.load(o); commit();
  };

  /* ============================ EXEMPLE ============================ */
  E.example = function () {
    var s = newState(), id = 0;
    function add(type, x, y, w, h, props) {
      var spec = W.types[type];
      s.widgets.push({ id: 'ex' + (id++), type: type, x: x, y: y, w: w || spec.w, h: h || spec.h,
        props: Object.assign(JSON.parse(JSON.stringify(spec.props)), props) });
    }
    add('shape', 0, 0, 1200, 80, { shape: 'rect', fill: '#e6efff' });
    add('text', 20, 14, 700, 56, { text: '🌡️ Station météo du labo', size: 30 });
    add('value', 20, 100, 200, 120, { title: 'Température', topic: 'lab/temperature', unit: '°C', color: '#ff9f43', alertAbove: 30 });
    add('gauge', 240, 100, 240, 170, { title: 'Humidité', topic: 'lab/humidity', unit: '%', color: '#4f8cff' });
    add('level', 500, 100, 260, 120, { title: 'Niveau de gaz', topic: 'lab/gaz', unit: 'ppm', max: 1000, color: '#34c38f', alertAbove: 700 });
    add('led', 780, 100, 150, 130, { title: 'Pompe', topic: 'lab/pompe/etat' });
    add('switch', 950, 100, 170, 120, { title: 'Commande pompe', topic: 'lab/pompe/cmd', stateTopic: 'lab/pompe/etat' });
    add('line', 20, 290, 560, 280, { title: 'Température & humidité', topic: 'lab/temperature, lab/humidity' });
    add('area', 600, 290, 520, 280, { title: 'Gaz', topic: 'lab/gaz', color: '#34c38f' });
    add('log', 20, 590, 560, 220, { title: 'Derniers messages', topic: 'lab/#' });
    add('slider', 600, 590, 300, 120, { title: 'Vitesse du ventilateur', topic: 'lab/ventilo/vitesse' });
    add('doughnut', 920, 590, 200, 220, { title: 'Humidité', topic: 'lab/humidity', unit: '%', color: '#9b7bff' });
    E.load(s); commit();
  };

  /* ============================ INIT ============================ */
  E.init = function () {
    E.canvas = $('#canvas'); E.stage = $('#stage'); E.panel = $('#props'); E.palette = $('#palette');
    E.toast = function (msg) {
      var t = $('#toast'); t.textContent = msg; t.classList.add('show');
      clearTimeout(E._tt); E._tt = setTimeout(function () { t.classList.remove('show'); }, 2800);
    };

    buildPalette();

    // glisser depuis la palette
    E.canvas.addEventListener('dragover', function (e) { if (E.editing) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    E.canvas.addEventListener('drop', function (e) {
      if (!E.editing) return;
      var d = e.dataTransfer.getData('text/plain') || '';
      if (d.indexOf('widget:') !== 0) return;
      e.preventDefault();
      var type = d.slice(7), spec = W.types[type]; if (!spec) return;
      var r = E.canvas.getBoundingClientRect();
      E.add(type, e.clientX - r.left - spec.w / 2, e.clientY - r.top - Math.min(spec.h / 2, 40));
    });

    E.canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('resize', fitCanvas);

    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? E.redo() : E.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); E.redo(); return; }
      if (typing || !E.editing || !E.selectedId) return;
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); E.duplicate(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); E.remove(); }
      else if (e.key === 'Escape') E.select(null);
      else if (e.key.indexOf('Arrow') === 0) {
        e.preventDefault();
        var s = e.shiftKey ? 1 : E.state.grid;
        E.nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0);
      }
    });

    // liste de topics détectés → <datalist>
    var dl = $('#topics-list');
    setInterval(function () {
      if (!dl) return;
      var topics = Object.keys(E.seen).sort();
      if (dl.dataset.n === String(topics.length)) return;
      dl.dataset.n = topics.length;
      dl.innerHTML = topics.map(function (t) { return '<option value="' + W.esc(t) + '"></option>'; }).join('');
    }, 1500);

    // chargement
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && Array.isArray(saved.widgets)) { E.load(saved); commit(); }
    else { E.example(); }

    MQ.onMessage(function (topic, raw) { E.dispatch(topic, raw); });
  };

  global.Editor = E;
})(window);
