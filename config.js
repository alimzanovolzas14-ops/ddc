/* ───────────────────────────────────────────────────────────────
   DDC — конфигурация бэкенда (необязательно)

   По умолчанию ВСЁ ПУСТО → сайт и портал работают полностью офлайн
   (данные хранятся в браузере, отклики уходят через почтовый клиент).

   Чтобы подключить НАСТОЯЩИЙ общий бэкенд (общая база для всех,
   реальная отправка писем HR, серверный мониторинг) — впишите адреса
   ниже. Готовый бэкенд и инструкция: см. DB_SETUP.md.
   ─────────────────────────────────────────────────────────────── */

// Синхронизация данных портала и админки (журнал, пользователи, заявки…)
//   GET  {DDC_API}/load?table=ddc_db_apps   → { "data":[...] }
//   POST {DDC_API}/save  { "table":"...", "data":[...] }
window.DDC_API = '';            // напр. 'https://ваш-бэкенд.workers.dev/api'

// Приём откликов на вакансии (POST JSON отклика + при желании отправка письма)
window.DDC_APPLY_ENDPOINT = ''; // напр. 'https://ваш-бэкенд.workers.dev/apply'

/* ───────── Supabase (общая облачная БД, REST) ─────────
   Заполните оба поля, чтобы данные хранились в Supabase для всех устройств.
   Где взять: панель Supabase → Project Settings → API:
     • Project URL      → SUPABASE_URL
     • anon public key  → SUPABASE_KEY   (публичный ключ, его можно держать в коде)
   ВАЖНО: вставляйте именно anon/публичный ключ, НЕ service_role (секретный).
   Перед включением выполните SQL из DB_SETUP.md (создание таблиц + политики). */
window.SUPABASE_URL = 'https://htzitobzbcjtggjltdkx.supabase.co';  // напр. 'https://abcdxyz.supabase.co'
window.SUPABASE_KEY = 'sb_publishable_R2pMn3BFE0velbtO0vT3Vw_kfGX7IJ9';  // anon public key (eyJ... или sb_publishable_...)

/* ───────── ИИ-ассистент (умные ответы на любые вопросы) ─────────
   Впишите адрес прокси (Cloudflare Worker), который хранит ваш API-ключ.
   Тогда бот отвечает на ЛЮБЫЕ вопросы (математика, теория, что угодно).
   Пусто → бот работает офлайн только по базе знаний о ЦЦР.
   Готовый прокси и инструкция: AI_SETUP.md. */
window.DDC_AI_ENDPOINT = 'https://soft-dew-90b7.alimzanovolzas14.workers.dev';  // напр. 'https://ddc-ai.ваш-акк.workers.dev'
// Модель ассистента. Провайдер определяется вашим прокси (Worker).
//   Claude:  'claude-sonnet-4-6'
//   Gemini:  'gemini-2.0-flash'  (или 'gemini-1.5-pro')
window.DDC_AI_MODEL = 'openrouter/free';  // пусто = по умолчанию 'claude-sonnet-4-6'

/* ───────── Собственный бэкенд (Node + WebSocket, realtime) ─────────
   Полноценный сервер из папки backend/: реальный вход, общий чат/ЛС,
   заявки и МГНОВЕННАЯ синхронизация между пользователями.
   Запуск:  cd backend && npm install && npm start  →  http://localhost:3000
   Затем впишите адрес сервера ниже (пусто = локальный демо-режим).           */
window.DDC_BACKEND = '';   // '' = демо · 'auto' = тот же адрес (прод) · или 'https://portal.ddcnb.kz'
