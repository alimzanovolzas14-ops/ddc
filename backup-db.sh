#!/usr/bin/env bash
# Ежедневный бэкап базы портала.
# Установка в cron (от пользователя ddc):  crontab -e
#   0 3 * * * /opt/ddc-portal/backend/deploy/backup-db.sh
set -euo pipefail

# берём DATABASE_URL из env-файла сервера
if [ -f /etc/ddc-portal.env ]; then set -a; . /etc/ddc-portal.env; set +a; fi

DIR="${BACKUP_DIR:-/var/backups/ddc}"
mkdir -p "$DIR"
FILE="$DIR/ddc-$(date +%F-%H%M).sql.gz"

pg_dump "${DATABASE_URL}" | gzip > "$FILE"

# оставляем 14 последних бэкапов
ls -1t "$DIR"/ddc-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "Бэкап готов: $FILE"
