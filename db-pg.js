'use strict';
/*
 * PostgreSQL-хранилище портала ЦЦР.
 * Тот же интерфейс, что и у db-json.js, но методы асинхронные (Promise).
 * Схема:
 *   users(id, login UNIQUE, name, dept, role, pass_hash, last_seen)
 *   items(seq SERIAL, id UNIQUE, coll, from_login, to_login, data JSONB)
 *          — по одной строке на запись любой коллекции (chat, dm, reqs …)
 *
 * Подключение: переменная окружения DATABASE_URL,
 *   напр. postgres://user:pass@localhost:5432/ddc
 */
const crypto = require('crypto');

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

let pool = null;
let _inited = false;

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    login TEXT UNIQUE NOT NULL,
    name TEXT, dept TEXT, role TEXT,
    pass_hash TEXT NOT NULL,
    last_seen BIGINT DEFAULT 0
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS items (
    seq SERIAL PRIMARY KEY,
    id TEXT UNIQUE NOT NULL,
    coll TEXT NOT NULL,
    from_login TEXT,
    to_login TEXT,
    data JSONB NOT NULL
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_items_coll ON items(coll)`);
}

function seedRows() {
  const iso = (ms) => new Date(Date.now() - ms).toISOString();
  const users = [
    { id: 'u1', login: 'admin',           name: 'Администратор',       dept: 'ИТ',                     role: 'admin',    pass: 'admin' },
    { id: 'u2', login: 'm.amardinov',     name: 'Амардинов Малик',     dept: 'Руководство',            role: 'manager',  pass: 'demo'  },
    { id: 'u3', login: 'a.arinova',       name: 'Аринова Айжан',       dept: 'Цифровая трансформация', role: 'employee', pass: 'demo'  },
    { id: 'u4', login: 'e.durmagambetov', name: 'Дурмагамбетов Ерлан', dept: 'Правление',              role: 'manager',  pass: 'demo'  },
    { id: 'u5', login: 'soc',             name: 'Оператор SOC',        dept: 'Кибербезопасность',      role: 'security', pass: 'soc'   }
  ];
  const items = [
    { coll: 'chat',          from: 'admin',     item: { id: 'm1', from: 'admin', fromName: 'Администратор', text: 'Добро пожаловать в командный чат ЦЦР!', ts: iso(3600000), rx: {} } },
    { coll: 'requests',      from: 'a.arinova', item: { id: 'r1', from: 'a.arinova', fromName: 'Аринова Айжан', type: 'Отпуск', status: 'На рассмотрении', text: 'Ежегодный отпуск 14 дней', ts: iso(86400000) } },
    { coll: 'announcements', from: 'admin',     item: { id: 'a1', from: 'admin', title: 'Плановые работы', text: 'В субботу возможны кратковременные перерывы в работе сервисов.', ts: iso(7200000) } },
    { coll: 'courses',       from: null,        item: { id: 'c1', title: 'Основы информационной безопасности', progress: 0 } }
  ];
  return { users, items };
}

async function seedIfEmpty() {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (r.rows[0].n > 0) return;
  const { users, items } = seedRows();
  for (const u of users) {
    await pool.query(
      'INSERT INTO users(id, login, name, dept, role, pass_hash, last_seen) VALUES($1,$2,$3,$4,$5,$6,0) ON CONFLICT (login) DO NOTHING',
      [u.id, u.login, u.name, u.dept, u.role, hashPassword(u.pass)]
    );
  }
  for (const it of items) {
    await pool.query(
      'INSERT INTO items(id, coll, from_login, to_login, data) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT (id) DO NOTHING',
      [it.item.id, it.coll, it.from, it.item.to || null, JSON.stringify(it.item)]
    );
  }
}

const mapUser = (r) => r && ({ id: r.id, login: r.login, name: r.name, dept: r.dept, role: r.role, passHash: r.pass_hash, lastSeen: Number(r.last_seen) || 0 });

const db = {
  COLLECTIONS,
  kind: 'postgres',
  hashPassword, verifyPassword,

  // poolOverride используется в тестах (pg-mem); иначе берём DATABASE_URL
  async init(poolOverride) {
    if (poolOverride) {
      pool = poolOverride;
    } else if (!pool) {
      const { Pool } = require('pg');
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
    }
    if (!_inited) {
      await ensureSchema();
      await seedIfEmpty();
      _inited = true;
    }
    return db;
  },

  async list(coll) {
    if (coll === 'users') {
      const r = await pool.query('SELECT * FROM users ORDER BY id');
      return r.rows.map(mapUser);
    }
    const r = await pool.query('SELECT data FROM items WHERE coll = $1 ORDER BY seq ASC', [coll]);
    return r.rows.map((x) => x.data);
  },

  // dm для конкретного пользователя (только его переписка)
  async listDMFor(login) {
    const r = await pool.query(
      "SELECT data FROM items WHERE coll = 'dm' AND (from_login = $1 OR to_login = $1) ORDER BY seq ASC",
      [login]
    );
    return r.rows.map((x) => x.data);
  },

  async userByLogin(login) {
    const r = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
    return mapUser(r.rows[0]);
  },

  async add(coll, item) {
    if (!item.id) item.id = coll[0] + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (!item.ts) item.ts = new Date().toISOString();
    await pool.query(
      'INSERT INTO items(id, coll, from_login, to_login, data) VALUES($1,$2,$3,$4,$5::jsonb)',
      [item.id, coll, item.from || null, item.to || null, JSON.stringify(item)]
    );
    return item;
  },

  async update(coll, id, patch) {
    const r = await pool.query('SELECT data FROM items WHERE id = $1 AND coll = $2', [id, coll]);
    if (!r.rows[0]) return null;
    const merged = Object.assign({}, r.rows[0].data, patch);
    await pool.query('UPDATE items SET data = $1::jsonb WHERE id = $2', [JSON.stringify(merged), id]);
    return merged;
  },

  async touchUser(login) {
    await pool.query('UPDATE users SET last_seen = $1 WHERE login = $2', [Date.now(), login]);
  },

  async createUser(u) {
    const existing = await db.userByLogin(u.login);
    if (existing) return null;
    const id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    await pool.query(
      'INSERT INTO users(id, login, name, dept, role, pass_hash, last_seen) VALUES($1,$2,$3,$4,$5,$6,0)',
      [id, u.login, u.name || u.login, u.dept || '', u.role || 'employee', hashPassword(u.password)]
    );
    return { id, login: u.login, name: u.name || u.login, dept: u.dept || '', role: u.role || 'employee', lastSeen: 0 };
  },

  async reset() {
    await pool.query('DELETE FROM items');
    await pool.query('DELETE FROM users');
    await seedIfEmpty();
  }
};

module.exports = db;
