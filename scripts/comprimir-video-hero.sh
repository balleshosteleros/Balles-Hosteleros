#!/usr/bin/env bash
# Comprime un video de fondo del hero de las webs publicas.
#
# El hero se pinta con blur(3px) + brightness(0.62), asi que mandar Full HD
# nitido es tirar bytes: el desenfoque destruye justo el detalle que cuestan
# los bits. 960px y CRF 34 se ven IGUAL que el original una vez difuminado,
# y pesan ~5 veces menos.
#
# -an          el hero va mudo, la pista de audio sobra
# -movflags    faststart: empieza a verse sin bajarlo entero
#
# Uso: ./scripts/comprimir-video-hero.sh entrada.mp4 salida.mp4
set -euo pipefail
[ $# -eq 2 ] || { echo "Uso: $0 <entrada> <salida>"; exit 1; }

ffmpeg -y -i "$1" \
  -an \
  -vf "scale=960:-2" \
  -c:v libx264 -profile:v high -preset slow -crf 34 \
  -g 50 -pix_fmt yuv420p \
  -movflags +faststart \
  "$2"

echo "Listo: $(du -h "$2" | cut -f1)"
