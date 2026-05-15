# PRP-036: Firmas Electrónicas con Validez Legal eIDAS

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-15
> **Proyecto**: Balles-Hosteleros — Módulo RRHH → Firmas electrónicas

---

## Objetivo

Convertir el módulo **RRHH → Firmas** (hoy 100 % mockup en `FirmasView.tsx` + `firmas.ts`) en un sistema **real de firma electrónica con validez legal eIDAS** (Reglamento UE 910/2014, art. 25–26 — firma simple y avanzada). El admin sube un PDF y selecciona empleado; el empleado recibe un email con un enlace único, abre el documento sin login (acceso por **token de un solo uso**), verifica su identidad con un **OTP** enviado a su email (móvil opcional vía SMS), firma con **click-to-sign** o **trazo manuscrito digital**, y el sistema sella el documento con **hash SHA-256**, **timestamp servidor**, **IP** y **user-agent**. Al cerrar se genera un **acta de firma PDF** que se concatena al original; la BD conserva un audit trail inmutable. **Multi-tenant** (`empresa_id`), RLS estricta, y arquitectura preparada para subir a **eIDAS Cualificada** con un TSP acreditado (Signaturit/EvidenceProof) sin refactor de UI.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy `FirmasView` es decorativo: 12 firmas mock, 9 empleados hardcodeados (`EMPLEADOS_PARA_FIRMA`), "adjuntar PDF" rotulado *simulado*, "enviar" hace `setTimeout(600)`. No hay BD, email, ni firma real. | Persistencia real + envío Resend + página pública `/firmar/[token]` + acta PDF firmada criptográficamente. |
| Las firmas de contratos, anexos, recibos de nómina y avisos disciplinarios se mueven hoy por email o en papel: trazabilidad nula y riesgo legal alto si el empleado niega haber firmado. | Audit trail completo (envío, apertura, OTP, firma) con IP, UA y timestamp servidor → **no repudio** demostrable en juicio (eIDAS art. 25). |
| Compliance laboral (art. 8.3 ET, RGPD, control horario) exige firma del empleado en horarios, anexos contractuales y políticas de RRHH. Sin sistema válido la empresa se expone a multas. | Cubierto por eIDAS Simple (acuses, políticas) y Avanzada (contratos, modificaciones, finiquitos) — suficiente para >95 % de la documentación laboral interna. |
| Tareas manuales repetitivas: enviar contrato → recordar al empleado → recibir escaneo → archivar. | Flujo 100 % digital: 1 clic empresa → empleado firma en 30 s → PDF firmado archivado. |
| Riesgo lock-in con un solo proveedor de firma (Signaturit, DocuSign, Adobe Sign) por su precio por firma (0,30–2 €). | MVP **self-hosted** con primitivas Supabase + criptografía estándar (SHA-256, HMAC, JWT). Capa `signature_providers` extensible si en el futuro se quiere TSA cualificada externa. |

**Valor de negocio**: cada empresa-cliente ahorra 30–60 min/firma (recopilación, envío, archivado) y elimina el coste de un proveedor externo de firma (típicamente 50–200 €/mes). Además se vuelve un **vendor lock-in fuerte** del SaaS: la documentación firmada vive dentro de Balles-Hosteleros.

## Qué

### Criterios de Éxito

- [ ] Un admin/director con `empresa_id` puede pulsar **"+ Nuevo"** en `/rrhh/firmas`, subir un PDF real (≤ 10 MB), seleccionar empleado **desde la BD** (ya corregido en sesión previa), elegir modalidad (`click_to_sign` / `email_otp` / `manuscrita_digital`), plazo (1–60 días), y al enviar:
  - se guarda el PDF en bucket Storage privado,
  - se calcula `sha256_original` y se persiste,
  - se crea fila en `firmas_documentos` con estado `pendiente`,
  - se genera un token único (32 bytes random base64url) y se guarda en `firmas_tokens` (single-use, expira con el plazo),
  - se envía email vía Resend al empleado (a `email_empresa ?? email_personal`) con enlace `https://app.balleshosteleros.com/firmar/<token>`,
  - se registra evento `enviado` en `firmas_eventos`.
- [ ] El empleado abre el enlace **sin login**, ve metadatos del documento (título, empresa, remitente, fecha de envío, expiración) y un visor PDF. Se registra evento `abierto` con IP + UA + timestamp.
- [ ] Antes de firmar, el sistema le envía un **OTP de 6 dígitos** a su email (opcionalmente SMS si tiene `telefono` y el provider está configurado), válido 10 min y consumible solo 1 vez. Se registra evento `otp_enviado`.
- [ ] El empleado introduce el OTP → si es correcto, marca evento `otp_validado` y desbloquea el botón **"Firmar"**.
- [ ] Al firmar (según modalidad):
  - `click_to_sign`: basta con confirmar checkbox + click.
  - `email_otp`: idem (el OTP ya cuenta como segundo factor).
  - `manuscrita_digital`: dibuja el trazo en `<canvas>`, se guarda como PNG embebido en el acta.
  - Se persiste `firmado_en`, `ip_firma`, `user_agent`, evento `firmado` y `sha256_acta`.
- [ ] El backend genera el **acta de firma** (PDF de 1–2 páginas) con: hash SHA-256 del PDF original, datos del firmante (nombre, DNI/NIE, email, empresa), fecha/hora UTC, IP, user-agent, modalidad, validez eIDAS, lista cronológica de eventos del audit trail, e imagen del trazo manuscrito si aplica. Se concatena al PDF original → `pdf_firmado_url`.
- [ ] El admin ve en `FirmasView` el estado real (no mock) y puede **descargar el acta + documento firmado** desde la columna acciones.
- [ ] El empleado puede **rechazar** desde el portal público con motivo opcional → evento `rechazado`, estado final.
- [ ] Si el plazo vence sin firma, un job cron marca `estado='expirado'` y registra evento `expirado`.
- [ ] **RLS estricta**: una empresa solo ve sus `firmas_documentos`, `firmas_eventos`, `firmas_tokens`. El empleado solo accede al documento si su `user_id` coincide o el token es válido. El service-role del cron es la única vía con acceso global.
- [ ] Hash chain: cada evento incluye `prev_hash` (sha256 del evento anterior) → **audit trail inmutable** detectable contra manipulación.
- [ ] `npm run typecheck` y `npm run build` pasan; sin `any`, todos los inputs externos validados con Zod (especialmente la página pública `/firmar/[token]`).

### Comportamiento Esperado (Happy Path)

1. **Crear**: Admin en `/rrhh/firmas` pulsa **"+ Nuevo"** → modal `EnviarParaFirmaDialog` → arrastra/elige PDF (≤10 MB) → selecciona empleado activo de la empresa (lista real) → modalidad `click_to_sign` → plazo 7 días → opcional observaciones.
2. **Envío server-side**:
   - Sube PDF a `storage/firmas-documentos/<empresa_id>/<doc_id>/original.pdf` (bucket privado).
   - Calcula `sha256(file)` → persiste en `firmas_documentos.sha256_original`.
   - Crea fila `firmas_documentos (estado='pendiente', expira_en=now()+7d)`.
   - Genera token: `crypto.randomBytes(32).toString('base64url')`; persiste hash bcrypt en `firmas_tokens` (no plain).
   - Envía email Resend con template React Email: asunto `"Tienes un documento para firmar — <título>"`, CTA `Firmar documento`, fallback texto plano.
   - Registra evento `enviado` con `prev_hash=null`.
3. **Empleado abre email** → clic `https://app.balleshosteleros.com/firmar/<token>`:
   - Backend valida token (no expirado, no consumido, hash coincide) → si OK devuelve metadatos + signed URL del PDF.
   - Registra evento `abierto`.
   - Renderiza vista pública `FirmaPublicaView`: cabecera con logo empresa, datos remitente/destinatario, visor PDF (`<iframe>` o react-pdf), botones `Firmar` / `Rechazar`.
4. **Empleado pulsa "Firmar"** → modal pide OTP:
   - Backend genera código 6 dígitos, persiste hash en `firmas_otps (expira=now()+10min, intentos=0)`, envía email Resend con el código.
   - Registra evento `otp_enviado`.
5. **Empleado introduce OTP** → backend valida (≤3 intentos, no expirado, hash match):
   - Si modalidad `manuscrita_digital` muestra `<canvas>` para trazar firma.
   - Confirma con checkbox *"Declaro haber leído y acepto el contenido del documento"*.
   - Registra evento `otp_validado`.
6. **Click definitivo "Firmar"** → backend:
   - Persiste `firmado_en`, `ip_firma`, `user_agent`, `metodo_firma`.
   - Si manuscrita: guarda PNG en storage `firmas/<doc_id>/signature.png`.
   - **Genera acta**: usa `@react-pdf/renderer` server-side para componer el PDF de evidencia con todos los datos. Sube a `firmas/<doc_id>/acta.pdf`.
   - **Concatena** original + acta con `pdf-lib`: `firmas/<doc_id>/firmado.pdf`.
   - Calcula `sha256(firmado.pdf)` → `sha256_acta`.
   - Actualiza `firmas_documentos.estado='firmado'`, `pdf_firmado_url`.
   - Registra evento `firmado` con `prev_hash=sha256(evento_anterior_json)`.
7. **Empleado** ve pantalla de éxito *"Documento firmado correctamente"* con botón "Descargar mi copia".
8. **Admin** en `FirmasView` ve fila con badge **Firmado** + acciones Ver/Descargar acta.
9. **Cron** `/api/cron/firmas-expirar` (diario, 03:00 UTC):
   - Marca como `expirado` cualquier `firmas_documentos.estado='pendiente' AND expira_en < now()`.
   - Registra evento `expirado` por cada uno.
   - Limpia `firmas_tokens` y `firmas_otps` consumidos/expirados >30d.

### Comportamientos alternativos

- **Rechazo**: empleado pulsa `Rechazar`, opcionalmente añade motivo → evento `rechazado`, `estado='rechazado'`. No se genera acta de firma; sí se genera acta de rechazo (mismo formato).
- **Reenvío**: admin puede reenviar un documento `pendiente` (regenera token + email, **mantiene** `doc_id`). Evento `reenviado`.
- **Múltiples intentos OTP**: 3 fallidos → bloqueo 30 min + evento `otp_bloqueado`. Reset desde admin.
- **Token reusado**: si ya consumido → 410 Gone; si caducado → 410 Gone + mensaje "Documento expirado, contacta con RRHH".

---

## Contexto

### Referencias del codebase

- [src/features/rrhh/components/firmas/FirmasView.tsx](src/features/rrhh/components/firmas/FirmasView.tsx) — entry point UI a refactorizar (hoy mock; ya hicimos arreglo del dropdown de empleados en esta sesión).
- [src/features/rrhh/data/firmas.ts](src/features/rrhh/data/firmas.ts) — tipos `DocumentoFirma`, `ModalidadFirma`, `ValidezLegal`, `EstadoFirma` ya definidos: **reutilizar nombres**; mover constantes (labels, colors) y eliminar `FIRMAS_MOCK` + `EMPLEADOS_PARA_FIRMA` al final.
- [src/app/(main)/rrhh/firmas/page.tsx](src/app/(main)/rrhh/firmas/page.tsx) — page wrapper (sin cambios).
- [src/features/rrhh/actions/empleados-actions.ts](src/features/rrhh/actions/empleados-actions.ts) — patrón `listEmpleados` + `requireAdminUser` + `createAdminClient` + `getAppContext` a seguir en `firmas-actions.ts`.
- [src/lib/supabase/admin.ts](src/lib/supabase/admin.ts) — cliente service-role (cron + envío de emails server-side).
- [src/lib/supabase/get-context.ts](src/lib/supabase/get-context.ts) — `getAppContext()` para multi-tenant en server actions.
- `src/app/api/cron/agora-sync/route.ts` — patrón cron (validación `CRON_SECRET`, recorrido empresas).
- `vercel.json` — añadir entrada `crons[]` para `/api/cron/firmas-expirar`.
- Estructura empleados: `nombre`, `apellidos`, `email_empresa`, `email_personal`, `telefono`, `dni_nie` (en `profiles` vinculado por `user_id`) — el envío usa `email_empresa ?? email_personal`.

### Referencias externas

- eIDAS — Reglamento (UE) 910/2014, art. 25–26 (firma electrónica simple/avanzada/cualificada). Art. 25.1: *"No se denegarán efectos jurídicos ni admisibilidad como prueba en procedimientos judiciales a una firma electrónica por el mero hecho de ser electrónica"*. → **Una firma simple bien documentada es vinculante**.
- Real Decreto 6/2019 — control horario digital (justifica firma de acuses de horario).
- ETSI EN 319 102-1 — criterios técnicos de firma electrónica avanzada.
- Resend API: https://resend.com/docs — provider de envío.
- React Email: https://react.email — templates de email server-rendered.
- pdf-lib: https://pdf-lib.js.org — concatenación PDFs (server-side, sin headless Chrome).
- @react-pdf/renderer: https://react-pdf.org — generación del acta PDF.

### Arquitectura Propuesta (Feature-First)

```
src/features/rrhh/firmas/                              ← nuevo sub-namespace
├── components/
│   ├── FirmasView.tsx                                 ← migrar desde components/firmas/
│   ├── EnviarParaFirmaDialog.tsx                      ← nuevo (sube PDF + envía)
│   ├── DetalleFirmaDialog.tsx                         ← nuevo (audit trail + descarga)
│   └── EstadoFirmaBadge.tsx                           ← nuevo
├── data/
│   └── firmas.ts                                      ← tipos (mantener), eliminar mocks
├── actions/
│   └── firmas-actions.ts                              ← nuevo: listFirmas, crearFirma, reenviarFirma, expirarFirmas
├── services/
│   ├── pdf.ts                                         ← @react-pdf + pdf-lib: generarActa, concatenar
│   ├── crypto.ts                                      ← sha256(buffer), generarToken, hashToken, generarOTP
│   ├── email.ts                                       ← envíos Resend (invitación, OTP, copia firmada)
│   └── audit.ts                                       ← registrarEvento (con prev_hash chain)
└── types/
    └── audit.ts                                       ← TipoEvento, EventoFirma

src/app/firmar/[token]/
├── page.tsx                                           ← nuevo: vista pública (sin login)
├── actions.ts                                         ← server actions: abrirDocumento, solicitarOTP, validarOTP, firmar, rechazar
└── components/
    ├── FirmaPublicaView.tsx
    ├── VisorPdf.tsx
    ├── OtpDialog.tsx
    └── CanvasFirma.tsx                                ← solo si modalidad=manuscrita_digital

src/app/api/
├── cron/firmas-expirar/route.ts                       ← cron diario 03:00
└── firmas/
    ├── download/[doc_id]/route.ts                     ← signed URL del PDF firmado (auth + RLS)
    └── webhook/route.ts                               ← reservado (futuro TSP cualificado)

supabase/migrations/
└── 20260515120000_firmas_eidas.sql                    ← nuevo
```

### Modelo de Datos

Migración nueva: `supabase/migrations/20260515120000_firmas_eidas.sql`.

```sql
-- ─── 1. Documentos a firmar ────────────────────────────────
create table if not exists public.firmas_documentos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  empleado_id       uuid not null references public.empleados(id) on delete restrict,
  titulo            text not null,
  tipo              text not null,                       -- contrato | anexo_contrato | politica_rrhh | ... (mismo enum app-side)
  modalidad         text not null check (modalidad in ('click_to_sign','email_otp','manuscrita_digital')),
  validez           text not null default 'eidas_simple' check (validez in ('eidas_simple','eidas_avanzada','eidas_cualificada')),
  estado            text not null default 'pendiente'
                    check (estado in ('borrador','pendiente','firmado','rechazado','expirado')),
  -- Archivos en Storage
  pdf_original_path text not null,                       -- firmas/<empresa>/<id>/original.pdf
  pdf_firmado_path  text,                                -- firmas/<empresa>/<id>/firmado.pdf
  sha256_original   text not null,
  sha256_acta       text,
  -- Firma
  firmado_en        timestamptz,
  ip_firma          inet,
  user_agent        text,
  metodo_firma      text,                                -- snapshot de modalidad real usada
  motivo_rechazo    text,
  -- Metadatos
  enviado_por       uuid not null references auth.users(id) on delete restrict,
  enviado_en        timestamptz not null default now(),
  expira_en         timestamptz not null,
  observaciones     text,
  reenviado_count   integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_firmas_empresa     on public.firmas_documentos(empresa_id, estado);
create index if not exists idx_firmas_empleado    on public.firmas_documentos(empleado_id);
create index if not exists idx_firmas_expira      on public.firmas_documentos(expira_en) where estado = 'pendiente';

-- ─── 2. Tokens de acceso público (single-use) ──────────────
create table if not exists public.firmas_tokens (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references public.firmas_documentos(id) on delete cascade,
  token_hash    text not null,                           -- bcrypt(token) — nunca plain
  expira_en     timestamptz not null,
  consumido_en  timestamptz,                             -- single-use: si está set, no reusable
  created_at    timestamptz not null default now()
);

create index if not exists idx_firmas_tokens_doc  on public.firmas_tokens(documento_id);

-- ─── 3. OTPs (2º factor previo a firmar) ───────────────────
create table if not exists public.firmas_otps (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references public.firmas_documentos(id) on delete cascade,
  codigo_hash   text not null,                           -- bcrypt(otp)
  canal         text not null check (canal in ('email','sms')),
  destino       text not null,                           -- email o teléfono
  expira_en     timestamptz not null,
  intentos      integer not null default 0,
  validado_en   timestamptz,
  bloqueado_hasta timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_firmas_otps_doc    on public.firmas_otps(documento_id, created_at desc);

-- ─── 4. Audit trail con hash chain (inmutable) ─────────────
create table if not exists public.firmas_eventos (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references public.firmas_documentos(id) on delete cascade,
  tipo          text not null check (tipo in (
                  'creado','enviado','reenviado','abierto','otp_enviado','otp_validado',
                  'otp_fallido','otp_bloqueado','firmado','rechazado','expirado'
                )),
  actor_user_id uuid references auth.users(id) on delete set null,
  ip            inet,
  user_agent    text,
  metadata      jsonb not null default '{}',
  prev_hash     text,                                    -- sha256 del evento previo en JSON canónico
  hash          text not null,                           -- sha256 del evento actual incluyendo prev_hash
  ocurrido_en   timestamptz not null default now()
);

create index if not exists idx_firmas_eventos_doc on public.firmas_eventos(documento_id, ocurrido_en);

-- ─── 5. RLS ────────────────────────────────────────────────
alter table public.firmas_documentos enable row level security;
alter table public.firmas_tokens     enable row level security;
alter table public.firmas_otps       enable row level security;
alter table public.firmas_eventos    enable row level security;

-- Documentos: la empresa propietaria y el empleado firmante pueden leer.
create policy "fd_read_empresa" on public.firmas_documentos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "fd_read_empleado" on public.firmas_documentos for select to authenticated
  using (empleado_id in (select e.id from empleados e where e.user_id = auth.uid()));
create policy "fd_manage_admin" on public.firmas_documentos for all to authenticated
  using (
    empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
    and exists (select 1 from user_roles r where r.user_id = auth.uid() and r.role in ('admin','director'))
  )
  with check (
    empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
    and exists (select 1 from user_roles r where r.user_id = auth.uid() and r.role in ('admin','director'))
  );

-- Tokens: nadie autenticado los lee directamente; el acceso es vía función SECURITY DEFINER (resolverToken).
create policy "ft_no_read" on public.firmas_tokens for select to authenticated using (false);

-- OTPs: idem.
create policy "fo_no_read" on public.firmas_otps for select to authenticated using (false);

-- Eventos: igual que documentos (empresa o empleado firmante).
create policy "fe_read_empresa" on public.firmas_eventos for select to authenticated
  using (documento_id in (
    select d.id from firmas_documentos d
    where d.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ));
create policy "fe_read_empleado" on public.firmas_eventos for select to authenticated
  using (documento_id in (
    select d.id from firmas_documentos d
    where d.empleado_id in (select e.id from empleados e where e.user_id = auth.uid())
  ));

-- ─── 6. Storage bucket ─────────────────────────────────────
-- (vía mcp__supabase__create_bucket — privado, no public)
-- bucket: 'firmas'
-- policies: select/insert/update/delete solo a service-role; el cliente accede vía signed URL emitida por server action.
```

### Variables de entorno nuevas

```
RESEND_API_KEY=...
RESEND_FROM_EMAIL=firmas@balleshosteleros.com
NEXT_PUBLIC_APP_URL=https://app.balleshosteleros.com    (ya usado por PSD2)
CRON_SECRET=<ya existe — reutilizar>
FIRMA_OTP_SECRET=<32+ chars — pepper extra para HMAC del OTP>    (opcional, mejora seguridad)
```

### Decisiones de arquitectura clave

1. **Self-hosted MVP eIDAS Simple/Avanzada**, no proveedor externo. La validez legal queda cubierta por el audit trail + OTP + hash chain. **Cualificada queda fuera** (requiere TSP/TSA acreditado tipo Signaturit; añadible como `signature_provider='signaturit'` sin tocar UI).
2. **Token de un solo uso + OTP** = doble factor (algo que se envía al email del firmante + algo que también se envía al email/SMS del firmante). Suficiente para Avanzada porque el correo está ligado al empleado en BD y el OTP se valida server-side con timestamping y máximo de intentos.
3. **Hash chain en `firmas_eventos`**: cada evento incluye `prev_hash` → manipular un evento intermedio invalida toda la cadena posterior. Equivalente a Merkle ligero, simple de implementar.
4. **`pdf-lib` + `@react-pdf/renderer`** server-side (Node runtime, no Edge — `pdf-lib` no funciona en Edge). Permite acta + concatenación sin headless Chrome ni servicio externo.
5. **Storage privado + signed URLs** de 5 min para acceder al PDF original o firmado. Nunca URL pública estable.
6. **Página pública `/firmar/[token]` fuera de `(main)`** (no requiere sesión), pero **siempre** valida el token antes de mostrar metadatos. Sin token válido → 410.
7. **OTP guardado como bcrypt + canal email por defecto**; SMS deshabilitado en MVP (lo añadimos cuando integremos un provider SMS — Twilio o Vonage).
8. **`firmas_tokens` y `firmas_otps` con RLS deny-by-default** + acceso vía funciones SECURITY DEFINER para que el cliente público no pueda enumerar. Solo el endpoint server las consulta con service-role.

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar a cada fase siguiendo el bucle agéntico.

### Fase 1 — Migración BD y bucket Storage
**Objetivo**: migración `20260515120000_firmas_eidas.sql` aplicada con `firmas_documentos`, `firmas_tokens`, `firmas_otps`, `firmas_eventos`, índices y RLS. Bucket privado `firmas` creado. Verificar con `mcp__supabase__get_advisors` que no hay issues críticos.
**Validación**: `select * from firmas_documentos limit 1` corre sin error; RLS bloquea acceso desde anon; bucket `firmas` listado en `storage.buckets` con `public=false`.

### Fase 2 — Servicios core: crypto + audit + PDF + email
**Objetivo**: implementar `services/crypto.ts` (`sha256(buffer)`, `generarToken()`, `hashToken()`, `generarOTP()`, `hashOTP()`), `services/audit.ts` (`registrarEvento(docId, tipo, metadata)` con cálculo automático de `prev_hash` y `hash`), `services/email.ts` (templates Resend: `InvitacionFirma`, `OTPCodigo`, `CopiaFirmada`), `services/pdf.ts` (`generarActa(documento, eventos)` y `concatenarConActa(originalBuffer, actaBuffer)`).
**Validación**: test unitario que genera un acta con datos dummy + concatena con un PDF de prueba → output válido; `sha256` determinista; hash chain reproducible.

### Fase 3 — Server actions admin (`firmas-actions.ts`)
**Objetivo**: `listFirmas` (RLS, filtros), `crearFirma` (sube PDF, hash, crea fila, token, manda email, registra evento `enviado`), `reenviarFirma` (regenera token + email, evento `reenviado`), `cancelarFirma` (admin marca expirado manualmente, evento `expirado`), `getAuditTrail(docId)`.
**Validación**: desde un script de prueba (node + service-role) crear una firma → fila persistida + email enviado en sandbox Resend + token funcional contra `/firmar/<token>`.

### Fase 4 — Página pública `/firmar/[token]` + server actions firmante
**Objetivo**: route `app/firmar/[token]/page.tsx` fuera del layout autenticado, layout minimalista con logo empresa y datos remitente. Server actions: `abrirDocumento(token)` (valida token, registra `abierto`, devuelve metadatos + signed URL del PDF), `solicitarOTP(token)` (genera OTP, manda email/SMS), `validarOTP(token, codigo)`, `firmar(token, payload)`, `rechazar(token, motivo)`. Componentes: `FirmaPublicaView`, `VisorPdf` (react-pdf), `OtpDialog`, `CanvasFirma` (signature_pad).
**Validación**: Playwright captura flujo completo: abrir enlace → OTP → firmar → ver pantalla éxito; eventos `abierto`, `otp_enviado`, `otp_validado`, `firmado` registrados en orden con hash chain válida.

### Fase 5 — Refactor `FirmasView` a datos reales + descarga
**Objetivo**: reemplazar `FIRMAS_MOCK` por `listFirmas()` (server action). Conectar `EnviarParaFirmaDialog` real con upload de PDF (validar tipo/tamaño con Zod, máx 10 MB). Implementar `DetalleFirmaDialog` con audit trail (lista de eventos) + botón "Descargar acta y documento firmado" → endpoint `/api/firmas/download/[doc_id]` que devuelve signed URL del `pdf_firmado`. Eliminar `FIRMAS_MOCK` y `EMPLEADOS_PARA_FIRMA` del file.
**Validación**: flujo completo desde UI admin → empleado firma → admin descarga PDF firmado y comprueba que tiene 2 páginas extra (acta) y que `sha256` del archivo descargado coincide con `sha256_acta` en BD.

### Fase 6 — Cron de expiración + cleanup
**Objetivo**: `/api/cron/firmas-expirar/route.ts` con validación `CRON_SECRET`. Recorre `firmas_documentos.estado='pendiente' AND expira_en < now()` → marca expirado + evento. Limpia `firmas_tokens` consumidos/expirados >30d. Limpia `firmas_otps` >7d. Entrada en `vercel.json` con `schedule "0 3 * * *"`.
**Validación**: forzar `expira_en = now() - 1h` en BD → correr cron manual con curl → fila pasa a `expirado` y aparece evento `expirado` con hash chain válido.

### Fase 7 — Validación Final
**Objetivo**: sistema funcionando end-to-end en producción.
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] `mcp__supabase__get_advisors` sin issues de RLS/security en las 4 tablas nuevas.
- [ ] Playwright captura el flujo: admin envía → email llega (modo dev: log Resend) → empleado firma → admin descarga PDF firmado.
- [ ] Validación legal: un PDF firmado descargado se abre en Adobe Reader y muestra 2 páginas (original + acta); el acta lista nombre, DNI, IP, hora UTC, hash SHA-256, y la cadena de eventos.
- [ ] Hash chain verificada: una query SQL `select * from firmas_eventos where documento_id=X order by ocurrido_en` permite recomputar los hashes y todos coinciden.
- [ ] Token y OTP invalidados tras uso (intentar reusarlos → 410).
- [ ] RLS: usuario de empresa A no ve firmas de empresa B (test con dos cuentas).
- [ ] Cobertura de criterios de éxito al 100 %.

---

## Aprendizajes (Self-Annealing)

> Esta sección crece con cada error durante la implementación.

### 2026-05-15: function_search_path_mutable en triggers
- **Error**: el linter `mcp__supabase__get_advisors` levantó WARN `function_search_path_mutable` sobre `firmas_eventos_block_mutation` y `firmas_documentos_set_updated_at`.
- **Fix**: añadir `SET search_path = ''` en la declaración de las funciones plpgsql; las referencias dentro del cuerpo deben quedar cualificadas (no aplica aquí porque son triggers que solo manipulan `NEW`/`TG_OP`).
- **Aplicar en**: cualquier `CREATE FUNCTION` futura en este proyecto, sobre todo SECURITY DEFINER. Patrón a copiar.

### 2026-05-15: mapeo previo a RLS evitó error de columna
- **Error potencial**: el PRP asumía `profiles.user_id` como única fuente del filtro multi-empresa.
- **Fix**: revisar políticas RLS existentes (`bank_connections` PRP-035 reciente) reveló el patrón establecido `profiles.user_id OR user_empresas.user_id`. Aplicado consistente en todas las policies de firmas.
- **Aplicar en**: cualquier policy multi-tenant nueva del proyecto. Fuente canónica del rol admin/director = `user_roles` (no `profiles.role`).

### 2026-05-15: middleware exigía sesión en /firmar/[token]
- **Error**: smoke test reveló que `GET /firmar/<token>` devolvía 307 (redirect a login) en lugar de renderizar la vista pública.
- **Fix**: añadir `/firmar` a `PUBLIC_PREFIXES` en `src/lib/supabase/proxy.ts`. Patrón ya usado por `/carta`, `/empleo`, `/__site`.
- **Aplicar en**: cualquier ruta pública nueva del proyecto (acceso por token o sin login) debe registrarse en `PUBLIC_PREFIXES` del middleware, si no la sesión obligatoria la bloquea.

### 2026-05-15: peppers en .env.local hot-reload OK
- **Hallazgo**: añadir `FIRMA_TOKEN_PEPPER` y `FIRMA_OTP_PEPPER` a `.env.local` con el dev server ya corriendo bastó — Next.js detectó el cambio y recargó las env vars sin reinicio manual.
- **Aplicar en**: dev local. En producción (Vercel) sí hay que redeploy tras cambiar env vars del proyecto.

---

## Gotchas

- [ ] **Edge runtime no soporta `pdf-lib` ni `@react-pdf/renderer`**: las server actions de generación de PDF deben ir en Node runtime (`export const runtime = 'nodejs'`).
- [ ] **`pdf-lib` requiere Buffer**: en Next.js App Router usar `Buffer.from(await file.arrayBuffer())`.
- [ ] **Email empleado**: usar `email_empresa ?? email_personal` (regla activa en memoria del proyecto). Si ninguno está → bloquear envío con toast claro.
- [ ] **OTP por SMS deshabilitado en MVP**: dejar la columna `canal` en BD pero forzar `email` en código. Cuando se integre Twilio, basta con flipear el flag.
- [ ] **Tokens nunca plain en BD**: bcrypt antes de persistir; comparar con `bcrypt.compare`.
- [ ] **Single-use estricto**: al validar token, marcar `consumido_en=now()` en la misma transacción que registra el evento → previene race condition de doble apertura.
- [ ] **Bucket Storage privado obligatorio**: si por error el bucket es público, cualquier URL filtrada expone el PDF firmado. Validar con `mcp__supabase__list_storage_buckets` que `public=false`.
- [ ] **Timestamp servidor, no cliente**: nunca confiar en `new Date()` en cliente para el audit trail. Todo timestamp viene de `now()` en BD o `Date.now()` en server action.
- [ ] **IP en server actions**: en Next.js App Router se obtiene vía `headers().get('x-forwarded-for')`. Documentar en `audit.ts`.
- [ ] **PDF acta con `@react-pdf/renderer`** debe registrar fuentes manualmente si se usan custom (default Helvetica funciona).
- [ ] **Concatenación con `pdf-lib`**: cuidado con metadatos del PDF original (puede romperse si está cifrado con permisos). Validar con `try/catch` y dar error legible.
- [ ] **Resend rate limit**: 100 req/min en plan free. Para una empresa media (10 firmas/día) no es problema, pero el envío de OTP + invitación + copia final hace 3 emails/firma → revisar al escalar.
- [ ] **Empleado puede no tener `user_id`**: si es un empleado dado de alta sin cuenta de portal, RLS `fd_read_empleado` falla. Confirmar que todos los empleados tienen `user_id` (regla del proyecto) o adaptar política.
- [ ] **`empleados.dni_nie` puede estar vacío**: el acta lo necesita para validez. Si falta, advertir al admin antes de enviar.
- [ ] **Locale del acta**: usar `es-ES` para fechas, formato `dd/mm/yyyy HH:MM:ss UTC`.
- [ ] **Hash chain en JSON canónico**: `JSON.stringify` con keys ordenadas (usar `json-stable-stringify` o equivalente) para que `prev_hash` sea reproducible al reverificar.
- [ ] **`firmar/[token]` no debe llevar el layout `(main)` ni sidebar ni nav**: aislar route group `app/firmar/...` con `layout.tsx` propio minimalista.

## Anti-Patrones

- NO confiar en el cliente para nada (IP, timestamp, validación OTP, hash) — todo server-side.
- NO almacenar tokens, OTPs ni claves en plain text. Bcrypt o HMAC siempre.
- NO usar el bucket Storage en modo público. Siempre signed URLs con TTL corto.
- NO romper el hash chain del audit trail — los eventos son inmutables (la migración no debe permitir update/delete en `firmas_eventos`; añadir triggers `before update` y `before delete` que lanzan exception, o policy RLS que bloquea).
- NO mezclar el flujo público (`/firmar/[token]`) con el flujo autenticado: namespaces y server actions separados.
- NO generar el acta PDF en cliente — pierde validez legal (manipulable). Solo server-side.
- NO usar `crypto.randomBytes` con tamaño <16 bytes para tokens — mínimo 32.
- NO ignorar el plazo: el cron debe correr sí o sí; un documento `pendiente` que nunca expira es un riesgo legal.
- NO dar por válido el OTP si los intentos superan 3 — bloquear y obligar a regenerar.

---

*PRP pendiente aprobación. No se ha modificado código fuera del arreglo del dropdown (sesión actual). Cualquier cambio de BD requiere autorización explícita del usuario.*
