# PRP-065: Motor de alertas universal

> **Estado**: IMPLEMENTADO (v1) — 2026-06-21
> **Fecha**: 2026-06-21
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Convertir el sistema de notificaciones de PRP-064 (campana en barra + bandeja + auto-pop-up sobre la tabla `notificaciones`) en un **motor de alertas universal**: una capa única `emitirNotificacion()` que cualquier módulo del software puede invocar para avisar de cualquier cosa, alimentada por (a) **emisores automáticos** repartidos por todo el software (vencimientos, cronogramas/tareas, temperaturas APPCC, fichajes, encuestas/cuestionarios, comunicados, stock bajo, solicitudes resueltas…) y (b) un **panel de avisos manuales** en Dirección/Gerencia para lanzar mensajes segmentados por empleado, departamento, rol, área o empresa entera.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy `notificaciones` solo la emite Pagos (liquidaciones); los demás eventos quedan invisibles o se pierden en pushes sueltos sin registro. | Una API única `emitirNotificacion()` + catálogo de tipos, integra alta de fila + push + registro en un solo sitio; cualquier módulo la llama. |
| Dirección no tiene forma de mandar un aviso accionable a "todo cocina" o "los encargados" y saber quién lo vio. | Panel de avisos manuales con segmentación (empleado/departamento/rol/área/empresa) y registro de acuse por destinatario. |
| Eventos críticos que se le olvidan al empleado (temperatura fuera de rango, tarea de cronograma pendiente, vencimiento próximo, encuesta sin contestar) no generan presión a la acción. | Emisores automáticos que disparan la notificación + auto-pop-up bloqueante (cola de `NotificacionesGate`), forzando el acuse antes de seguir. |
| No hay manera de medir si los empleados atienden los avisos. | El registro de Dirección ya guarda estado (No vista / Vista / Accionada) por destinatario; se amplía a métricas de respuesta. |

**Valor de negocio**: el objetivo declarado por el dueño es **forzar que los empleados trabajen y rindan más y no se les olviden las cosas**. Un motor de alertas universal con acuse obligatorio y panel de envío manual hace que ninguna tarea, temperatura, vencimiento o aviso pase desapercibido, con trazabilidad de quién lo atendió y cuándo.

## Qué

### Criterios de Éxito

- [ ] Existe una capa única `emitirNotificacion(input)` que: resuelve destinatarios, inserta filas en `notificaciones`, dispara push opcional y queda en el registro — usada por todos los emisores (manual y automáticos).
- [ ] Catálogo central de tipos de notificación (`TIPOS_NOTIFICACION`) con: clave, etiqueta, icono, color, label de acuse por defecto y si requiere acción — fuente única reutilizada por bandeja, gate y registro.
- [ ] Resolución de destinatarios por **empleado concreto, departamento, rol, área (operativa/administrativa) y empresa entera**, multi-empresa aware, sin duplicar destinatarios.
- [ ] Panel **Dirección → Notificaciones** gana una pestaña/acción **"Nuevo aviso"**: título, mensaje, segmentación, ¿requiere acuse?, y se emite a todos los destinatarios resueltos (con preview del nº de destinatarios).
- [ ] Al menos **6 emisores automáticos** cableados y verificables: vencimientos próximos (cron), tareas de cronograma pendientes (cron), temperatura APPCC fuera de rango (evento), comunicado nuevo publicado (evento), encuesta/cuestionario publicado (evento), stock bajo (evento) — más los ya existentes (liquidación, fichaje).
- [ ] Cada emisor respeta un **toggle de configuración por empresa** (encender/apagar ese tipo de alerta) y opt-in de push del usuario.
- [ ] Idempotencia: los emisores por cron no reemiten la misma alerta dos veces (clave de deduplicación por entidad+periodo).
- [ ] `tsc` + `eslint` limpios; RLS verificada (empleado solo ve las suyas, gestor el registro de su empresa); E2E manual: emitir aviso manual segmentado → llega a la bandeja/pop-up de los destinatarios correctos → acuse queda registrado.

### Comportamiento Esperado

**Aviso manual (Dirección/Gerencia):**
1. El gestor abre Dirección → Notificaciones → "Nuevo aviso".
2. Escribe título + mensaje, elige segmento (p. ej. Departamento = Cocina, o Rol = Encargado, o "Toda la empresa"), marca si requiere acuse.
3. Ve el nº de destinatarios resueltos y confirma.
4. `emitirNotificacion()` resuelve los `(empleadoId, usuarioId)` del segmento, inserta una fila por destinatario, dispara push a los que tengan opt-in, y devuelve cuántas creó.
5. Cada destinatario ve el círculo en la campana + auto-pop-up bloqueante (cola). Pulsa "Visto" (o la acción específica) → se marca `vista_at`/`accionada_at`.
6. El registro de Dirección muestra el aviso con el estado por destinatario.

**Emisor automático (ejemplo: temperatura APPCC fuera de rango):**
1. Un empleado registra una temperatura; el valor cae fuera de `[min, max]`.
2. La acción de registro llama a `emitirNotificacion({ tipo: 'appcc_fuera_rango', segmento: { departamento: cocinaId }, ... })` si el toggle de empresa está activo.
3. Los responsables de cocina reciben la alerta accionable inmediatamente.

**Emisor automático por cron (ejemplo: vencimientos próximos):**
1. Cron diario recorre vencimientos a N días, resuelve los responsables, y emite una notificación por cada uno **una sola vez** (dedup por `entidad_id + fecha`).

---

## Contexto

### Referencias (ya construido — se construye ENCIMA, no se reescribe)

- `src/features/notificaciones/actions/notificaciones-actions.ts` — `crearNotificaciones()` (insert masivo, RLS gestor), `listMisNotificaciones()`, `listNotificacionesPendientes()`, `marcarNotificacionVista()`, `accionarLiquidacion()`, `listRegistroNotificaciones()`. **`crearNotificaciones` es el núcleo de inserción que envolverá `emitirNotificacion`.**
- `src/features/notificaciones/components/NotificacionBell.tsx` — campana + badge + bandeja (Sheet), variantes `panel`/`toolbar`.
- `src/features/notificaciones/components/NotificacionesGate.tsx` — cola de auto-pop-up bloqueante.
- `src/features/notificaciones/components/NotificacionesRegistroView.tsx` — registro en Dirección (tabla con `TIPO_LABEL`, estados No vista/Vista/Accionada). **El catálogo de tipos sustituye al `TIPO_LABEL` local.**
- `src/features/notificaciones/actions/notif-config-actions.ts` + `NotifLiquidacionesConfigPanel.tsx` — patrón de config por empresa (columnas en `empresas`).
- `src/app/(main)/direccion/notificaciones/page.tsx` — ruta del registro (se le añade el panel de aviso manual).
- `src/features/mi-panel/mobile/lib/push-server.ts` — `sendPushWithClient()` + `PushEventType` + opt-in por usuario (`usuarios.push_*`). **El motor reusa esto para el canal push; se amplía el enum/opt-in.**
- `src/app/api/cron/fichajes-reavisos/route.ts` — patrón de cron con service role, idempotencia vía tabla `*_log`, header `Bearer CRON_SECRET`. **Plantilla para los crons de vencimientos/cronogramas.**
- `vercel.json` → array `crons` (se añaden las nuevas entradas).

### Emisores candidatos (mapa de integración)

| Dominio | Archivo de acción / origen | Punto de disparo | Mecanismo |
|---------|---------------------------|------------------|-----------|
| Liquidación / pago | `rrhh/actions/pagos-actions.ts` | ya cableado (PRP-064) | evento |
| Fichaje recordatorio | `app/api/cron/fichajes-reavisos` | ya cableado (push) | cron |
| Vencimientos próximos | `gerencia/actions/vencimientos-actions.ts` + `vencimientos` | fecha ≤ hoy+N | **cron nuevo** |
| Cronogramas / tareas | `gerencia` cronogramas (`cronogramas_operativos`) | tarea asignada / fecha de ejecución | **cron nuevo** + evento |
| Temperaturas APPCC | `cocina/actions/temperaturas-actions.ts` | valor fuera de `[min,max]` | evento |
| Comunicado publicado | `gerencia/actions/comunicados-actions.ts` | estado → publicado | evento |
| Encuesta / cuestionario | `rrhh/encuestas` (`encuestas`) | estado → publicado | evento |
| Stock bajo | `logistica/actions/stock-actions.ts` | cantidad ≤ mínima | evento |
| Solicitud resuelta | `solicitudes_personal` | estado → aprobada/rechazada | evento |

> Nota: las rutas/funciones exactas de algunos emisores se verifican al entrar a su fase (mapeo just-in-time del bucle agéntico); el contrato hacia el motor (`emitirNotificacion`) es estable.

### Resolución de destinatarios (targeting)

Tablas: `empleados` (`id, user_id, empresa_id, departamento_id, puesto_id, estado`), `usuario_roles` (`user_id, empresa_id, empresa_role_id`), `usuario_empresas` (acceso multi-empresa), `departamentos` (`id, empresa_id, area`), `empresa_roles`. Helpers existentes a generalizar: `listEmpleadosParaComunicado()` (gerencia), `listEmpleadosParaPagos()` (rrhh). El motor expone un único `resolverDestinatarios(empresaId, segmento)` que devuelve `{ empleadoId, usuarioId }[]` deduplicado, cubriendo: empleado, departamento, rol, área, empresa entera (incluye acceso multi-empresa vía `usuario_empresas`).

### Arquitectura Propuesta (Feature-First)

```
src/features/notificaciones/
├── lib/
│   ├── catalogo.ts            # TIPOS_NOTIFICACION (clave, label, icono, color, acuse, requiereAccion)
│   └── targeting.ts           # resolverDestinatarios(empresaId, segmento) [server-only]
├── actions/
│   ├── notificaciones-actions.ts   # (existente) + emitirNotificacion()
│   ├── emisores-actions.ts         # helpers de emisión por dominio (evento)
│   └── notif-config-actions.ts     # (existente) + toggles por tipo
├── components/
│   ├── NotificacionBell.tsx        # (existente, usa catálogo)
│   ├── NotificacionesGate.tsx      # (existente, usa catálogo)
│   ├── NotificacionesRegistroView.tsx  # (existente, usa catálogo) + tab/acción "Nuevo aviso"
│   └── NuevoAvisoDialog.tsx         # panel de aviso manual segmentado
└── types/
    └── index.ts                # Segmento, TipoNotificacion, EmitirInput

src/app/api/cron/
├── vencimientos-alertas/route.ts
└── cronogramas-alertas/route.ts
```

### Modelo de Datos (cambios)

La tabla `notificaciones` ya existe y es genérica (PRP-064): `empresa_id, empleado_id, usuario_id, tipo, titulo, mensaje, payload(jsonb), accion_label, requiere_accion, leida/leida_at, vista_at, accionada_at, entidad_tipo, entidad_id, accion_url, created_by`. **No se recrea.**

Cambios mínimos:

```sql
-- 1) Deduplicación de emisores por cron (idempotencia), patrón de fichaje_reavisos_log.
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_dedupe_uq
  ON notificaciones (empresa_id, usuario_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 2) Toggles de alertas por empresa (un bool por tipo automático), columnas en `empresas`
--    siguiendo el patrón notif_liquidaciones_*. Decisión exacta de nombres en Fase 0.
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS notif_vencimientos_activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_cronogramas_activo  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_appcc_activo         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_comunicados_activo   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_encuestas_activo     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_stock_activo         boolean NOT NULL DEFAULT true;

-- 3) Opt-in de push del nuevo canal "alertas" en usuarios (patrón push_*).
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS push_alertas boolean NOT NULL DEFAULT true;
```

> Migraciones idempotentes versionadas como `.sql` en `supabase/migrations/` (regla del proyecto). RLS de `notificaciones` ya cubre los nuevos flujos (no cambia).

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (mapeo de contexto just-in-time).

### Fase 0 — Catálogo de tipos + config por empresa
**Objetivo**: `lib/catalogo.ts` con `TIPOS_NOTIFICACION` (clave, label, icono, color, acuse por defecto, requiereAccion) como fuente única; migración de toggles `notif_*_activo` en `empresas` + `push_alertas` en `usuarios` + backfill Habana/Bacanal; `notif-config-actions` ampliado para leer/escribir los toggles.
**Validación**: catálogo importable sin SSR issues; columnas creadas; `NotificacionesRegistroView` y `NotificacionBell` consumen `TIPOS_NOTIFICACION` en vez de `TIPO_LABEL` local.

### Fase 1 — Capa `emitirNotificacion()` + targeting
**Objetivo**: `lib/targeting.ts::resolverDestinatarios(empresaId, segmento)` (empleado/departamento/rol/área/empresa, dedup, multi-empresa) y `actions/notificaciones-actions.ts::emitirNotificacion(input)` que resuelve destinatarios, inserta vía `crearNotificaciones`, aplica `dedupe_key` y dispara push opcional (`sendPushWithClient` con canal `alertas`). Migración `dedupe_key` + índice único.
**Validación**: prueba que emitir a un departamento crea N filas sin duplicar; reemisión con misma `dedupe_key` no duplica; push respeta opt-in.

### Fase 2 — Panel de aviso manual (Dirección/Gerencia)
**Objetivo**: `NuevoAvisoDialog.tsx` (título, mensaje, selector de segmento con preview de nº destinatarios, toggle "requiere acuse") integrado en `NotificacionesRegistroView` (acción "Nuevo aviso", barra horizontal 1). Emite vía `emitirNotificacion`.
**Validación**: enviar a "Cocina" llega solo a empleados de cocina; el registro lo lista; acuse cambia el estado.

### Fase 3 — Emisores por evento (síncronos)
**Objetivo**: cablear en sus acciones de origen, cada uno tras su toggle de empresa: comunicado publicado, encuesta/cuestionario publicado, temperatura APPCC fuera de rango, stock bajo, solicitud resuelta. Helpers en `emisores-actions.ts` con la `tipo`/segmento correctos.
**Validación**: provocar cada evento dispara la notificación a los destinatarios esperados; con toggle OFF no se emite.

### Fase 4 — Emisores por cron (asíncronos, idempotentes)
**Objetivo**: `app/api/cron/vencimientos-alertas/route.ts` y `app/api/cron/cronogramas-alertas/route.ts` (service role, `Bearer CRON_SECRET`, `dedupe_key = entidad_id + fecha`), registrados en `vercel.json`. Reusan `emitirNotificacion` con cliente service.
**Validación**: dos ejecuciones seguidas no duplican; alerta llega una vez por entidad/día; logs OK.

### Fase 5 — Push + opt-in del canal alertas
**Objetivo**: ampliar `PushEventType`/`optInMap` con `alerta` ligado a `usuarios.push_alertas`; `emitirNotificacion` dispara push para los destinatarios con opt-in; UI de preferencias del empleado gana el toggle de alertas.
**Validación**: con `push_alertas=false` no llega push pero sí entra en bandeja; con true llega ambos.

### Fase 6 — Validación final
**Objetivo**: sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] RLS: empleado solo ve las suyas; gestor el registro de su empresa
- [ ] E2E manual: aviso manual segmentado + 1 emisor evento + 1 emisor cron → llegan a destinatarios correctos, sin duplicar, con acuse registrado
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece durante la implementación. El mismo error NUNCA ocurre dos veces.

### 2026-06-21: Catálogo sin componentes React en módulo de datos
- **Decisión**: `lib/catalogo.ts` es datos puros (label/color/badge/accionLabel/requiereAccion + clave de icono string); los componentes Lucide viven aparte en `lib/catalogo-iconos.tsx`. Así el catálogo se importa desde Server Actions sin arrastrar componentes ni romper la regla "use server".

### 2026-06-21: Segmento "usuarios" como primitivo unificador
- **Contexto**: comunicados resuelven audiencia en espacio `user_id` (incluye empleados sin ficha) y encuestas guardan departamentos por NOMBRE y empleados por `empleadoId`; ninguno encaja con el `Segmento` UUID-first.
- **Fix**: se añadió `{ tipo: "usuarios"; usuarioIds }` al `Segmento`. Los emisores resuelven a user_ids con su lógica propia (reusando `resolverDestinatariosUserIds` de comunicados) y emiten con ese segmento. `resolverDestinatarios` mapea cada user a su ficha si existe, o entrega por `usuario_id` (la bandeja filtra por usuario o ficha). `Destinatario.empleadoId` pasó a `string | null`.

### 2026-06-21: Datos reales de vencimientos/cronogramas (cron v1)
- **vencimientos**: tabla VACÍA y `responsable` es texto libre (sin FK a usuario) → el cron alerta al área ADMINISTRATIVA. No-op hasta que haya datos.
- **cronogramas_operativos**: `empleados_asignados` está NULL en todas las filas; la asignación real es por `departamento` (nombre). `dia_semana` = ISO 1..7, `dia_mes` entero, `meses_trimestrales` = nº de mes. El cron resuelve destinatarios por departamento (nombre) cuando no hay asignados, y evalúa recurrencia DIARIO/SEMANAL/MENSUAL/TRIMESTRAL (OTRO/anual se omiten; modelo en rediseño).
- **Idempotencia**: `dedupe_key` = `vencimiento:<id>:<fecha>` / `cronograma:<id>:<YYYY-MM-DD>`.

### 2026-06-22: ON CONFLICT no infiere índices PARCIALES (bug de runtime)
- **Error**: `42P10 there is no unique or exclusion constraint matching the ON CONFLICT specification` al emitir. El `upsert({ onConflict: "empresa_id,usuario_id,dedupe_key" })` de PostgREST NO puede apuntar a un índice único PARCIAL (`WHERE dedupe_key is not null`) porque no admite el predicado del índice. tsc/build no lo detectan; solo aparece al ejecutar.
- **Fix**: índice único NO parcial sobre `(empresa_id, usuario_id, dedupe_key)`. Postgres trata los NULL como distintos → las filas con `dedupe_key` null (avisos manuales) no colisionan y las no-null sí deduplican. Migración `20260621260000` corregida.
- **Aplicar en**: cualquier upsert de PostgREST con `onConflict` → el índice destino debe ser NO parcial.

### 2026-06-21: Push del canal alertas y doble-push
- `emitirNotificacion` dispara push (`eventType: "alerta"`, opt-in `usuarios.push_alertas`) SIEMPRE con cliente service (debe leer suscripciones de otros usuarios). El emisor de comunicados pasa `push: false` porque el comunicado ya dispara su propio push (`comunicado_nuevo`) — así se evita doble notificación.
- **Scope v1**: no existe UI de preferencias push por canal para NINGÚN canal (solo la tarjeta global de suscripción). El opt-in `push_alertas` queda funcional por defecto (true) y respetado en servidor; un toggle por canal es una feature transversal aparte, no se añade solo para alertas.

---

## Gotchas

- [ ] **Construir ENCIMA de PRP-064**: `crearNotificaciones`, `NotificacionBell`, `NotificacionesGate`, `listRegistroNotificaciones` y la tabla `notificaciones` ya existen — `emitirNotificacion` los envuelve, no los reemplaza. No recrear la tabla.
- [ ] **`crearNotificaciones` usa cliente del usuario (RLS gestor)**; los crons no tienen sesión → `emitirNotificacion` debe aceptar inyección de cliente service (patrón `sendPushWithClient`).
- [ ] **Dedup obligatoria en crons**: sin `dedupe_key` los crons reemiten cada ejecución (igual que `fichaje_reavisos_log`). Índice único parcial.
- [ ] **Multi-empresa**: resolver destinatarios debe incluir `usuario_empresas` (acceso secundario), no solo `empleados.empresa_id`. Toda RLS multi-tenant usa `empresas_del_usuario()`.
- [ ] **Capitalización** sentence case en títulos/labels (regla global); nada de `uppercase` salvo siglas reales (APPCC) o el "LIQUIDAR" heredado.
- [ ] **No `confirm()`/`alert()` nativos**: confirmaciones vía AlertDialog/`useConfirmDelete`.
- [ ] **Barra horizontal 1** por defecto en el registro y panel (toolbar minimalista).
- [ ] **Cambios al software, no a una empresa**: los toggles son por empresa pero el código es compartido; aplica a todas las empresas presentes y futuras.
- [ ] **Versionar migraciones** siempre como `.sql` idempotente en `supabase/migrations/`.
- [ ] **Opt-in de push** ya existe por canal en `usuarios.push_*`; añadir `push_alertas` y respetarlo en `emitirNotificacion`.
- [ ] **No confundir con comunicados**: notificaciones son por-empleado, accionables y con acuse; los comunicados publicados pueden EMITIR una notificación, pero siguen siendo entidades distintas.

## Anti-Patrones

- NO recrear la tabla `notificaciones` ni duplicar la lógica de `crearNotificaciones`.
- NO emitir desde cada módulo con inserts ad-hoc: SIEMPRE pasar por `emitirNotificacion`.
- NO emitir sin `dedupe_key` desde crons.
- NO hardcodear etiquetas/iconos de tipo en cada vista: usar `TIPOS_NOTIFICACION`.
- NO segmentar solo por `empleados.empresa_id` (rompe el acceso multi-empresa).
- NO usar `confirm()`/`alert()` nativos ni `uppercase` decorativo.
- NO ignorar errores de TypeScript ni omitir Zod en el input del aviso manual.

---

*PRP pendiente aprobación. No se ha modificado código.*
