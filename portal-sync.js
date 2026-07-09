/*
 * portal-sync.js — подключает портал к реальному бэкенду.
 *
 * Как включить: в config.js задайте  window.DDC_BACKEND = 'http://localhost:3000';
 * Если переменная пустая — портал работает как раньше (демо на localStorage).
 *
 * Что делает при включённом бэкенде:
 *   • вход проверяется на сервере (реальная аутентификация);
 *   • при входе загружается состояние с сервера в локальный кеш;
 *   • новые сообщения/заявки уходят на сервер и МГНОВЕННО приходят другим
 *     пользователям через WebSocket (реальная межпользовательская синхронизация);
 *   • если сервер недоступен — тихо откатывается на локальный режим.
 */
(function () {
  'use strict';
  var BE = (window.DDC_BACKEND || '').trim();
  // 'auto' → тот же адрес, с которого открыт сайт (когда сайт раздаёт сам бэкенд)
  if (BE === 'auto') BE = (location.protocol === 'file:') ? '' : location.origin;
  BE = BE.replace(/\/+$/, '');
  if (!BE) return; // демо-режим
  var DB = window.DDCDB;
  if (!DB) return;

  var token = null;
  try { token = localStorage.getItem('ddc_token'); } catch (e) {}

  // соответствие: серверная коллекция → ключ кеша localStorage
  var SRV2KEY = {
    users: 'ddc_db_users', chat: 'ddc_db_chat', dm: 'ddc_db_dm', gm: 'ddc_db_gm',
    groups: 'ddc_db_groups', requests: 'ddc_db_reqs', announcements: 'ddc_db_ann',
    courses: 'ddc_db_courses', incidents: 'ddc_db_incidents'
  };
  // соответствие: коллекция DB.* портала → серверная коллекция (только realtime)
  var COLL2SRV = {
    chat: 'chat', dm: 'dm', gm: 'gm', groups: 'groups',
    reqs: 'requests', ann: 'announcements', incidents: 'incidents'
  };

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    return fetch(BE + path, opts).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || ('HTTP ' + r.status)); });
      return r.json();
    });
  }

  function cacheGet(key) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : []; } catch (e) { return []; } }
  function cacheSet(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {} }
  function ping(key) { try { window.dispatchEvent(new StorageEvent('storage', { key: key })); } catch (e) {} }
  function rerender() { try { if (typeof window.__ddcRender === 'function') window.__ddcRender(); } catch (e) {} }

  // записать снимок состояния сервера в локальный кеш
  function seedCache(state) {
    Object.keys(SRV2KEY).forEach(function (srv) {
      if (state[srv] != null) cacheSet(SRV2KEY[srv], state[srv]);
    });
    rerender();
  }

  // ── слияние входящих событий от сервера ──────────────────────────────────
  function upsert(srv, item) {
    var key = SRV2KEY[srv]; if (!key) return;
    var arr = cacheGet(key);
    var idx = -1;
    for (var i = 0; i < arr.length; i++) {
      if ((item.cid && arr[i].cid && arr[i].cid === item.cid) || (arr[i].id && arr[i].id === item.id)) { idx = i; break; }
    }
    if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], item);
    else arr.unshift(item);
    cacheSet(key, arr);
    ping(key);
    if (srv !== 'chat' && srv !== 'dm' && srv !== 'gm') rerender();
  }

  // ── WebSocket realtime ────────────────────────────────────────────────────
  var ws = null, wsTimer = null;
  function connectWS() {
    if (!token) return;
    try {
      var url = BE.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token);
      ws = new WebSocket(url);
      ws.onmessage = function (ev) {
        var msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type === 'add' || msg.type === 'update') upsert(msg.coll, msg.item);
      };
      ws.onclose = function () { ws = null; clearTimeout(wsTimer); wsTimer = setTimeout(connectWS, 3000); };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    } catch (e) {}
  }

  // ── обёртки записи: отправляем на сервер (сервер — источник истины) ────────
  function wrapColl(collName) {
    var srv = COLL2SRV[collName]; var c = DB[collName]; if (!srv || !c) return;
    var origAdd = c.add.bind(c), origUpd = c.update.bind(c);
    c.add = function (o) {
      o = o || {};
      o.cid = o.cid || ('c' + Date.now() + Math.random().toString(36).slice(2, 7));
      // оптимистично не пишем локально — придёт эхо от сервера и отрисуется
      api('/api/' + srv, { method: 'POST', body: JSON.stringify(o) }).catch(function () {
        // сервер недоступен → локальный фолбэк, чтобы не терять сообщение
        origAdd(o); ping(SRV2KEY[srv]); rerender();
      });
      return o;
    };
    c.update = function (id, patch) {
      origUpd(id, patch); // оптимистично применяем сразу
      api('/api/' + srv + '/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch || {}) }).catch(function () {});
    };
  }

  function enableBackend() {
    Object.keys(COLL2SRV).forEach(wrapColl);
    connectWS();
    // периодический heartbeat присутствия
    setInterval(function () { api('/api/heartbeat', { method: 'POST' }).catch(function () {}); }, 60000);
  }

  // ── перехват формы входа: авторизация на сервере ─────────────────────────
  document.addEventListener('submit', function (e) {
    if (!e.target || e.target.id !== 'loginForm') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var u = (document.getElementById('lUser') || {}).value || '';
    var p = (document.getElementById('lPass') || {}).value || '';
    var err = document.getElementById('lErr');
    u = u.trim(); p = p.trim();
    if (!u || !p) { if (err) err.textContent = 'Введите логин и пароль'; return; }
    if (err) err.textContent = 'Вход…';
    api('/api/login', { method: 'POST', body: JSON.stringify({ login: u, password: p }) })
      .then(function (res) {
        token = res.token;
        try { localStorage.setItem('ddc_token', token); } catch (e2) {}
        var sess = { login: res.user.login, name: res.user.name, role: res.user.role, id: res.user.id, dept: res.user.dept };
        try { DB.session.set(sess); } catch (e2) {}
        if (err) err.textContent = '';
        return api('/api/state').then(function (state) {
          seedCache(state);
          enableBackend();
          if (typeof window.__ddcShowApp === 'function') window.__ddcShowApp(sess);
        });
      })
      .catch(function (ex) { if (err) err.textContent = ex.message || 'Ошибка входа'; });
  }, true); // capture — раньше локального обработчика

  // ── при загрузке: если есть токен, обновляем состояние с сервера ──────────
  if (token) {
    api('/api/me').then(function () {
      return api('/api/state');
    }).then(function (state) {
      seedCache(state);
      enableBackend();
    }).catch(function () {
      // токен протух / сервер недоступен → чистим токен, остаёмся в локальном режиме
      try { localStorage.removeItem('ddc_token'); } catch (e) {}
      token = null;
    });
  }

  console.log('[portal-sync] бэкенд включён:', BE);
})();
