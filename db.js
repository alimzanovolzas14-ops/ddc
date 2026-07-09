'use strict';
/*
 * Выбор хранилища:
 *   • если задан DATABASE_URL → PostgreSQL (db-pg.js) — для продакшена;
 *   • иначе → встроенный JSON-файл (db-json.js) — работает из коробки.
 * Оба модуля имеют одинаковый интерфейс, поэтому server.js не меняется.
 */
module.exports = process.env.DATABASE_URL ? require('./db-pg') : require('./db-json');
