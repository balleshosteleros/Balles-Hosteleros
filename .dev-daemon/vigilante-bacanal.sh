#!/bin/bash
# Mantiene viva la migración de Marketing de BACANAL.
#
# La subida puede cortarse por un corte de red o porque el Mac se suspenda. El
# script es reanudable (salta lo ya copiado por id de Drive), así que basta con
# volver a lanzarlo mientras queden archivos por traer.
#
# Se identifica por su PID propio, no por el nombre del script: HABANA y
# BACANAL corren el mismo `subir-local.mjs` y no hay que confundirlos.
cd "/Users/ivanballesteros/Balles Hosteleros" || exit 1
PIDFILE=".dev-daemon/bacanal-marketing.pid"
while true; do
  vivo=0
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then vivo=1; fi
  if [ "$vivo" = "0" ]; then
    echo "$(date '+%H:%M:%S') vigilante: relanzando BACANAL" >> .dev-daemon/bacanal-marketing.log
    SOLO=BACANAL PARALELO=6 node .dev-daemon/subir-local.mjs >> .dev-daemon/bacanal-marketing.log 2>&1 &
    echo $! > "$PIDFILE"
  fi
  sleep 60
done
