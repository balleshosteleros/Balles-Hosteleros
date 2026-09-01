#!/bin/zsh
# Escribe en el Escritorio como va la migracion. Corre cada 2 minutos.
cd "/Users/ivanballesteros/Balles Hosteleros"
OUT="$HOME/Desktop/MIGRACION-COMO-VA.txt"
while true; do
  node .dev-daemon/estado-migracion.mjs > "$OUT" 2>&1
  sleep 120
done
