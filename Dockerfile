# Образ портала ЦЦР: сервер (Node) + сайт в одном контейнере.
# Разворачивается одинаково на Railway, Render, Fly.io и любом Docker-хостинге.
FROM node:20-slim

WORKDIR /app

# сначала зависимости (кэшируется)
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# затем код сервера и сайт
COPY backend/ ./backend/
COPY DDC_site/ ./DDC_site/

# фронт подключается к своему же серверу (тот же адрес)
RUN sed -i "s|window.DDC_BACKEND = '[^']*';|window.DDC_BACKEND = 'auto';|" ./DDC_site/config.js || true

ENV SITE_DIR=/app/DDC_site
ENV HOST=0.0.0.0
# PORT облачные платформы задают сами; сервер его читает.
EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
