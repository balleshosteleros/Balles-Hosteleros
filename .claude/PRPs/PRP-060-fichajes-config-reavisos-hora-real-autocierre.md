# PRP-060: Ampliación de la configuración de fichajes (reavisos push, hora real vs oficial, auto-fichar salida, sonido/vibración)

> **Estado**: COMPLETADO (2026-06-20) — 8 fases implementadas y validadas (tsc 0, lint 0 errores, crons 401/200, defaults = comportamiento actual).
> **Fecha**: 2026-06-19
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Ampliar la configuración por empresa de fichajes (Ajustes → Departamentos → RRHH → submódulo "Fichajes", tabla `empresa_fichajes_config`) para hacer configurable: (1) reavisos del aviso de fichar por **push** dentro de la ventana de cortesía, (2) unificación conceptual del redondeo bajo "tiempo de cortesía", (3) registro de **hora real** (informativa) junto a la **hora oficial** (la que cuenta), (4) **auto-fichar salida** a la hora prevista + margen, y (5) **sonido/vibración** del aviso en el móvil. Todos los nuevos ajustes son multi-tenant y sus valores por defecto reproducen el comportamiento actual.

## Por Qué

| Problema | Solución |
|----------|----------|
| El aviso de fichar es un pop-up que solo se ve con la app abierta; si el empleado no la tiene abierta, no se entera y olvida fichar. | Reavisos por **web push** (app cerrada) + sonido/vibración (app abierta), cada X min dentro de la ventana de cortesía, sin spamear. |
| El redondeo (`redondear_antes/despues`) sobrescribe `hora_entrada`/`hora_salida` y se **pierde la hora real** de fichaje; RRHH no puede auditar a qué hora fichó de verdad el empleado. | Guardar SIEMPRE `hora_entrada_real`/`hora_salida_real` (informativa) y dejar `hora_entrada`/`hora_salida` como la oficial/redondeada que cuenta para horas trabajadas. |
| Empleados con horario fijo que olvidan fichar salida dejan jornadas abiertas hasta el cron nocturno (huérfanos), inflando o falseando las horas. | Auto-fichar salida a la hora prevista + margen, marcado para revisión, coherente con `cierre_anticipado`/`requiere_revision`. |
| El concepto "margen / redondeo / ventana de pop-up" está fragmentado en la UI y confunde. | Unificarlo bajo "tiempo de cortesía" con copy claro. |

**Valor de negocio**: menos fichajes olvidados o fuera de hora (datos más fiables para nóminas y control horario legal), menos correcciones manuales de RRHH, y trazabilidad real vs oficial para auditoría/inspecciones de trabajo.

## Qué

### Criterios de Éxito
- [ ] En Ajustes → RRHH → Fichajes existe (modo "ventana") un ajuste de **intervalo de reaviso** (p.ej. 5 min) y un toggle de **sonido/vibración**; los defaults dejan el comportamiento actual (sin reavisos push extra, sonido off).
- [ ] Un cron que corre **cada minuto** detecta empleados con horario fijo dentro de su ventana de entrada que aún no han fichado y les envía **push** respetando el intervalo y **sin duplicar** dentro del mismo minuto/ventana.
- [ ] La columna nueva `hora_entrada_real`/`hora_salida_real` guarda SIEMPRE la hora física del fichaje; `hora_entrada`/`hora_salida` conservan la oficial (redondeada). El cálculo de horas/contador usa la **oficial**.
- [ ] `FichajeDetalleDialog` (y donde aplique en `/rrhh/fichajes`) muestra **ambas**: "hora real" (informativa) y "hora oficial" (la que cuenta), sin romper fichajes antiguos (que no tienen hora_real).
- [ ] Con el ajuste de **auto-salida** activo, un cron cierra la jornada de horario fijo a la hora prevista + margen, marcándola para revisión sin pisar el cierre por paralización ni el de huérfanos.
- [ ] En el móvil, dentro de la ventana de cortesía, suena/vibra el aviso (si la empresa lo activó) con la app abierta, además del push.
- [ ] `npm run typecheck` y `npm run build` pasan; defaults verificados = comportamiento idéntico al actual para empresas que no toquen la config.

### Comportamiento Esperado

**Reavisos (modo ventana, horario fijo):** cortesía 10 antes / 10 después + intervalo 5 → mientras el empleado no haya fichado entrada, recibe avisos a −10, −5, 0, +5, +10 min de su hora de entrada. Cada aviso sale por **push** (funciona con la app cerrada) y, si la app está abierta, además suena/vibra (si la empresa lo activó). El cron de cada minuto comprueba quién está dentro de su ventana, no ha fichado, y le toca reaviso según el intervalo (idempotente: no reenvía el mismo "slot" dos veces).

**Hora real vs oficial:** al fichar entrada/salida se guarda `hora_entrada_real` = instante físico; si aplica redondeo dentro de la cortesía, `hora_entrada` = hora exacta del turno (oficial). El contador de tiempo trabajado y `horas_totales` se calculan con la oficial. RRHH ve las dos en el detalle.

**Auto-salida:** si la empresa activa "cerrar jornada automáticamente" y el empleado tiene horario fijo, un cron cierra la jornada abierta a `salida_prevista + margen` poniendo `hora_salida` (oficial = salida prevista) y `hora_salida_real = null` (no fichó), marca `requiere_revision = true` e incidencia informativa.

---

## Contexto

### Referencias
- `src/features/rrhh/data/fichaje-policy.ts` — tipo `FichajePolicy` + `FICHAJE_POLICY_DEFAULT` (ampliar con los nuevos campos).
- `src/features/rrhh/actions/fichajes-policy-actions.ts` — `getFichajePolicy`/`saveFichajePolicy` (mapear nuevas columnas).
- `src/features/ajustes/components/FichajesConfigPanel.tsx` — panel embebido de UI (añadir secciones de reaviso, sonido/vibración, auto-salida; reagrupar bajo "tiempo de cortesía").
- `src/features/mi-panel/actions/mi-panel-actions.ts` — `ficharEntradaPersonal` (lógica `horaEntradaOverrideISO`, líneas ~683–725, 738), `ficharSalidaPersonal` (~776–960), `getMiVentanaFichajeHoy` + `VentanaFichajeHoy` (~337–441), `autoCerrarFichajesHuerfanos` (~127), `getHorarioDia`/`getHorariosDiaUnificado`.
- `src/features/mi-panel/mobile/components/MobileFichajeProvider.tsx` — pop-up por ventana ±márgenes (añadir sonido/vibración y leer nuevos campos de la ventana).
- `src/features/mi-panel/mobile/lib/push-server.ts` — `sendPushToUser` (añadir `PushEventType` `"fichaje_recordatorio"` + opt-in en `usuarios`).
- `src/features/mi-panel/mobile/components/PushPermissionCard.tsx` y `push-subscription-actions.ts` — suscripción push ya montada.
- `src/app/api/cron/reservas-recordatorios/route.ts` — patrón de cron (Bearer `CRON_SECRET`, service client, loop por empresa).
- `src/app/api/cron/cerrar-fichajes-huerfanos/route.ts` — patrón de cierre automático con incidencia (reusar/coexistir).
- `src/features/rrhh/components/fichajes/FichajeDetalleDialog.tsx` — detalle (mostrar real + oficial).
- `supabase/migrations/20260619120000_fichajes_popup_config.sql` — patrón de `ALTER TABLE ADD COLUMN IF NOT EXISTS` con defaults = comportamiento actual + CHECKs idempotentes.
- `vercel.json` — registro de crons (ojo: hoy varios "cada hora" están como diarios; el nuevo necesita `* * * * *`).

### Arquitectura Propuesta

Sigue la estructura existente (no se crea feature nueva): se extienden `empresa_fichajes_config`, `fichajes`, el `FichajePolicy`, el panel de ajustes, las server actions de fichaje, el provider móvil, y se añaden dos endpoints de cron.

```
src/app/api/cron/
├── fichajes-reavisos/route.ts        # NUEVO — cada minuto: push de reaviso dentro de ventana
└── fichajes-autosalida/route.ts      # NUEVO — cada minuto/5min: auto-cierre de jornada fija

src/features/mi-panel/mobile/lib/push-server.ts   # + PushEventType "fichaje_recordatorio"
src/features/mi-panel/mobile/lib/push-sound.ts    # NUEVO (cliente) — sonido/vibración del aviso
```

### Modelo de Datos

```sql
-- 1) Nuevos ajustes por empresa (defaults = comportamiento actual)
alter table public.empresa_fichajes_config
  add column if not exists reaviso_activo          boolean not null default false,
  add column if not exists reaviso_intervalo_min   integer not null default 5,
  add column if not exists aviso_sonido            boolean not null default false,
  add column if not exists aviso_vibracion         boolean not null default false,
  add column if not exists auto_salida_activa      boolean not null default false,
  add column if not exists auto_salida_margen_min  integer not null default 15;
-- + CHECK idempotente: reaviso_intervalo_min between 1 and 60,
--   auto_salida_margen_min between 0 and 120

-- 2) Hora real vs oficial en fichajes (nullable; fichajes antiguos = null)
alter table public.fichajes
  add column if not exists hora_entrada_real timestamptz,
  add column if not exists hora_salida_real  timestamptz;

-- 3) Idempotencia del reaviso (evitar duplicados por slot dentro de la ventana).
--    Opción A: columna last en fichajes/empleado-día.  Opción B: tabla de log
--    `fichaje_reavisos_log (empresa_id, user_id, fecha, slot_min, sent_at)`
--    con UNIQUE(user_id, fecha, slot_min) — se decide en Fase 1.
```

- RLS: `empresa_fichajes_config` ya tiene política `empresas_del_usuario()`; las columnas nuevas heredan. Si se crea tabla de log de reavisos, añadir RLS multi-tenant con `empresas_del_usuario()`.
- Los crons usan **service role** (sin RLS), igual que los crons existentes.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Migración + modelo de datos
**Objetivo**: Columnas nuevas en `empresa_fichajes_config` y `fichajes` (real/oficial), CHECKs idempotentes y mecanismo de idempotencia del reaviso (columna o tabla de log con RLS). Defaults = comportamiento actual.
**Validación**: Migración versionada en `supabase/migrations/`; columnas existen; ninguna empresa cambia de comportamiento sin tocar config.

### Fase 2: Policy + server actions (hora real vs oficial)
**Objetivo**: Ampliar `FichajePolicy`/`FICHAJE_POLICY_DEFAULT` y `get/saveFichajePolicy` con los nuevos campos. En `ficharEntradaPersonal`/`ficharSalidaPersonal` guardar siempre `hora_*_real` y dejar `hora_*` como oficial; verificar que `horas_totales`/contador usan la oficial. Unificar el redondeo bajo "tiempo de cortesía".
**Validación**: Fichar con redondeo guarda real ≠ oficial; horas calculadas con la oficial; typecheck pasa.

### Fase 3: UI de configuración
**Objetivo**: En `FichajesConfigPanel` reagrupar bajo "tiempo de cortesía" y añadir: intervalo de reaviso + sonido/vibración (modo ventana), y auto-fichar salida + margen. Sentence case, sin confirm nativo, copy claro de real vs oficial.
**Validación**: Guardar/leer round-trip correcto; defaults visibles = comportamiento actual.

### Fase 4: Push de reavisos (server + cron)
**Objetivo**: Añadir `PushEventType "fichaje_recordatorio"` + opt-in en `usuarios`/`sendPushToUser`. Cron `fichajes-reavisos` (cada minuto, Bearer `CRON_SECRET`) que recorre empresas con `reaviso_activo`, resuelve quién está dentro de su ventana de entrada y no ha fichado, y envía push por intervalo sin duplicar. Registrar en `vercel.json` con `* * * * *`.
**Validación**: Llamada manual al endpoint con el secret detecta candidatos y no reenvía el mismo slot; push llega con la app cerrada.

### Fase 5: Móvil — sonido/vibración del aviso
**Objetivo**: En `MobileFichajeProvider` leer los nuevos campos de la ventana (intervalo, sonido, vibración) y, al mostrar el pop-up dentro de la ventana, reproducir sonido/vibrar si la empresa lo activó (gestos del navegador permitidos).
**Validación**: Con la config activa, el aviso suena/vibra en móvil; con default off, no.

### Fase 6: Auto-fichar salida (cron)
**Objetivo**: Cron `fichajes-autosalida` que, para empresas con `auto_salida_activa` y empleados con horario fijo y jornada abierta, cierra a `salida_prevista + margen`: `hora_salida` = salida prevista (oficial), `hora_salida_real = null`, `requiere_revision = true`, incidencia informativa; coherente con paralización y huérfanos (no pisarlos). Registrar en `vercel.json`.
**Validación**: Jornada fija sin salida se cierra a la hora prevista + margen y queda marcada para revisión; no afecta a flexibles ni a las ya cerradas.

### Fase 7: Detalle RRHH (real + oficial)
**Objetivo**: `FichajeDetalleDialog` y vistas de `/rrhh/fichajes` muestran "hora real" (informativa) y "hora oficial" (la que cuenta); fichajes antiguos sin real degradan a "—".
**Validación**: Detalle muestra ambas; fichajes legacy no rompen.

### Fase 8: Validación Final
**Objetivo**: Sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Crons responden 401 sin secret y procesan con secret
- [ ] Defaults = comportamiento actual confirmado (empresa sin tocar config)
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

### 2026-06-20: Sesión paralela tocando los mismos archivos
- **Situación**: Durante la implementación, otra sesión (refactor "horario unificado multi-empresa") editaba el MISMO working tree: refactorizó `getMiVentanaFichajeHoy` (ahora usa `getHorariosDiaUnificado` + helper `leerPopupConfig`) y reescribió `FichajesView.tsx` (~493 líneas). Hay DOS PRP-060 distintos.
- **Fix**: Ediciones quirúrgicas sobre estado actual (nunca `Write` en archivos compartidos), reconciliando mi interfaz `VentanaFichajeHoy` con su `leerPopupConfig`/`base`. No toqué `FichajesView` salvo 2 líneas de mapeo. Verificado con `git status` que `fichajes-actions.ts` NO estaba en su lista antes de editarlo.
- **Aplicar en**: cualquier build largo; comprobar `git status` antes de editar archivos "calientes" y preferir Edit (falla en limpio si cambian la región) sobre Write.

### 2026-06-20: Mapeo Fichaje y push desde cron
- `listFichajes` usa `.select("*")` → `hora_entrada_real`/`hora_salida_real` vienen solas; solo hubo que mapearlas en `FichajesView` y mostrarlas en `FichajeDetalleDialog`.
- `sendPushToUser` usaba el cliente con cookies (inútil en cron sin sesión). Se extrajo `sendPushWithClient(supabase, …)` para pasar el service client desde el cron.
- Idempotencia del reaviso: `INSERT` en `fichaje_reavisos_log` con `UNIQUE(user_id, fecha, slot_min)`; si choca, no se reenvía. `slot_min` = offset (puede ser negativo) en múltiplos del intervalo dentro de la cortesía.

---

## Gotchas

- [ ] **Cron cada minuto en Vercel**: el plan/cuenta debe permitir frecuencia `* * * * *`; si no, usar el mínimo soportado y ajustar el intervalo de reaviso. Confirmar antes de Fase 4.
- [ ] **vercel.json**: varios crons rotulados "cada hora" están registrados como diarios (`0 8 * * *`). No copiar ese schedule para el reaviso; necesita `* * * * *`.
- [ ] **Idempotencia del reaviso**: sin control de "slot ya enviado" el cron de cada minuto spamea. Decidir en Fase 1 (columna last_sent vs tabla log con UNIQUE).
- [ ] **Multi-empresa**: `getMiVentanaFichajeHoy` unifica turnos de varias empresas; el cron debe resolver ventana por empleado de forma equivalente (no solo cookie). Reusar `getHorariosDiaUnificado`/`getHorarioDia` con service client.
- [ ] **No pisar override existente**: `horaEntradaOverrideISO` ya redondea `hora_entrada`. Al introducir `hora_entrada_real`, mantener que `permitir_fuera_horario` desactiva el redondeo (real == oficial).
- [ ] **Auto-salida vs huérfanos vs paralización**: tres caminos cierran jornada; el nuevo cron solo debe tocar jornadas fijas abiertas del día, sin pisar `cierre_anticipado` ni los huérfanos de días anteriores.
- [ ] **Push opt-in**: `sendPushToUser` filtra por columnas `push_*` en `usuarios`; añadir la columna de opt-in para fichaje y respetar el opt-out.
- [ ] **Sonido en navegador**: autoplay de audio requiere interacción previa; degradar con elegancia (vibración API también puede no estar disponible en iOS).
- [ ] **hora_entrada_real nullable**: fichajes existentes quedan con `null`; la UI y los cálculos deben tolerarlo.

## Anti-Patrones

- NO duplicar lógica de ventana/horario: reusar `getHorarioDia`/`getHorariosDiaUnificado`.
- NO cambiar defaults que alteren el comportamiento de empresas que no toquen la config.
- NO usar `confirm()`/`alert()` nativos en la UI (usar diálogos internos).
- NO `uppercase` en labels (sentence case salvo siglas reales).
- NO calcular horas trabajadas con la hora real (siempre la oficial).
- NO hardcodear el `CRON_SECRET` ni saltarse el Bearer en los endpoints.

---

*PRP pendiente aprobación. No se ha modificado código.*
