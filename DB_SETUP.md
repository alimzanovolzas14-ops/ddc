# База данных для портала: приём откликов на вакансии

Сайт статический — он не может сам хранить данные. Чтобы отклики (и обращения)
**сохранялись в базу данных**, нужен небольшой бэкенд: эндпоинт, который принимает
форму и пишет её в БД. Форма отклика уже к этому готова — нужно лишь указать адрес:

в общем JS-файле найдите строку и впишите URL вашего бэкенда:

```js
var APPLY={ endpoint:'https://ВАШ-БЭКЕНД/apply' };
```

Когда `endpoint` пустой — форма открывает почтовый клиент (mailto). Когда задан —
отклик уходит `POST`-запросом (JSON) и сохраняется в БД.

Формат отправляемых данных:
```json
{ "vacancy":"SOC Analyst L2/L3", "department":"Безопасность",
  "name":"Иван Иванов", "email":"ivan@mail.kz", "phone":"+7...",
  "cover":"текст письма", "ts":"2026-06-27T10:00:00.000Z" }
```

---

## Вариант A. Cloudflare Workers + D1 (SQLite) — рекомендуется

D1 — бесплатная база на Cloudflare. ~10 минут.

### 1. Создайте базу и таблицу
```bash
npm i -g wrangler
wrangler d1 create ddc-portal
# впишите выданный database_id в wrangler.toml (см. ниже)
wrangler d1 execute ddc-portal --command "CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vacancy TEXT, department TEXT, name TEXT, email TEXT,
  phone TEXT, cover TEXT, ts TEXT
);"
```

### 2. `wrangler.toml`
```toml
name = "ddc-portal"
main = "worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "ddc-portal"
database_id = "ВАШ_DATABASE_ID"
```

### 3. `worker.js`
```js
export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

    const a = await req.json();
    // простая валидация
    if (!a.name || !a.email || !a.cover)
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: cors });

    await env.DB.prepare(
      "INSERT INTO applications (vacancy,department,name,email,phone,cover,ts) VALUES (?,?,?,?,?,?,?)"
    ).bind(a.vacancy||"", a.department||"", a.name, a.email, a.phone||"", a.cover, a.ts||new Date().toISOString()).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", ...cors },
    });
  },
};
```

### 4. Публикация
```bash
wrangler deploy
```
Полученный адрес (`https://ddc-portal.ВАШ.workers.dev`) впишите в `APPLY.endpoint` на сайте.

### Просмотр откликов
```bash
wrangler d1 execute ddc-portal --command "SELECT * FROM applications ORDER BY id DESC;"
```

---

## Вариант B. Google Apps Script + Google Sheets — без сервера

Самый простой путь: отклики падают строками в Google-таблицу.

1. Создайте Google-таблицу с колонками: `ts, vacancy, department, name, email, phone, cover`.
2. **Расширения → Apps Script**, вставьте:
```js
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sh.appendRow([d.ts||new Date(), d.vacancy, d.department, d.name, d.email, d.phone, d.cover]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```
3. **Развернуть → Веб-приложение**, доступ «Всем», скопируйте URL и впишите в `APPLY.endpoint`.

> Примечание: Apps Script не отдаёт CORS-заголовки. Если браузер блокирует ответ,
> отправку можно делать «вслепую» (`mode:'no-cors'`) — данные сохранятся, но статус
> ответа не прочитать. Для полноценного контроля лучше Вариант A.

---

## Тот же бэкенд для формы «Связаться с нами»
Контактную форму на странице «Медиа» можно подключить так же — отправлять `POST`
на эндпоинт и хранить обращения в той же базе (таблица `messages`).

## Безопасность
- Ограничьте `Access-Control-Allow-Origin` своим доменом вместо `*`.
- Добавьте простую защиту от спама (honeypot-поле или rate-limit).
- Не храните лишних персональных данных; соблюдайте требования к их защите.

---

## Перевод портала и админки на серверную БД (синхронизация)

Портал и админка умеют работать с сервером без переписывания. Включается одной строкой —
добавьте перед подключением `portal-db.js` (в `portal.html` и `admin.html`):

```html
<script>window.DDC_API='https://ВАШ-БЭКЕНД/api';</script>
<script src="portal-db.js"></script>
```

После этого:
- при загрузке страницы данные **подтягиваются с сервера** (`GET {API}/load?table=...`),
- при любом изменении (роль, статус, новая заявка, объявление) изменения **отправляются на сервер**
  (`POST {API}/save` с телом `{ "table":"ddc_db_apps", "data":[ ... ] }`).

LocalStorage остаётся быстрым кэшем, поэтому интерфейс не «тормозит» на запросах.

### Контракт бэкенда (2 эндпоинта)
| Метод | Путь | Тело / ответ |
|------|------|--------------|
| `GET`  | `/load?table=ddc_db_users` | → `{ "data": [ ...записи... ] }` |
| `POST` | `/save` | тело `{ "table":"...", "data":[...] }` → `{ "ok": true }` |

Таблицы: `ddc_db_users`, `ddc_db_ann`, `ddc_db_apps`, `ddc_db_reqs`.

### Пример на Cloudflare Workers + D1 (хранение JSON по таблицам)
```js
export default {
  async fetch(req, env) {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);

    if (url.pathname.endsWith("/load")) {
      const t = url.searchParams.get("table");
      const row = await env.DB.prepare("SELECT data FROM kv WHERE k=?").bind(t).first();
      return json({ data: row ? JSON.parse(row.data) : [] }, cors);
    }
    if (url.pathname.endsWith("/save") && req.method === "POST") {
      const { table, data } = await req.json();
      await env.DB.prepare("INSERT INTO kv (k,data) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET data=excluded.data")
        .bind(table, JSON.stringify(data)).run();
      return json({ ok: true }, cors);
    }
    return new Response("Not found", { status: 404, headers: cors });
  },
};
function json(o, cors) { return new Response(JSON.stringify(o), { headers: { "content-type": "application/json", ...cors } }); }
```
Таблица: `CREATE TABLE kv (k TEXT PRIMARY KEY, data TEXT);`

> Это «быстрый» вариант (вся таблица одним JSON). Для продакшена лучше хранить записи
> построчно и добавить аутентификацию администратора (проверка сессии/токена на сервере).

---

## Быстрое подключение через `config.js` (новое)

Теперь все настройки бэкенда — в одном файле **`config.js`** (он подключён
в `portal.html`, `admin.html` и `careers.html` ещё до остального кода).
По умолчанию там всё пусто → сайт работает офлайн. Чтобы включить бэкенд,
впишите адреса:

```js
window.DDC_API = 'https://ВАШ-БЭКЕНД/api';        // синхронизация портала/админки
window.DDC_APPLY_ENDPOINT = 'https://ВАШ-БЭКЕНД/apply'; // приём откликов
```

Отдельно править `portal.html` / `careers.html` больше не нужно.

## Отклики на почту HR + резюме во вложении (Google Apps Script)

В папке **`backend/apps-script.gs`** лежит готовый скрипт: он принимает отклик,
пишет строку в Google-таблицу **и отправляет письмо HR с приложенным резюме**.
Шаги — внутри файла. После развёртывания URL веб-приложения впишите в
`config.js → window.DDC_APPLY_ENDPOINT`.

> Сейчас сайт при отправке отклика делает три вещи сразу: сохраняет его в
> админ-панель, отправляет на `DDC_APPLY_ENDPOINT` (если задан) и открывает
> письмо в почтовом клиенте. Так отклик доходит и до базы/почты, и до админки.

## Новая таблица мониторинга `ddc_db_audit`

При синхронизации портала с сервером добавьте к списку таблиц журнал входов:
`ddc_db_users`, `ddc_db_ann`, `ddc_db_apps`, `ddc_db_reqs`, `ddc_db_courses`, `ddc_db_audit`.
(KV-вариант на Cloudflare из примера выше поддержит её автоматически — он хранит
любые таблицы по ключу.)

## Безопасность входа (реализовано на клиенте)

- Пароли хранятся **в виде хэшей** (SHA-256 с солью), а не открытым текстом.
- После **5 неудачных попыток** вход блокируется на 5 минут.
- Поддержана **двухфакторная аутентификация**: админ включает 2FA сотруднику
  и задаёт код; при входе запрашивается второй фактор.
- Все входы/выходы/неудачные попытки пишутся в журнал мониторинга.

> Это клиентская (демо) реализация. В продакшене проверку пароля, 2FA и
> блокировки следует переносить на сервер, а хэширование — на медленный
> алгоритм (bcrypt/argon2) с индивидуальной солью.

---

## Путь A (Supabase, гибрид) — пошагово

Данные хранятся в Supabase (общая облачная БД, REST), вход остаётся собственным
(пароли — хэшами в таблице). Ставить ничего не нужно.

### 1. Создайте таблицы
Supabase → **SQL Editor → New query**, вставьте и нажмите **Run**:

```sql
-- Данные портала (пользователи, объявления, заявки сотрудников,
-- курсы, чат, прогресс обучения, журнал мониторинга) — по ключу-таблице
create table if not exists ddc_kv (
  k text primary key,
  data jsonb,
  updated_at timestamptz default now()
);

-- Отклики на вакансии — по строке на каждый отклик
create table if not exists ddc_apps (
  id bigint generated always as identity primary key,
  ts timestamptz default now(),
  vacancy text, department text, name text, email text, phone text, cover text,
  resume_name text, resume_data text, status text default 'new'
);

-- Демо-доступ для публичного (anon) ключа. На проде ограничьте политики!
alter table ddc_kv   enable row level security;
alter table ddc_apps enable row level security;
create policy "kv all"   on ddc_kv   for all to anon using (true) with check (true);
create policy "apps all" on ddc_apps for all to anon using (true) with check (true);
```

> Если вы уже создавали `ddc_apps` раньше — добавьте колонку для резюме:
> `alter table ddc_apps add column if not exists resume_data text;`

### 2. Возьмите ключи
Supabase → **Project Settings → API**: скопируйте **Project URL** и **anon public** ключ.

### 3. Впишите в `config.js`
```js
window.SUPABASE_URL = 'https://ВАШ-ПРОЕКТ.supabase.co';
window.SUPABASE_KEY = 'eyJ...';   // anon public (НЕ service_role!)
```

### 4. Откройте портал/админку
- При первом запуске демо-данные **зальются в облако** автоматически.
- Дальше любые изменения (роли, пароли, статусы, объявления, курсы, журнал входов)
  пишутся в Supabase, а при загрузке — подтягиваются обратно.
- Отклики с «Карьеры» падают в таблицу `ddc_apps` (видно в Supabase и в админке).
- localStorage остаётся быстрым кэшем — интерфейс не ждёт сеть.

### Важно про безопасность
Политики выше дают публичному ключу полный доступ — это удобно для запуска/демо,
но **на проде так нельзя**. Ограничьте: чтение/запись только нужных таблиц,
вставку откликов — да, а чтение списка сотрудников и журнала — закройте или
вынесите за Supabase Auth / Edge Function. Пароли хэшируются на клиенте (демо-уровень).
