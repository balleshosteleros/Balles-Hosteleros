# PRP-041: Cierre verificado de inspección con QR de un solo uso

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-25
> **Proyecto**: Balles-Hosteleros
> **Módulo**: Calidad → Inspecciones (Realizadas)
> **Relacionado**: PRP-040 (Inspectores bolsa empleo), módulo Inspecciones Propias (memory `project_inspecciones_propias.md`)

---

## Objetivo

Añadir al cierre del formulario público del inspector un **QR de verificación in-situ de un solo uso** (caducidad 30 min) que el encargado del local escanea con el móvil para confirmar que la inspección se realizó realmente allí. Tras el escaneo, la inspección queda marcada como **verificada** en el sistema y el encargado ve una pantalla de confirmación con instrucción del descuento a aplicar.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy el inspector externo puede enviar el formulario desde cualquier sitio; no hay garantía de que realmente fue al local | Cierre con QR escaneado por un empleado del local en su sesión → prueba presencial |
| Calidad no sabe si el encargado vio el cierre de la inspección ni si se aplicó el descuento prometido al inspector | Verificación trazable (`verificado_at`, `verificado_por_empleado_id`) + mensaje explícito del descuento al encargado |
| El envío "pendiente_revision" no distingue entre "el inspector lo envió" y "el encargado lo confirmó en el local" | Nuevo badge "Pendiente de verificación" en Realizadas → visibilidad operativa sin bloquear el flujo de revisión interno |

**Valor de negocio**:
- **Antifraude**: imposible enviar inspecciones falsas a distancia sin la complicidad explícita de un empleado del local.
- **Cierre operativo medible**: el equipo de Calidad ve qué porcentaje de inspecciones se han verificado en sitio.
- **Confianza en la red de inspectores externos**: alinea el contrato (visita real → descuento real).

## Qué

### Criterios de Éxito

- [ ] Al pulsar "Enviar inspección" en `/inspectores/[token]`, el inspector ve un **diálogo de confirmación** ("Esta acción es irreversible") antes de cerrar.
- [ ] Al confirmar, el envío queda **inmutable** (`estado` no editable desde el formulario público) y se genera un `inspeccion_qr_token` único.
- [ ] La pantalla del inspector muestra el **QR a tamaño grande** + instrucción "Enseña este QR al encargado del local" + cuenta atrás de 30 min.
- [ ] Si el QR caduca sin escanear, aparece botón **"Regenerar QR"** que invalida el anterior (`revoked=true`) y crea uno nuevo.
- [ ] El QR codifica la URL absoluta `https://sistema.balleshosteleros.com/inspecciones/verificar/[token]`.
- [ ] Al abrir la URL de verificación, si el usuario no está logueado, se le redirige a `/login?next=/inspecciones/verificar/[token]` y vuelve tras el login.
- [ ] El backend valida que el usuario es un empleado activo del **mismo local** del envío (o multiempresa con acceso a esa empresa) — si no, error explícito.
- [ ] El token se marca como **usado** (`used_at`, `used_by_empleado_id`) atomicamente; un segundo intento muestra "QR ya utilizado".
- [ ] Tras verificar, el encargado ve pantalla verde: **"✓ Inspección verificada — Aplica el descuento INSPECCIÓN al ticket"** + CTA "Ver inspección en Mi Panel".
- [ ] En `RealizadasView` aparece badge amarillo **"Pendiente de verificación"** mientras `verificado_at IS NULL` (no bloquea revisión interna).
- [ ] RLS multiempresa estándar (`UNION user_empresas`) sobre `inspeccion_qr_tokens` y sobre las nuevas columnas de `inspeccion_envios`.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Flujo inspector (happy path)**:
1. Inspector rellena el formulario en `/inspectores/[token]` y pulsa "Enviar inspección".
2. Aparece `AlertDialog`: *"Vas a cerrar esta inspección. Esta acción es irreversible. ¿Continuar?"*.
3. Al confirmar, se llama al endpoint público de envío (`POST /api/inspectores/[token]/envio`, ya existente) extendido para que en el mismo paso:
   - Inserte el envío con `estado='pendiente_revision'`.
   - Genere y devuelva el `qr_token` (token aleatorio, expires_at = now() + 30min).
4. El cliente abre `QrViewerDialog` mostrando: QR grande (URL `https://sistema.balleshosteleros.com/inspecciones/verificar/[token]`) + cuenta atrás + instrucción + botón "Regenerar QR" (deshabilitado hasta caducidad).
5. Cuando el contador llega a 0 → habilita "Regenerar QR"; pulsarlo llama a `POST /api/inspectores/[token]/qr/regenerar` con `envio_id`+`token` original como prueba de continuidad, marca el anterior `revoked=true` e inserta uno nuevo.

**Flujo encargado (happy path)**:
1. Encargado escanea con la cámara del móvil → abre `https://sistema.balleshosteleros.com/inspecciones/verificar/[token]`.
2. Si no hay sesión: redirect a `/login?next=/inspecciones/verificar/[token]`. Tras login, el usuario vuelve automáticamente.
3. La página Server Component:
   - Resuelve el token en `inspeccion_qr_tokens` con admin client (sin RLS de usuario).
   - Verifica `revoked=false`, `used_at IS NULL`, `expires_at > now()`.
   - Obtiene el `empresa_id` y `local_id` del envío asociado.
   - Llama a `getAppContext()` y comprueba que el `userId` tiene un `empleados` con `local_id` igual al del envío y pertenece a esa empresa (o tiene acceso vía `user_empresas`).
4. Si todo ok, ejecuta server action `verificarEnvioConToken(token)` que:
   - Hace `UPDATE inspeccion_qr_tokens SET used_at=now(), used_by_empleado_id=$empleadoId WHERE token=$token AND used_at IS NULL AND revoked=false AND expires_at>now()` (concurrency-safe).
   - Si afecta 1 fila: `UPDATE inspeccion_envios SET verificado_at=now(), verificado_por_empleado_id=$empleadoId, verificado_qr_token_id=$tokenId WHERE id=$envioId`.
5. Renderiza la pantalla verde con instrucción del descuento y un link (`target="_blank"` no aplica — es la misma sesión) hacia la vista del empleado en Mi Panel.

**Casos de error visibles al encargado**:
- QR caducado → mensaje rojo + sugerencia: "Pide al inspector que regenere el QR".
- QR ya usado → mensaje gris + datos básicos: "Esta inspección ya fue verificada el [fecha] por [empleado]".
- Empleado no pertenece al local del envío → mensaje rojo: "No tienes permiso para verificar inspecciones de este local".
- Sesión no es de un empleado registrado en la empresa → mismo mensaje.

---

## Contexto

### Referencias
- `src/features/calidad/inspecciones/public-data.ts` — patrón actual de admin client para resolución pública por token.
- `src/features/calidad/inspecciones/components/PublicFormulario.tsx` — formulario actual que se enviará vía endpoint POST.
- `src/features/calidad/inspecciones/components/RealizadasView.tsx` — listado interno donde se añadirá el badge "Pendiente de verificación".
- `src/features/calidad/inspecciones/actions.ts` — server actions del módulo (extender con 3 acciones nuevas).
- `src/lib/supabase/get-context.ts` + `src/features/empresa/lib/empresa-server.ts` — patrón `getAppContext()` con cookie `bh_empresa_activa`.
- `src/features/auth/components/GoogleSignInButton.tsx` — patrón `next=...` para preservar callback tras login (ya soportado).
- `src/app/firmar/[token]/VisorPdfInteractivo.tsx` — uso existente de `QRCodeSVG` from `qrcode.react` (librería YA instalada → **NO requiere `npm install`**).
- Memoria `project_rls_multiempresa.md` — UNION `user_empresas` obligatorio.
- Memoria `project_empresa_activa_cookie.md` — usar siempre `getAppContext()`.
- Memoria `project_inspecciones_propias.md` — arquitectura existente de las 8 tablas `inspeccion_*`.
- Memoria `feedback_seeds_canonicos_propagan.md` — nada que sembrar (sin datos canónicos).

### Arquitectura Propuesta (Feature-First)

No se crea feature nueva. Se extiende `src/features/calidad/inspecciones/`:

```
src/features/calidad/inspecciones/
├── actions.ts                                # + finalizarEnvio / regenerarQrToken / verificarEnvioConToken
├── public-data.ts                            # + finalizarEnvioPublico / regenerarQrPublico
├── types.ts                                  # + QrToken, VerificacionResultado, EnvioVerificacionInfo
└── components/
    ├── PublicFormulario.tsx                  # ~ AlertDialog confirmación + abre QrViewerDialog
    ├── QrViewerDialog.tsx                    # + (nuevo) modal con QR + countdown + regenerar
    └── RealizadasView.tsx                    # ~ badge "Pendiente verificación" + columna opcional
```

Rutas nuevas:

```
src/app/
├── api/inspectores/[token]/
│   ├── envio/route.ts                        # ~ modificar: devuelve también qr_token
│   └── qr/regenerar/route.ts                 # + (nuevo) endpoint público
└── inspecciones/verificar/[token]/
    └── page.tsx                              # + (nuevo) Server Component con guard
```

Mi Panel — sub-vista nueva `/mi-panel/inspecciones` (CONFIRMADO):
- Crear sub-sección **Inspecciones** en Mi Panel del empleado. Si la entrada de menú no existe en el sidebar de `/mi-panel`, añadirla.
- Listado de inspecciones donde `verificado_por_empleado_id = empleado_actual` (las que el empleado validó con su escaneo de QR).
- Cada fila navega al detalle de la inspección (snapshot read-only del envío: respuestas, nota final, fecha, inspector, local).
- Filtros básicos: por local (si el empleado tiene varios), por rango de fechas, por nota.
- El CTA "Ver en Mi Panel" de la pantalla verde de verificación enlaza directamente a `/mi-panel/inspecciones` (lista) — al recién verificada queda destacada arriba (orden por `verificado_at desc`).
- RLS estándar UNION user_empresas; query filtra por `verificado_por_empleado_id` = el id del empleado del usuario autenticado.

### Modelo de Datos

**Tabla nueva: `inspeccion_qr_tokens`**

```sql
CREATE TABLE inspeccion_qr_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id     UUID NOT NULL REFERENCES inspeccion_envios(id) ON DELETE CASCADE,
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  used_by_empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
  revoked      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX inspeccion_qr_tokens_envio_idx   ON inspeccion_qr_tokens(envio_id);
CREATE INDEX inspeccion_qr_tokens_empresa_idx ON inspeccion_qr_tokens(empresa_id);
CREATE INDEX inspeccion_qr_tokens_token_idx   ON inspeccion_qr_tokens(token);

ALTER TABLE inspeccion_qr_tokens ENABLE ROW LEVEL SECURITY;

-- SELECT/INSERT/UPDATE para usuarios autenticados de la empresa (multiempresa con UNION)
CREATE POLICY inspeccion_qr_tokens_rw ON inspeccion_qr_tokens
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM profiles WHERE user_id = auth.uid()
      UNION
      SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM profiles WHERE user_id = auth.uid()
      UNION
      SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()
    )
  );

-- IMPORTANTE: NO se concede SELECT/UPDATE a anon. El endpoint público de verificación
-- usa admin client en el servidor y filtra por token literal. El anon NUNCA toca esta tabla
-- directamente para evitar leakage de filas por escaneo de tokens.
```

**Cambios en `inspeccion_envios`** (alter):

```sql
ALTER TABLE inspeccion_envios
  ADD COLUMN verificado_at             TIMESTAMPTZ,
  ADD COLUMN verificado_por_empleado_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
  ADD COLUMN verificado_qr_token_id    UUID REFERENCES inspeccion_qr_tokens(id) ON DELETE SET NULL;

-- Las políticas RLS existentes sobre inspeccion_envios siguen aplicando.
-- Hacer un re-check rápido en migración para asegurar que UPDATE permite estos campos.
```

**Generación del token**: `gen_random_bytes(24)` codificado en base64url server-side (Node), o `encode(gen_random_bytes(24), 'base64')` y normalizar. Token mínimo 32 chars URL-safe → suficientemente aleatorio para descartar fuerza bruta a 30 min de ventana.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar).

### Fase 1: DB — Tabla `inspeccion_qr_tokens` + columnas en `inspeccion_envios`
**Objetivo**: Modelo de datos listo con RLS multiempresa y FKs correctas.
**Validación**:
- Migración aplicada en Supabase (vía MCP `apply_migration` tras aprobación humana del DDL).
- `supabase__list_tables` confirma la tabla y columnas.
- `supabase__get_advisors` no reporta warnings nuevos de RLS.

### Fase 2: Backend — Acciones y endpoints
**Objetivo**: Lógica de cierre, generación de QR, regeneración y verificación.
**Validación**:
- `actions.ts` exporta `finalizarEnvio(envioId)`, `regenerarQrToken(envioId)`, `verificarEnvioConToken(token)`.
- `public-data.ts` extiende `submitInspeccion` para devolver `{ ok, envioId, numero, qrToken, expiresAt }`.
- `POST /api/inspectores/[token]/envio` devuelve el QR junto con el resultado.
- `POST /api/inspectores/[token]/qr/regenerar` valida que el envío fue creado por el mismo `token` público y aún no está verificado, invalida el QR anterior y devuelve uno nuevo.
- `UPDATE` de verificación es atómico (filtra por `used_at IS NULL AND expires_at > now() AND revoked=false`).
- Tipos en `types.ts` actualizados.

### Fase 3: UI Inspector — Confirmación + QR Viewer
**Objetivo**: Inspector ve diálogo "irreversible", QR grande, countdown y botón regenerar.
**Validación**:
- `PublicFormulario.tsx` muestra `AlertDialog` antes del envío real.
- `QrViewerDialog.tsx` renderiza con `QRCodeSVG` from `qrcode.react`, instrucción visible, countdown que se actualiza cada segundo, botón "Regenerar QR" deshabilitado hasta `expires_at`.
- Si la regeneración falla, toast de error claro.
- Mobile-first (el inspector usa móvil): QR mínimo 280×280 px.

### Fase 4: UI Encargado — Ruta de verificación
**Objetivo**: Página pública `/inspecciones/verificar/[token]` con guard de auth y verificación.
**Validación**:
- Server Component que:
  - Si sin sesión → `redirect('/login?next=/inspecciones/verificar/' + token)`.
  - Si sesión sin empleado/local match → pantalla rojo con mensaje.
  - Si token caducado/usado → pantalla informativa correspondiente.
  - Si todo ok → server action ejecuta la verificación y muestra pantalla verde + CTA "Ver en Mi Panel".
- El callback `next=` del login YA preserva la URL (LoginForm soporta `redirectTo`); validar end-to-end.
- CTA "Ver en Mi Panel" enlaza a **`/mi-panel/inspecciones`** (sub-vista creada en Fase 4b).

### Fase 4b: UI Encargado — Sub-vista Mi Panel → Inspecciones
**Objetivo**: el empleado verificador puede consultar las inspecciones que él validó desde su portal.
**Cambios**:
- Crear ruta `/app/(main)/mi-panel/inspecciones/page.tsx` (Server Component) que lista los `inspeccion_envios` donde `verificado_por_empleado_id` = empleado del usuario autenticado, orden `verificado_at desc`.
- Crear detalle `/app/(main)/mi-panel/inspecciones/[envio_id]/page.tsx` con snapshot read-only (respuestas, nota final, fecha, inspector, local, plantilla usada).
- Añadir entrada **"Inspecciones"** al sidebar/menú de Mi Panel (localizar archivo de navegación de `/mi-panel` durante la fase).
- Tabla con patrón estándar SubmoduleToolbar (búsqueda + filtros por local/fecha/nota) + columnas redimensionables.
- Si el empleado no tiene ninguna inspección verificada todavía: empty state ("Aún no has verificado ninguna inspección. Cuando un inspector te enseñe un QR, lo verás aquí.").
**Validación**:
- Empleado A solo ve las inspecciones donde verificó él (no las de empleado B del mismo local).
- Multiempresa: si el empleado opera en varias empresas, ve las de todas (UNION user_empresas).
- Detalle es read-only (no se puede modificar la inspección desde Mi Panel).

### Fase 5: UI Realizadas — Badge "Pendiente verificación"
**Objetivo**: Listado interno muestra estado de verificación sin bloquear el flujo.
**Validación**:
- `RealizadasView.tsx` añade columna o badge contextual en la columna "Estado" (decisión en fase): amarillo "Pendiente verificación" si `verificado_at IS NULL`, verde "Verificada" + fecha si está.
- `EnvioDetailDialog` muestra `verificado_at` + nombre del empleado verificador.
- `listEnvios` / `getEnvio` devuelven los campos nuevos.

### Fase 6: Validación Final
**Objetivo**: Sistema funcionando end-to-end en ambas empresas (HABANA, BACANAL).
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Playwright simula: inspector envía formulario → QR aparece → empleado encargado escanea (abre URL) → pantalla verde.
- [ ] Test manual de caducidad: editar `expires_at` a un valor pasado vía Supabase → escaneo muestra "QR caducado".
- [ ] Test manual de doble uso: escanear dos veces → segundo intento muestra "QR ya utilizado".
- [ ] Test manual de empleado de otro local → mensaje "Sin permiso".
- [ ] Criterios de éxito de la sección "Qué" todos marcados.

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

*(Vacío hasta ejecución)*

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] `qrcode.react` está instalado (`^4.2.0`) → NO ejecutar `npm install`. Importar `QRCodeSVG` como en `src/app/firmar/[token]/VisorPdfInteractivo.tsx`.
- [ ] La política RLS de `inspeccion_qr_tokens` debe restringir SELECT/UPDATE a `authenticated` con UNION `user_empresas`. **NO conceder acceso a `anon`** — el endpoint público usa admin client server-side.
- [ ] El `UPDATE` de marca-como-usado debe filtrar por `used_at IS NULL AND revoked=false AND expires_at > now()` en el `WHERE` para garantizar atomicidad (evita race condition entre dos escaneos simultáneos).
- [ ] El token debe generarse con `crypto.randomBytes(24).toString('base64url')` en Node (no en cliente) para evitar predictibilidad.
- [ ] La URL del QR debe usar el dominio canónico `https://sistema.balleshosteleros.com` (no `window.location.origin`) porque el inspector puede estar en preview/demo; configurar vía `process.env.NEXT_PUBLIC_APP_URL` con fallback.
- [ ] El endpoint de regeneración debe exigir el `token` público original como header/body para evitar que un atacante con solo el `envio_id` regenere QRs (defensa en profundidad — el envío ya está cerrado, pero la regeneración debe pertenecer al mismo flujo).
- [ ] Cookie `bh_empresa_activa`: en `/inspecciones/verificar/[token]` hay que comprobar que el `local_id` del envío pertenece a una empresa accesible para el usuario (NO forzar `getAppContext().empresaId === envio.empresa_id`, porque el usuario puede tener la cookie en otra empresa; permitir si está en `user_empresas ∪ profiles.empresa_id`).
- [ ] El `AlertDialog` de "irreversible" debe usar el componente ya existente (`@/components/ui/alert-dialog`), no inventar uno nuevo.
- [ ] Multiempresa: un encargado con acceso a HABANA y BACANAL escanea correctamente el QR de cualquiera de las dos siempre que tenga un `empleados` con `local_id` correcto en esa empresa.
- [ ] Pantalla verde NO debe usar `target="_blank"` para el CTA "Ver en Mi Panel" — la regla `feedback_links_pestana_nueva.md` aplica a emails y links externos; aquí estamos ya dentro de la app del encargado.
- [ ] Working tree limpio antes de la migración DB (regla `feedback_filter_repo_force_destruye_wip.md`).

## Anti-Patrones

- NO sobrescribir el `estado` actual de `inspeccion_envios` con un nuevo valor "finalizado" — `estado` ya está usado para el ciclo de revisión interno (`pendiente_revision | revisado | archivado`). La verificación vive en columnas separadas (`verificado_at`, etc.).
- NO permitir editar respuestas tras "Enviar inspección" — el envío ya es inmutable, no hay que añadir nuevo concepto.
- NO mostrar el QR antes de confirmar el `AlertDialog` — la inserción del envío debe ocurrir solo tras la confirmación.
- NO duplicar lógica de auth-redirect; usar el parámetro `next=` que el login ya soporta.
- NO generar el QR en cliente con datos sensibles — el cliente solo recibe el `token` ya generado server-side y lo renderiza como SVG.
- NO bloquear el flujo de revisión interno si la inspección no está verificada — el badge es informativo, no impide marcar como revisado.
- NO integrar con el POS (módulo de tickets) en este PRP — el mensaje del descuento es informativo. Una integración real es scope futuro.
- NO añadir nuevos scopes OAuth ni tocar DNS (memorias `project_google_oauth_scopes.md` y `feedback_dns_siteground_no_tocar.md`).

---

*PRP pendiente aprobación. No se ha modificado código.*
