#!/bin/zsh
# Si la bateria baja de 15% sin cargador, para la subida ordenadamente.
#
# Un apagon por bateria corta una subida a medias: el archivo queda a medio
# escribir en R2 y sin fila en `documentos`. Parando a tiempo, lo copiado
# queda consistente y al volver la corriente el vigilante sigue solo.
cd "/Users/ivanballesteros/Balles Hosteleros"
LOG=.dev-daemon/vigilante.log
while true; do
  B=$(pmset -g batt)
  PCT=$(echo "$B" | grep -o '[0-9]*%' | head -1 | tr -d '%')
  if ! echo "$B" | grep -q "AC Power"; then
    if [ "${PCT:-100}" -le 15 ]; then
      echo "$(date '+%d/%m %H:%M:%S') BATERIA $PCT% - parando subida para no corromper nada" >> $LOG
      pkill -f vigilante.sh 2>/dev/null
      pkill -f subir-local 2>/dev/null
      echo "$(date '+%d/%m %H:%M:%S') parado. Al enchufar, relanzar el vigilante." >> $LOG
      break
    fi
  fi
  sleep 120
done
