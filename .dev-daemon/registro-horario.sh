#!/bin/zsh
# Apunta cada hora como va la subida, en el Escritorio.
cd "/Users/ivanballesteros/Balles Hosteleros"
# El histórico se guarda aquí, no en el Escritorio: el parte de
# MIGRACION-COMO-VA.txt ya lo muestra dentro, en una sola ventana.
OUT="/Users/ivanballesteros/Balles Hosteleros/.dev-daemon/migracion-por-horas.txt"
[ -f "$OUT" ] || echo "COMO VA LA SUBIDA, HORA A HORA\n" > "$OUT"
while true; do
  node .dev-daemon/linea-horaria.mjs >> "$OUT" 2>/dev/null
  sleep 3600
done
