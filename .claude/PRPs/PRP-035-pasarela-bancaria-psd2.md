# PRP-035: Pasarela Bancaria PSD2 (GoCardless Bank Account Data)

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-13
> **Proyecto**: Balles-Hosteleros — Módulo Contabilidad → Transacciones

---

## Objetivo

Integrar **GoCardless Bank Account Data** (ex-Nordigen) como proveedor PSD2 para que cada empresa conecte sus cuentas bancarias y vea, dentro del submódulo **Contabilidad → Transacciones**, los movimientos reales sincronizados automáticamente (sync inicial de 90 días + cron incremental). MVP **solo lectura**, cualquier banco que opere en España, **multi-tenant** (por `empresa_id`) y con un modelo de datos **multi-proveedor** preparado para añadir Arcopay después sin refactor.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy `transacciones` se rellena a mano o con CSV: cada restaurante pierde horas semanales conciliando. | Conexión PSD2 con cualquier banco ES en 2 minutos → ingreso automático de movimientos. |
| Los datos `SAMPLE_BANCOS` / `SAMPLE_TRANSACCIONES` no se persisten por empresa y no permiten conciliación real. | Persistencia real `cuentas_bancarias` + `movimientos_banco` ya existentes, alimentadas vía GoCardless. |
| Riesgo de lock-in con un solo proveedor PSD2 (GoCardless tiene precio por conexión). | Capa de abstracción `bank_providers` + `bank_connections.provider` → migrar a Arcopay sin tocar UI. |
| Tokens PSD2 son credenciales sensibles + consentimiento expira a los 90 días (obligación normativa). | Tokens cifrados en BD (pgcrypto + KMS), recordatorio de reconsentimiento y job de renovación. |

**Valor de negocio**: cada cliente ahorra ~3-5 h/semana de conciliación manual, multiplica por 4 la frecuencia de actualización del cuadro de mando financiero, y desbloquea cobros automáticos en fases posteriores (Arcopay/PSD2 payment-initiation).

## Qué

### Criterios de Éxito

- [ ] Un usuario con `empresa_id` puede pulsar "Conectar banco" desde `BancosView`, elegir un banco ES (lista filtrada por país=ES), aceptar el consentimiento PSD2 en la web del banco y volver a la app con la cuenta visible en estado `ACTIVA`.
- [ ] La sincronización inicial trae **90 días** de movimientos y los inserta en `movimientos_banco` deduplicados por `(cuenta_id, provider_tx_id)`.
- [ ] Existe un **cron diario** (`/api/cron/psd2-sync`) que actualiza movimientos incrementales de **todas** las conexiones activas de **todas** las empresas, respetando los rate-limits de GoCardless (4 calls/día/cuenta).
- [ ] Los tokens (`access_token`, `refresh_token`, `requisition_id`) viven **cifrados** en BD (`pgcrypto` con `pgp_sym_encrypt` + clave en `BANK_TOKENS_KEY` env var) — nunca visibles en plain text en la columna.
- [ ] **RLS estricta**: una empresa solo ve sus `bank_connections`, `bank_accounts`, `bank_sync_logs`. El service-role del cron es la única vía con acceso global.
- [ ] El modelo de datos soporta un segundo proveedor: añadir `arcopay` a `bank_providers` + un adapter nuevo no obliga a tocar UI, tablas ni RLS.
- [ ] El usuario ve en `BancosView` el estado de cada conexión: `ACTIVA`, `EXPIRA_EN_X_DIAS`, `REQUIERE_RECONSENTIMIENTO`, `ERROR`, con un CTA "Renovar" cuando faltan ≤ 7 días.
- [ ] Las transacciones sincronizadas aparecen en `TransaccionesView` con el banco real, la fecha valor y el concepto enriquecido (counterparty + reference) — sin romper el modo "manual" actual.
- [ ] `npm run typecheck` y `npm run build` pasan; sin `any`, todos los inputs externos validados con Zod.

### Comportamiento Esperado (Happy Path)

1. **Conectar**: Usuario en `/contabilidad/bancos` pulsa **"+ Nuevo banco"** → modal "Conectar banco" → selecciona país (ES preseleccionado) → busca/elige banco (BBVA, Santander, Caixa, Revolut, …) → pulsa "Continuar".
2. **Crear requisition**: backend llama a GoCardless `POST /requisitions` con `redirect=/contabilidad/bancos/callback`, persiste `bank_connections (status=PENDING)` y redirige al usuario a la URL del banco.
3. **Consentimiento PSD2**: el usuario autentica en la web del banco y autoriza 90 días de acceso a sus cuentas.
4. **Callback**: el banco redirige a `/contabilidad/bancos/callback?ref=<requisition_ref>` → handler valida `ref`, llama `GET /requisitions/{id}` para obtener `accounts[]`, crea filas en `bank_accounts` y lanza sync inicial en background (Edge function / Vercel Function en cola).
5. **Sync inicial**: por cada `account_id` se llama `GET /accounts/{id}/transactions?date_from=hoy-90d` → se mapea al shape `movimientos_banco` (uno por movimiento, `cuenta_id` enlazado a la `cuenta_bancaria` recién creada).
6. **Estado actualizado**: `bank_connections.status='ACTIVE'`, `bank_connections.expires_at = now() + 90d`, `bank_accounts.last_sync_at = now()`. UI redirige a `BancosView` con toast "Banco conectado · 124 movimientos importados".
7. **Cron incremental** (diario, 06:30 UTC): recorre todas las `bank_connections.status='ACTIVE'`, llama `GET /accounts/{id}/transactions?date_from=last_sync_at-3d` (3 días de overlap para capturar movimientos retrasados), deduplica y persiste. Loggea en `bank_sync_logs`.
8. **Reconsentimiento**: cron mira `expires_at < now() + 7d` → marca `status='REQUIRES_RECONSENT'` y crea notificación in-app. Usuario pulsa "Renovar", se genera un nuevo `requisition` y la `bank_connection` mantiene su `id` (rotación de tokens).
9. **Visualización**: en `TransaccionesView` los movimientos importados aparecen con `origen='psd2'` (badge sutil "Sincronizado") y conviven con los manuales/CSV preexistentes.

---

## Contexto

### Referencias del codebase

- `src/features/contabilidad/components/BancosView.tsx` — entry point UI a modificar (hoy usa `SAMPLE_BANCOS`).
- `src/features/contabilidad/components/TransaccionesView.tsx` — vista de movimientos; ya lee de `listTransacciones()`. Hay que añadir filtro por `cuenta_bancaria_id` y enriquecer la fuente.
- `src/features/contabilidad/io/bancos.io.ts`, `src/features/contabilidad/io/transacciones.io.ts` — patrón ModuleIO a respetar.
- `src/features/contabilidad/actions/contabilidad-actions.ts` — server actions existentes; añadir aquí `listCuentasBancariasReales` y similares.
- `src/features/contabilidad/data/contabilidad.ts` — tipos `BancoConectado`, `TransaccionContable`. Mantener; añadir tipos nuevos en `src/features/contabilidad/types/bank-providers.ts`.
- `supabase/migrations/010_features_restantes.sql` — define `public.transacciones` (mantener, NO romper).
- `supabase/migrations/029_contabilidad_upgrade.sql` — ya define `public.cuentas_bancarias` y `public.movimientos_banco` con RLS por `empresa_id`. **Vamos a reutilizar estas dos tablas** y añadir columnas (`provider`, `external_id`, `iban_hash`, etc.) + 3 tablas nuevas.
- `src/app/api/cron/agora-sync/route.ts` — patrón a copiar para el cron (validación `CRON_SECRET`, recorrido multi-empresa con service-role).
- `vercel.json` — añadir nueva entrada en `crons[]`.
- `src/lib/supabase/admin.ts` — cliente service-role para el cron.

### Referencias externas

- GoCardless Bank Account Data API: https://developer.gocardless.com/bank-account-data/overview
- Endpoints clave: `POST /token/new/`, `POST /token/refresh/`, `GET /institutions/?country=ES`, `POST /requisitions/`, `GET /requisitions/{id}/`, `GET /accounts/{id}/details/`, `GET /accounts/{id}/balances/`, `GET /accounts/{id}/transactions/`.
- Rate limit: 4 calls/día/endpoint/cuenta — diseñar cron para **una** llamada de transactions/día/cuenta.
- PSD2: consentimiento expira a los 90 días; reconsentimiento obligatorio (`access_valid_for_days=90`).

### Arquitectura Propuesta (Feature-First)

```
src/features/contabilidad/
├── components/
│   ├── BancosView.tsx                       ← modificar (lista real + CTA conectar)
│   ├── TransaccionesView.tsx                ← modificar (filtro por cuenta, badge origen)
│   └── bancos/
│       ├── ConectarBancoDialog.tsx          ← nuevo
│       ├── ListaInstitucionesES.tsx         ← nuevo (combobox de bancos ES)
│       └── EstadoConexionBadge.tsx          ← nuevo (ACTIVA/EXPIRA/RECONSENT/ERROR)
├── services/
│   └── psd2/
│       ├── providers/
│       │   ├── types.ts                     ← interfaz BankProvider (contrato común)
│       │   ├── gocardless.ts                ← adapter GoCardless
│       │   └── index.ts                     ← factory: getProvider(name)
│       ├── sync.ts                          ← lógica sync inicial + incremental + dedup
│       ├── crypto.ts                        ← wrapper pgp_sym_encrypt/decrypt
│       └── mappers.ts                       ← GoCardless → movimientos_banco
├── actions/
│   └── psd2-actions.ts                      ← server actions: crearRequisition, listarBancosES, finalizarConexion, renovarConsentimiento, listarConexiones
├── types/
│   └── bank-providers.ts                    ← tipos compartidos
└── hooks/
    └── usePsd2Connection.ts                 ← estado conexión + reconsent UI

src/app/(main)/contabilidad/bancos/
├── page.tsx                                 ← ya existe
└── callback/
    └── page.tsx                             ← nuevo: maneja redirect del banco

src/app/api/
├── cron/psd2-sync/route.ts                  ← nuevo: cron diario incremental
└── psd2/
    ├── requisitions/route.ts                ← POST crea requisition (proxy al provider)
    └── webhooks/route.ts                    ← reservado (GoCardless no envía webhooks de tx, pero dejar para Arcopay)
```

### Modelo de Datos

Migración nueva: `supabase/migrations/20260513120000_psd2_bank_connections.sql`.

```sql
-- ─── 1. Catálogo de proveedores PSD2 (extensible) ──────────
create table if not exists public.bank_providers (
  id            text primary key,            -- 'gocardless' | 'arcopay'
  display_name  text not null,
  api_base_url  text not null,
  default_country text not null default 'ES',
  config        jsonb not null default '{}',  -- secret_id ref, rate limit, etc.
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
insert into public.bank_providers (id, display_name, api_base_url)
values ('gocardless', 'GoCardless Bank Account Data', 'https://bankaccountdata.gocardless.com/api/v2')
on conflict do nothing;

-- ─── 2. Conexiones PSD2 por empresa ────────────────────────
create table if not exists public.bank_connections (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  provider          text not null references public.bank_providers(id),
  institution_id    text not null,                  -- 'BBVA_BBVAESMM' (id del banco en el provider)
  institution_name  text not null,
  requisition_id    text not null,                  -- id externo del consentimiento
  -- Tokens cifrados con pgp_sym_encrypt(<token>, current_setting('app.bank_tokens_key'))
  access_token_enc  bytea,
  refresh_token_enc bytea,
  status            text not null default 'PENDING'
                    check (status in ('PENDING','ACTIVE','REQUIRES_RECONSENT','EXPIRED','ERROR','REVOKED')),
  expires_at        timestamptz,                    -- vence consentimiento (90d)
  last_error        text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (empresa_id, provider, requisition_id)
);

create index if not exists idx_bank_conn_empresa  on public.bank_connections(empresa_id);
create index if not exists idx_bank_conn_status   on public.bank_connections(status, expires_at);

-- ─── 3. Cuentas remotas vinculadas (1 connection → N accounts) ─
-- Reutilizamos public.cuentas_bancarias añadiendo columnas multi-proveedor.
alter table public.cuentas_bancarias
  add column if not exists provider          text references public.bank_providers(id),
  add column if not exists connection_id     uuid references public.bank_connections(id) on delete cascade,
  add column if not exists external_id       text,          -- id de la cuenta en el provider
  add column if not exists iban_hash         text,          -- sha256(IBAN) para dedup sin exponer
  add column if not exists last_sync_at      timestamptz,
  add column if not exists sync_status       text default 'IDLE'
                                              check (sync_status in ('IDLE','SYNCING','OK','ERROR'));

create unique index if not exists ux_cuentas_provider_external
  on public.cuentas_bancarias(provider, external_id)
  where external_id is not null;

-- ─── 4. Reutilizamos public.movimientos_banco añadiendo provider_tx_id ─
alter table public.movimientos_banco
  add column if not exists provider          text references public.bank_providers(id),
  add column if not exists provider_tx_id    text,             -- id único del movimiento en el provider
  add column if not exists fecha_valor       date,
  add column if not exists contraparte       text,
  add column if not exists raw               jsonb;            -- payload completo para depurar

create unique index if not exists ux_mov_provider_tx
  on public.movimientos_banco(cuenta_id, provider_tx_id)
  where provider_tx_id is not null;

-- ─── 5. Log de sincronizaciones ────────────────────────────
create table if not exists public.bank_sync_logs (
  id               uuid primary key default gen_random_uuid(),
  connection_id    uuid not null references public.bank_connections(id) on delete cascade,
  cuenta_id        uuid references public.cuentas_bancarias(id) on delete set null,
  tipo             text not null check (tipo in ('INITIAL','INCREMENTAL','RECONSENT')),
  status           text not null check (status in ('OK','PARTIAL','ERROR')),
  movimientos_new  integer not null default 0,
  movimientos_dup  integer not null default 0,
  error_message    text,
  duration_ms      integer,
  ran_at           timestamptz not null default now()
);

create index if not exists idx_sync_logs_conn on public.bank_sync_logs(connection_id, ran_at desc);

-- ─── 6. Helpers de cifrado ─────────────────────────────────
-- Activar pgcrypto si no está
create extension if not exists pgcrypto;

-- Función para almacenar y recuperar tokens cifrados con clave de sesión
-- La clave la inyecta el server con: select set_config('app.bank_tokens_key', $1, true);
create or replace function public.encrypt_bank_token(plain text) returns bytea
language sql immutable as $$
  select pgp_sym_encrypt(plain, current_setting('app.bank_tokens_key'));
$$;

create or replace function public.decrypt_bank_token(cipher bytea) returns text
language sql immutable as $$
  select pgp_sym_decrypt(cipher, current_setting('app.bank_tokens_key'));
$$;

-- ─── 7. RLS ────────────────────────────────────────────────
alter table public.bank_providers     enable row level security;
alter table public.bank_connections   enable row level security;
alter table public.bank_sync_logs     enable row level security;

-- Providers: lectura abierta a authenticated (lista de bancos / proveedores)
create policy "bp_read" on public.bank_providers for select to authenticated using (true);

-- Connections: solo la empresa propietaria
create policy "bc_read" on public.bank_connections for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "bc_manage" on public.bank_connections for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Sync logs: vía conexión
create policy "bsl_read" on public.bank_sync_logs for select to authenticated
  using (connection_id in (
    select c.id from public.bank_connections c
    where c.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ));
```

### Variables de entorno nuevas

```
GOCARDLESS_SECRET_ID=...
GOCARDLESS_SECRET_KEY=...
BANK_TOKENS_KEY=<32+ chars random — clave maestra cifrado tokens>
CRON_SECRET=<ya existe — reutilizar>
NEXT_PUBLIC_APP_URL=https://app.balleshosteleros.com   (para redirect callback)
```

### Decisiones de arquitectura clave

1. **Multi-proveedor desde día 1** mediante interfaz `BankProvider` (`createRequisition`, `listInstitutions`, `getAccounts`, `getTransactions`, `refreshToken`) + factory `getProvider('gocardless'|'arcopay')`. Añadir Arcopay = un fichero nuevo.
2. **Reutilizar `cuentas_bancarias` y `movimientos_banco`** existentes (extender con columnas) en vez de tablas paralelas → la conciliación, etiquetas y reglas ya construidas siguen funcionando sin cambios.
3. **Tokens cifrados con `pgcrypto`** (no en plaintext) y clave maestra inyectada vía `set_config('app.bank_tokens_key', ...)` desde el server-side antes de cualquier query que los toque. Nunca se exponen al cliente.
4. **Una llamada de transactions/día/cuenta** en el cron para respetar rate-limit de GoCardless (4/día/endpoint). Sync manual disponible desde UI con cooldown de 6 h.
5. **Reconsentimiento** como flujo principal, no excepción: cron mira `expires_at` y avisa con 7 días de antelación; renovar reusa la `bank_connection` (no se crea una nueva).
6. **RLS estricta por `empresa_id`** + service-role solo en el cron y en server actions privilegiadas.

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar a cada fase siguiendo el bucle agéntico.

### Fase 1 — Modelo de datos y cifrado
**Objetivo**: migración `20260513120000_psd2_bank_connections.sql` aplicada con `bank_providers`, `bank_connections`, `bank_sync_logs`, columnas nuevas en `cuentas_bancarias` y `movimientos_banco`, funciones `encrypt_bank_token`/`decrypt_bank_token`, RLS validada.
**Validación**: `select * from public.bank_providers` devuelve gocardless; `pgp_sym_encrypt` funciona con `BANK_TOKENS_KEY`; `mcp__supabase__get_advisors` sin issues críticos sobre las nuevas tablas.

### Fase 2 — Capa de abstracción y adapter GoCardless
**Objetivo**: `src/features/contabilidad/services/psd2/providers/` con interfaz `BankProvider`, adapter `gocardless.ts` que implementa los 6 endpoints, manejo de token refresh, retry exponencial, validación Zod de respuestas, y wrappers `crypto.ts` para encrypt/decrypt server-side.
**Validación**: test unitario (vitest o equivalente) o script `node` que llama `listInstitutions('ES')` y devuelve >50 bancos; validación de mock de `getTransactions` mapeando a `movimientos_banco`.

### Fase 3 — Server actions y endpoints API
**Objetivo**: `psd2-actions.ts` con `crearRequisition`, `listarBancosES`, `listarConexiones`, `renovarConsentimiento`, `forzarSync`. Endpoint `POST /api/psd2/requisitions` para crear consentimiento. Página `/contabilidad/bancos/callback` que recibe el redirect, persiste `bank_accounts` y dispara sync inicial.
**Validación**: con un secret-id de sandbox de GoCardless, crear requisition → URL devuelta válida; flujo end-to-end completable en sandbox.

### Fase 4 — UI: Conectar banco y estado de conexión
**Objetivo**: `ConectarBancoDialog.tsx` (combobox bancos ES con logo Google favicon, según [memory: selector de bancos con logo]), `EstadoConexionBadge.tsx`, modificar `BancosView.tsx` para leer de `cuentas_bancarias` reales por `empresa_id`, mostrar CTA "+ Nuevo banco" → abre dialog, mostrar badge de estado + CTA "Renovar". Respetar [memory: BARRA HORIZONTAL 1] en la toolbar.
**Validación**: Playwright captura screenshot del flujo conectar → callback → ver banco activo; tipos correctos; sin warnings.

### Fase 5 — Sincronización (inicial + incremental) y cron
**Objetivo**: `sync.ts` con `runInitialSync(connectionId)` (90 días) y `runIncrementalSync(connectionId)` (delta + 3d overlap, dedup por `provider_tx_id`). Endpoint `/api/cron/psd2-sync` (validación `CRON_SECRET`, recorrido multi-empresa). Entrada en `vercel.json` con `schedule "30 6 * * *"`. Log estructurado en `bank_sync_logs`.
**Validación**: ejecutar el cron manualmente con `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/psd2-sync` y comprobar nuevas filas en `movimientos_banco` y `bank_sync_logs.status='OK'`; dedup confirmada (ejecutar 2 veces seguidas, segundo run `movimientos_new=0`).

### Fase 6 — Integración con TransaccionesView y conciliación
**Objetivo**: Modificar `TransaccionesView` para que muestre los `movimientos_banco` enriquecidos (badge "Sincronizado" cuando `provider is not null`), filtro por `cuenta_bancaria_id`, y enlace clic-banco → filtra por cuenta. Mantener compatibilidad con el modo manual/sample actual.
**Validación**: una transacción importada vía PSD2 aparece en la lista, con su banco y fecha valor, y se puede etiquetar/conciliar como las manuales.

### Fase 7 — Reconsentimiento y notificaciones
**Objetivo**: lógica en el cron: si `expires_at < now() + 7d` → `status='REQUIRES_RECONSENT'` + notificación in-app + email opcional (Resend, si `/add-emails` ya instalado). UI: CTA "Renovar" en `BancosView` que regenera requisition y rota tokens manteniendo `connection_id`.
**Validación**: forzar `expires_at = now() + 5d` en BD, correr cron, ver notificación; renovación end-to-end en sandbox mantiene cuenta y movimientos previos.

### Fase 8 — Validación Final
**Objetivo**: Sistema funcionando end-to-end en producción con sandbox de GoCardless y al menos un banco real (test interno con cuenta del fundador).
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] `mcp__supabase__get_advisors` sin issues de RLS/security.
- [ ] Playwright captura el flujo completo (conectar → sync → ver tx).
- [ ] Tokens en BD verificadamente cifrados (`select access_token_enc from bank_connections limit 1` devuelve `bytea`, no texto).
- [ ] Cron ejecutado 2 días seguidos en producción sin errores y con dedup correcta.
- [ ] Cobertura de criterios de éxito al 100 %.

---

## Aprendizajes (Self-Annealing)

> Esta sección crece con cada error durante la implementación.

_Aún sin implementar._

---

## Gotchas

- [ ] **Rate limit GoCardless**: 4 calls/día/endpoint/cuenta. El cron debe hacer **una** llamada `transactions` por cuenta/día; sync manual con cooldown de 6 h o bloquear con toast.
- [ ] **Consentimiento PSD2 expira a 90 días sí o sí** — no hay forma de extender sin re-autenticación. Diseñar UX para que sea trivial renovar (un clic).
- [ ] **Tokens nunca al cliente**: todas las operaciones que usan tokens corren en server actions o API routes con service-role + `set_config('app.bank_tokens_key', ...)` antes de query.
- [ ] **`BANK_TOKENS_KEY` no puede rotarse sin re-cifrar**: documentar y dejar columna `tokens_key_version` (futuro) si se prevé rotación. MVP: clave única, anotada.
- [ ] **`pgcrypto`** debe estar en el extension allowlist de Supabase (suele estarlo; verificar con `mcp__supabase__list_extensions`).
- [ ] **Dedup por `provider_tx_id`**: GoCardless puede devolver el mismo movimiento como `booked` y luego con `valueDate` distinto; usar `transactionId` del payload, fallback a hash determinista `(amount, date, counterparty, reference)` si falta.
- [ ] **Movimientos `pending` vs `booked`**: importar solo `booked` para no inflar conciliación con duplicados. Documentar la decisión.
- [ ] **IBAN**: guardar `iban_hash` (sha256 truncado) y los 4 últimos dígitos en `iban_last4` para no exponer el IBAN completo en logs.
- [ ] **Multi-empresa en cron**: usar service-role + iterar por `bank_connections.status='ACTIVE'`; nunca confiar en RLS dentro del cron.
- [ ] **Vercel function timeout**: sync inicial de 90 días con cuentas muy activas puede pasar de 10 s; ejecutar en background con `waitUntil` o Edge Function con timeout 300 s. Plan B: encolar y procesar en cron de 5 min.
- [ ] **Logos de bancos**: GoCardless da `logo` URL en `/institutions`; si no, usar favicon de Google (patrón ya en uso, ver memoria del selector de bancos).
- [ ] **`empresa_id` tipo**: en `transacciones` es `text` (legacy) pero en `cuentas_bancarias` es `uuid`. El cron debe trabajar con `uuid` (las tablas nuevas usan `uuid`).

## Anti-Patrones

- NO crear tablas paralelas a `cuentas_bancarias` / `movimientos_banco` (rompería conciliación, etiquetas y reglas existentes).
- NO guardar tokens en plain text — ni siquiera "temporalmente".
- NO hardcodear "GoCardless" en componentes UI — siempre vía `provider` resuelto por factory.
- NO llamar al provider desde el cliente — todo server-side.
- NO ignorar el rate-limit con retry agresivo: bloquearía la cuenta del cliente en GoCardless.
- NO mezclar `auth.users.id` con `empresa_id` en RLS — el filtro siempre es por empresa.
- NO romper el flujo manual existente — la integración debe ser additive.

---

*PRP pendiente aprobación. No se ha modificado código.*
