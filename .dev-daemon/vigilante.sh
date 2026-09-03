#!/bin/zsh
# Mantiene viva la subida hasta que NO FALTE NINGUN ARCHIVO.
#
# El bucle anterior preguntaba al cron "queda algo?" y este respondia "nada
# pendiente" porque las importaciones figuraban como terminada aunque faltaran
# miles de archivos: se dio por acabado y perdimos dos dias. Este cuenta los
# archivos que faltan de verdad; mientras falte uno, sigue.
cd "/Users/ivanballesteros/Balles Hosteleros"
LOG=.dev-daemon/vigilante.log
echo "=== vigilante arrancado $(date '+%d/%m %H:%M:%S')" >> $LOG
while true; do
  if ! pgrep -f subir-hb >/dev/null; then
    FALTAN=$(node .dev-daemon/faltan.mjs 2>/dev/null | tail -1)
    if [ "$FALTAN" = "0" ]; then
      echo "$(date '+%d/%m %H:%M:%S') COMPLETO, no falta nada" >> $LOG
      break
    fi
    echo "$(date '+%d/%m %H:%M:%S') faltan $FALTAN, relanzando subida" >> $LOG
    (PARALELO=8 nohup node .dev-daemon/subir-hb.mjs >> .dev-daemon/subida-hb-consola.log 2>&1 < /dev/null &) 
    sleep 30
  fi
  sleep 60
done
