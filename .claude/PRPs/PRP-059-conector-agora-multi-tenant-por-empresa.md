# PRP-059: Conector Ágora por cliente (multi-tenant, credenciales por empresa)

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-18
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Que cada empresa cliente configure SUS PROPIAS credenciales de Ágora POS desde el panel (Ajustes → Integraciones): URL, token (cifrado) y nº de TPV/Workplace, con un flag `agora_activo`. El cron y los servicios de ingesta dejan de leer variables de entorno globales y el mapa hardcodeado `EMPRESA_WORKPLACE`, y pasan a iterar TODAS las empresas con `agora_activo = true` leyendo sus credenciales desde BD. Cero código por cliente nuevo: alta de un restaurante con Ágora = rellenar un formulario.

## Por Qué

| Problema | Solución |
|----------|----------|
| `AGORA_API_URL` / `AGORA_API_TOKEN` son variables de entorno globales en Vercel: un solo Ágora para todo el SaaS. No escala a más clientes. | Columnas por empresa en `empresas` (URL, token cifrado, workplace, activo). Cada cliente tiene su conexión. |
| El mapa `EMPRESA_WORKPLACE = { HABANA:1, BACANAL:4 }` está hardcodeado en código; cada cliente nuevo exige editar y desplegar. | El workplace vive en `empresas.agora_workplace_id`; el cron itera por `agora_activo = true`. Cliente nuevo = formulario, sin deploy. |
| El cliente no puede ni ver ni cambiar su conexión Ágora; depende de que nosotros toquemos Vercel. | Formulario self-service en Ajustes con botón "Probar conexión" antes de guardar. |
| El token de Ágora viajaría en plano si se guardara tal cual. | Cifrado AES-256-GCM real reutilizando `src/features/accesos/lib/crypto.ts` (PRP-043) y `CREDENCIALES_ENCRYPTION_KEY`. |

**Valor de negocio**: el conector Ágora deja de ser un coste de ingeniería por cliente y pasa a ser onboarding self-service. Habilita vender el SaaS a cualquier restaurante con Ágora sin tocar Vercel ni desplegar código.

## Qué

### Criterios de Éxito
- [ ] La tabla `empresas` tiene columnas `agora_activo` (bool, default false), `agora_api_url` (text), `agora_api_token_cifrado` (text), `agora_workplace_id` (int). El token NUNCA se guarda en plano.
- [ ] Existe un formulario en Ajustes → Integraciones (o Herramientas) donde el cliente pega URL + token + nº TPV, con toggle Activo/Inactivo y botón "Probar conexión".
- [ ] "Probar conexión" hace una llamada real a Ágora con las credenciales tecleadas (server action, token nunca expuesto al cliente) y devuelve OK / detalle del error.
- [ ] El token cifrado nunca viaja al cliente: el form muestra "•••• configurado" si ya hay token guardado y solo lo reescribe si el usuario teclea uno nuevo.
- [ ] El cron `/api/cron/agora-sync` itera TODAS las empresas con `agora_activo = true` (sin lista hardcodeada) y procesa cada una con SUS credenciales.
- [ ] `agora-ventas-ingesta.ts` (y demás servicios Ágora) reciben/leen las credenciales por empresa; se elimina la constante `EMPRESA_WORKPLACE`.
- [ ] Habana y Bacanal quedan migradas: su fila en `empresas` tiene URL, token cifrado y workplace (1 y 4) y `agora_activo = true`; el cron las procesa idéntico a antes.
- [ ] Durante la transición, si una empresa no tiene credenciales en BD, los servicios caen al fallback de variables de entorno globales (sin romper Habana/Bacanal si aún no se migran).
- [ ] `npm run typecheck` y `npm run build` pasan; el cron procesa Habana+Bacanal en una ejecución manual (`?fecha=YYYY-MM-DD`) sin la lista hardcodeada.

### Comportamiento Esperado (Happy Path)

1. Onboarding de un restaurante nuevo con Ágora. El cliente entra en Ajustes → Integraciones → Ágora POS.
2. Pega la URL de su servidor Ágora, el token de su API y el nº de TPV (Workplace). Pulsa "Probar conexión".
3. El server action llama a Ágora con esas credenciales; responde "Conexión correcta" (o el error real si falla).
4. El cliente activa el toggle "Activo" y pulsa Guardar. El token se cifra server-side con AES-256-GCM antes del UPDATE; en BD queda `iv:tag:enc`.
5. Esa noche, el cron `/api/cron/agora-sync` recorre todas las empresas con `agora_activo = true` —incluida la nueva— descifra cada token, ingiere las ventas del día anterior con el workplace de cada una y registra en `agora_sync_log`.
6. Habana y Bacanal siguen funcionando igual: su conexión ya vive en su fila de `empresas`.

---

## Contexto

### Referencias
- `src/features/accesos/lib/crypto.ts` — **cifrado AES-256-GCM real reutilizable** (`encrypt`/`decrypt`, formato `iv:tag:enc`, clave `CREDENCIALES_ENCRYPTION_KEY`). PRP-043. NO crear cifrado nuevo.
- `src/features/logistica/services/agora-ventas-ingesta.ts` — `ingerirVentasAgoraDia()`, `agoraGet()` (lee `process.env.AGORA_API_URL/TOKEN`) y la constante hardcodeada `EMPRESA_WORKPLACE` a eliminar.
- `src/app/api/cron/agora-sync/route.ts` — cron diario; hoy itera `Object.keys(EMPRESA_WORKPLACE)`. Punto central del refactor de iteración.
- `src/features/sala/actions/agora-migracion-actions.ts` — usa `EMPRESA_WORKPLACE` y `process.env.AGORA_API_URL/TOKEN` (líneas 136, 155-159). Hay que adaptarlo.
- `src/features/logistica/services/agora-sync.ts` (catálogo, l.153), `agora-ventas-sync.ts` (l.240-245), `agora-stock-mirror.ts` (l.62-67) — otros servicios que leen las envs globales; revisar si entran en el refactor o quedan con fallback.
- `src/features/ajustes/components/HerramientasTab.tsx` + `TelefonoConfigPanel.tsx` — **patrón de panel de integración por empresa** a imitar para el panel Ágora. Acordeón de herramientas.
- `src/features/ajustes/components/EmpresaTab.tsx` / `DatosGeneralesTab.tsx` — patrón de form de edición de `empresas`.
- Memoria `project_imagen_de_marca` / `project_empresa_activa_cookie` — `empresas` es la tabla por-empresa canónica; `getAppContext()` da la empresa activa.
- Endpoint Ágora usado hoy: `GET {base}/api/export/?business-day=YYYY-MM-DD&filter=Invoices` con header `Api-Token`. Base real de ejemplo: `http://habanabacanaliictpv.ddns.me:8984`.

### Arquitectura Propuesta (Feature-First)
```
src/features/ajustes/
├── components/
│   └── AgoraConfigPanel.tsx        # form URL + token + nº TPV + toggle activo + "Probar conexión"
├── actions/
│   └── agora-config-actions.ts     # getAgoraConfig / saveAgoraConfig / probarConexionAgora (server)

src/features/logistica/services/
├── agora-credenciales.ts           # NUEVO: getAgoraCredenciales(supabase, empresaId) -> { baseUrl, token, workplaceId } | null
│                                   #   lee empresas.agora_*; descifra token; fallback a process.env si falta
├── agora-ventas-ingesta.ts         # agoraGet(creds, path); ingerirVentasAgoraDia recibe creds; SE ELIMINA EMPRESA_WORKPLACE
```
- `getAgoraCredenciales()` es la **fuente única** de credenciales: descifra con `accesos/lib/crypto`, aplica fallback a envs globales, devuelve null si la empresa no está conectada.
- El cron consulta `empresas` con `agora_activo = true` y pasa las credenciales descifradas a la ingesta. Sin mapas en código.

### Modelo de Datos
```sql
-- Columnas nuevas en empresas (NO crear tabla aparte: empresas es la tabla por-empresa canónica)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS agora_activo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agora_api_url text,
  ADD COLUMN IF NOT EXISTS agora_api_token_cifrado text,   -- formato iv:tag:enc (AES-256-GCM)
  ADD COLUMN IF NOT EXISTS agora_workplace_id integer;

-- Migración de datos (Habana=1, Bacanal=4). El token cifrado se inserta por script
-- server-side (usa CREDENCIALES_ENCRYPTION_KEY), no en SQL plano.
-- HABANA  id 00000000-0000-0000-0000-000000000001 -> workplace 1, activo true
-- BACANAL id fe2ea3c4-aa28-41ce-a135-bf196ab5dc47 -> workplace 4, activo true

-- RLS: empresas ya tiene políticas multi-tenant (empresas_del_usuario()). El token cifrado
-- solo se descifra server-side; NUNCA se devuelve la columna agora_api_token_cifrado al cliente.
```

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Esquema en BD y migración de datos
**Objetivo**: `empresas` con las 4 columnas Ágora; Habana y Bacanal migradas (workplace 1/4, token cifrado, `agora_activo=true`) vía script server-side que reutiliza `encrypt()`.
**Validación**: `SELECT id, agora_activo, agora_workplace_id, (agora_api_token_cifrado IS NOT NULL) FROM empresas WHERE agora_activo` devuelve Habana y Bacanal con token presente; la columna del token nunca aparece en queries del cliente.

### Fase 2: Fuente única de credenciales por empresa
**Objetivo**: `agora-credenciales.ts` con `getAgoraCredenciales(supabase, empresaId)` que lee `empresas.agora_*`, descifra el token con `accesos/lib/crypto`, y cae a `process.env.AGORA_API_URL/TOKEN` + workplace si la empresa no tiene credenciales (fallback de transición). Devuelve `null` si no está conectada.
**Validación**: helper devuelve credenciales correctas para Habana/Bacanal leyendo de BD; con BD vacía cae al env global sin romper.

### Fase 3: Refactor de cron y servicios de ingesta
**Objetivo**: el cron itera empresas con `agora_activo=true` (sin `EMPRESA_WORKPLACE`); `ingerirVentasAgoraDia`/`agoraGet` reciben las credenciales por parámetro; se elimina la constante `EMPRESA_WORKPLACE` y sus usos en `agora-migracion-actions.ts`. Servicios de catálogo/stock-mirror: adaptar a `getAgoraCredenciales` o dejar con fallback explícito (decidir en mapeo).
**Validación**: `grep EMPRESA_WORKPLACE src/` sin resultados; ejecución manual del cron (`?fecha=…`) procesa Habana+Bacanal idéntico a antes.

### Fase 4: UI de configuración self-service en Ajustes
**Objetivo**: `AgoraConfigPanel` (form URL + token + nº TPV + toggle Activo + botón "Probar conexión") integrado en Ajustes → Integraciones/Herramientas, con `agora-config-actions.ts` (get/save/probar). Token enmascarado ("•••• configurado"), nunca devuelto al cliente; capitalización sentence case; estado Activo/Inactivo.
**Validación**: cliente guarda credenciales nuevas → cifradas en BD; "Probar conexión" devuelve OK con creds válidas y error claro con inválidas; el token cifrado no aparece en la respuesta de red.

### Fase 5: Validación Final
**Objetivo**: Sistema funcionando end-to-end multi-tenant.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] `grep -rn "EMPRESA_WORKPLACE" src/` vacío
- [ ] Cron manual procesa todas las empresas `agora_activo=true`
- [ ] Playwright/screenshot confirma el panel de Ajustes y "Probar conexión"
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece durante la implementación.

---

## Gotchas

- [ ] **Cifrado**: reutilizar `src/features/accesos/lib/crypto.ts` tal cual; NO crear cifrado nuevo. Requiere `CREDENCIALES_ENCRYPTION_KEY` (64 hex) ya presente en el proyecto.
- [ ] El cron usa el **service role** (`createClient` con `SUPABASE_SERVICE_ROLE_KEY`), no `getAppContext`; el filtro por empresa es por query (`agora_activo = true`), no por RLS de sesión.
- [ ] El token cifrado NUNCA se devuelve al cliente: `getAgoraConfig` debe omitir `agora_api_token_cifrado` y devolver solo un booleano `tokenConfigurado`.
- [ ] "Probar conexión" debe usar el token que el usuario acaba de teclear (aún no guardado) o, si lo dejó vacío y ya hay uno, el cifrado en BD. Token siempre server-side.
- [ ] Hay **5 servicios** que leen las envs Ágora (`ingesta`, `sync` catálogo, `ventas-sync`, `stock-mirror`, `migracion-actions`). No olvidar ninguno: o se adaptan a `getAgoraCredenciales` o se documenta su fallback.
- [ ] Fallback de transición obligatorio: mientras Habana/Bacanal no estén migradas, las envs globales deben seguir funcionando (no fail-closed prematuro).
- [ ] Multi-tenant: el cambio es al software compartido (todas las empresas), nunca a una empresa concreta en código (memoria `feedback_cambios_multi_tenant`).
- [ ] La URL de Ágora suele ser `http://` (servidor local del restaurante con DDNS), no `https://`. No forzar https en la validación.

## Anti-Patrones

- NO crear una tabla `agora_config` aparte: `empresas` es la tabla por-empresa canónica.
- NO duplicar la lógica de cifrado: usar `accesos/lib/crypto`.
- NO devolver el token (ni cifrado ni plano) al cliente salvo en el flujo explícito server-side de "probar".
- NO dejar `EMPRESA_WORKPLACE` ni ningún mapa empresa→workplace en código.
- NO romper Habana/Bacanal durante la transición: fallback a envs hasta migrar.
- NO ignorar errores de TypeScript ni omitir validación Zod del form.

---

*PRP pendiente aprobación. No se ha modificado código.*
