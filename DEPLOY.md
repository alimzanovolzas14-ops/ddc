# Развёртывание портала ЦЦР на сервере (24/7, PostgreSQL, HTTPS)

Пошаговая инструкция для внутреннего сервера или VPS на **Ubuntu 22.04/24.04**.
После неё портал будет работать постоянно, сам перезапускаться после сбоев и
перезагрузок, хранить данные в PostgreSQL и открываться по обычному адресу
с замочком HTTPS.

> **Важно про данные.** Это портал Нацбанка (данные сотрудников, переписка).
> Размещение и защиту согласуйте со службой ИБ/ИТ: как правило, такие системы
> ставят на сервер внутри организации или у аттестованного казахстанского
> провайдера, а не на произвольном зарубежном облаке. Технически инструкция
> одинакова — отличается только, чья это машина.

Команды выполняются от пользователя с `sudo`. Где написано `portal.ddcnb.kz` —
подставьте свой домен или адрес сервера.

---

## Что понадобится

- Сервер Ubuntu с доступом по SSH и правами `sudo`.
- Файлы проекта из архива: папки `DDC_site` и `backend`.
- Желательно доменное имя, указывающее на IP сервера (для HTTPS). Для внутреннего
  сервера без публичного домена — см. шаг 8Б.

---

## Шаг 1. Подключиться к серверу

```bash
ssh admin@АДРЕС_СЕРВЕРА
sudo apt update && sudo apt -y upgrade
```

## Шаг 2. Установить Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
node -v      # должно показать v20.x
```

## Шаг 3. Установить PostgreSQL и создать базу

```bash
sudo apt -y install postgresql

# создаём пользователя и базу (задайте свой надёжный пароль вместо СИЛЬНЫЙ_ПАРОЛЬ)
sudo -u postgres psql <<'SQL'
CREATE USER ddc WITH PASSWORD 'СИЛЬНЫЙ_ПАРОЛЬ';
CREATE DATABASE ddc OWNER ddc;
SQL
```

Строка подключения будет такой:
`postgres://ddc:СИЛЬНЫЙ_ПАРОЛЬ@localhost:5432/ddc`
(таблицы и начальные данные сервер создаст сам при первом запуске).

## Шаг 4. Загрузить проект и установить зависимости

```bash
# служебный пользователь для сервиса
sudo useradd --system --create-home --shell /usr/sbin/nologin ddc || true

sudo mkdir -p /opt/ddc-portal
# скопируйте сюда папки DDC_site и backend (через scp, git или архив), чтобы было:
#   /opt/ddc-portal/DDC_site
#   /opt/ddc-portal/backend
# пример через scp со своего компьютера:
#   scp -r DDC_site backend admin@АДРЕС_СЕРВЕРА:/tmp/ddc && \
#   sudo cp -r /tmp/ddc/* /opt/ddc-portal/

cd /opt/ddc-portal/backend
sudo npm install --omit=dev        # ставит express, ws, pg (без dev-зависимостей)
sudo chown -R ddc:ddc /opt/ddc-portal
```

## Шаг 5. Настроить переменные окружения

```bash
sudo cp /opt/ddc-portal/backend/deploy/ddc-portal.env.example /etc/ddc-portal.env
sudo nano /etc/ddc-portal.env
```

Заполните:
- `DATABASE_URL` — строку из шага 3 (с вашим паролем);
- `DDC_SECRET` — сгенерируйте: `openssl rand -hex 32` и вставьте результат;
- `SITE_DIR` оставьте `/opt/ddc-portal/DDC_site`.

Закройте доступ к файлу с паролями:
```bash
sudo chown root:ddc /etc/ddc-portal.env
sudo chmod 640 /etc/ddc-portal.env
```

## Шаг 6. Автозапуск через systemd (сервер работает всегда)

```bash
sudo cp /opt/ddc-portal/backend/deploy/ddc-portal.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ddc-portal
sudo systemctl status ddc-portal      # должно быть active (running)
```

Теперь Node-сервер запущен, слушает `127.0.0.1:3000`, перезапускается после
сбоя и стартует сам после перезагрузки сервера. Проверка локально:
```bash
curl -s http://127.0.0.1:3000/api/health      # {"ok":true,...}
```

## Шаг 7. Nginx — публичный доступ + WebSocket

```bash
sudo apt -y install nginx
sudo cp /opt/ddc-portal/backend/deploy/nginx-ddc.conf /etc/nginx/sites-available/ddc-portal
sudo nano /etc/nginx/sites-available/ddc-portal     # заменить portal.ddcnb.kz на ваш адрес
sudo ln -s /etc/nginx/sites-available/ddc-portal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## Шаг 8. HTTPS

HTTPS обязателен: без него WebSocket (realtime-чат) в браузере не работает.
С ним фронт сам переключается на `wss://`.

**8А. Публичный домен (проще всего) — Let's Encrypt:**
```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d portal.ddcnb.kz
```
Certbot сам пропишет сертификат в конфиг и настроит автопродление.

**8Б. Внутренний сервер без публичного домена:**
Let's Encrypt не подойдёт (нужен публичный DNS). Варианты:
- получить сертификат в корпоративном центре сертификации (рекомендуется —
  тогда у сотрудников не будет предупреждений в браузере);
- либо временно самоподписанный:
  ```bash
  sudo mkdir -p /etc/nginx/ssl
  sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/ddc.key -out /etc/nginx/ssl/ddc.crt \
    -subj "/CN=portal.ddcnb.kz"
  ```
  затем в `nginx-ddc.conf` укажите пути `ssl_certificate /etc/nginx/ssl/ddc.crt;`
  и `ssl_certificate_key /etc/nginx/ssl/ddc.key;`, потом
  `sudo nginx -t && sudo systemctl reload nginx`.

## Шаг 9. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'      # 80 + 443
sudo ufw enable
```

## Шаг 10. Включить бэкенд во фронте

Так как сайт раздаёт этот же сервер, впишите в
`/opt/ddc-portal/DDC_site/config.js`:

```js
window.DDC_BACKEND = 'auto';
```

`auto` означает «тот же адрес, с которого открыт сайт» — домен хардкодить не
нужно. Перезагрузка не требуется (файл статический), но обновите страницу.

## Шаг 11. Проверка

1. Откройте `https://portal.ddcnb.kz` — должен открыться сайт с замочком.
2. Войдите в портал: `a.arinova / demo` (демо-учётка; смените пароли перед
   реальным использованием).
3. Откройте портал во втором окне под другим пользователем
   (`m.amardinov / demo`) и напишите в общий чат — сообщение должно появиться
   у первого мгновенно. Значит, PostgreSQL и WebSocket работают.

---

## Обслуживание

**Логи сервера:**
```bash
journalctl -u ddc-portal -f
```

**Перезапуск / остановка:**
```bash
sudo systemctl restart ddc-portal
sudo systemctl stop ddc-portal
```

**Обновление кода:** замените файлы в `/opt/ddc-portal`, затем
```bash
cd /opt/ddc-portal/backend && sudo npm install --omit=dev
sudo chown -R ddc:ddc /opt/ddc-portal
sudo systemctl restart ddc-portal
```

**Резервные копии базы:** скрипт `deploy/backup-db.sh` делает ежедневный дамп.
Добавьте в cron (от пользователя ddc):
```bash
sudo -u ddc crontab -e
# строка:
0 3 * * * /opt/ddc-portal/backend/deploy/backup-db.sh
```

**Сбросить данные к начальным (осторожно, удаляет всё):**
```bash
cd /opt/ddc-portal/backend
sudo -u ddc DATABASE_URL="postgres://ddc:ПАРОЛЬ@localhost:5432/ddc" npm run seed
```

---

## Чек-лист перед «боевым» запуском

- [ ] Сменить демо-пароли пользователей (`admin/admin` и т.д.).
- [ ] Задать надёжный `DDC_SECRET` (`openssl rand -hex 32`).
- [ ] Надёжный пароль у пользователя БД `ddc`.
- [ ] HTTPS от доверенного центра сертификации (не самоподписанный в проде).
- [ ] Настроены бэкапы базы и проверено восстановление.
- [ ] Размещение согласовано со службой ИБ (хранение данных внутри контура).
- [ ] Ограничение частоты запросов (rate-limit) — при публичном доступе.
