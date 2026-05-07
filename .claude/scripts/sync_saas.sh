#!/usr/bin/env bash
#
# sync_saas.sh — Sincroniza la lista "SAAS" de la app Recordatorios de macOS
#                con el archivo ROADMAP.md en la raíz del proyecto.
#
# Funcionalidad:
#   - Solo exporta tareas PENDIENTES (ignora completadas)
#   - Ignora tareas con título vacío o "."
#   - Incluye la descripción/notas de cada tarea
#   - Agrupa por prioridad (Alta, Media, Baja, Sin prioridad)
#
# Uso:
#   ./.claude/scripts/sync_saas.sh
#
# Requisitos:
#   - macOS con la app Recordatorios
#   - Una lista llamada "SAAS" (o cambia LIST_NAME abajo)
#   - Permiso de acceso a Recordatorios (macOS lo pedirá la primera vez)
#

set -euo pipefail

# -----------------------------
# Configuración
# -----------------------------
LIST_NAME="SAAS"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ROADMAP="${PROJECT_ROOT}/ROADMAP.md"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M')"

# -----------------------------
# Lee recordatorios vía AppleScript
# -----------------------------
# Salida: una línea por recordatorio, con 3 campos separados por TAB:
#     priority<TAB>nombre<TAB>body_con_<br>_en_vez_de_saltos
#
# Mapeo de prioridad en Recordatorios/iCal:
#     0 = ninguna, 1 = alta, 5 = media, 9 = baja
#
read_reminders() {
  osascript <<APPLESCRIPT
tell application "Reminders"
  if not (exists list "${LIST_NAME}") then
    error "LIST_NOT_FOUND"
  end if
  set output to ""
  repeat with r in (reminders of list "${LIST_NAME}" whose completed is false)
    set itemName to (name of r) as string
    -- Saltar títulos vacíos o solo "."
    if itemName is not "" and itemName is not "." then
      set itemPrio to priority of r
      -- Leer body con manejo explícito de "missing value"
      set itemBody to ""
      try
        set rawBody to body of r
        if rawBody is not missing value then
          set itemBody to rawBody as string
        end if
      on error
        set itemBody to ""
      end try
      -- Limpiar saltos/tabs del body para mantener una línea por registro
      if itemBody is not "" then
        set itemBody to my replaceAll(itemBody, return, "<br>")
        set itemBody to my replaceAll(itemBody, linefeed, "<br>")
        set itemBody to my replaceAll(itemBody, tab, "    ")
      end if
      set output to output & (itemPrio as string) & tab & itemName & tab & itemBody & linefeed
    end if
  end repeat
  return output
end tell

on replaceAll(theText, oldStr, newStr)
  set AppleScript's text item delimiters to oldStr
  set parts to every text item of theText
  set AppleScript's text item delimiters to newStr
  set resultText to parts as text
  set AppleScript's text item delimiters to ""
  return resultText
end replaceAll
APPLESCRIPT
}

# -----------------------------
# Ejecutar y capturar resultado
# -----------------------------
if ! REMINDERS=$(read_reminders 2>&1); then
  if echo "$REMINDERS" | grep -q "LIST_NOT_FOUND"; then
    echo "⚠️  No existe una lista llamada '${LIST_NAME}' en la app Recordatorios."
    echo "    Crea una con ese nombre exacto y añade alguna tarea, luego vuelve a ejecutar."
    exit 1
  fi
  echo "❌ Error leyendo Recordatorios:"
  echo "$REMINDERS"
  echo ""
  echo "ℹ️  Si es la primera vez, macOS habrá pedido permiso para acceder a Recordatorios."
  echo "    Acéptalo y vuelve a correr. Si lo rechazaste, reactívalo en:"
  echo "    Ajustes del Sistema → Privacidad y seguridad → Recordatorios"
  exit 1
fi

# -----------------------------
# Agrupar por prioridad
# -----------------------------
HIGH=""
MEDIUM=""
LOW=""
NONE=""
TOTAL=0

while IFS=$'\t' read -r prio name body; do
  [ -z "${name:-}" ] && continue
  TOTAL=$((TOTAL + 1))

  # Construir entrada markdown con la tarea principal
  entry="- **${name}**"

  # Si tiene descripción, partir por <br> y listar cada línea como sub-checklist
  if [ -n "${body:-}" ]; then
    body_lines=$(printf '%s' "$body" | sed 's|<br>|\
|g')
    while IFS= read -r line; do
      # saltar líneas vacías o solo-espacios
      trimmed=$(printf '%s' "$line" | sed 's|^ *||;s| *$||')
      [ -z "$trimmed" ] && continue
      entry="${entry}"$'\n'"  - [ ] ${trimmed}"
    done <<< "$body_lines"
  fi
  entry="${entry}"$'\n'

  case "$prio" in
    1) HIGH="${HIGH}${entry}" ;;
    5) MEDIUM="${MEDIUM}${entry}" ;;
    9) LOW="${LOW}${entry}" ;;
    *) NONE="${NONE}${entry}" ;;
  esac
done <<< "$REMINDERS"

# -----------------------------
# Escribir ROADMAP.md
# -----------------------------
{
  echo "# Roadmap — BallesHosteleros"
  echo ""
  echo "> Sincronizado automáticamente desde la lista **${LIST_NAME}** de la app Recordatorios."
  echo "> Última actualización: ${TIMESTAMP}"
  echo "> Total pendientes: ${TOTAL}"
  echo ""

  if [ "$TOTAL" -eq 0 ]; then
    echo "_Nada pendiente. Todo al día._"
  else
    if [ -n "$HIGH" ]; then
      echo "## Prioridad alta"
      echo ""
      printf '%s\n' "$HIGH"
    fi
    if [ -n "$MEDIUM" ]; then
      echo "## Prioridad media"
      echo ""
      printf '%s\n' "$MEDIUM"
    fi
    if [ -n "$LOW" ]; then
      echo "## Prioridad baja"
      echo ""
      printf '%s\n' "$LOW"
    fi
    if [ -n "$NONE" ]; then
      echo "## Sin prioridad asignada"
      echo ""
      printf '%s\n' "$NONE"
    fi
  fi
} > "${ROADMAP}"

echo "✅ ROADMAP.md actualizado"
echo "   Total pendientes: ${TOTAL}"
echo "   Archivo:          ${ROADMAP}"
