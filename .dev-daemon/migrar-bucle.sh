#!/bin/zsh
# Encadena vueltas de importacion hasta terminar la migracion.
# Si el servidor se cae (memoria), lo levanta y sigue: la fecha limite manda.
cd "/Users/ivanballesteros/Balles Hosteleros"
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '"'"'"'')
URL=$(grep '^NEXT_PUBLIC_SITE_URL=' .env.local | cut -d= -f2- | tr -d '"'"'"'')
LOG=.dev-daemon/migracion.log
VACIAS=0
echo "=== bucle arrancado $(date '+%H:%M:%S')" >> $LOG
while true; do
  # El servidor tiene que estar en pie antes de pedir nada.
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 8 "$URL/" 2>/dev/null)
  if [ "$CODE" != "200" ]; then
    echo "$(date '+%H:%M:%S') servidor caido ($CODE), levantando" >> $LOG
    launchctl kickstart -k gui/501/com.balleshosteleros.localhost >/dev/null 2>&1
    for i in $(seq 1 60); do
      sleep 5
      [ "$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$URL/" 2>/dev/null)" = "200" ] && break
    done
    continue
  fi

  R=$(curl -s -m 400 -H "Authorization: Bearer $SECRET" "$URL/api/cron/archivos-importacion" 2>&1)
  echo "$(date '+%H:%M:%S') ${R:0:150}" >> $LOG

  if echo "$R" | grep -q "Nada pendiente"; then
    VACIAS=$((VACIAS+1))
    [ $VACIAS -ge 20 ] && { echo "=== sin trabajo $(date '+%H:%M:%S')" >> $LOG; break; }
    sleep 8
  else
    VACIAS=0
    sleep 2
  fi
done
