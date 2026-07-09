'use strict';
/*
 * Простой встроенный «движок БД» на JSON-файле.
 * Никаких нативных модулей — работает где угодно, где есть Node 18+.
 * Данные хранятся в data/db.json и переживают перезапуск сервера.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const COLLECTIONS = ['users', 'chat', 'dm', 'gm', 'groups', 'requests', 'announcements', 'courses', 'incidents'];

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const dk = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return 'scrypt$' + salt + '$' + dk;
}
function verifyPassword(pw, stored) {
  try {
    const [algo, salt, dk] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const test = crypto.scryptSync(String(pw), salt, 32).toString('hex');
    const a = Buffer.from(dk, 'hex'), b = Buffer.from(test, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

function seed() {
  const iso = (ms) => new Date(Date.now() - ms).toISOString();
  const users = [
    { id: 'u1', login: 'admin',           name: 'Администратор',        dept: 'ИТ',                     role: 'admin',    pass: 'admin' },
    { id: 'u2', login: 'm.amardinov',     name: 'Амардинов Малик',      dept: 'Руководство',            role: 'manager',  pass: 'demo'  },
    { id: 'u3', login: 'a.arinova',       name: 'Аринова Айжан',        dept: 'Цифровая трансформация', role: 'employee', pass: 'demo'  },
    { id: 'u4', login: 'e.durmagambetov', name: 'Дурмагамбетов Ерлан',  dept: 'Правление',              role: 'manager',  pass: 'demo'  },
    { id: 'u5', login: 'soc',             name: 'Оператор SOC',         dept: 'Кибербезопасность',      role: 'security', pass: 'soc'   }
  ].map(u => ({ id: u.id, login: u.login, name: u.name, dept: u.dept, role: u.role, passHash: hashPassword(u.pass), lastSeen: 0 }));

  return {
    users,
    chat: [
      { id: 'm1', from: 'admin', fromName: 'Администратор', text: 'Добро пожаловать в командный чат ЦЦР!', ts: iso(3600000), rx: {} }
    ],
    dm: [],
    gm: [],
    groups: [],
    requests: [
      { id: 'r1', from: 'a.arinova', fromName: 'Аринова Айжан', type: 'Отпуск', status: 'На рассмотрении', text: 'Ежегодный отпуск 14 дней', ts: iso(86400000) }
    ],
    announcements: [
      { id: 'a1', from: 'admin', title: 'Плановые работы', text: 'В субботу возможны кратковременные перерывы в работе сервисов.', ts: iso(7200000) }
    ],
    courses: [
      { id: 'c1', title: 'Основы информационной безопасности', progress: 0 }
    ],
    incidents: []
  };
}

let _db = null;

function load() {
  if (_db) return _db;
  try {
    if (fs.existsSync(DB_FILE)) {
      _db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      for (const c of COLLECTIONS) if (!Array.isArray(_db[c])) _db[c] = [];
      return _db;
    }
  } catch (e) { console.error('Не удалось прочитать БД, пересоздаю:', e.message); }
  _db = seed();
  persist();
  return _db;
}

let _t = null;
function persist() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  clearTimeout(_t);
  _t = setTimeout(() => {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(_db, null, 0)); }
    catch (e) { console.error('Ошибка записи БД:', e.message); }
  }, 40);
}

function reset() { _db = seed(); if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE); persist(); return _db; }

const db = {
  COLLECTIONS,
  kind: 'json',
  init() { load(); return Promise.resolve(); },
  hashPassword, verifyPassword,
  all() { return load(); },
  list(coll) { const d = load(); return Array.isArray(d[coll]) ? d[coll] : []; },
  userByLogin(login) { return db.list('users').find(u => u.login === login) || null; },
  add(coll, item) {
    const d = load();
    if (!Array.isArray(d[coll])) d[coll] = [];
    if (!item.id) item.id = coll[0] + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (!item.ts) item.ts = new Date().toISOString();
    d[coll].push(item);
    persist();
    return item;
  },
  update(coll, id, patch) {
    const arr = db.list(coll);
    const it = arr.find(x => x.id === id);
    if (!it) return null;
    Object.assign(it, patch);
    persist();
    return it;
  },
  touchUser(login) {
    const u = db.userByLogin(login);
    if (u) { u.lastSeen = Date.now(); persist(); }
  },
  createUser(u) {
    const d = load();
    if (d.users.some((x) => x.login === u.login)) return null;
    const rec = {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      login: u.login, name: u.name || u.login, dept: u.dept || '',
      role: u.role || 'employee', passHash: hashPassword(u.password), lastSeen: 0
    };
    d.users.push(rec);
    persist();
    return rec;
  },
  reset
};

module.exports = db;
