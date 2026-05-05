# PRP-034: Flujo Reclutamiento → Empleado/Usuario + Página Pública de Empleo

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-05
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Cerrar el círculo Reclutamiento → Empleado/Usuario: una página pública de empleo (compartible y embebible) recoge candidaturas que entran al pipeline de Reclutamiento; cuando un candidato llega a fase de prueba, un botón único lo convierte automáticamente en empleado y usuario del sistema; en su primer login, un wizard bloqueante le pide solo los datos personales que faltan. Los datos personales nunca se introducen manualmente desde RRHH/Ajustes — siempre nacen aquí.

## Por Qué

| Problema | Solución |
|----------|----------|
| RRHH dedica horas a teclear datos personales (DNI, IBAN, dirección…) que el propio empleado conoce mejor | El empleado los rellena él mismo en su primer login. RRHH no toca un campo. |
| Datos del candidato (nombre, email, teléfono, CV) se duplican manualmente al crear el empleado | Al promover, se traspasan automáticamente. Cero re-tipeo. |
| Cada empresa publica sus ofertas en mil sitios sin orden ni landing dedicada | Una URL pública por empresa + iframe embebible para la web del restaurante. |
| Riesgo de duplicar empleados al re-contratar | Detección automática por email/DNI → reactivar ficha antigua y vincular candidato. |
| Empleados despedidos en fase de prueba sin baja correcta (gap legal) | Aviso obligatorio que fuerza a iniciar el flujo OFF de Boarding antes de cerrar. |

**Valor de negocio**: tiempo de alta de empleado de ~30 min a ~2 min, cobertura de datos personales 100% (wizard bloqueante), captación de candidatos sin coste extra, trazabilidad legal de altas y bajas.

## Qué

### Criterios de Éxito

- [ ] URL pública por empresa que lista las ofertas activas y visibles, sin login.
- [ ] Cada oferta tiene URL individual estable y compartible (link directo + OpenGraph).
- [ ] Formulario público (nombre, apellidos, email, teléfono, CV PDF) inserta `candidatos` con `empresa_id`, `puesto_id`, `departamento_id` derivados de la oferta.
- [ ] Página pública embebible vía `<iframe>` (CSP `frame-ancestors` configurado).
- [ ] Botón "Crear en sistema" SOLO visible cuando el candidato está en `fase=seleccionado` y `estado=prueba`.
- [ ] Al pulsar el botón:
  - Si email/DNI ya existe en `empleados` → reactivar ficha antigua, vincular candidato, NO duplicar.
  - Si no existe → mini-dialog confirma rol+depto (pre-rellenados desde la oferta) → crea `empleados` + `profiles` + `auth.users`.
  - Envía magic link al email.
  - Marca candidato como promovido y guarda `empleado_id`.
  - Registra evento en `audit_log`.
  - Notifica in-app a Director y a usuarios con rol RRHH.
- [ ] Idempotente: dos clicks no duplican.
- [ ] Empleado entra con magic link → `perfil_completado=false` → wizard bloqueante. No navega a nada hasta completar campos obligatorios.
- [ ] Wizard solo pide campos vacíos en `empleados` (los del candidato no se vuelven a pedir).
- [ ] Al completar: `perfil_completado=true` + (opcional) dispara proceso de Onboarding con plantilla por defecto.
- [ ] **Movimiento atrás del candidato tras promover**: permitido, con aviso "ya es empleado, movimiento solo organizativo".
- [ ] **Movimiento a `descartado` tras promover**: NO desactiva. Modal "inicia Offboarding" → al confirmar crea `procesos_boarding` con `tipo=offboarding`.

### Comportamiento Esperado (Happy Path)

1. Candidato entra a `https://surestaurante.bh.app/empleo` (o `bh.app/empleo/surestaurante`). Ve listado de ofertas. Clica una.
2. Página de oferta + formulario (nombre, apellidos, email, teléfono, CV). Captcha. Envía.
3. Sistema crea `candidatos` con `empresa_id`, `oferta_id`, `puesto_id`, `fase=nuevo`, `estado=nuevo`.
4. RRHH ve la tarjeta en el kanban. La mueve: `nuevo` → `entrevista` → `teorica` → `practica` → fase `seleccionado` con estado `prueba`.
5. Aparece botón "Crear en sistema". RRHH lo pulsa.
6. Mini-dialog confirma rol + departamento (pre-rellenados desde la oferta). Confirmar.
7. Sistema: chequea duplicados → crea `auth.users` + `profiles` + `empleados` con datos del candidato traspasados → marca `candidatos.promovido_at` y `empleado_id` → envía magic link → audit_log + notificaciones.
8. Empleado recibe email → click magic link → entra al sistema.
9. Layout protegido detecta `perfil_completado=false` → renderiza `WizardPrimerAcceso` a pantalla completa.
10. Wizard pide solo campos faltantes: foto, DNI/NIE+copia, fecha nac., dirección, IBAN, contacto emergencia, talla uniforme, alergias, Nº SS.
11. Empleado completa. Sistema marca `perfil_completado=true` y opcionalmente crea `procesos_boarding(tipo=onboarding)`.
12. Redirige a `/dashboard` con acceso completo.

---

## Contexto

### Estado actual del codebase

- **Reclutamiento**: ya existe en `src/features/rrhh/components/reclutamiento/` con kanban. Tabla `candidatos` con fases y estados — el estado `prueba` dentro de fase `seleccionado` ya existe, dispara la aparición del botón.
- **Empleados**: tabla `empleados` con la mayoría de campos. `profile_id` nullable → encaja para ligar auth user. Faltan campos: `talla_uniforme`, `alergias_medicas`, `iban`, `dni_archivo_url`, `contacto_emergencia_*`, `perfil_completado`.
- **Profiles + Auth**: trigger `handle_new_user()` ya crea profile al insertar en `auth.users`. `admin.generateLink()` ya usado para invitar.
- **Boarding**: tablas `plantillas_boarding` y `procesos_boarding` con `tipo='onboarding'|'offboarding'` listas para invocar.
- **Auditoría**: tabla `audit_log` + `fn_audit_log()`. Insertar manualmente evento `PROMOTE_CANDIDATO`.
- **Notificaciones**: tabla `notificaciones` con RLS por `usuario_id`.
- **Multi-tenant**: `empresa_id` UUID en todas las tablas. **No existe `slug` en `empresas`** → añadirlo.
- **Rutas públicas**: `/carta/[slug]/` es buen patrón a copiar para `/empleo/[empresa-slug]/`.
- **Emails**: `src/lib/email/send.ts` orquesta SMTP por empresa con fallback a Resend. Reutilizar.
- **RBAC**: `canAccess()` en `auth-context.tsx`, permisos por módulo en `ajustes/data/ajustes.ts`. Usar permiso editar sobre `rrhh.reclutamiento`.

### Referencias de patrón

- `src/app/carta/[slug]/page.tsx` — página pública multi-tenant con slug.
- `src/features/admin/` — magic link / invitación.
- `src/features/rrhh/io/boarding.io.ts` — invocar procesos.
- `src/features/rrhh/io/reclutamiento.io.ts` — IO de candidatos (extender).
- `src/lib/email/send.ts` — envío de emails.
- `.claude/memory/project_flujo_reclutamiento_empleado.md` — regla de negocio canónica.

### Arquitectura propuesta

```
src/
├── app/
│   ├── empleo/                                # Rutas públicas
│   │   ├── [empresa-slug]/
│   │   │   ├── page.tsx                       # Listado público
│   │   │   └── [oferta-id]/
│   │   │       ├── page.tsx                   # Ficha + form
│   │   │       └── confirmacion/page.tsx
│   │   └── layout.tsx                         # Branding por empresa
│   ├── api/
│   │   ├── empleo/
│   │   │   ├── [empresa-slug]/route.ts        # GET listado
│   │   │   └── candidatura/route.ts           # POST con captcha + rate-limit
│   │   └── reclutamiento/promover/route.ts    # POST candidato → empleado+user
│   └── (protegido)/primer-acceso/page.tsx     # Wizard bloqueante
│
├── features/
│   ├── empleo-publico/                        # NUEVO
│   │   ├── components/
│   │   │   ├── ListadoOfertasPublico.tsx
│   │   │   ├── FichaOfertaPublica.tsx
│   │   │   ├── FormCandidaturaPublica.tsx
│   │   │   ├── EmpleoBrandingShell.tsx
│   │   │   └── SnippetEmbed.tsx
│   │   ├── io/empleo-publico.io.ts
│   │   ├── services/captcha.ts
│   │   └── types/oferta.ts
│   ├── primer-acceso/                         # NUEVO
│   │   ├── components/
│   │   │   ├── WizardPrimerAcceso.tsx
│   │   │   ├── PasoFotoYDocumentos.tsx
│   │   │   ├── PasoDireccion.tsx
│   │   │   ├── PasoBancario.tsx
│   │   │   ├── PasoEmergencia.tsx
│   │   │   └── PasoUniformeYSalud.tsx
│   │   ├── hooks/usePrimerAccesoGate.ts
│   │   ├── io/primer-acceso.io.ts
│   │   └── schemas/primer-acceso.zod.ts
│   └── rrhh/                                  # EXTENSIÓN
│       ├── components/reclutamiento/
│       │   ├── BotonCrearEnSistema.tsx        # NUEVO
│       │   ├── DialogConfirmarRolDepto.tsx    # NUEVO
│       │   ├── DialogAvisoOffboarding.tsx     # NUEVO
│       │   ├── GestionOfertasPublicas.tsx     # NUEVO
│       │   └── DialogSnippetEmbed.tsx         # NUEVO
│       └── io/
│           ├── promocion.io.ts                # NUEVO
│           └── ofertas-empleo.io.ts           # NUEVO
│
└── shared/lib/middleware/
    └── primer-acceso-gate.ts                  # Guard global
```

### Modelo de datos (cambios en BD)

```sql
-- 1. Slug y branding de empresa
ALTER TABLE empresas ADD COLUMN slug TEXT UNIQUE;
ALTER TABLE empresas ADD COLUMN logo_url TEXT;
ALTER TABLE empresas ADD COLUMN color_primario TEXT;
UPDATE empresas
SET slug = lower(regexp_replace(nombre, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
ALTER TABLE empresas ALTER COLUMN slug SET NOT NULL;

-- 2. Ofertas de empleo
CREATE TABLE ofertas_empleo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  departamento_id UUID REFERENCES departamentos(id),
  puesto_id UUID REFERENCES puestos(id),
  tipo_jornada TEXT,
  ubicacion TEXT,
  salario_rango TEXT,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','cerrada','borrador')),
  visible_publicamente BOOLEAN NOT NULL DEFAULT false,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ofertas_empresa_visible
  ON ofertas_empleo(empresa_id, visible_publicamente, estado);
ALTER TABLE ofertas_empleo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ofertas_publicas_lectura" ON ofertas_empleo FOR SELECT
  USING (visible_publicamente = true AND estado = 'activa');
CREATE POLICY "ofertas_internas_rw" ON ofertas_empleo FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM profiles WHERE user_id = auth.uid()));

-- 3. Vincular candidatos a oferta y empleado
ALTER TABLE candidatos ADD COLUMN oferta_id UUID REFERENCES ofertas_empleo(id);
ALTER TABLE candidatos ADD COLUMN empleado_id UUID REFERENCES empleados(id);
ALTER TABLE candidatos ADD COLUMN promovido_at TIMESTAMPTZ;
ALTER TABLE candidatos ADD COLUMN promovido_por UUID REFERENCES auth.users(id);
CREATE INDEX idx_candidatos_oferta ON candidatos(oferta_id);
CREATE INDEX idx_candidatos_empleado ON candidatos(empleado_id);

-- 4. Campos del wizard
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS perfil_completado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS perfil_completado_at TIMESTAMPTZ;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS dni_archivo_url TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS contacto_emergencia_relacion TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS talla_uniforme TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS alergias_medicas TEXT;

-- 5. Storage buckets:
--    cvs-candidatos: insert solo desde server (service_role); lectura interna por empresa
--    empleados-docs: insert/select solo el propio empleado o RRHH de su empresa

-- 6. Rate limiting de candidaturas
CREATE TABLE candidaturas_rate_limit (
  ip_hash TEXT NOT NULL,
  empresa_id UUID NOT NULL,
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, empresa_id)
);
```

### Reglas RLS clave

- `ofertas_empleo`: lectura pública solo `visible_publicamente=true AND estado='activa'`. Resto, RBAC por empresa.
- `candidatos`: insert público solo desde API server-side (service_role tras captcha + rate-limit). Resto interno por empresa.
- `empleados.iban`, `empleados.contacto_emergencia_*`, `empleados.dni_*`: visibles solo para el propio empleado y RRHH/Director de su empresa.

---

## Blueprint (Assembly Line)

### Fase 1: Migraciones de BD y storage
**Objetivo**: Esquema listo, buckets creados, slug backfilled.
**Validación**: migración limpia en branch, slug único en todas las empresas, buckets listados, advisors sin warnings.

### Fase 2: Gestión interna de ofertas de empleo
**Objetivo**: CRUD de ofertas en Reclutamiento con toggle de visibilidad pública.
**Validación**: crear/editar/cerrar funciona, toggle persistido, RBAC respetado.

### Fase 3: Página pública de empleo (multi-tenant)
**Objetivo**: rutas `/empleo/[empresa-slug]` y `/empleo/[empresa-slug]/[oferta-id]`, branding, captcha, rate-limit, CSP iframe-friendly.
**Validación**: acceso sin login, embed iframe funciona desde dominio externo, captcha rechaza bots, rate-limit corta, OG/SEO ≥ 90.

### Fase 4: Snippet de embed
**Objetivo**: modal "Compartir oferta" con tabs Link/Iframe/Botón.
**Validación**: snippets pegados en HTML externo renderizan correctamente.

### Fase 5: Botón "Crear en sistema" + flujo de promoción
**Objetivo**: botón visible solo en estado=prueba, dialog rol+depto, endpoint orquestador idempotente con detección de duplicados.
**Validación**: E2E postular → mover a prueba → pulsar → empleado+user creados + email entregado. Re-contratación reactiva. Doble click no duplica.

### Fase 6: Wizard bloqueante de primer login
**Objetivo**: gate global, wizard multi-paso con Zod, solo campos vacíos, opcional dispara onboarding.
**Validación**: empleado no accede sin completar, validaciones tolerantes (IBAN), subida de DNI/foto correcta, una vez completo desbloquea normal.

### Fase 7: Movimientos posteriores en el pipeline
**Objetivo**: interceptar cambios de fase tras promoción (toast atrás / modal offboarding adelante).
**Validación**: E2E mover atrás → toast, NO modificar empleado. Mover a descartado → modal → confirmar crea offboarding y redirige.

### Fase 8: Auditoría y notificaciones
**Objetivo**: cada promoción genera fila en audit_log + notificaciones in-app a Director y RRHH.
**Validación**: query a audit_log muestra fila, notificaciones llegan con accion_url funcional.

### Fase 9: Validación final
**Objetivo**: sistema end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] `npm run lint` sin errores
- [ ] Playwright E2E completo: postulación → kanban → promoción → magic link → wizard → empleado activo
- [ ] Playwright re-contratación
- [ ] Playwright descarte tras promoción dispara offboarding
- [ ] Lighthouse pública: SEO ≥ 90, Perf ≥ 80, A11y ≥ 95
- [ ] `mcp__supabase__get_advisors` sin warnings nuevos
- [ ] MEMORY.md alineado

---

## 🧠 Aprendizajes (Self-Annealing)

*(Vacía — se rellena al ejecutar cada fase)*

---

## Gotchas

- [ ] **`X-Frame-Options` vs CSP `frame-ancestors`**: el middleware/`next.config` puede inyectar `X-Frame-Options: DENY`. Sobreescribir SOLO en `/empleo/*` con `Content-Security-Policy: frame-ancestors *`.
- [ ] **Slug único de empresa**: si dos nombres normalizan igual, sufijo numérico (`-2`, `-3`).
- [ ] **`auth.users` vs `profiles` vs `empleados`**: trigger `handle_new_user()` crea profile auto. Crear primero auth.users, luego actualizar profile (empresa, nombre), luego insertar empleado con `profile_id`.
- [ ] **Magic link expira en 1h**: permitir reenvío desde la ficha del empleado.
- [ ] **Re-contratación**: comparar email AND dni_nie normalizado. Si solo email coincide pero DNI distinto → confirmación humana (puede ser email reciclado).
- [ ] **Race condition**: doble click sobre el botón → usar lock optimista en `candidatos.promovido_at` (UPDATE … WHERE promovido_at IS NULL).
- [ ] **IBAN tolerante** (MEMORY.md): no error mientras prefijo válido. Reusar componente de `ajustes/`.
- [ ] **Selector de bancos** (MEMORY.md): logo, oculta código 4 dígitos, cubre Revolut 1583.
- [ ] **Subida CV pública**: max 5MB, tipo `application/pdf`, nombre aleatorio, insert solo desde server con service_role.
- [ ] **Captcha (Turnstile)**: validar token server-side antes de aceptar.
- [ ] **Subdominio wildcard**: requiere DNS y cert wildcard. Si no es viable transparente, fallback a subruta `/empleo/[slug]`.
- [ ] **Notificaciones a "todos los RRHH"**: resolver dinámicamente desde el RBAC, no hardcodear.
- [ ] **Wizard bloqueante en backend**: validar `perfil_completado` también server-side en endpoints sensibles.
- [ ] **Audit snapshot**: capturar estado del candidato ANTES de marcar promovido.

## Anti-Patrones

- NO añadir botón "Crear empleado" en RRHH/Empleados — el alta canónica es desde Reclutamiento.
- NO duplicar la entidad empleado: si re-contratación, reactivar.
- NO bloquear el cambio de fase atrás del candidato — solo avisar.
- NO mostrar campos del wizard ya rellenos desde el candidato.
- NO permitir bypass del wizard (gate hard, no toast).
- NO usar `any`. Tipos generados por Supabase + Zod en frontera.
- NO hardcodear roles. Usar `canAccess()` y permisos por módulo.
- NO crear nuevos sistemas de email/auditoría/notificación — extender los existentes.
- NO meter formulario público sin captcha + rate-limit.

---

## Dependencias y configuración

- **Variables de entorno nuevas**:
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - `TURNSTILE_SECRET`
  - `NEXT_PUBLIC_DOMINIO_EMPLEO_PUBLICO` (ej. `bh.app`)
- **Servicios externos**: Cloudflare Turnstile (free tier).
- **Supabase**: `service_role` para crear `auth.users` desde server (ya disponible).
- **DNS**: wildcard `*.bh.app` si se opta por subdominio. Si no, no hace falta.

---

*PRP pendiente aprobación. No se ha modificado código.*
