# PRP-078: Entregas individuales con firma del trabajador al entregar y al devolver

> **Estado**: PENDIENTE
> **Fecha**: 2026-08-20
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Convertir el submódulo Entregas en un registro de **una cosa por entrega** (una fila = un objeto entregado), donde el trabajador **firma por correo dos veces**: al recibirlo (acta de entrega) y al devolverlo (acta de devolución), quedando ambos PDFs firmados en su carpeta de documentos.

## Por Qué

| Problema | Solución |
|----------|----------|
| La entrega actual agrupa varias cosas en un mismo acta multi-línea: si el trabajador devuelve solo las llaves, el acta firmada ya no refleja la realidad y no hay forma de firmar la devolución de una sola cosa | Una entrega = un objeto. Cada objeto tiene su propio ciclo de vida y su propia firma, independiente de los demás |
| El estado `pendiente_firma` existe en la BD y la UI lo pinta, pero **ninguna acción lo produce**: `enviarEntregaAFirma` se menciona en un comentario y no está implementada. Hoy nada se firma | Se implementa el envío a firma reutilizando `crearFirmaInterno` (mismo motor que contrato, baja y sanción) |
| La devolución es una casilla que marca RRHH (`marcarItemDevuelto`): la empresa afirma unilateralmente que le devolvieron las llaves, sin prueba del trabajador | La devolución genera su propia acta que el trabajador firma por correo; la casilla deja de ser la fuente de verdad |
| Si el trabajador se va y niega haber recibido el material, no hay documento oponible | Dos actas firmadas con sello eIDAS (OTP + trazo manuscrito + audit trail) por cada objeto |

**Valor de negocio**: cierra el círculo legal del material entregado. La empresa puede descontar en finiquito o reclamar lo no devuelto con un documento firmado por objeto, y el offboarding deja de depender de la palabra de RRHH.

## Qué

### Criterios de Éxito
- [ ] Una entrega contiene **exactamente un objeto** (tipo, cantidad y talla). El diálogo de alta ya no permite añadir líneas.
- [ ] Al crear la entrega se envía **al momento** el acta de entrega a firma: correo al trabajador **y** notificación in-app, ambos con enlace `/firmar/{token}` (regla `feedback_firmas_email_y_notificacion`).
- [ ] Al firmar la entrega, el estado pasa a `firmada`, se guarda `firmada_en` y el PDF firmado se archiva en `documentos_empleado` con categoría `entregas` (la categoría ya existe en el CHECK).
- [ ] Un objeto con `requiere_devolucion` ofrece a RRHH la acción **Pedir devolución**, que genera un acta de devolución distinta y la manda a firmar por el mismo circuito.
- [ ] Al firmar la devolución, la entrega pasa a `devuelta`, se rellena `devuelto_en`, y el acta de devolución firmada también se archiva en `documentos_empleado`.
- [ ] El trabajador ve en su portal (`/mi-panel/entregas` y `/m/entregas`) qué tiene, qué firmó y qué tiene pendiente de firmar, con enlace a firmar.
- [ ] El offboarding lista lo pendiente de devolver leyendo el nuevo modelo; nada que requiera devolución queda cerrado sin acta firmada.
- [ ] Las entregas ya firmadas **no se pueden borrar ni editar** (son documentos legales); el histórico conserva el nombre del tipo congelado.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Happy path (entrega):** RRHH entra en Entregas → «Nueva entrega». Elige trabajador, un tipo del catálogo (p. ej. «Llaves del local»), cantidad, talla si el tipo la pide, y una nota libre. Guarda. El sistema genera el PDF del acta de entrega, lo manda a firma con firma manuscrita + OTP, y el trabajador recibe correo + notificación. La fila aparece como «Pendiente de firma». El trabajador abre el enlace, valida el código, firma a mano y confirma: la fila pasa a «Firmada», él recibe copia por correo y el acta queda en su carpeta de documentos.

**Happy path (devolución):** El trabajador se va o devuelve las llaves. RRHH pulsa «Pedir devolución» en esa fila. El sistema genera el acta de devolución (mismo objeto, fecha de devolución, referencia al acta de entrega original) y la manda a firma por el mismo circuito. La fila pasa a «Pendiente de firma de devolución». Cuando el trabajador firma, pasa a «Devuelta» y el segundo acta se archiva junto al primero.

**Camino alterno (rechazo):** Si el trabajador rechaza el acta (dice que no recibió eso), la entrega queda `rechazada` con el motivo, y RRHH puede borrarla y rehacerla. Lo firmado nunca se borra.

---

## Contexto

### Referencias

**Lo que YA existe (implementación previa sin firma, se reutiliza y se corrige):**
- `supabase/migrations/20260820100000_entregas_material_uniforme.sql` — crea `entregas_tipos_material` (catálogo por empresa con `requiere_talla` / `requiere_devolucion` + seed de 15 tipos canónicos), `entregas_material` (cabecera, ya tiene `firma_id`, `firmada_en`, estados `borrador|pendiente_firma|firmada|rechazada`) y `entregas_material_items` (líneas con `devuelto_en`/`devuelto_por`). RLS por `empresas_del_usuario()` + el propio empleado. Añade `'entregas'` al CHECK de `documentos_empleado.categoria`.
- `src/features/rrhh/actions/entregas-actions.ts` — `listEntregas`, `listEntregasPorEmpleado`, `listMisEntregas`, `crearEntrega`, `actualizarNotaEntrega`, `marcarItemDevuelto`, `borrarEntrega`. **`enviarEntregaAFirma` se cita en el comentario de cabecera (L17) pero NO existe en el código.**
- `src/features/rrhh/data/entregas.ts` — tipos puros + `resumirMaterial()` y `pendientesDeDevolucion()` (ambas agregan líneas de varias entregas; hay que reescribirlas al modelo de un objeto por entrega).
- `src/features/rrhh/components/entregas/EntregasView.tsx` — lista + KPIs («Firmadas», «Pendientes de firma» ya pintados aunque nada los produzca) + engranaje de Configuración que abre `TiposMaterialConfig`.
- `src/features/rrhh/components/entregas/NuevaEntregaDialog.tsx` — **hoy es multi-línea** (`LineaForm[]` con añadir/quitar): es lo que hay que reducir a un objeto.
- `src/features/rrhh/components/empleados/EntregasEmpleadoTab.tsx`, `src/features/mi-panel/components/MisEntregasView.tsx` — ficha del empleado y portal.
- Navegación ya cableada: `nav-routes.tsx` L94 (`/mi-panel/entregas`) y L163 (`/rrhh/entregas`), `MasGrid.tsx` L38 (`/m/entregas`), `reglas-submodulos-catalogo.ts` L342 (`placeholder("entregas", "Entregas")` — hay que darle reglas reales).

**Motor de firmas (se reutiliza tal cual, sin tocarlo):**
- `src/features/rrhh/services/firmas/crear-firma.ts` — `crearFirmaInterno(input: CrearFirmaInternoInput)`. Sube el PDF al bucket `firmas`, crea `firmas_documentos` + token, y manda el correo. Devuelve `{ ok, documentoId, emailEnviado }`. Parámetros clave: `empresaId`, `empleadoId`, `pdf: Buffer`, `titulo`, `tipo` (texto libre), `modalidad`, `plazoDias`/`plazoHoras`, `preferirEmailPersonal`, `enviadoPorUserId`, `enviadoPorNombre`, `posicionFirmaDefault`.
- `supabase/migrations/20260515160000_firmas_eidas.sql` — **`firmas_documentos.tipo` es `text not null` SIN CHECK**: añadir los tipos `entrega_material` y `devolucion_material` **NO requiere migración**.
- `src/app/firmar/[token]/actions.ts` — flujo público de firma. En L664–687 está el patrón exacto a replicar: tras firmar, si `doc.tipo === 'sancion_disciplinaria'` copia el PDF firmado a `empleados-docs` + inserta en `documentos_empleado`. En L692 cierra la notificación con `marcarNotificacionesVistasPorRef("firmas_documentos", documentoId)`.
- `src/features/rrhh/services/firmas/baja-voluntaria-pdf.ts` y `reconocimiento-medico-pdf.ts` — patrón de generador con `pdf-lib`: el generador **calcula y devuelve la posición del hueco de firma** (`posicionFirma`), nunca se pone a ojo (regla de `project_baja_contrato_firma_confirmacion`).
- `src/features/rrhh/actions/firmas-actions.ts` — `notificarFirmaPendiente()` (emite la notificación in-app con `refTabla: "firmas_documentos"`, `accionUrl` = enlace de firma, `dedupeKey`).
- `src/features/notificaciones/lib/catalogo.ts` — no tiene claves de entregas; hay que añadirlas (el CHECK de `notificaciones.tipo` en BD solo admite `info|alerta|error|exito|recordatorio|liquidacion|liquidacion_pagada` → usar `"info"`).

### Arquitectura Propuesta (Feature-First)

```
src/features/rrhh/
├── services/firmas/
│   └── entrega-material-pdf.ts        # NUEVO: genera acta de entrega y de
│                                      #   devolución (devuelve {pdf, posicionFirma})
├── actions/
│   └── entregas-actions.ts            # + enviarEntregaAFirma()
│                                      # + pedirDevolucionEntrega()
│                                      # crearEntrega() pasa a un objeto
├── data/entregas.ts                   # estados nuevos; resumirMaterial() y
│                                      #   pendientesDeDevolucion() reescritas
└── components/entregas/
    ├── NuevaEntregaDialog.tsx         # de multi-línea a UN objeto
    └── EntregasView.tsx               # acciones Enviar a firma / Pedir devolución

src/app/firmar/[token]/actions.ts      # hook post-firma para los 2 tipos nuevos
```

### Modelo de Datos

El modelo actual es cabecera + líneas. Se pasa a **una fila = un objeto**, conservando las tablas existentes (no se recrea nada) y sin romper el histórico ya grabado.

```sql
-- 1) Estados nuevos del ciclo completo del objeto.
alter table public.entregas_material drop constraint if exists entregas_material_estado_check;
alter table public.entregas_material add constraint entregas_material_estado_check
  check (estado in (
    'borrador',
    'pendiente_firma',            -- acta de entrega enviada
    'firmada',                    -- el trabajador la reconoció: la tiene
    'rechazada',
    'pendiente_firma_devolucion', -- acta de devolución enviada
    'devuelta'                    -- devolución firmada: ciclo cerrado
  ));

-- 2) Firma y fecha de la DEVOLUCIÓN (la de entrega ya existe: firma_id / firmada_en).
alter table public.entregas_material
  add column if not exists devolucion_firma_id uuid
    references public.firmas_documentos(id) on delete set null,
  add column if not exists devolucion_firmada_en timestamptz,
  add column if not exists devuelto_en timestamptz,
  add column if not exists motivo_rechazo text;

-- 3) Una entrega = un objeto: se garantiza a nivel de BD que no haya 2 líneas.
--    Las entregas viejas multi-línea (si las hubiera) se parten en una por línea
--    ANTES de crear el índice, en la misma migración e idempotente.
create unique index if not exists entregas_material_items_una_por_entrega_uk
  on public.entregas_material_items (entrega_id);
```

> Nota: se mantiene `entregas_material_items` como tabla (una fila por entrega) en vez de aplanar las columnas en la cabecera, porque conserva intactos los datos ya grabados, el nombre del tipo congelado y las RLS existentes. El aplanado se decide en la Fase 1 si el volumen actual es cero.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas se generan al entrar en cada fase.

### Fase 1: Modelo de un objeto por entrega
**Objetivo**: Migración idempetente con los estados nuevos, las columnas de devolución y el índice de un objeto por entrega, partiendo antes cualquier entrega multi-línea existente.
**Validación**: La migración corre dos veces seguidas sin error; ninguna entrega tiene más de una línea.

### Fase 2: Acta de entrega y acta de devolución en PDF
**Objetivo**: `entrega-material-pdf.ts` genera los dos documentos (objeto, cantidad, talla, fecha, empresa, trabajador, nota; la devolución referencia el acta original), devolviendo la posición exacta del hueco de firma.
**Validación**: Ambos PDFs se generan y abren correctamente, con el hueco de firma donde corresponde.

### Fase 3: Envío a firma de la entrega
**Objetivo**: `enviarEntregaAFirma()` reutiliza `crearFirmaInterno` (tipo `entrega_material`, manuscrita + OTP) y emite correo **y** notificación in-app; `crearEntrega()` pasa a un objeto y dispara el envío.
**Validación**: Crear una entrega deja la fila en `pendiente_firma`, llega el correo y aparece la notificación con enlace.

### Fase 4: Firma de la entrega y archivado
**Objetivo**: Al firmar el tipo `entrega_material`, la entrega pasa a `firmada` y el PDF firmado se archiva en `documentos_empleado` categoría `entregas` (patrón sanción, L664–687).
**Validación**: Firmar de punta a punta deja la fila «Firmada» y el acta visible en la carpeta de documentos del trabajador.

### Fase 5: Ciclo de devolución con firma
**Objetivo**: `pedirDevolucionEntrega()` genera y envía el acta de devolución; al firmarla la entrega pasa a `devuelta` con su fecha, y el segundo acta se archiva igual.
**Validación**: Un objeto con `requiere_devolucion` recorre entrega → firmada → pendiente de devolución → devuelta, con dos PDFs firmados en su carpeta.

### Fase 6: UI de RRHH y portal del trabajador
**Objetivo**: Diálogo de alta de un solo objeto; lista con los estados nuevos y las acciones Enviar a firma / Pedir devolución; ficha del empleado y portal (web y móvil) muestran lo que tiene y lo pendiente de firmar; `resumirMaterial()` y `pendientesDeDevolucion()` reescritas; reglas reales del submódulo en Ajustes.
**Validación**: Los tres accesos (`/rrhh/entregas`, `/mi-panel/entregas`, `/m/entregas`) reflejan el mismo estado real.

### Fase 7: Validación Final
**Objetivo**: Sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright confirma el circuito completo entrega → firma → devolución → firma
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

_(vacía hasta la implementación)_

---

## Gotchas

- [ ] **`firmas_documentos.tipo` NO tiene CHECK** (`text not null` a secas): añadir `entrega_material` y `devolucion_material` no necesita migración. Verificado en `20260515160000_firmas_eidas.sql`.
- [ ] **El OTP es obligatorio en TODAS las modalidades** (`firmar/[token]/actions.ts`), así que `manuscrita_digital` ya implica doble factor. Es la modalidad que usan contrato, baja y sanción: usar la misma por coherencia.
- [ ] **Correo + notificación in-app siempre juntos**, ambos con el enlace `/firmar/{token}` (`feedback_firmas_email_y_notificacion`). Al firmar, la notificación se cierra sola con `marcarNotificacionesVistasPorRef`.
- [ ] **El CHECK de `notificaciones.tipo`** solo admite `info|alerta|error|exito|recordatorio|liquidacion|liquidacion_pagada`: usar `"info"`, no una clave nueva del catálogo TS.
- [ ] **La posición de la firma la calcula el generador del PDF**, nunca se fija a ojo: el documento lo genera el sistema, así que devuelve `posicionFirma` y se pasa como `posicionFirmaDefault` (`project_baja_contrato_firma_confirmacion`).
- [ ] **Lo firmado no se borra ni se edita**: `borrarEntrega` ya bloquea el estado `firmada`; hay que extender el bloqueo a `pendiente_firma_devolucion` y `devuelta`.
- [ ] **El nombre del tipo va congelado** en la línea (`tipo_nombre`, `categoria`): si mañana se borra el tipo del catálogo, el acta firmada debe seguir diciendo lo mismo.
- [ ] **Aislamiento por empresa lo da el código, no la RLS**: toda consulta filtra por `empresa_id` de la empresa activa (`project_aislamiento_empresa_activa_no_lo_da_la_rls`).
- [ ] **Empleado multiempresa**: la ficha es espejo por empresa; las entregas son de la ficha de la empresa activa, no del usuario global.
- [ ] **Zona horaria por empresa**: nunca `toLocale*` sin la `zonaHoraria` de la empresa; en BD todo UTC.
- [ ] El correo de firma debe ir al **email personal** del trabajador (`preferirEmailPersonal: true`): el material entregado es asunto suyo y debe llegarle aunque pierda el corporativo al salir.

## Anti-Patrones

- NO crear un motor de firmas propio para entregas: se reutiliza `crearFirmaInterno`.
- NO dejar que la casilla manual de RRHH siga siendo la prueba de la devolución.
- NO borrar ni reescribir actas firmadas (para eso está `rechazada`).
- NO ignorar errores de TypeScript ni usar `any`.
- NO hardcodear los tipos de material: salen del catálogo por empresa.
- NO omitir validación en las server actions.

---

*PRP pendiente aprobación. No se ha modificado código.*
