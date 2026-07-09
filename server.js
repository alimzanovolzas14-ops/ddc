'use strict';
/*
 * Реальный бэкенд портала ЦЦР.
 *   • REST API   — /api/*
 *   • Realtime   — WebSocket /ws (мгновенная доставка сообщений всем клиентам)
 *   • Статика    — раздаёт сам сайт (папка ../DDC_site), чтобы всё работало с одного адреса
 *
 * Запуск:  npm install && npm start   →  http://localhost:3000
 */
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const db = require('./db');

const PORT = process.env.PORT || 3000;
// Секрет для подписи токенов. В проде задайте через переменную окружения.
const SECRET = process.env.DDC_SECRET || crypto.randomBytes(32).toString('hex');
const SITE_DIR = process.env.SITE_DIR || path.join(__dirname, '..', 'DDC_site');

// ── токены (HMAC-подписанные, без внешних зависимостей) ─────────────────────
function sign(login) {
  const exp = Date.now() + 1000 * 60 * 60 * 12; // 12 часов
  const payload = Buffer.from(JSON.stringify({ login, exp })).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return payload + '.' + mac;
}
function verify(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [payload, mac] = token.split('.');
  const good = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (mac !== good) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data.login;
  } catch (e) { return null; }
}

const publicUser = (u) => u && ({ id: u.id, login: u.login, name: u.name, dept: u.dept, role: u.role, lastSeen: u.lastSeen || 0 });

// ── HTTP / Express ──────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1); // за Nginx — брать реальный IP клиента
app.use(express.json({ limit: '1mb' }));

// ── ограничение частоты запросов (защита от перебора пароля/злоупотреблений) ──
function rateLimit(max, windowMs) {
  const hits = new Map();
  const t = setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now > v.reset) hits.delete(k); }, windowMs);
  if (t.unref) t.unref();
  return function (req, res, next) {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'x';
    const now = Date.now();
    let e = hits.get(key);
    if (!e || now > e.reset) { e = { count: 0, reset: now + windowMs }; hits.set(key, e); }
    e.count++;
    if (e.count > max) return res.status(429).json({ error: 'Слишком много запросов, попробуйте позже' });
    next();
  };
}
const loginLimiter = rateLimit(30, 5 * 60 * 1000);   // 30 попыток входа за 5 минут с одного IP
app.use('/api', rateLimit(1200, 60 * 1000));         // общий предохранитель

// ── журнал аудита (входы и действия админа) ──
function audit(action, login, extra) {
  try {
    Promise.resolve(db.add('audit', Object.assign({ action, login: login || null, ts: new Date().toISOString() }, extra || {}))).catch(function () {});
  } catch (e) {}
}

// CORS — чтобы фронт работал и когда открыт отдельно (file:// или другой порт)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// авторизация по Bearer-токену
function touch(login) { try { Promise.resolve(db.touchUser(login)).catch(function () {}); } catch (e) {} }
async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const login = verify(h.replace(/^Bearer\s+/i, ''));
    if (!login) return res.status(401).json({ error: 'unauthorized' });
    const u = await db.userByLogin(login);
    if (!u) return res.status(401).json({ error: 'unknown user' });
    req.user = u;
    touch(login);
    next();
  } catch (e) { res.status(500).json({ error: 'server' }); }
}

app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { login, password } = req.body || {};
    const u = await db.userByLogin(String(login || '').trim());
    if (!u || !db.verifyPassword(password, u.passHash)) {
      audit('login_fail', String(login || ''), { ip: req.ip });
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    touch(u.login);
    audit('login', u.login, { ip: req.ip });
    res.json({ token: sign(u.login), user: publicUser(u) });
  } catch (e) { res.status(500).json({ error: 'server' }); }
});

// админ: создать пользователя (регистрация сотрудника)
app.post('/api/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для администратора' });
    const { login, name, dept, role, password } = req.body || {};
    if (!login || !password) return res.status(400).json({ error: 'Нужны login и password' });
    const created = await db.createUser({ login: String(login).trim(), name, dept, role, password });
    if (!created) return res.status(409).json({ error: 'Пользователь уже существует' });
    audit('user_create', req.user.login, { newUser: created.login, role: created.role, ip: req.ip });
    res.json({ user: publicUser(created) });
  } catch (e) { res.status(500).json({ error: 'server' }); }
});

// админ: журнал аудита
app.get('/api/audit', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для администратора' });
    const rows = await db.list('audit');
    res.json({ audit: rows.slice(-200).reverse() });
  } catch (e) { res.status(500).json({ error: 'server' }); }
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

// Полный снимок состояния для текущего пользователя
app.get('/api/state', auth, async (req, res) => {
  try {
    const me = req.user.login;
    const canSec = req.user.role === 'security' || req.user.role === 'admin';
    const [users, chat, gm, groups, requests, announcements, courses, incidents] = await Promise.all([
      db.list('users'), db.list('chat'), db.list('gm'), db.list('groups'),
      db.list('requests'), db.list('announcements'), db.list('courses'),
      canSec ? db.list('incidents') : Promise.resolve([])
    ]);
    let dm;
    if (typeof db.listDMFor === 'function') dm = await db.listDMFor(me);
    else dm = (await db.list('dm')).filter(m => m.from === me || m.to === me);
    res.json({ users: users.map(publicUser), chat, gm, groups, requests, announcements, courses, incidents, dm });
  } catch (e) { res.status(500).json({ error: 'server' }); }
});

const WRITABLE = new Set(['chat', 'dm', 'gm', 'groups', 'requests', 'announcements', 'courses', 'incidents']);

app.post('/api/:coll', auth, async (req, res) => {
  try {
    const coll = req.params.coll;
    if (!WRITABLE.has(coll)) return res.status(400).json({ error: 'bad collection' });
    const item = Object.assign({}, req.body || {});
    // сервер — источник истины по отправителю и времени
    item.from = req.user.login;
    item.fromName = req.user.name;
    item.ts = new Date().toISOString();
    delete item.id;
    const saved = await db.add(coll, item);
    broadcast({ type: 'add', coll, item: saved }, saved);
    res.json(saved);
  } catch (e) { res.status(500).json({ error: 'server' }); }
});

app.patch('/api/:coll/:id', auth, async (req, res) => {
  try {
    const coll = req.params.coll;
    if (!WRITABLE.has(coll)) return res.status(400).json({ error: 'bad collection' });
    const patch = Object.assign({}, req.body || {});
    delete patch.id; delete patch.from; delete patch.ts;
    const it = await db.update(coll, req.params.id, patch);
    if (!it) return res.status(404).json({ error: 'not found' });
    broadcast({ type: 'update', coll, item: it }, it);
    res.json(it);
  } catch (e) { res.status(500).json({ error: 'server' }); }
});

// heartbeat присутствия
app.post('/api/heartbeat', auth, (req, res) => { touch(req.user.login); res.json({ ok: true }); });

// health
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// статический сайт (чтобы фронт и API были на одном origin — без проблем с CORS)
app.use(express.static(SITE_DIR, { extensions: ['html'] }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(SITE_DIR, 'portal.html'), (e) => { if (e) res.status(404).end(); });
});

// ── WebSocket realtime ────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set(); // { ws, login, role }

wss.on('connection', async (ws, req) => {
  let login = null;
  try {
    const url = new URL(req.url, 'http://x');
    login = verify(url.searchParams.get('token'));
  } catch (e) {}
  if (!login) { try { ws.close(4001, 'unauthorized'); } catch (e) {} return; }
  let u = null;
  try { u = await db.userByLogin(login); } catch (e) {}
  const client = { ws, login, role: u ? u.role : 'employee' };
  clients.add(client);
  touch(login);
  try { ws.send(JSON.stringify({ type: 'hello', login })); } catch (e) {}
  ws.on('message', () => touch(login));
  ws.on('close', () => clients.delete(client));
  ws.on('error', () => clients.delete(client));
});

// доставка события заинтересованным клиентам
function broadcast(msg, item) {
  const data = JSON.stringify(msg);
  for (const c of clients) {
    if (c.ws.readyState !== 1) continue;
    // приватные сообщения — только участникам
    if (msg.coll === 'dm' && item && !(item.from === c.login || item.to === c.login)) continue;
    // инциденты ИБ — только security/admin
    if (msg.coll === 'incidents' && !(c.role === 'security' || c.role === 'admin')) continue;
    try { c.ws.send(data); } catch (e) {}
  }
}

db.init().then(function () {
  server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
    console.log('DDC backend → http://localhost:' + PORT);
    console.log('Хранилище: ' + (db.kind === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : 'JSON-файл (data/db.json)'));
    console.log('Сайт раздаётся из: ' + SITE_DIR);
    console.log('Демо-входы: admin/admin · a.arinova/demo · m.amardinov/demo · soc/soc');
  });
}).catch(function (e) {
  console.error('Ошибка инициализации хранилища:', e.message);
  process.exit(1);
});
