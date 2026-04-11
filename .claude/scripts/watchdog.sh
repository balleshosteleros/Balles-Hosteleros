#!/usr/bin/env bash
#
# watchdog.sh — Monitoriza cambios en la lista SAAS de Recordatorios y
#               auto-genera PRPs (Product Requirements Proposals) para
#               tareas nuevas que todavía no tienen blueprint.
#
# Flujo:
#   1. Ejecuta sync_saas.sh para refrescar ROADMAP.md desde Recordatorios
#   2. Extrae todas las tareas del ROADMAP.md
#   3. Para cada tarea que NO tenga ya un PRP creado, genera un stub
#   4. Registra todo en .claude/logs/activity.log
#
# Uso:
#   ./.claude/scripts/watchdog.sh          # ejecución manual
#   ./.claude/scripts/watchdog.sh --quiet  # sin output a stdout (para cron)
#
# Programación automática (opcional — activar a mano si lo quieres):
#   launchctl load .claude/scripts/com.ballesshosteleros.watchdog.plist
# Para pararlo:
#   launchctl unload .claude/scripts/com.ballesshosteleros.watchdog.plist
#

set -euo pipefail

# -----------------------------
# Configuración
# -----------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ROADMAP="${PROJECT_ROOT}/ROADMAP.md"
PRPS_DIR="${PROJECT_ROOT}/.claude/PRPs"
LOGS_DIR="${PROJECT_ROOT}/.claude/logs"
LOG_FILE="${LOGS_DIR}/activity.log"
SYNC_SCRIPT="${SCRIPT_DIR}/sync_saas.sh"

QUIET=0
if [ "${1:-}" = "--quiet" ]; then
  QUIET=1
fi

mkdir -p "${PRPS_DIR}" "${LOGS_DIR}"

# -----------------------------
# Utilidades
# -----------------------------
log() {
  local msg="$1"
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$msg" >> "${LOG_FILE}"
  if [ "$QUIET" -eq 0 ]; then
    printf '%s\n' "$msg"
  fi
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | LC_ALL=C sed 's/[áàäâã]/a/g; s/[éèëê]/e/g; s/[íìïî]/i/g; s/[óòöô]/o/g; s/[úùüû]/u/g; s/ñ/n/g' \
    | sed 's/[^a-z0-9]/-/g; s/-\{2,\}/-/g; s/^-//; s/-$//' \
    | cut -c1-60
}

next_prp_number() {
  local max=0
  local num num_base10
  for f in "${PRPS_DIR}"/PRP-*.md; do
    [ -f "$f" ] || continue
    num=$(basename "$f" | sed -n 's/^PRP-\([0-9][0-9]*\).*/\1/p')
    if [ -n "$num" ]; then
      # Forzar base 10 para evitar que 008/009 se interpreten como octal
      num_base10=$((10#$num))
      if [ "$num_base10" -gt "$max" ]; then
        max=$num_base10
      fi
    fi
  done
  printf '%03d' $((max + 1))
}

prp_exists_for_slug() {
  local slug="$1"
  # Busca archivos PRP-NNN-slug.md
  ls "${PRPS_DIR}"/PRP-*-"${slug}".md >/dev/null 2>&1
}

create_prp_stub() {
  local task="$1"
  local slug="$2"
  local num="$3"
  local file="${PRPS_DIR}/PRP-${num}-${slug}.md"
  local created_at
  created_at=$(date '+%Y-%m-%d %H:%M')

  cat > "${file}" <<EOF
# PRP-${num}: ${task}

**Estado:** PENDIENTE
**Creado:** ${created_at}
**Origen:** Auto-generado por watchdog.sh desde ROADMAP.md (lista "SAAS" de Recordatorios)

---

## 🎯 Objetivo

_Describe qué se quiere construir. Estado final deseado._

> TODO: rellenar

## 💡 Por qué

_Valor de negocio. Qué problema resuelve._

> TODO: rellenar

## 🔨 Qué

_Comportamiento esperado, criterios de éxito, restricciones._

> TODO: rellenar

## 📚 Contexto

_Documentación, referencias, código existente que haya que considerar._

> TODO: investigar

## 🗺️ Blueprint de Implementación

_Fases de implementación (sin subtareas granulares)._

> TODO: generar una vez aprobado el PRP

## 🧠 Aprendizajes (Self-Annealing)

_Se rellena durante/después de la ejecución con errores encontrados y soluciones._

_Aún sin implementar._

---

> 🤖 Este PRP fue auto-generado por \`watchdog.sh\`.
> Revísalo, completa los campos marcados con TODO, y cuando esté listo ejecuta
> \`/bucle-agentico\` para que yo (Claude) lo implemente fase a fase.
EOF

  log "📝 Creado PRP ${file}"
}

# -----------------------------
# Extraer tareas del ROADMAP.md
# -----------------------------
# Detecta dos formatos:
#   1. Tareas padre:     "- **Nombre de tarea**"
#   2. Sub-tareas:       "  - [ ] Nombre de tarea"
# Solo considera tareas pendientes (no las marcadas con [x]).
extract_tasks() {
  [ -f "${ROADMAP}" ] || return 0
  # Tareas padre en negrita
  grep -E '^- \*\*[^*]+\*\*' "${ROADMAP}" 2>/dev/null \
    | sed 's/^- \*\*\(.*\)\*\*.*/\1/' || true
  # Sub-tareas pendientes
  grep -E '^[[:space:]]+- \[ \] .+' "${ROADMAP}" 2>/dev/null \
    | sed 's/^[[:space:]]*- \[ \] //' || true
}

# -----------------------------
# Main
# -----------------------------
log "==================== Watchdog run ===================="

# Paso 1: Sincronizar Recordatorios → ROADMAP.md
if [ -x "${SYNC_SCRIPT}" ]; then
  log "🔄 Ejecutando sync_saas.sh..."
  if sync_out=$("${SYNC_SCRIPT}" 2>&1); then
    # Log solo las líneas con "Total" o "actualizado"
    echo "${sync_out}" | while IFS= read -r l; do
      log "   ${l}"
    done
  else
    log "❌ sync_saas.sh falló: ${sync_out}"
    log "Watchdog abortado"
    exit 1
  fi
else
  log "⚠️  ${SYNC_SCRIPT} no encontrado o no ejecutable — salto sync"
fi

# Paso 2: Extraer tareas
if [ ! -f "${ROADMAP}" ]; then
  log "⚠️  No existe ${ROADMAP} — nada que procesar"
  log "Watchdog terminado"
  exit 0
fi

tasks_raw=$(extract_tasks)

if [ -z "${tasks_raw}" ]; then
  log "ℹ️  No se encontraron tareas pendientes en ROADMAP.md"
  log "Watchdog terminado"
  exit 0
fi

# Paso 3: Generar PRPs para tareas nuevas
new_count=0
skip_count=0
total_count=0

while IFS= read -r task; do
  [ -z "${task}" ] && continue
  total_count=$((total_count + 1))

  slug=$(slugify "${task}")
  if [ -z "${slug}" ]; then
    log "⚠️  Tarea sin slug válido, ignorada: '${task}'"
    continue
  fi

  if prp_exists_for_slug "${slug}"; then
    skip_count=$((skip_count + 1))
    continue
  fi

  num=$(next_prp_number)
  create_prp_stub "${task}" "${slug}" "${num}"
  new_count=$((new_count + 1))
done <<< "${tasks_raw}"

# Paso 4: Resumen
log "📊 Resumen: ${total_count} tareas detectadas, ${new_count} PRPs nuevos, ${skip_count} ya existían"
log "Watchdog terminado"

if [ "$QUIET" -eq 0 ]; then
  echo ""
  echo "Log completo: ${LOG_FILE}"
fi
