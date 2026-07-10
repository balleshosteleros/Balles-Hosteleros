# Balles FTP Relay — Node + ffmpeg. Un solo contenedor para todos los clientes.
FROM node:20-slim

# ffmpeg para convertir .DAV (Dahua) → MP4.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

# Puerto de control FTP + rango pasivo (debe coincidir con FTP_PASV_MIN/MAX).
EXPOSE 21 30000-30009

CMD ["node", "src/index.js"]
