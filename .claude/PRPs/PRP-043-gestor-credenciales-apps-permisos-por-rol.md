# PRP-043: Gestor de credenciales de apps externas con permisos por rol

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-26
> **Proyecto**: Balles-Hosteleros
> **Ruta UI**: `/accesos` (submódulo "Accesos a aplicaciones")
> **Refactor**: sustituye el modelo plano actual de `accesos_apps` (1 credencial / app, roles como array TEXT) por un modelo normalizado 3-tablas con cifrado AES-256 y M:N obligatorio app_credencial ↔ rol.

---

## Objetivo

Convertir el submódulo de **Accesos a aplicaciones** en un gestor multi-credencial seguro: cada app externa (Glovo, Sabadell, Mailchimp, etc.) puede tener N credenciales y cada credencial está restringida obligatoriamente a uno o más roles, de modo que cada usuario solo ve las credenciales cuyos roles permitidos intersectan con sus roles activos en la empresa.

## Por Qué

| Problema | Solución |
|----------|----------|
| El modelo actual guarda 1 sola pareja usuario/contraseña por app, pero el equipo tiene cuentas distintas por rol (ej. Glovo Bacanal centro vs Glovo Habana). | Tabla `app_credenciales` 1:N con `app_id`, multi-credencial por app. |
| Hoy `accesos_apps.roles_autorizados` es un array TEXT sin FK, no se valida que el rol exista y no permite RLS por intersección. | Tabla pivote `app_credencial_roles` M:N con FK a `roles` + RLS basada en intersección con los roles del usuario. |
| `accesos_apps.contrasena` se guarda en texto plano; la propia migración 2026-05-17 documenta que el cifrado quedaba pendiente. | Cifrado AES-256-GCM con clave en `CREDENCIALES_ENCRYPTION_KEY`; el server descifra solo en endpoint de "revelar". |
| No hay separación entre "ver que existe la app" y "ver las credenciales": basta tener acceso al módulo para leerlo todo. | Card de app visible a cualquiera con permiso del módulo; credenciales filtradas por intersección de roles. |

**Valor de negocio**: elimina el riesgo de fuga cross-rol de credenciales sensibles (banca, Glovo, Mailchimp), cumple con el principio de mínimo privilegio y soporta el caso real de cuentas separadas por local/rol sin duplicar apps en la UI.

## Qué

### Criterios de Éxito

- [ ] Vista `/accesos` muestra grid de cards (logo + nombre + categoría) con TODAS las apps de la empresa activa.
- [ ] Click en card abre drawer lateral con las credenciales **visibles para el usuario actual** (intersección de roles).
- [ ] Cada credencial expone botón 👁️ "revelar" (server action que descifra y devuelve plano una sola vez) y 📋 "copiar al portapapeles".
- [ ] Botón "+ Nueva credencial" dentro del drawer abre form Zod que **exige al menos 1 rol** seleccionado.
- [ ] Form "+ Nueva app" pide nombre, URL, logo (autocompletado con favicon Google si vacío), categoría, notas.
- [ ] Un usuario con rol único `LOGÍSTICA` no ve credenciales restringidas a `DIRECCIÓN` (verificado en BD vía RLS, no solo en UI).
- [ ] `CREDENCIALES_ENCRYPTION_KEY` ausente → server action falla con error claro y nunca devuelve texto plano.
- [ ] Las contraseñas nunca viajan en plano por la red salvo en la respuesta del endpoint explícito de revelar.
- [ ] Aplica barra horizontal 1 (toolbar `+ Nuevo` izquierda + buscar/columnas/IO/⚙️ derecha) y configuración base universal de submódulo.
- [ ] Datos de la tabla legacy `accesos_apps` se migran sin pérdida a las nuevas tablas (las que tengan `contrasena` plano pasan cifradas y conservan `roles_autorizados` como semilla de la M:N).

### Comportamiento Esperado (Happy Path)

1. María (rol `LOGÍSTICA` en HABANA) entra a `/accesos`. Ve el grid de cards de todas las apps de HABANA.
2. Click en card "Glovo" → drawer abre y muestra solo la credencial "Glovo - Habana Logística" (porque tiene rol `LOGÍSTICA` asignado). NO ve "Glovo - Dirección Bacanal".
3. María pulsa 👁️ junto a "Glovo - Habana Logística" → server action verifica RLS, descifra password, devuelve plano. UI lo muestra 10s y se vuelve a ocultar.
4. María pulsa 📋 → copia password al portapapeles vía la misma vía server-action (no se cachea en cliente).
5. Carlos (rol `DIRECCIÓN`) entra al mismo drawer y ve las 2 credenciales (Logística + Dirección).
6. Carlos pulsa "+ Nueva credencial", rellena etiqueta "Glovo - Dirección Madrid", usuario, password, selecciona roles `DIRECCIÓN` y `GERENCIA` (form rechaza si selecciona 0). Al guardar, la password se cifra server-side antes del INSERT.

---

## Contexto

### Referencias

- `src/features/logistica/components/ProductosView.tsx` — patrón de vista principal (toolbar minimalista + grid + dialog), referencia viva citada en `MEMORY.md > feedback_configuracion_base_submodulo`.
- `src/features/rrhh/components/AccesosView.tsx` — implementación actual del submódulo (se sustituye por la nueva vista bajo `src/features/accesos/`). Se mantienen `CATEGORIAS_APP` y el helper `AppLogo` (favicon Google).
- `src/features/rrhh/actions/accesos-apps-actions.ts` — actions actuales sobre `accesos_apps`; se mantienen solo lectura durante la migración.
- `src/features/rrhh/io/accesos.io.ts` — definición IOActions (export/import). Se reescribe contra el nuevo modelo (export sin password).
- `src/lib/seeds/roles.ts` — fuente canónica de roles. Se reutiliza la tabla `roles` por empresa (sincronizada por `syncSeedsToAllEmpresas`).
- `supabase/migrations/20260517110000_accesos_apps_rls_tenant.sql` — patrón RLS multiempresa `user_empresas ∪ profiles.empresa_id`. Aplicar idéntico en las 3 tablas nuevas.
- `MEMORY.md > project_rls_multiempresa` — toda policy con `empresa_id` debe aceptar UNION (`user_empresas ∪ profiles.empresa_id`).
- `MEMORY.md > feedback_barra_horizontal_1` — toolbar por defecto.
- `MEMORY.md > feedback_configuracion_base_submodulo` — SubmoduleToolbar + ResizableColumnsProvider + TableColumnHeader.
- Node crypto `createCipheriv("aes-256-gcm", ...)` — librería estándar, sin dependencia nueva. La clave `CREDENCIALES_ENCRYPTION_KEY` se genera con `openssl rand -hex 32` (32 bytes hex).

### Arquitectura Propuesta (Feature-First)

```
src/features/accesos/
├── components/
│   ├── AccesosView.tsx               # Grid de cards (vista principal)
│   ├── AppCard.tsx                   # Card de app (logo + nombre + categoría + nº credenciales visibles)
│   ├── CredencialesDrawer.tsx        # Drawer lateral con credenciales filtradas
│   ├── CredencialRow.tsx             # Fila con etiqueta + usuario + 👁️ + 📋 + ✏️
│   ├── AppFormDialog.tsx             # Form "+ Nueva app" (incluye favicon-helper)
│   └── CredencialFormDialog.tsx      # Form "+ Nueva credencial" (multi-select roles obligatorio)
├── actions/
│   ├── apps-actions.ts               # listApps, createApp, updateApp, deleteApp
│   ├── credenciales-actions.ts       # listCredencialesVisibles, createCredencial, updateCredencial, deleteCredencial
│   └── revelar-action.ts             # revealCredencial(id) — único endpoint que descifra
├── lib/
│   └── crypto.ts                     # encrypt / decrypt AES-256-GCM (server-only)
├── data/
│   └── tipos.ts                      # Tipos TS: App, Credencial, CredencialVisible
├── io/
│   └── accesos.io.ts                 # IOActions (sin password en export ni import)
└── store/                            # (no se necesita Zustand, estado local por drawer)
```

Página: `src/app/(main)/accesos/page.tsx` — sustituye el import actual a `@/features/accesos/components/AccesosView`.

### Modelo de Datos

```sql
-- 1) Apps externas (1 fila por app, no contiene credenciales)
CREATE TABLE public.apps_externas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  url TEXT,
  logo_url TEXT,                          -- favicon Google si vacío, calculado client-side al guardar
  categoria TEXT NOT NULL,                -- de CATEGORIAS_APP
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, nombre)
);
CREATE INDEX idx_apps_externas_empresa ON public.apps_externas(empresa_id);
ALTER TABLE public.apps_externas ENABLE ROW LEVEL SECURITY;

-- 2) Credenciales (N por app)
CREATE TABLE public.app_credenciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.apps_externas(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE, -- denormalizado para RLS rápida
  etiqueta TEXT NOT NULL,                 -- ej. "Glovo - Habana Logística"
  usuario TEXT NOT NULL,
  password_cifrado TEXT NOT NULL,         -- formato "iv:authTag:cipher" (base64) — ver lib/crypto.ts
  url_especifica TEXT,                    -- opcional, sobreescribe apps_externas.url
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
CREATE INDEX idx_app_credenciales_app ON public.app_credenciales(app_id);
CREATE INDEX idx_app_credenciales_empresa ON public.app_credenciales(empresa_id);
ALTER TABLE public.app_credenciales ENABLE ROW LEVEL SECURITY;

-- 3) Roles autorizados por credencial (M:N obligatoria — al menos 1 fila)
CREATE TABLE public.app_credencial_roles (
  credencial_id UUID NOT NULL REFERENCES public.app_credenciales(id) ON DELETE CASCADE,
  rol_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (credencial_id, rol_id)
);
CREATE INDEX idx_app_credencial_roles_rol ON public.app_credencial_roles(rol_id);
CREATE INDEX idx_app_credencial_roles_empresa ON public.app_credencial_roles(empresa_id);
ALTER TABLE public.app_credencial_roles ENABLE ROW LEVEL SECURITY;
```

#### RLS (resumen — detalle en Fase 1)

- `apps_externas`: SELECT/INSERT/UPDATE/DELETE si `empresa_id ∈ user_empresas(auth.uid()) ∪ profiles.empresa_id(auth.uid())`.
- `app_credenciales`: además del tenant, SELECT requiere que **EXISTA** una fila en `app_credencial_roles` cuyo `rol_id` esté en los roles del usuario en esa empresa (vía `usuarios_roles` o equivalente canónico). INSERT/UPDATE/DELETE requieren permiso del módulo (ver "Gotchas — permiso editar").
- `app_credencial_roles`: SELECT/WRITE solo si la credencial padre pasa su RLS (queda implícito por la cascada, pero conviene policy explícita por consistencia).

#### Cifrado (`src/features/accesos/lib/crypto.ts`)

- Algoritmo: `aes-256-gcm`.
- Clave: `process.env.CREDENCIALES_ENCRYPTION_KEY` (32 bytes hex).
- IV: 12 bytes aleatorios por cifrado.
- Formato almacenado: `${iv_base64}:${authTag_base64}:${cipher_base64}`.
- API: `encrypt(plain: string): string` y `decrypt(stored: string): string`.
- `import "server-only"` en el módulo para impedir bundling cliente.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas se generan al entrar a cada fase con el bucle agéntico.

### Fase 1: BD y RLS multiempresa
**Objetivo**: Migración SQL crea las 3 tablas (`apps_externas`, `app_credenciales`, `app_credencial_roles`) con FKs, índices y políticas RLS tenant + filtro por roles. La migración legacy `accesos_apps` queda intacta (lectura, no se borra todavía).
**Validación**:
- [ ] `supabase db push` (o migración aplicada vía MCP) sin errores.
- [ ] Test manual con dos usuarios de distinta empresa: cada uno ve solo lo suyo en `apps_externas`.
- [ ] Test con dos roles en la misma empresa: solo la intersección ve la credencial.

### Fase 2: Cifrado server-side y server actions de escritura
**Objetivo**: `lib/crypto.ts` operativo + `apps-actions.ts` y `credenciales-actions.ts` con CRUD validado por Zod. `revelar-action.ts` es el único punto que descifra. La key se lee de `CREDENCIALES_ENCRYPTION_KEY`; si falta, las actions de revelar tiran error claro.
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] Smoke test: crear credencial → fila en BD tiene `password_cifrado` (formato `iv:tag:cipher`), nunca el plano.
- [ ] `revelar(id)` devuelve el plano original; `revelar(id)` con un usuario sin rol válido lanza error "no autorizado" (no leak).

### Fase 3: UI grid de apps + drawer de credenciales
**Objetivo**: `AccesosView` con grid de cards, búsqueda y barra horizontal 1. Click en card abre `CredencialesDrawer` con lista de credenciales visibles. Botones 👁️ / 📋 / ✏️ por credencial. SubmoduleToolbar + ResizableColumnsProvider + TableColumnHeader si se decide vista lista alternativa (mismo patrón que ProductosView).
**Validación**:
- [ ] Vista renderiza sin errores con datos sembrados.
- [ ] 👁️ muestra password 10s y vuelve a ocultar.
- [ ] 📋 copia al portapapeles desde server-action (no cache cliente).
- [ ] Toolbar respeta el estándar (`+ Nuevo` izquierda; buscar + columnas + IO + ⚙️ derecha).

### Fase 4: Forms (nueva app + nueva credencial) con multi-select roles obligatorio
**Objetivo**: `AppFormDialog` y `CredencialFormDialog` operativos, Zod en ambos. Multi-select de roles en credencial con validación `.min(1, "Selecciona al menos un rol")`. Helper de favicon Google rellena `logo_url` automáticamente si el usuario deja el campo vacío.
**Validación**:
- [ ] Form de credencial rechaza submit con 0 roles seleccionados.
- [ ] Form de app autocompleta `logo_url` con `https://www.google.com/s2/favicons?domain=...&sz=64` si el campo está vacío.
- [ ] Después de crear, la nueva credencial aparece en el drawer SOLO para los roles seleccionados.

### Fase 5: Migración de datos legacy + IOActions + retirada de la vista vieja
**Objetivo**: Script SQL idempotente que lee `accesos_apps`, crea 1 fila en `apps_externas`, 1 fila en `app_credenciales` (cifrando `contrasena`), y N filas en `app_credencial_roles` (una por nombre de rol que matchee con `roles.nombre` en esa empresa). IOActions reescritos contra el nuevo modelo (export NUNCA incluye password). La página `/accesos` importa el nuevo `AccesosView`. La carpeta `src/features/rrhh/{components,actions,data,io}/...accesos*` queda marcada `@deprecated` (no se borra hasta confirmar).
**Validación**:
- [ ] `SELECT count(*) FROM accesos_apps` ≈ `SELECT count(*) FROM apps_externas` (puede ser menor si había duplicados de nombre por empresa).
- [ ] Cada credencial migrada tiene ≥1 rol en `app_credencial_roles`.
- [ ] Revelar una credencial migrada devuelve el password original (verificación con un par de filas conocidas).
- [ ] Export IOActions no contiene la columna `password_cifrado` ni `usuario`.

### Fase 6: Validación final
**Objetivo**: Sistema operativo end-to-end en HABANA y BACANAL con `syncSeedsToAllEmpresas` (no aplica al modelo, sí a que las tablas existen para empresas nuevas vía migración).
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Playwright screenshot: grid de cards + drawer + form de credencial con rol obligatorio.
- [ ] Verificación cross-rol en BD: usuario sin rol autorizado NO ve la credencial ni siquiera vía MCP query directa.
- [ ] Todos los criterios de éxito ✅.

---

## Aprendizajes (Self-Annealing)

*Pendiente — se rellena durante la implementación.*

---

## Gotchas

- [ ] **Empresa activa por cookie**: las actions deben usar `getAppContext()` (ver `MEMORY.md > project_empresa_activa_cookie`), nunca asumir `profiles.empresa_id` directamente.
- [ ] **RLS UNION obligatorio**: las policies deben aceptar `user_empresas ∪ profiles.empresa_id` (`MEMORY.md > project_rls_multiempresa`). Filtrar solo por principal rompe usuarios multiempresa.
- [ ] **Roles del usuario en la empresa activa**: comprobar dónde vive la relación usuario↔rol (revisar `src/features/ajustes/actions/roles-actions.ts` y `src/features/rrhh/data/roles-empresa.ts` antes de Fase 1). Si la tabla es `usuarios_roles` con `empresa_id`, la subquery de RLS debe filtrar también por la empresa activa, no solo por user_id.
- [ ] **`CREDENCIALES_ENCRYPTION_KEY`**: NO se commitea. Generar con `openssl rand -hex 32` y añadir a `.env.local` y a las env vars de Vercel (preview + prod). Pedir permiso al usuario para añadirla (no es instalar dependencia, pero es cambio de infra).
- [ ] **`server-only` en `crypto.ts`**: importar `"server-only"` arriba para que un componente cliente que lo importe por error rompa el build, no se filtre al bundle.
- [ ] **Rotación de clave**: si la key cambia, las credenciales viejas se vuelven ilegibles. Documentar en notas internas (no en este PRP). Fase 7 opcional: tabla `credenciales_key_version` para rotación gradual.
- [ ] **Revelar como server action, no API route**: usar `"use server"` para que el cliente no pueda saltar la verificación RLS+Zod.
- [ ] **Permiso "editar"**: revisar quién puede crear/editar/eliminar credenciales. Mínimo, debería estar gated por permiso del módulo (similar a otros submódulos). Si no hay módulo "ACCESOS" en `ROLES_SEED`, definirlo o reutilizar `AJUSTES`/`DIRECCIÓN` y dejarlo configurable.
- [ ] **Combobox dentro de Dialog**: si el multi-select de roles se hace con Radix Popover + cmdk dentro del Dialog del form, el input se rompe (`MEMORY.md > feedback_combobox_dentro_dialog`). Usar dropdown nativo o el patrón sin portal.
- [ ] **No clonar a empresas existentes**: las tablas se crean vacías. NO seed automático de apps de ejemplo en cada empresa (`MEMORY.md > feedback_inspecciones_no_clonar_nuevas_empresas` aplica como referencia de filosofía).
- [ ] **Migración legacy**: NO borrar `accesos_apps` hasta confirmar visualmente que todo migró bien. Sigue la regla `MEMORY.md > feedback_filter_repo_force_destruye_wip` (working tree limpio + backup antes de destruir).
- [ ] **Audit log (fase 2 futura)**: deliberadamente fuera de scope. Si se quiere trazar quién reveló qué y cuándo, se hará en un PRP posterior con tabla `credenciales_accesos_log`.

## Anti-Patrones

- NO devolver `password_cifrado` ni el plano en `listCredencialesVisibles`. Solo `revelar-action.ts` puede devolver plano, y siempre vía server action.
- NO cifrar/descifrar en el cliente. La clave nunca sale del servidor.
- NO usar `any` en los tipos. Usar `z.infer` de los schemas Zod.
- NO bypassear RLS con `createAdminClient` salvo en el script de migración legacy.
- NO duplicar la lógica de roles del usuario; reutilizar el helper canónico que use el resto de RLS multi-rol.
- NO commitear la clave de cifrado ni semillas con passwords reales.
- NO romper el patrón de barra horizontal 1 ni añadir filtros en la misma fila que `+ Nuevo`.

---

*PRP pendiente aprobación. No se ha modificado código.*
