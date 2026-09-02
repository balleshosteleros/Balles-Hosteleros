#!/bin/bash
# Reinicia una subida cuando se queda bloqueada.
#
# Los procesos se cuelgan esperando a que Google Drive descargue un vídeo que
# nunca acaba de llegar: se quedan sin conexiones a R2 y sin gastar CPU, pero
# vivos, así que el vigilante normal no los relanza. Aquí se detecta ese estado
# (nada subido en 25 min) y se reinicia; la copia es reanudable, no se pierde
# nada.
cd "/Users/ivanballesteros/Balles Hosteleros" || exit 1
declare -A ULTIMO_GB ULTIMO_T
while true; do
  LECTURA=$(node .dev-daemon/gb-subidos.mjs 2>/dev/null)
  AHORA=$(date +%s)
  for E in BACANAL BALLES; do
    GB=$(echo "$LECTURA" | grep "^$E:" | grep -oE '[0-9]+\.[0-9]+ GB' | cut -d' ' -f1)
    [ -z "$GB" ] && continue
    MIN=$(echo "$E" | tr 'A-Z' 'a-z')
    PIDFILE=".dev-daemon/${MIN}-marketing.pid"
    [ -f "$PIDFILE" ] || continue
    P=$(cat "$PIDFILE")
    kill -0 "$P" 2>/dev/null || continue
    if [ "${ULTIMO_GB[$E]}" = "$GB" ]; then
      PARADO=$(( AHORA - ${ULTIMO_T[$E]:-$AHORA} ))
      if [ "$PARADO" -gt 1500 ]; then
        echo "$(date '+%H:%M:%S') desatascador: $E lleva $((PARADO/60)) min sin subir, reiniciando" \
          >> ".dev-daemon/${MIN}-marketing.log"
        kill "$P" 2>/dev/null; sleep 3; kill -9 "$P" 2>/dev/null
        SOLO=$E PARALELO=6 nohup node .dev-daemon/subir-local.mjs >> ".dev-daemon/${MIN}-marketing.log" 2>&1 &
        echo $! > "$PIDFILE"
        ULTIMO_T[$E]=$AHORA
      fi
    else
      ULTIMO_GB[$E]=$GB
      ULTIMO_T[$E]=$AHORA
    fi
  done
  sleep 300
done
