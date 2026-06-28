# PRP-068 — Alta a gestoría con datos completos + firma del contrato

**Estado:** Pendiente de aprobación
**Fecha:** 2026-06-28
**Origen:** Petición del usuario tras detectar que el alta a la gestoría salía vacía y que la firma del contrato no estaba conectada.

---

## 1. Objetivo

Garantizar que **ningún candidato se pueda contratar sin que sus datos estén completos**, que **el alta a la gestoría siempre salga con todos los datos**, y conectar el flujo de **firma del contrato** (la gestoría sube el PDF → el trabajador lo firma → avisos a trabajador y a RRHH), reutilizando el módulo de Firmas que ya existe.

Regla maestra (palabras del usuario):
> "No debes dejar crear una plantilla de puesto sin que estén todos los datos, y no debes dejar crear un CONTRATADO en reclutamiento sin que se envíe el alta a la gestoría, y para que se envíe el alta a gestoría deben estar todos los datos."

---

## 2. Diagnóstico (estado actual real, verificado en BD)

- `candidatos.dni_nie` **existe** (text, nullable) pero **el formulario público no lo pide** → siempre `null`. La ficha del candidato tampoco lo edita.
- `puestos`: `convenio_colectivo`, `tipo_contrato_defecto`, `grupo_categoria_prof`, `epigrafe_cotizacion` existen pero son **opcionales** al guardar.
- `puesto_salarios` (niveles): `salario_neto`, `nomina_neta`, `jornada_contrato`, `horas_semanales`, etc. existen pero **no se validan** (arrancan en 0 / null).
- `contratarCandidato` ya envía el alta a la gestoría (añadido en commit anterior) pero **no valida** que los datos estén completos → alta vacía.
- Módulo **Firmas** ya hace TODO lo de firmar: documento, token público `/firmar/[token]`, firma manuscrita, email al trabajador, notificación in-app al trabajador, audit trail, copia firmada. Falta que **la gestoría** pueda subir el PDF (hoy solo un admin con sesión).
- **No existe** un "correo de RRHH" configurable. Hay `gestoria_email` y `gestoria_email_cc` en `reclutamiento_config`. Hay que añadir `rrhh_email`.

---

## 3. Reglas de validación (la "cadena de datos obligatorios")

### R1 — Plantilla de puesto completa
No se puede **guardar como `activo`** un puesto/nivel si falta cualquiera de estos:
- En `puestos`: `convenio_colectivo`, `tipo_contrato_defecto`, `grupo_categoria_prof`, `epigrafe_cotizacion`.
- En `puesto_salarios` (el nivel): `salario_neto` > 0, `jornada_contrato`, `horas_semanales` > 0.
- Se permite guardar como **borrador** incompleto (estado='borrador'), pero **no como activo** ni usarse para contratar.

### R2 — DNI del candidato obligatorio antes de contratar
- Añadir campo **DNI/NIE** al formulario público de candidatura (`FormCandidaturaPublica`) → guardar en `candidatos.dni_nie`. (Decisión abierta P1: ¿obligatorio en el portal público o solo editable luego por RRHH? — ver §7)
- Permitir a RRHH editar el DNI en la ficha del candidato (`CandidatoDetailModal`).
- Validación de formato DNI/NIE español.

### R3 — No contratar sin datos completos
`contratarCandidato` rechaza la contratación (antes del lock) si falta:
- `candidato.dni_nie` (válido).
- Plantilla del puesto activa y completa (R1).
- Local, primer día (ya se validan hoy).
Mensaje de error claro indicando QUÉ falta.

### R4 — No quedar contratado sin alta a gestoría
- El alta a la gestoría se envía **dentro** de `contratarCandidato` (ya lo hace).
- Si el envío del alta **falla** (p.ej. falta `gestoria_email`), la contratación **no se da por completada en silencio**: se informa con un aviso claro y la acción del alta queda **reintentar­ble** desde la ficha del empleado. (Decisión abierta P2: ¿revertir la contratación si falla el alta, o crear el empleado y dejar el alta pendiente con botón de reintento? — ver §7)
- Requisito previo: `gestoria_email` configurado. Si no lo está, no se permite contratar (mensaje: configúralo en Ajustes → RRHH → Reclutamiento).

---

## 4. Flujo de firma del contrato (conectar Firmas existente)

1. El correo de alta a la gestoría incluye un **botón "Subir contrato firmado por la empresa"** → enlace público con token: `/gestoria/contrato/[token]`.
2. Token nuevo, de un solo uso, asociado al empleado/alta. Tabla nueva `gestoria_contrato_tokens` (o reutilizar patrón de `firmas_tokens`). Caduca (p.ej. 30 días).
3. La página pública (sin login) muestra los datos del alta (solo lectura) y un campo para **subir el PDF del contrato**.
4. Al subir el PDF, server-side:
   - Se crea un documento de firma reutilizando la lógica de `crearFirma` → **versión sistema/pública** (sin requerir admin con sesión), con:
     - `empleado_id` = el trabajador, `tipo='contrato'`, `modalidad='manuscrita_digital'`, `estado='pendiente'`.
   - Esto **ya dispara automáticamente**: email de invitación de firma al trabajador + notificación in-app al trabajador + entrada en módulo Firmas + audit trail.
   - El token de gestoría se marca como consumido.
5. **Avisos a RRHH (nuevo)**: al subir la gestoría el contrato, se envía:
   - **Email a `rrhh_email`** (campo nuevo): "La gestoría ha subido el contrato de {trabajador}. Revisa si lo firma."
   - **Notificación in-app a RRHH** (segmento: correo/depto RRHH — ver P3) con `accion_url` a `/rrhh/firmas`.
6. El trabajador firma en `/firmar/[token]` (manuscrita, ya implementado). Al firmar:
   - El estado pasa a `firmado` (ya implementado), copia firmada al trabajador (ya implementado).
   - **Nuevo opcional**: notificar a RRHH "el trabajador ha firmado el contrato".
7. RRHH ve el estado (pendiente/firmado) en `/rrhh/firmas` y en la ficha del empleado (ya implementado).

---

## 5. Cambios de base de datos (migraciones nuevas, idempotentes)

1. `ALTER TABLE reclutamiento_config ADD COLUMN IF NOT EXISTS rrhh_email text;`
2. Tabla nueva `gestoria_contrato_tokens` (id, empleado_id, empresa_id, token_hash, expira_en, consumido_en, created_at) + índices + RLS. (O evaluar reutilizar `firmas_tokens` con un flag; preferible tabla propia por claridad.)
3. (Opcional, según P2) columna en `empleados` o `empleado_condiciones` para marcar "alta gestoría enviada / pendiente / contrato subido" y permitir reintento y seguimiento.

Todas como ficheros `.sql` versionados e idempotentes (regla de proyecto).

---

## 6. Fases de implementación (en orden, sin dejar nada)

- **Fase 1 — Correo RRHH + avisos (lo más pequeño):**
  - Migración `rrhh_email`. UI en `ConfigGeneralConfig`/`GestoriaConfig` para configurarlo. Helper para leerlo.
- **Fase 2 — Plantilla de puesto completa (R1):**
  - Validación en `upsertPuestoSalario` + UI: no permitir activar sin datos; marcar campos requeridos; permitir borrador.
- **Fase 3 — DNI del candidato (R2):**
  - Campo DNI en formulario público + Zod en la API + edición en ficha candidato + validación de formato.
- **Fase 4 — Bloqueos de contratación (R3, R4):**
  - `contratarCandidato`: validar dni + plantilla completa + gestoria_email antes del lock; manejar fallo de alta (P2).
- **Fase 5 — Subida del contrato por la gestoría (firma):**
  - Migración tokens. Página pública `/gestoria/contrato/[token]` + action de subida. Botón en el email de alta. Reutilizar `crearFirma` (versión sistema).
- **Fase 6 — Avisos a RRHH al subir contrato y al firmar:**
  - Email a `rrhh_email` + notificación in-app a RRHH (al subir) y (opcional) al firmar.
- **Fase 7 — QA end-to-end** con un candidato de prueba: plantilla completa → DNI → contratar → alta a gestoría con datos → subir contrato → firma del trabajador → estados y avisos.

---

## 7. Decisiones abiertas (a confirmar antes de programar)

- **P1 — DNI en el portal público:** ¿obligatorio que el candidato meta su DNI al inscribirse, o opcional en el portal y obligatorio solo en el momento de contratar (lo rellena RRHH si falta)? *Recomendado: opcional en el portal, obligatorio para contratar.*
- **P2 — Si falla el alta a la gestoría:** ¿revertir la contratación entera, o crear el empleado y dejar el alta como "pendiente de reenvío" con botón en la ficha? *Recomendado: crear empleado + alta pendiente reintentable (no perder la contratación ya hecha), bloqueando solo si falta gestoria_email de entrada.*
- **P3 — Destinatario in-app de "RRHH":** el email va a `rrhh_email`. Para la **notificación in-app**, ¿a quién? ¿Directores/Admins, o depto RRHH? *Recomendado: Directores/Admins (siempre existen).*
- **P4 — Validez de firma:** el contrato, ¿`eidas_simple` o `eidas_avanzada`? *Recomendado: eidas_avanzada (con OTP) por ser un contrato laboral.* — Nota: el usuario pidió firma **manuscrita**; manuscrita + OTP = avanzada.

---

## 8. Qué NO se toca

- El motor de firmas (`/firmar/[token]`, OTP, audit, PDF) se reutiliza tal cual.
- El motor de notificaciones (`emitirNotificacion`) y de email (`sendEmail`) se reutilizan.
- No se cambian datos de ninguna empresa concreta; solo código compartido (regla multi-tenant).
