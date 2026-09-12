#!/bin/bash
# ============================================================================
# Consultar la base de datos REAL de producción, desde el terminal.
#
# PARA QUÉ: para dejar de suponer. Antes de afirmar que algo está roto, que una
# columna existe o que una migración se aplicó, se mira. Leer el código dice lo
# que DEBERÍA pasar; esto dice lo que PASA.
#
# CÓMO SE USA:
#     bash scripts/sql-produccion.sh consulta.sql
#     bash scripts/sql-produccion.sh -c "select count(*) from productos;"
#
# DE DÓNDE SALE EL PERMISO: de `SUPABASE_ACCESS_TOKEN`, que ya está en el
# `.env.local` de cada uno. No se escribe nunca en el repositorio ni se imprime.
#
# CUIDADO: esto es PRODUCCIÓN. Para consultar (`select`) no hay riesgo ninguno.
# Para escribir, la regla de la casa es ensayarlo primero dentro de una
# transacción que se revierte:
#
#     begin;
#       ...lo que sea...
#       select ... ;          -- comprobar que ha hecho lo que se esperaba
#     rollback;               -- y no dejar nada
#
# Así se cazan los errores ANTES de tocar los datos de verdad.
# ============================================================================
set -e

cd "$(dirname "$0")/.." || exit 1

if [ -z "$1" ]; then
  echo "Uso: bash scripts/sql-produccion.sh <fichero.sql>"
  echo "     bash scripts/sql-produccion.sh -c \"select ...\""
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "No encuentro .env.local, que es donde vive el token." >&2
  exit 1
fi

TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "\r")
if [ -z "$TOKEN" ]; then
  echo "Falta SUPABASE_ACCESS_TOKEN en .env.local." >&2
  exit 1
fi

# Referencia del proyecto de Supabase (la de la URL de NEXT_PUBLIC_SUPABASE_URL).
REF=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | sed -E 's#.*//([^.]+)\..*#\1#' | tr -d '"' | tr -d "\r")
if [ -z "$REF" ]; then
  echo "No consigo deducir el proyecto de NEXT_PUBLIC_SUPABASE_URL." >&2
  exit 1
fi

# La consulta llega como fichero o como texto suelto.
if [ "$1" = "-c" ]; then
  SQL_TMP=$(mktemp)
  printf '%s' "$2" > "$SQL_TMP"
  ORIGEN="$SQL_TMP"
else
  ORIGEN="$1"
fi

# El SQL se empaqueta con node y no a mano: así las comillas y los acentos del
# castellano llegan intactos, que es donde se rompe siempre.
PAYLOAD=$(mktemp)
node -e '
const fs = require("fs");
fs.writeFileSync(process.argv[2], JSON.stringify({ query: fs.readFileSync(process.argv[1], "utf8") }));
' "$ORIGEN" "$PAYLOAD"

curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data @"$PAYLOAD"
echo

rm -f "$PAYLOAD"
[ "$1" = "-c" ] && rm -f "$SQL_TMP"
exit 0
