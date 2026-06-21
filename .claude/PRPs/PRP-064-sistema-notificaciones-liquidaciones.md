# PRP-064: Sistema de notificaciones + notificación de liquidaciones

> **Estado**: IMPLEMENTADO (2026-06-21) — 7 fases. Reutiliza la tabla `notificaciones` existente (extendida). tsc/eslint OK; RLS verificada (empleado solo las suyas, gestor el registro) y trigger verificado (pagado permitido, importes bloqueados). Sin commit aún.
> **Fecha**: 2026-06-21
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Crear un **sistema de notificaciones** general del software a los empleados (distinto de los comunicados), con:
1. Una tabla canónica `notificaciones` reutilizable por cualquier módulo.
2. Un **registro** (log, solo lectura) en **Dirección → Notificaciones**.
3. Una **bandeja** en la app del empleado (campana + nº de no leídas).
4. La **liquidación** como primer emisor: al pulsar *Enviar liquidaciones* en Pagos se notifica a todos los empleados con pago guardado del mes; el empleado ve su liquidación bonita y minimalista y pulsa **LIQUIDAR** para aprobarla.
5. Ajuste **general de empresa** (en RRHH → ajustes de departamentos y en Pagos → ⚙️) que gobierna si se avisa y si se exige confirmar con LIQUIDAR.

## Por Qué

- Hoy solo hay **comunicados** (Gerencia) sin acuse, y un pop-up de confirmación de liquidación que monté de forma acoplada a Pagos (PRP-062 + columnas `confirmacion_*`). El usuario quiere algo más general y reutilizable, con su propio registro y bandeja.
- Las nóminas necesitan que el empleado **apruebe** su liquidación ("confirmar que es correcta") antes de poder marcarla como pagada, con trazabilidad.

## Qué

### Criterios de Éxito

1. Tabla `notificaciones` con RLS por empleado (empleado ve solo las suyas; gestor/director ven el registro de su empresa).
2. Dirección → submódulo **Notificaciones**: tabla con tipo, destinatario, título, estado (no leída/leída/accionada), fecha. Solo lectura. Filtrable.
3. App del empleado: **campana con círculo** cuando hay sin ver + bandeja (móvil `/m` y web) + **auto-pop-up al acceder** de las pendientes hasta pulsar Visto/LIQUIDAR. La notificación de liquidación muestra los conceptos de Pagos en formato minimalista.
4. Notificación de liquidación: botón **LIQUIDAR** → pop-up con el **texto editable de la empresa** (default *"Las liquidaciones se emiten siempre el primer miércoles del mes."*) → marca aprobada (`confirmacion_aceptada_at`) + `accionada_at` de la notificación.
5. Ajuste **general de empresa** (mismo dato en 2 sitios):
   - Toggle 1: *Avisar por notificación a los empleados cada vez que haya una nueva liquidación* (default ON).
   - Si ON → Toggle 2: *El empleado debe confirmar pulsando LIQUIDAR para aprobar que la liquidación es correcta* (default ON).
   - Toggle 3: *Avisar por notificación cuando se marque la liquidación como Pagado* (default ON).
7. **Todas** las notificaciones tienen un botón de acuse: **Visto** (genérico, informativas) o su acción específica (**LIQUIDAR** para la de emisión). Pulsarlo marca la notificación como vista/accionada y queda registrado.
6. Pagos: botón **Enviar liquidaciones**; al final de cada fila un **tick ✓** cuando el empleado aprobó; la columna **Pagado** (casilla) se sustituye por un botón **Pagar/Pagado** que pulsa RRHH; solo habilitado cuando hay tick (si el Toggle 2 está ON).

### Comportamiento esperado

- **Toggle 1 OFF**: *Enviar liquidaciones* sigue bloqueando importes pero NO emite notificación ni pop-up al empleado (envío silencioso de cara a la app).
- **Toggle 1 ON / Toggle 2 OFF**: se notifica al empleado (informativo); LIQUIDAR es solo "marcar leído/enterado", no gobierna el pagado.
- **Toggle 1 ON / Toggle 2 ON** (default): se notifica; el empleado DEBE pulsar LIQUIDAR; hasta que no aparezca el tick, el gestor no puede marcar pagado.

---

## Contexto

### Estado actual (ya en `main` / WIP de esta sesión)

- `rrhh_pagos` con `confirmacion_enviada_at` (bloqueo), `confirmacion_enviada_por`, `confirmacion_aceptada_at` (migración `20260621180000`), trigger de bloqueo `rrhh_pagos_lock_confirmado`, y RLS por empleado + helpers `puede_gestionar_pagos()` / `mis_empleado_ids()` (migración `20260621190000`).
- `PagosView.tsx`: botón "Enviar confirmaciones", icono enviar por fila, reabrir (director), columna "Confirmación" con badges, `showConfig` (⚙️ ya existe como estado, sin panel).
- `LiquidacionGate.tsx`: pop-up bloqueante en `/m` layout y `MiPanelView`. **Se reconvierte** a la bandeja/flujo LIQUIDAR.
- Comunicados (referencia de patrón): `mi-panel/actions/mi-panel-actions.ts::listarComunicadosVisibles`, `MisComunicadosView`, `MisComunicadosMobile`, `Tablon`.

### Modelo de datos (cambios)

**Tabla nueva `notificaciones`** (genérica):
```
id uuid pk
empresa_id uuid not null  → empresas
empleado_id uuid          → empleados (destinatario; null = broadcast futuro)
user_id uuid              → destinatario por auth (denormalizado para lectura rápida en la app)
tipo text not null        → 'liquidacion' | (futuros)
titulo text not null
cuerpo text
payload jsonb             → datos del tipo (p.ej. desglose de la liquidación + periodo + pago_id)
ref_tabla text            → 'rrhh_pagos' (traza al origen)
ref_id uuid               → id del pago
accion_label text         → 'LIQUIDAR' (emisión) | 'Visto' (informativa, default)
requiere_accion boolean   default false  → true solo si la acción gobierna lógica (LIQUIDAR)
leida_at timestamptz      → se marca al abrir la bandeja
vista_at timestamptz      → cuándo pulsó el botón de acuse (Visto/LIQUIDAR)
accionada_at timestamptz  → cuándo pulsó LIQUIDAR (acción con efecto)
created_at, created_by
```
RLS: empleado ve/actualiza solo las suyas (`empleado_id in mis_empleado_ids()` o `user_id = auth.uid()`); gestor/director ven todas las de su empresa (registro). INSERT solo gestor/sistema.

**Config de empresa** — reutilizar patrón `empresa_*_config` o columnas en `empresas`. Propuesta: tabla `empresa_notificaciones_config` (o columnas `notif_liquidaciones_activo bool`, `notif_liquidaciones_requiere_aprobacion bool` en `empresas`). Decisión en Fase 1 (columnas en `empresas` = más simple, sin tabla nueva).

**`rrhh_pagos` (ajuste del trigger)**: sacar `pagado` del set de campos bloqueados, para que el gestor pueda marcar pagado tras la aprobación aunque la liquidación esté enviada (los importes siguen bloqueados). El gating "solo pagar si hay tick" se hace en UI/acción según Toggle 2.

---

## Blueprint (Assembly Line)

### Fase 0 — Config de empresa
- Añadir a `empresas` (migración idempotente): `notif_liquidaciones_activo` (def true), `notif_liquidaciones_requiere_aprobacion` (def true), `notif_liquidaciones_pagado_activo` (def true), `notif_liquidaciones_texto_liquidar text` (default = la frase canónica).
- Frase canónica por defecto: *"Las liquidaciones se emiten siempre el primer miércoles del mes."* → default de columna (futuras empresas) + backfill a Habana y Bacanal.
- Server: `getNotifLiquidacionesConfig()` / `setNotifLiquidacionesConfig()`.

### Fase 1 — Tabla `notificaciones` + RLS + helpers
- Migración: tabla, índices (`empleado_id`, `user_id where leida_at is null`), RLS (reusar `mis_empleado_ids()` / `puede_gestionar_pagos()` — generalizar este último o crear `puede_ver_notificaciones()`).
- Server `features/notificaciones/actions`: `crearNotificaciones(rows)`, `listMisNotificaciones()`, `marcarLeida(id)`, `accionarNotificacion(id)`, `listRegistroNotificaciones(filtros)`.

### Fase 2 — Ajuste del trigger de `rrhh_pagos`
- Recrear `rrhh_pagos_lock_confirmado` sin `pagado` en los campos bloqueados. Verificar con prueba en BD.

### Fase 3 — Pagos: emisión + gating
- Renombrar botón a **"Enviar liquidaciones"**.
- `enviarConfirmacionesPago` → además de fijar `confirmacion_enviada_at`, si `notif_liquidaciones_activo`: crear una `notificaciones` por empleado (tipo `liquidacion`, payload = desglose, `requiere_accion = requiere_aprobacion`, `accion_label='LIQUIDAR'`).
- Columna final con **tick ✓** = `confirmacion_aceptada_at` no nulo.
- **Sustituir la casilla "Pagado" por un botón Pagar/Pagado** (lo pulsa RRHH):
  - No pagado → botón `variant="outline"` fondo blanco, azul como el de *Nuevo*, texto **Pagar**.
  - Al pulsar → `pagado=true`: botón **verde lleno** con icono check, texto **Pagado** (toggle, se puede revertir).
  - Habilitado solo si (no requiere aprobación) o (hay tick). Toast explicativo si no.
  - Si `notif_liquidaciones_pagado_activo`: al marcar Pagado se crea una notificación informativa (tipo `liquidacion_pagada`, acuse **Visto**) al empleado.

### Fase 4 — App del empleado: bandeja + campana + auto-pop-up
- Componente campana con **círculo/badge** cuando hay notificaciones sin ver (`vista_at is null`), en header móvil (`InicioHeader`) y web (`MiPanelView`).
- Vista bandeja: lista de notificaciones; al abrir la de liquidación → tarjeta minimalista con conceptos + total + botón **LIQUIDAR** → pop-up "primer miércoles" → `accionarNotificacion` + `aceptarLiquidacion`. Las informativas llevan botón **Visto**.
- **Auto-pop-up al acceder**: cada vez que entra a la app, las notificaciones sin ver saltan en secuencia (cola); al pulsar **Visto** / **LIQUIDAR** se marcan (`vista_at`) y se quitan. Cuando no quedan, no salta nada y el círculo desaparece.
- `LiquidacionGate` se generaliza a `NotificacionesGate` (cola de pendientes), reutilizando su patrón de AlertDialog bloqueante.

### Fase 5 — Dirección: submódulo Notificaciones (registro)
- Ruta + entrada de menú en Dirección. Vista tabla (SubmoduleToolbar + barra horizontal 1) solo lectura: tipo, destinatario, título, estado (No leída/Leída/Accionada), fecha, origen. Filtros por tipo/estado/empleado.

### Fase 6 — Ajustes (2 superficies, mismo dato)
- Panel reutilizable `NotifLiquidacionesConfig`: Toggle 1 (→ despliega Toggle 2), Toggle 3, y **campo de texto editable** del pop-up de LIQUIDAR (con la frase por defecto).
- Insertarlo en RRHH → ajustes de departamentos y en Pagos → ⚙️ (`showConfig`).

### Fase 7 — Validación
- `tsc` + `eslint` limpios; pruebas RLS (empleado solo ve las suyas, gestor el registro); prueba trigger (pagado editable, importes no); E2E manual del flujo enviar→notificar→LIQUIDAR→tick→pagar.

---

## Gotchas

- **No confundir con comunicados**: notificaciones son por-empleado, accionables y con registro propio; comunicados son tablón por rol/empresa.
- **Capitalización** sentence case; nada de `uppercase` salvo el botón LIQUIDAR si el usuario lo quiere en mayúsculas (lo pidió así textualmente → respetar "LIQUIDAR").
- **Confirmación interna** (no `confirm()` nativo): pop-up "primer miércoles" = AlertDialog/Dialog interno.
- **RLS**: reutilizar `mis_empleado_ids()`; el registro de Dirección usa `puede_gestionar_pagos()` (o un helper más general).
- **Versionar migraciones** siempre como fichero `.sql` idempotente.
- **Multi-empresa**: notificación lleva `empresa_id`; la app del empleado es agnóstica pero filtra por sus fichas (`mis_empleado_ids`).

## Anti-Patrones

- Reusar la tabla `comunicados` para esto (son cosas distintas).
- Bloquear `pagado` por el trigger (debe poder marcarse tras aprobación).
- Forzar el pop-up de liquidación de golpe ignorando la bandeja (el usuario quiere bandeja).
- Guardar la config por departamento (el usuario la quiere **general de empresa**).
