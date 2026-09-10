# PRP-094: Auditoría de correos — volumen por buzón y con quién (regla 80/20)

> **Estado**: PENDIENTE
> **Fecha**: 2026-09-10
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Un panel en **Dirección › Auditorías › Correo** que, para cada buzón de la empresa conectado
a Gmail, responde a dos preguntas:

1. **¿Cuánto correo mueve?** — entrantes y salientes por día, semana y mes.
2. **¿Con quién?** — el ranking de interlocutores de ese buzón, ordenado de más a menos
   correos, con el **acumulado en porcentaje**: se ve de un vistazo qué puñado de remitentes
   genera el 80 % del correo que entra (Pareto, 80/20).

Ese ranking es el eje del panel: sobre él se decide dónde mejorar (automatizar a un
proveedor pesado, cortar un boletín, redistribuir carga entre departamentos).

Se guardan **solo los datos de cabecera** de cada mensaje (fecha, quién, asunto, etiquetas).
Nunca el cuerpo del correo. **Sin IA en ningún punto: coste 0 €.**

## Por Qué

| Problema | Solución |
|----------|----------|
| Nadie sabe cuánto correo mueve cada área: si RRHH está desbordado o si el buzón de reservas está muerto se descubre por sensación, no por dato | Volumen real entrante/saliente por buzón, por día, semana y mes |
| No se sabe **quién** genera ese volumen, así que no hay dónde atacar para bajarlo | Ranking de interlocutores con acumulado: el 20 % de contactos que trae el 80 % del correo queda señalado |
| En la auditoría mensual de departamento no hay ni un número de carga de trabajo administrativa | El panel entra donde ya se valora cada departamento cada mes |
| Contar esto a mano en Gmail es imposible: Gmail no da totales por periodo ni ranking de remitentes | Las cabeceras se sincronizan a la base y el panel responde al instante |

**Valor de negocio**: mide la carga administrativa por departamento con un dato comprobable,
y señala con nombre y apellidos de dónde viene. Sirve de argumento en la reunión mensual
(contratar, redistribuir, automatizar) y detecta buzones abandonados —correo que entra y
nadie contesta— antes de que se pierda un proveedor o un cliente.

## Qué

### Criterios de Éxito

- [ ] Cada buzón auditado aparece con su estado: **conectado** o **sin conectar**.
- [ ] Para un buzón conectado, el panel muestra entrantes y salientes de **hoy, esta semana y este mes**, y la serie de los 12 meses anteriores.
- [ ] El **ranking de interlocutores** ordena por número de correos e incluye, por fila: entrantes, salientes, total, % sobre el total del periodo y **% acumulado**.
- [ ] La fila donde el acumulado cruza el **80 %** queda marcada: encima de ella está el 20 % que genera la mayor parte del trabajo.
- [ ] El ranking se puede ver **por dirección** (persona) o **por dominio** (empresa), con el mismo cálculo.
- [ ] El día que se cuenta es el **día de la empresa** (zona horaria de la empresa), no el del navegador ni UTC.
- [ ] La conexión es **de la empresa, no del usuario**: la vincule quien la vincule, el buzón queda conectado para todos.
- [ ] Que un usuario se quite esa cuenta de **su** selector personal **no** desconecta la auditoría.
- [ ] Si el permiso de Google se revoca de verdad, el buzón dice **"conexión caducada"**, nunca 0.
- [ ] Un buzón sin conectar dice "sin conectar", **nunca 0**.
- [ ] En la base **no hay cuerpos de correo**: solo cabeceras.
- [ ] La sincronización va sola (cron horario) y se puede lanzar a mano desde el panel.
- [ ] **Cero llamadas a IA** en todo el recorrido.

### Comportamiento Esperado

**Conectar un buzón** (una vez, en Ajustes)
1. Ajustes → Integraciones → Correo: la tabla lista los buzones de la empresa y cuáles están conectados.
2. Se pulsa "Conectar" en uno → permiso de Google → vuelve y el buzón queda conectado.
3. Arranca el volcado inicial: los últimos **12 meses** de cabeceras, en segundo plano.

**Quién sostiene la conexión** (la regla que evita el agujero)
1. Los buzones son **de la empresa**: quien los vincule da igual. Al vincular una cuenta de
   Google cuyo correo coincide con un buzón auditado, el permiso se guarda **a nombre del
   buzón** (`correo_buzones_tokens`), no de la persona.
2. Si un empleado lo conecta desde su ordenador, el buzón queda conectado **para todos** y se
   pone al día solo. No hace falta que lo repita nadie más.
3. Si alguien se quita esa cuenta de **su** selector personal (`/api/google/disconnect`), la
   auditoría **sigue funcionando**: ese botón toca el roster del usuario, no el de la empresa.
4. Solo cortan la auditoría dos cosas: desconectar el buzón **a propósito** desde Ajustes (con
   aviso de que se deja de contar), o que se revoque el permiso desde la cuenta de Google.
   En ese segundo caso el buzón queda "conexión caducada" y se pide reconectar.

**Mirar la auditoría** (a diario, en Dirección)
1. Dirección → Auditorías → Correo.
2. Arriba: buzón (todos / uno) y periodo (día / semana / mes) con su rango.
3. Tarjetas: entrantes, salientes, media diaria y número de contactos distintos.
4. **Ranking de contactos** de ese buzón y periodo, ordenado por volumen, con el acumulado
   y la línea del 80 % marcada. Es la tabla protagonista de la pantalla.
5. Debajo: barras de entrante/saliente por día del rango, y la tabla resumen por buzón.
6. Cambiar a "mes" repinta con los mismos datos: no se vuelve a llamar a Gmail.

**Bajar el volumen** (el uso real)
1. Se mira quién encabeza el ranking de un buzón.
2. Se pincha en ese contacto y se ve su serie: cuánto escribe cada semana y si se le contesta.
3. Con eso se decide: automatizar, agrupar, o cortar.

---

## Contexto

### Referencias

**Código existente que marca el patrón**

- `src/features/direccion/components/auditorias/AuditoriasView.tsx` — vista de Auditorías (toolbar, sincronización en vivo, spinner único).
- `src/features/direccion/components/auditorias/AuditoriaKpis.tsx` — tarjetas de KPI + gráficas con **recharts** (ya es dependencia, `^2.15.4`). Es el patrón visual a copiar.
- `src/shared/lib/supabase-paginado.ts` — lectura paginada obligatoria (Supabase corta en 1000 filas).
- `src/features/direccion/actions/auditoria-kpis-actions.ts` — server action que agrega por periodo `YYYY-MM` y devuelve bloques con métricas + tendencia. Patrón de agregación a copiar.
- `src/lib/google/api.ts` — `googleFetchAuto()` (token en cookie, refresco y reintento) y `refreshAccessToken()`. **`googleFetchAuto` no sirve para el cron**: lee cookies. El cron necesita `refreshAccessToken(refreshToken)` + `googleFetch()`.
- `src/lib/google/accounts.ts` — roster multi-cuenta en `google_cuentas_usuario` (JSONB con `refreshToken` por email), RLS por usuario.
- `src/app/api/google/gmail/messages/route.ts` — parseo de cabeceras `From`/`To`, listado de hilos, carpetas y `labelIds`. De aquí sale el parser de direcciones.
- `src/app/api/google/gmail/unread-count/route.ts` — llamada mínima a `threads.list`.
- `src/app/api/cron/google-resenas-sync/route.ts` — patrón de cron: `CRON_SECRET` fail-closed, cliente admin, bucle por empresa.
- `src/features/empresa/lib/zona-horaria.ts` — `hoyEnZona(tz)`, `ahoraEnZona()`.
- `src/shared/components/SubmoduleToolbar.tsx` — barra del submódulo (búsqueda, filtros, columnas, `viewKey`).
- `supabase/migrations/20260622180000_direccion_auditorias.sql` — RLS con `public.user_has_empresa_access(empresa_id)`.
- `src/features/layout/data/nav-routes.tsx` — `direccionSubs` y `SUBTITULOS`; la sub-ruta se registra ahí (igual que `/direccion/cronogramas/productividad`).

**Reglas del proyecto que condicionan el diseño**

- Los correos de la empresa viven **por departamento** en `empresas.datos_generales` (`correoDireccion`, `correoRrhh`, `correoGestoria`…). No hay correo general. (`project_correo_solo_por_departamento_sin_general`)
- **Todo lo que conecta con un servicio externo se configura en Ajustes.** Aquí: **conectar el buzón = Ajustes**. El panel de Dirección solo mira números, no configura la conexión.
- Token en claro → **tabla solo servidor, sin policies** (`project_token_gestoria_nominas_solo_servidor`).
- Supabase **corta en 1000 filas**: toda lectura de volcado va paginada (`src/shared/lib/supabase-paginado.ts`).
- **0 € ≠ sin dato**: buzón sin conectar dice "sin conectar".
- Fechas dd/mm/aaaa, coma decimal, sentence case, un solo icono de carga centrado, filtro en cada columna, `force-dynamic` exige `loading.tsx`.
- Scopes Gmail: `gmail.readonly` es **restringido** (CASA pendiente). Esta feature **no añade scopes nuevos**: usa los que la app ya pide. (`project_google_oauth_scopes`)

**API de Google**

- `users.messages.list` — `q`, `maxResults` 500, devuelve solo ids (5 unidades de cuota).
- `users.messages.get?format=metadata&metadataHeaders=From,To,Cc,Subject,Date` — cabeceras sin cuerpo (5 unidades).
- `users.history.list?startHistoryId=` — incremental; el `historyId` **caduca** → si Google responde 404, se cae a `q=after:<epoch>` de los últimos 7 días.

### Arquitectura Propuesta (Feature-First)

```
src/features/direccion/correo-auditoria/
├── components/
│   ├── CorreoAuditoriaView.tsx        # panel: toolbar + KPIs + grafica + tablas
│   ├── CorreoKpis.tsx                 # tarjetas (entrantes, salientes, media diaria, contactos)
│   ├── CorreoVolumenChart.tsx         # barras entrante/saliente por dia del rango
│   ├── CorreoParetoChart.tsx          # barras por contacto + linea de acumulado (80/20)
│   ├── CorreoContactosTabla.tsx       # RANKING: un contacto por fila, filtro por columna
│   └── CorreoBuzonesTabla.tsx         # una fila por buzon, filtro por columna
├── actions/
│   ├── correo-metricas-actions.ts     # agregados dia/semana/mes (lee de BD)
│   ├── correo-contactos-actions.ts    # ranking de interlocutores + acumulado
│   └── correo-buzones-actions.ts      # estado de buzones, sync manual
├── services/
│   ├── gmail-ingesta.ts               # backfill + incremental (sin cookies)
│   ├── contraparte.ts                 # parseo de direccion y dominio, funcion PURA
│   └── periodos.ts                    # dia/semana ISO/mes en zona de la empresa
└── types/index.ts

src/app/(main)/direccion/auditorias/correo/{page.tsx,loading.tsx}
src/app/api/cron/correo-auditoria-sync/route.ts
src/features/ajustes/components/integraciones/BuzonesCorreoCard.tsx   # conectar buzon
```

### Modelo de Datos

```sql
-- 1) Buzones auditados. Una fila por (empresa, correo).
CREATE TABLE IF NOT EXISTS public.correo_buzones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email             text NOT NULL,
  departamento_id   uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  estado            text NOT NULL DEFAULT 'Activo',      -- Activo | Inactivo
  -- sin_conectar | conectado | caducado  (NUNCA se traduce a 0 correos)
  conexion          text NOT NULL DEFAULT 'sin_conectar',
  conectado_por     uuid REFERENCES public.usuarios(id) ON DELETE SET NULL, -- informativo
  conectado_at      timestamptz,
  ultima_sync_at    timestamptz,
  ultimo_error      text,
  backfill_hasta    date,          -- hasta donde llego el volcado inicial
  last_history_id   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT correo_buzones_unq UNIQUE (empresa_id, email),
  CONSTRAINT correo_buzones_estado_chk CHECK (estado IN ('Activo','Inactivo')),
  CONSTRAINT correo_buzones_conexion_chk
    CHECK (conexion IN ('sin_conectar','conectado','caducado'))
);
ALTER TABLE public.correo_buzones ENABLE ROW LEVEL SECURITY;
CREATE POLICY correo_buzones_all ON public.correo_buzones FOR ALL
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));

-- 2) Token del buzon. SOLO SERVIDOR: RLS activa y NINGUNA policy.
--    Se lee unicamente con el cliente admin desde el cron/servicio.
CREATE TABLE IF NOT EXISTS public.correo_buzones_tokens (
  buzon_id      uuid PRIMARY KEY REFERENCES public.correo_buzones(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  actualizado   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.correo_buzones_tokens ENABLE ROW LEVEL SECURITY;  -- sin policies

-- 3) Cabecera de cada mensaje. NUNCA el cuerpo.
CREATE TABLE IF NOT EXISTS public.correo_mensajes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  buzon_id            uuid NOT NULL REFERENCES public.correo_buzones(id) ON DELETE CASCADE,
  gmail_message_id    text NOT NULL,
  gmail_thread_id     text NOT NULL,
  direccion           text NOT NULL,          -- entrante | saliente
  enviado_at          timestamptz NOT NULL,   -- internalDate (UTC)
  dia_empresa         date NOT NULL,          -- dia en la ZONA DE LA EMPRESA
  contraparte_email   text NOT NULL DEFAULT '',   -- EJE DEL PANEL
  contraparte_dominio text NOT NULL DEFAULT '',   -- EJE DEL PANEL (agrupado por empresa)
  contraparte_nombre  text NOT NULL DEFAULT '',   -- display name, para pintar
  asunto              text NOT NULL DEFAULT '',
  etiquetas           text[] NOT NULL DEFAULT '{}',   -- labelIds de Gmail
  automatico          boolean NOT NULL DEFAULT false, -- no-reply, boletines, bounces
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT correo_mensajes_unq UNIQUE (buzon_id, gmail_message_id),
  CONSTRAINT correo_mensajes_direccion_chk CHECK (direccion IN ('entrante','saliente'))
);
CREATE INDEX IF NOT EXISTS correo_mensajes_empresa_dia_idx
  ON public.correo_mensajes(empresa_id, dia_empresa DESC);
CREATE INDEX IF NOT EXISTS correo_mensajes_buzon_dia_idx
  ON public.correo_mensajes(buzon_id, dia_empresa DESC);
-- El ranking 80/20 agrupa por contraparte dentro de un buzon y un rango:
CREATE INDEX IF NOT EXISTS correo_mensajes_ranking_idx
  ON public.correo_mensajes(buzon_id, dia_empresa, contraparte_email);
CREATE INDEX IF NOT EXISTS correo_mensajes_dominio_idx
  ON public.correo_mensajes(buzon_id, dia_empresa, contraparte_dominio);
ALTER TABLE public.correo_mensajes ENABLE ROW LEVEL SECURITY;
CREATE POLICY correo_mensajes_all ON public.correo_mensajes FOR ALL
  USING (public.user_has_empresa_access(empresa_id))
  WITH CHECK (public.user_has_empresa_access(empresa_id));
```

**Agregación del ranking (en BD, no en JS)**

El ranking se calcula con una función `SECURITY INVOKER` que agrupa por contraparte y
devuelve ya el acumulado; así el panel no baja miles de filas al navegador ni choca con el
tope de 1000 de Supabase:

```sql
-- Devuelve, para un buzon y un rango: contacto, entrantes, salientes, total,
-- porcentaje y porcentaje ACUMULADO (ordenado de mas a menos).
CREATE OR REPLACE FUNCTION public.correo_ranking_contactos(
  p_buzon_id uuid, p_desde date, p_hasta date, p_por_dominio boolean DEFAULT false,
  p_incluir_automaticos boolean DEFAULT true
) RETURNS TABLE (
  contacto text, nombre text, entrantes bigint, salientes bigint,
  total bigint, porcentaje numeric, acumulado numeric
) ...
```

**Decisiones de modelo**

- Se guarda **un mensaje, no un hilo**: el volumen de trabajo es por correo recibido/enviado.
- **No hay tabla de categorías ni de reglas.** El eje es el interlocutor real; agrupar por
  dominio ya da la lectura "por empresa" sin inventar etiquetas que envejecen mal.
- `automatico` **no es una categoría**: es un marcador técnico (remitente `no-reply@`,
  `mailer-daemon`, cabecera `List-Unsubscribe`) que solo sirve para el interruptor
  "ocultar automáticos" del panel. No se configura en ningún sitio.
- `dia_empresa` se calcula **al guardar**, con la zona de la empresa. Así el panel agrupa por
  una columna `date` sin aritmética de husos, y el corte de medianoche es el de la empresa.
- `direccion` sale de `labelIds`: contiene `SENT` → saliente; si no → entrante.
  Se **descartan** `SPAM` y `DRAFT`. La papelera sí cuenta (llegó igual).
- `contraparte` = `From` en los entrantes, primer `To` en los salientes.
- Semana = **ISO, de lunes a domingo**.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar en cada una (`/bucle-agentico`).

### Fase 1: Registro de buzones y conexión desde Ajustes
**Objetivo**: existen las tablas de buzones y token; en Ajustes → Integraciones se ven los
buzones de la empresa y se puede conectar/desconectar cada uno, guardando el `refresh_token`
en la tabla solo-servidor. Se dan de alta los **8 buzones ya conectados** aprovechando el
roster que ya existe en `google_cuentas_usuario`; el resto queda listado como "sin conectar".
Además, `vincular-callback` engancha con la auditoría: si el correo recién vinculado por
**cualquier** usuario es un buzón auditado, se guarda/renueva el token del buzón.
**Validación**: conectar un buzón real deja `conexion = 'conectado'` y token guardado; el token no
se puede leer con el cliente de navegador (RLS sin policies); **desconectar la cuenta del
selector personal no apaga la auditoría**; vincularlo otro usuario la reactiva sola;
solo la desconexión explícita desde Ajustes borra el token.

### Fase 2: Ingesta de cabeceras desde Gmail
**Objetivo**: servicio que vuelca los últimos **12 meses** de cabeceras de un buzón y luego
sincroniza en incremental; cron horario que recorre todos los buzones activos de todas las
empresas; botón de sincronizar a mano. Parseo de contraparte (dirección, nombre y dominio) y
marcado de automáticos.
**Validación**: tras el volcado, el número de mensajes de un mes en la tabla coincide con lo
que Gmail muestra al buscar ese mismo rango; re-ejecutar el cron no duplica ni una fila;
un `historyId` caducado no rompe la sincronización (cae al modo por fecha).

### Fase 3: Panel Dirección › Auditorías › Correo
**Objetivo**: la vista con selector de buzón y periodo (día/semana/mes), tarjetas de KPI,
**ranking de contactos con acumulado y corte del 80 % marcado** (con conmutador
dirección/dominio y con el interruptor de ocultar automáticos), gráfica de Pareto, barras
entrante/saliente por día, tabla resumen por buzón con filtro en cada columna, y estado
"sin conectar" donde toque. Al pinchar un contacto, su serie en el tiempo. Ruta en el menú.
**Validación**: los tres periodos cuadran entre sí (la suma de los días de la semana = la
semana); la suma de los totales del ranking = el total del periodo; el acumulado de la última
fila es 100 %; el día que se pinta es el de la empresa aunque el navegador esté en otro huso;
un buzón sin conectar no muestra ceros.

### Fase 4: Validación Final
**Objetivo**: sistema funcionando de punta a punta con datos reales de BACANAL y HABANA.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: captura del panel con datos reales
- [ ] Los criterios de éxito, todos marcados
- [ ] Todos los archivos nuevos en `git add` (un archivo sin subir tumba el despliegue)

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Se rellena durante la implementación.

---

## Gotchas

- [ ] **El cron no tiene cookies.** `googleFetchAuto()` lee `g_access_token` de la cookie del navegador: en el cron devuelve siempre `needsReauth`. Hay que canjear el `refresh_token` del buzón con `refreshAccessToken()` y llamar con `googleFetch()`.
- [ ] **Supabase corta en 1000 filas.** El volcado inserta por lotes y el ranking se agrega **en BD**, no bajando filas al cliente.
- [ ] **`internalDate` viene en milisegundos epoch UTC.** Convertir a día con la zona de la EMPRESA, nunca con `toLocaleDateString()` del servidor (que corre en UTC en Vercel).
- [ ] **El `historyId` caduca.** Google responde 404 y hay que caer a `q=after:` de los últimos días; si no, el buzón deja de sincronizar en silencio.
- [ ] **`messages.list` con `q` no da el total fiable.** `resultSizeEstimate` es una estimación: hay que paginar los ids y contarlos.
- [ ] **Nada de cuerpos.** `format=metadata` con `metadataHeaders`; jamás `format=full` ni guardar `snippet`.
- [ ] **La contraparte hay que normalizarla en minúsculas** antes de agrupar, o el mismo proveedor sale dos veces en el ranking y el 80/20 miente.
- [ ] **Alias y subdirecciones** (`pedidos+bacanal@proveedor.es`) parten el ranking: se normaliza quitando lo que va tras `+`.
- [ ] **Un correo con varios destinatarios** cuenta una vez, por el primer `To`; el `Cc` no crea filas nuevas.
- [ ] **Un correo puede llevar varias etiquetas.** La dirección se decide solo por `SENT`.
- [ ] **Correo a uno mismo**: la `UNIQUE (buzon_id, gmail_message_id)` lo deja en una fila; cuenta como saliente.
- [ ] **`force-dynamic` sin `loading.tsx`**: al pulsar en el menú no pasa nada. La sub-ruta nueva necesita su `loading.tsx`.
- [ ] **Nuevos scopes = nueva pantalla de consentimiento.** Esta feature se queda con los scopes que la app ya pide (`gmail.readonly` incluido).
- [ ] **Migraciones idempotentes y versionadas** (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
- [ ] **`/api/google/disconnect` NO debe tocar `correo_buzones_tokens`.** Es el roster personal del usuario; si al desconectar su cuenta se borrase el token del buzón, la auditoría de la empresa moriría por un gesto individual. Son dos almacenes distintos a propósito.
- [ ] **El token del buzón se refresca desde donde venga.** Si cualquier usuario vuelve a vincular ese correo, el `refresh_token` del buzón se actualiza (upsert) y se limpia el estado de caducado.
- [ ] **Google solo devuelve `refresh_token` la primera vez** salvo `prompt=consent`. Si al vincular no llega, hay que conservar el que ya estaba guardado en vez de machacarlo con vacío.
- [ ] **Revocado ≠ caído.** Un 5xx o un corte de red hacen fallar el refresco sin que nadie haya revocado nada: solo se marca "conexión caducada" cuando Google responde `invalid_grant`. Si no, se reintenta en el siguiente barrido.
- [ ] **Tres estados, no dos**: sin conectar / conectado / conexión caducada. Cada uno se pinta distinto y ninguno enseña 0.
- [ ] **Un buzón sin conectar no es un buzón con 0 correos.** Los estados distintos se pintan distinto.

## Anti-Patrones

- NO usar IA en ningún punto: ni para clasificar, ni para resumir, ni para agrupar. Coste 0 €.
- NO inventar categorías: el eje es el interlocutor real (dirección o dominio).
- NO consultar Gmail desde el panel al pintar: el panel lee de la base, la ingesta es aparte.
- NO guardar cuerpos, adjuntos ni `snippet` de correo.
- NO calcular el ranking en JavaScript bajando filas: se agrega en BD.
- NO poner la conexión del buzón en el engranaje del submódulo: las integraciones externas van en Ajustes.
- NO calcular el día con la zona del navegador ni con `toLocaleDateString()` sin `timeZone`.
- NO leer `correo_buzones_tokens` desde el cliente ni desde una server action de usuario: solo cliente admin.
- NO atar la auditoría al roster personal `google_cuentas_usuario`: son correos de la empresa y la conexión la sostiene la empresa.
- NO marcar un buzón como caducado por un fallo pasajero de red: solo con `invalid_grant`.
- NO crear una vista nueva de "correo" en el menú principal: vive dentro de Dirección › Auditorías.

---

## ✅ Decisiones ya tomadas por Iván (2026-09-10)

1. **Qué se guarda**: solo la ficha del correo (fecha, quién, a quién, asunto, entrada/salida).
   Nunca el cuerpo, nunca un resumen.
2. **Dónde vive**: Dirección › Auditorías, como sub-ruta `/direccion/auditorias/correo`.
3. **Qué buzones**: se empieza por los **8 ya conectados**. La tabla admite el resto sin
   cambios de modelo: se conectan cuando se quiera y se ponen al día solos.
4. **Historial**: **12 meses** en el volcado inicial.
5. **Sin categorías**: el eje es **con quién habla cada buzón**, ordenado por volumen y con el
   acumulado, para atacar el 20 % de contactos que genera el 80 % del correo.
6. **Cero IA**: es requisito, no preferencia. Nada de esta feature toca el tope de 5 €/mes.
7. **La conexión la sostiene la empresa, no la persona**: la vincule quien la vincule vale, y
   quitarse la cuenta del selector personal no apaga la auditoría. Son correos de la empresa.

---

*PRP pendiente de aprobación. No se ha modificado código.*
