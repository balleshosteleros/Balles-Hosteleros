# PRP-070 — Onboarding: rediseño de fases (Formación · Alta y Contrato · Prueba)

**Estado:** Pendiente de aprobación
**Fecha:** 2026-06-30
**Origen:** Petición del usuario para simplificar el pipeline de reclutamiento y automatizar todo el onboarding desde formación hasta el período de prueba.
**Relación:** Sucede y amplía a [PRP-068](PRP-068-alta-gestoria-firma-contrato.md). Reutiliza Firmas (PRP-068), Notificaciones/Motor de alertas (PRP-064/065) y la contratación por puesto-plantilla (PRP-066).

---

## 1. Objetivo

Reorganizar el pipeline de reclutamiento para que el flujo sea **más claro, automatizado y seguro**:

1. Unir **Teórica + Práctica** en una sola fase **Formación**.
2. Crear una fase nueva **Alta y Contrato** cuya **entrada** dispara automáticamente: el alta a la gestoría **y** el contrato interno a firmar por el empleado.
3. La gestoría sube el contrato oficial por enlace → se manda a firmar al empleado.
4. Ambos contratos firmados quedan en la carpeta documental del empleado.
5. RRHH recibe notificaciones internas en cada hito.
6. La fase **Prueba** materializa al empleado real (`contratarCandidato`), con duración y avisos configurables (cron).

Objetivo final: que ningún trabajador empiece sin tener correctamente gestionada su documentación, dejando constancia de cada paso.

---

## 2. Decisiones del usuario (cerradas)

| # | Decisión |
|---|----------|
| D1 | Es **UNA sola fase** (no dos). Nombre definitivo: **"Contratación"**. |
| D2 | El alta a gestoría se envía **automáticamente al ENTRAR en la fase Alta y Contrato** (no al pasar a empleado). |
| D3 | El **contrato interno** lo **redacta el sistema** (plantilla incluida) → genera PDF firmable. Editable en PLANTILLAS. |
| D4 | Se crea un **4º apartado "Documentos"** dentro de PLANTILLAS, con un documento "Contrato interno". |
| D5 | La **documentación del candidato** (DNI/IBAN/SS/foto) se sigue exigiendo **antes de Formación** (igual que hoy). |
| D6 (REVISADO) | El **empleado real se crea al ENTRAR en Contratación** (se ejecuta `contratarCandidato` ahí), porque firmas y gestoría operan sobre un empleado. **Prueba** pasa a ser cambio de estado + Email 5 (y ahí se envía el acceso/login). |
| D7 | **PRP completo aprobado** antes de tocar código. |

**Implicación de D6 (revisado):** `contratarCandidato` se invoca al entrar en Contratación. Así `enviarAltaGestoria(empleadoId)` y `crearFirmaInterno({empleadoId})` funcionan sin cambios estructurales. El email de acceso/login (elige contraseña) se difiere a Prueba para no dar acceso antes de tiempo.

---

## 3. Estado actual (verificado en código)

- **Fases** (`src/features/rrhh/data/reclutamiento.ts`): 3 fases canónicas — Selección (`nuevo`,`elegido`,`entrevista`,`documentacion`), Formación (`teorica`,`practica`,`prueba`,`empleado`), Descartado. Helpers `getFasePrincipal`, `siguienteEstado`, `estadoRequiereResenas`, `estadoRequiereDocumentacion`. Alias legacy para historial.
- **Gestoría** (`gestoria-actions.ts`): `enviarAltaGestoria(empleadoId, {forzar})` ya construye email con campos configurables, **token para que la gestoría suba el contrato**, recordatorio (cron `gestoria-recordatorio`) y notificación a RRHH. Config en `reclutamiento_config`: `gestoria_email/_cc`, `gestoria_envio_auto`, `gestoria_campos`, `gestoria_recordatorio_*`, `notif_alta_gestoria/_recordatorio_gestoria/_contrato_subido/_contrato_firmado`.
- **Firmas eIDAS** (`firmas-actions.ts` + `services/firmas/*`): `crearFirma()`/`crearFirmaInterno()`, token público `/firmar/[token]`, OTP 2FA, manuscrita, acta PDF, copia firmada, audit trail con hash, notificación in-app integrada. Bucket `firmas`.
- **Notificaciones** (`notificaciones-actions.ts`): `emitirNotificacion({empresaId, tipo, titulo, segmento, refTabla, refId, accionUrl, dedupeKey, system, push})`. `marcarNotificacionesVistasPorRef`.
- **Emails** (`src/lib/email/send.ts`): `sendEmail({to, subject, html, text, cc, fromName, empresaId, attachments})`. Plantillas reclutamiento en `src/lib/seeds/reclutamiento-email-plantillas.ts` + `reclutamiento-email.ts` (sustitución de variables).
- **PLANTILLAS** (`PlantillasConfig.tsx`): hoy 3 apartados — `emails` | `estados` | `cuestionarios`.
- **Documentos empleado**: tabla `documentos_empleado` (categorías `nominas`/`contratos`/`justificantes`/`registros-jornada`), bucket `empleados-docs`.
- **Contratación** (`contratacion-actions.ts`): `contratarCandidato(input)` — crea/reactiva empleado, snapshot condiciones, email de acceso, hoy llama `enviarAltaGestoria`. Solo desde fase `prueba`/`empleado`.
- **Crons** (`vercel.json`): patrón `CRON_SECRET` + `dedupeKey` + zona horaria por empresa (`ahoraEnZona`). Ejemplos: `vencimientos-alertas`, `gestoria-recordatorio`, `firmas-expirar`.

---

## 4. Modelo de fases nuevo

| Fase principal | Estados internos | Cambio |
|---|---|---|
| **Selección** | `nuevo`, `elegido`, `entrevista`, `documentacion` | Sin cambios |
| **Formación** | `formacion` | Unifica `teorica`+`practica` en un único estado |
| **Contratación** | `alta_pendiente_revision`, `alta_enviada`, `contrato_interno_firmado`, `contrato_oficial_subido`, `contrato_oficial_firmado`, `alta_completada` | **Fase y estados nuevos** |
| **Prueba** | `prueba` | Fase propia (sale de Formación); dispara `contratarCandidato` |
| **Empleado** | `empleado` | Columna final tras Prueba (ya contratado, se mantiene visible) |
| **Descartado** | `papelera`, `no_se_presenta`, `suspenso_formacion` | Sin cambios |

**Migración de datos:** candidatos en `teorica` o `practica` → `formacion`. Alias legacy `teorica/practica` mantenidos en tipos para no romper historial (mapean a Formación).

**Requisitos de avance (se conservan/ajustan):**
- Reseñas completas: igual que hoy.
- Documentación completa: requisito para entrar en **Formación** (D5).
- Entrar en **Alta y Contrato**: requiere documentación completa (ya la tiene desde Formación).

---

## 5. Flujo completo (estado final)

```
Selección (documentación completa)
   ↓  RRHH pasa a Formación
Formación
   · Email 1 → candidato: "Accede a la formación" (botón → URL configurable)
   · Notificación RRHH: candidato en Formación
   ↓  RRHH pasa a Alta y Contrato
Alta y Contrato  (ENTRADA = automático, estado alta_enviada)
   · Email 2 → gestoría: datos del alta + botón "Adjuntar contrato laboral" (token)
   · Email 3 → candidato: "Leer y firmar contrato interno" (Firmas)
   · Notificación RRHH: alta enviada a gestoría
   ↓ candidato firma contrato interno → estado contrato_interno_firmado
   · Contrato interno firmado → carpeta del empleado/candidato
   · Notificación RRHH: contrato interno firmado
   ↓ gestoría sube contrato oficial → estado contrato_oficial_subido
   · Email 4 → candidato: "Firmar contrato laboral" (Firmas)
   · Notificación RRHH: contrato oficial subido
   ↓ candidato firma contrato oficial → estado contrato_oficial_firmado → alta_completada
   · Notificación RRHH: TODO firmado, ya puede pasar a Prueba
   ↓  RRHH pasa a Prueba  →  contratarCandidato() crea empleado real
Prueba
   · Email 5 → empleado: "Inicio de período de prueba" (duración dinámica de ajustes)
   · Cron: a los X días → aviso a RRHH (canal configurable) con días restantes
   ↓  RRHH confirma continuidad
Empleado
```

---

## 6. Configuración nueva (Ajustes → RRHH → Reclutamiento)

Todo en `reclutamiento_config` (1 fila por empresa). Migración idempotente.

| Columna | Tipo | Default | Uso |
|---|---|---|---|
| `formacion_url` | text | null | Destino del botón "Acceder a la formación" (Email 1) |
| `contrato_interno_plantilla` | text/jsonb | null | Texto del contrato interno (apartado Documentos de PLANTILLAS) |
| `prueba_duracion_dias` | int | 30 | Duración del período de prueba (email + cálculo) |
| `prueba_aviso_dias` | int | 10 | Avisar a RRHH cuando lleve X días en prueba |
| `prueba_aviso_canal` | text | 'ambos' | `notificacion` \| `email` \| `ambos` (activable por separado) |
| `prueba_aviso_activo` | boolean | true | Activar/desactivar el aviso |

UI: ampliar `GestoriaConfig.tsx`/panel de Reclutamiento con una tarjeta "Período de prueba" (duración + aviso + canal) y el campo `formacion_url`.

---

## 7. Emails (6)

Reutilizan `sendEmail({empresaId})` + sistema de plantillas. Variables: nombre, email, puesto, fecha incorporación, fecha inicio prueba, duración, días transcurridos/restantes, URL formación, URL firma interno, URL subida gestoría, URL firma oficial, estados.

| # | Trigger | Destinatario | Botón |
|---|---|---|---|
| 1 | Entra en Formación | Candidato | Acceder a la formación |
| 2 | Entra en Alta y Contrato | Gestoría | Adjuntar contrato laboral |
| 3 | Entra en Alta y Contrato | Candidato | Leer y firmar contrato interno |
| 4 | Gestoría sube contrato oficial | Candidato | Firmar contrato laboral |
| 5 | Pasa a Prueba | Empleado | (informativo; duración dinámica) |
| 6 | Cron, a los X días de prueba | RRHH | (revisar evolución) |

---

## 8. Documentos

- **Contrato interno:** plantilla redactada por el sistema (formación recibida, normas internas, alta procesada, aceptación). Editable en **PLANTILLAS → Documentos**. Genera PDF → `crearFirmaInterno()` → firma manuscrita/OTP → copia firmada al bucket `firmas` y registro en `documentos_empleado` categoría `contratos`.
- **Contrato oficial:** lo sube la gestoría por el enlace con token (mecanismo ya existente de `enviarAltaGestoria`) → se manda a firmar al empleado con el mismo sistema de Firmas → carpeta documental.

---

## 9. Blueprint (fases de implementación)

### Fase 1 — Reorganización de fases
Reescribir `reclutamiento.ts`: estado `formacion` (unifica teórica/práctica), fase `alta_contrato` con sus estados, fase `prueba` propia. Helpers, colores, orden, `getFasePrincipal`, cadena de progreso, métricas del embudo. Alias legacy. Migración `.sql` idempotente: `teorica/practica → formacion`. Ajustar pipeline UI y seed de estados.

### Fase 2 — Disparadores de la fase Alta y Contrato
Server action al entrar en Alta y Contrato: adaptar `enviarAltaGestoria` para operar sobre **candidato** (no empleado) + generar contrato interno (`crearFirmaInterno`) + Email 3 + notificaciones RRHH. Estados internos `alta_enviada`/`contrato_interno_firmado`/etc. Quitar el disparo automático actual desde `contratarCandidato`.

### Fase 3 — Contrato interno (PLANTILLAS → Documentos)
4º apartado "Documentos" en `PlantillasConfig.tsx` (`type TipoPlantilla += "documentos"`). Editor del texto del contrato interno (`contrato_interno_plantilla`). Generación PDF + envío a Firmas. Al firmar: guardar en `documentos_empleado` + notificación RRHH (`notif_contrato_firmado`, ya existe).

### Fase 4 — Contrato oficial + cierre de Alta y Contrato
Conectar la subida del contrato oficial por gestoría (token existente) → Email 4 → firma → guardado → notificación RRHH. Estado `alta_completada` + notificación "ya puedes pasar a Prueba".

### Fase 5 — Fase Prueba + ajustes + cron de avisos
Pasar a Prueba ejecuta `contratarCandidato` (crea empleado real) + Email 5 con duración dinámica. Migración de columnas `prueba_*` + UI de ajustes. Nuevo cron `/api/cron/prueba-avisos` (patrón estándar, `dedupeKey`, zona horaria) que calcula días transcurridos/restantes y emite por canal configurable (Email 6 / notificación / ambos). Registrar en `vercel.json`.

### Fase 6 — QA del flujo end-to-end
Recorrer el pipeline completo con un candidato de prueba; verificar emails, firmas, documentos guardados y notificaciones en cada hito.

---

## 10. Reutilización (no se construye de cero)

Firmas eIDAS · `enviarAltaGestoria` (token gestoría + recordatorio) · `emitirNotificacion` · `sendEmail` · `documentos_empleado` · patrón de cron · toggles de notificación ya en BD (`notif_*`).

## 11. Reglas no negociables

Migraciones versionadas como `.sql` idempotentes · zona horaria por empresa en todo cálculo de días · sentence case en UI · botón "Guardar" + `pb-28` · no `confirm()`/`alert()` nativos · respuestas en español · commit directo a `main`.

---

## 12. Riesgos / decisiones abiertas

- **P1 (RESUELTO):** Se mantiene la columna final "Empleado" en el pipeline.
- **P2 (RESUELTO):** Nombre de la fase = "Contratación".
- **P3:** Si la documentación del candidato ya es completa antes de Formación, el alta a gestoría tendrá los datos. Validar que `contratarCandidato` (que corre en Prueba) siga teniendo todos los datos para crear el empleado.

---

## 13. Aprendizajes (Self-Annealing)

_(se rellena durante la implementación)_
