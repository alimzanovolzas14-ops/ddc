#!/usr/bin/env bash
#
# Установщик портала ЦЦР «в одну команду» для чистого Ubuntu 22.04/24.04.
# Ставит Node.js, PostgreSQL, настраивает базу, автозапуск (systemd) и Nginx.
# После него сайт работает постоянно и открывается по адресу сервера.
#
# Запуск (из распакованного архива, где лежат папки DDC_site и backend):
#     sudo bash backend/deploy/install.sh
#
# С доменом и HTTPS (Let's Encrypt):
#     sudo DOMAIN=portal.example.kz LETSENCRYPT_EMAIL=you@example.kz bash backend/deploy/install.sh
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Запустите через sudo: sudo bash $0"; exit 1; fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"   # тут должны быть DDC_site и backend
APP_DIR=/opt/ddc-portal
ENV_FILE=/etc/ddc-portal.env
DOMAIN="${DOMAIN:-}"
EMAIL="${LETSENCRYPT_EMAIL:-}"

if [ ! -d "$PROJECT_DIR/DDC_site" ] || [ ! -d "$PROJECT_DIR/backend" ]; then
  echo "Не найдены папки DDC_site и backend рядом со скриптом."
  echo "Запускайте из распакованного архива: sudo bash backend/deploy/install.sh"
  exit 1
fi

say() { echo -e "\n=== $* ==="; }

say "1/8 Обновление системы"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y

say "2/8 Node.js 20 LTS"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

say "3/8 PostgreSQL"
apt-get install -y postgresql
systemctl enable --now postgresql

say "4/8 Служебный пользователь и файлы приложения"
id ddc >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin ddc
mkdir -p "$APP_DIR"
cp -r "$PROJECT_DIR/DDC_site" "$PROJECT_DIR/backend" "$APP_DIR/"
( cd "$APP_DIR/backend" && npm install --omit=dev )

say "5/8 База данных и настройки"
if [ -f "$ENV_FILE" ]; then
  echo "Файл $ENV_FILE уже есть — использую его (данные и пароли сохраняю)."
else
  DB_PASS="$(openssl rand -hex 16)"
  SECRET="$(openssl rand -hex 32)"
  # создать пользователя и базу, если их ещё нет; пароль выставить в любом случае
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='ddc'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE ROLE ddc LOGIN"
  sudo -u postgres psql -c "ALTER ROLE ddc WITH PASSWORD '${DB_PASS}'"
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='ddc'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE ddc OWNER ddc"
  cat > "$ENV_FILE" <<EOF
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgres://ddc:${DB_PASS}@localhost:5432/ddc
DDC_SECRET=${SECRET}
SITE_DIR=${APP_DIR}/DDC_site
EOF
  chown root:ddc "$ENV_FILE"; chmod 640 "$ENV_FILE"
  echo "Создан $ENV_FILE (пароль БД и секрет сгенерированы автоматически)."
fi

say "6/8 Фронтенд подключаю к бэкенду (config.js)"
sed -i "s|window.DDC_BACKEND = '[^']*';|window.DDC_BACKEND = 'auto';|" "$APP_DIR/DDC_site/config.js" || true
chown -R ddc:ddc "$APP_DIR"

say "7/8 Автозапуск (systemd)"
cp "$APP_DIR/backend/deploy/ddc-portal.service" /etc/systemd/system/ddc-portal.service
systemctl daemon-reload
systemctl enable --now ddc-portal
sleep 2
systemctl --no-pager --full status ddc-portal | head -n 6 || true
curl -fsS http://127.0.0.1:3000/api/health && echo " ← бэкенд отвечает" || echo "ВНИМАНИЕ: бэкенд не ответил, смотрите: journalctl -u ddc-portal -e"

say "8/8 Nginx (публичный доступ + WebSocket)"
apt-get install -y nginx
SERVER_NAME="${DOMAIN:-_}"
cat > /etc/nginx/sites-available/ddc-portal <<EOF
map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }
server {
    listen 80;
    server_name ${SERVER_NAME};
    client_max_body_size 5m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/ddc-portal /etc/nginx/sites-enabled/ddc-portal
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# firewall (если ufw установлен/активен)
if command -v ufw >/dev/null 2>&1; then ufw allow OpenSSH || true; ufw allow 'Nginx Full' || true; fi

# HTTPS, если задан домен и почта
if [ -n "$DOMAIN" ] && [ -n "$EMAIL" ]; then
  say "HTTPS (Let's Encrypt) для $DOMAIN"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
    echo "Certbot не смог выпустить сертификат (проверьте, что домен указывает на этот сервер)."
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo -e "\n────────────────────────────────────────────"
echo "Готово. Портал работает и запускается сам после перезагрузки."
if [ -n "$DOMAIN" ]; then echo "Адрес:  https://${DOMAIN}  (или http://${DOMAIN})"; else echo "Адрес:  http://${IP:-АДРЕС_СЕРВЕРА}"; fi
echo "Демо-входы: a.arinova/demo · admin/admin · soc/soc  (смените пароли!)"
echo "Логи:      journalctl -u ddc-portal -f"
echo "────────────────────────────────────────────"
