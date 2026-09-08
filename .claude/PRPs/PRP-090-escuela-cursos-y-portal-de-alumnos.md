# PRP-090: Escuela — cursos en PRODUCTO y portal de alumnos

> **Estado**: EN MARCHA — fases 1, 2, 5, 6, 7 y las CLASES hechas (08-09-2026). Pendiente: volcar el contenido real de GoHighLevel y repuntar el dominio.
> **Fecha**: 2026-09-07 (revisado el 08-09-2026)
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Convertir el submódulo **ESCUELA** de PRODUCTO (hoy una pantalla vacía) en el back-office donde BALLES monta sus cursos —módulos, lecciones y vídeos— reutilizando la maquinaria del portal de formación de RRHH, y abrir un **portal de alumnos con acceso propio** donde los clientes que contratan el software ven los vídeos y su progreso, con todo el contenido traído desde la escuela actual de GoHighLevel.

## Por Qué

| Problema | Solución |
|----------|----------|
| La escuela vive en GoHighLevel: se paga aparte, no se puede exportar y no habla con el software | Escuela dentro del propio software: mismo login de gestión, mismos vídeos en R2, cero herramienta externa |
| El cliente que contrata el software no sabe usarlo y se pierde en los primeros días | Cursos de producto (cómo gestionar con la herramienta) accesibles desde el primer día |
| El conocimiento hostelero de BALLES (mentalidad y gestión) no es un activo del producto, es contenido suelto en una plataforma ajena | El contenido pasa a ser parte del producto y una razón para quedarse |
| Ya existe un portal de formación completo (vídeo, cuestionarios, preguntas, likes, progreso) que solo se usa para empleados | Se reutiliza entero en vez de construir un segundo sistema de cursos |

**Valor de negocio**: se retira el coste y la dependencia de GoHighLevel para la escuela, baja el tiempo hasta que un cliente nuevo sabe usar el software, y el contenido formativo pasa a ser un argumento de venta con su propia URL pública.

## Qué

### Criterios de Éxito

- [ ] En PRODUCTO → ESCUELA se crea un curso con sus módulos y lecciones, se sube un vídeo y se publica, sin salir del software.
- [ ] Los cursos de la Escuela **no aparecen** en RRHH → Formación ni en Mi panel → Mi formación, y los cursos de puesto **no aparecen** en la Escuela.
- [ ] Todo el contenido de `laescuela.balleshosteleros.com` (cursos, módulos, lecciones, textos y vídeos) está dentro del software, con los vídeos servidos desde R2 y contabilizados en la cuota de BALLES.
- [ ] Un alumno entra en el portal público con su correo y un código, ve solo los cursos que tiene asignados y reproduce los vídeos.
- [ ] Al alumno se le marca la lección como vista y al volver ve su progreso (porcentaje del curso y última lección).
- [ ] El alta y la baja de un alumno se hacen desde el back-office; nadie se registra solo.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Back-office (BALLES, empresa matriz).** Dirección entra en PRODUCTO → ESCUELA y ve la rejilla de cursos de la escuela. Crea uno («Gestión hostelera integral»), le pone portada y descripción, añade módulos y dentro lecciones: sube el vídeo (va a R2, a la cuota de BALLES), escribe el texto, adjunta un PDF y, si quiere, monta el cuestionario. Publica el curso.

**Alumno.** Recibe el correo de bienvenida con el enlace del portal. Entra, escribe su correo, recibe un código de 6 cifras, lo introduce y queda dentro. Ve la rejilla de sus cursos con el porcentaje completado en cada uno. Abre uno: índice de módulos a un lado, reproductor al otro. Ve la lección, la marca como vista, puede dejar «me gusta» y preguntar. Al volver, el portal le lleva a donde lo dejó.

**Migración.** Un script abre la escuela de GHL con sesión iniciada, recorre cursos, módulos y lecciones, guarda textos y descarga los vídeos (que van en HLS y no se pueden copiar por el `src` del reproductor), y los deja en R2 y en las tablas del software.

---

## Contexto

### Referencias

Maquinaria de formación que se reutiliza tal cual:

- `supabase/migrations/20260610190000_formacion_cursos_skool_por_puesto.sql` — `formacion_cursos` / `formacion_secciones` / `formacion_lecciones` / `formacion_progreso` + bucket `formacion-docs`.
- `supabase/migrations/20260629160000_formacion_temas_preguntas_likes.sql` — texto libre, documento incrustado, `formacion_preguntas`, `formacion_likes`, `formacion_cuestionario_preguntas`, `formacion_cuestionario_intentos`.
- `src/features/formacion/actions/formacion-actions.ts` — CRUD de cursos, secciones y lecciones; `uploadFormacionDoc`; `dbToggleCompletada`.
- `src/features/formacion/actions/formacion-interaccion-actions.ts` — likes, preguntas y cuestionarios.
- `src/features/formacion/components/admin/CursoEditorSidebar.tsx`, `LeccionFormDialog.tsx`, `CursoFormDialog.tsx`, `FormacionGridAdmin.tsx` — el editor completo.
- `src/features/formacion/components/CursoVista.tsx` + `LeccionInteraccion.tsx` — el visor.
- `src/app/api/formacion/video/route.ts` — subida de vídeo a `empresa_<id>/formacion/` en R2, control de cuota y registro en `recordings` con `type='formacion'`.

Patrón de portal público sin cuenta:

- `src/features/formacion/services/formacion-publica.ts` + `src/app/formacion/[token]/page.tsx` + `FormacionPublicaVista.tsx` — lectura con service-role a partir de un token, documentos firmados.
- `src/lib/supabase/proxy.ts` — `PUBLIC_PREFIXES`. **El middleware real de Next 16 es `proxy.ts`, no `middleware.ts`.** Sin la entrada, la ruta rebota al login.
- `src/features/rrhh/services/firmas/` — código de un solo uso enviado por correo con ventana de caducidad; patrón a copiar para el acceso del alumno.

Migración desde GoHighLevel:

- `scripts/clonar-web.mjs` — ya resuelve lo difícil: navegación con Playwright, absolutización de rutas, y sobre todo la extracción del vídeo (`videojs.getAllPlayers()` → `player.tech(true).vhs.source_.src` → `master.m3u8` → `ffmpeg` eligiendo la mayor resolución + fotograma de portada).
- `.claude/PRPs/PRP-088-clonar-webs-y-embudos-desde-un-dominio.md`.

Encaje del módulo:

- `src/features/auth/lib/permisos.ts` — `MODULOS_SOLO_MATRIZ = ["PRODUCTO"]`; la Escuela solo existe en la empresa matriz.
- `supabase/migrations/20260908010000_empresa_matriz.sql` — BALLES es la matriz (`eb99bddd-9f49-4348-96ee-37f930c0d5d0`, slug `balles-hosteleros`).
- `src/features/layout/data/nav-routes.tsx` (`productoSubs`) y `src/features/ajustes/lib/reglas-submodulos-catalogo.ts` — ESCUELA ya está en el menú y en el catálogo como hueco.
- `src/features/producto/components/EscuelaView.tsx` — 35 líneas que dicen «todavía no tiene contenido»; es lo que se sustituye.

### Estado real de la base de datos (consultado 07-09-2026)

`formacion_cursos` = 55 filas (10 de BALLES), pero **`formacion_secciones` = 0 y `formacion_lecciones` = 0**: los cursos existen porque `syncCursosPorPuesto()` crea uno por puesto, pero no hay ni un solo contenido cargado. La maquinaria está entera y sin estrenar; la Escuela va a ser su primer contenido real.

### Arquitectura Propuesta (Feature-First)

**Contenido: cero tablas nuevas.** Los cursos de la Escuela son filas de `formacion_cursos` con `empresa_id` = BALLES, `puesto_id = null` y un **ámbito nuevo `'escuela'`**. Módulos, lecciones, likes, preguntas y cuestionarios cuelgan de ahí sin tocar nada. Se amplía el `CHECK` de `ambito` y se filtra por ámbito en las lecturas de RRHH y Mi panel, que hoy leerían los cursos de la escuela como si fueran de empleados.

**Alumnos: identidad propia, fuera de `auth.users`.** Un alumno no es un usuario del software: meterlo en `auth.users` rompería el modelo de acceso de empleados (`usuarios.email` como correo de acceso, login único multiempresa) y le dejaría una puerta abierta al panel. Se crea identidad propia con acceso por código al correo y sesión en cookie HttpOnly firmada. Por lo mismo, el progreso del alumno no cabe en `formacion_progreso` (su RLS es `user_id = auth.uid()`) y va en tabla propia.

```
src/features/producto/escuela/
├── components/          # Rejilla y editor del back-office (envuelven los de formacion/)
├── actions/             # CRUD de cursos de escuela, alumnos y matrículas
├── services/            # Lectura del portal (service-role), acceso por código, progreso
└── types/

src/features/escuela-publica/
├── components/          # Catálogo del alumno, visor, pantalla de acceso
└── services/

src/app/(main)/producto/escuela/        # back-office (ya existe la ruta)
src/app/escuela/                        # portal público: acceso, catálogo, /curso/[id]
src/app/api/escuela/                    # envío y verificación del código de acceso

scripts/importar-escuela-ghl.mjs        # migración desde GoHighLevel
```

**Dominio.** La landing `software.balleshosteleros.com` vive en **otro repo** (`balleshosteleros/Balles-Hosteleros-Web`): allí solo se añade el enlace. El portal se sirve desde este repo, en `sistema.balleshosteleros.com/escuela`. Si se quiere `escuela.balleshosteleros.com`, hay que añadir el host a `WEB_HOSTS_FIJOS` en `next.config.ts` **y** en `hostname-resolver.ts` (los dos, o la raíz sirve el panel del software).

### Modelo de Datos

```sql
-- 1) Ámbito nuevo para los cursos de la Escuela (contenido reutilizado).
ALTER TABLE public.formacion_cursos DROP CONSTRAINT IF EXISTS formacion_cursos_ambito_check;
ALTER TABLE public.formacion_cursos ADD CONSTRAINT formacion_cursos_ambito_check
  CHECK (ambito IN ('general','puesto','escuela'));

-- 2) El alumno de la Escuela. No es un usuario del software.
CREATE TABLE IF NOT EXISTS public.escuela_alumnos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  nombre       text NOT NULL DEFAULT '',
  telefono     text,
  -- Empresa cliente a la que pertenece, cuando ya es cliente del software.
  empresa_id   uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  estado       text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
  origen       text NOT NULL DEFAULT 'ALTA_MANUAL',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_escuela_alumnos_email
  ON public.escuela_alumnos (lower(email));

-- 3) Qué cursos ve cada alumno.
CREATE TABLE IF NOT EXISTS public.escuela_matriculas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id   uuid NOT NULL REFERENCES public.escuela_alumnos(id) ON DELETE CASCADE,
  curso_id    uuid NOT NULL REFERENCES public.formacion_cursos(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, curso_id)
);

-- 4) Progreso del alumno (el de empleados vive en formacion_progreso, atado a auth.uid()).
CREATE TABLE IF NOT EXISTS public.escuela_progreso (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id     uuid NOT NULL REFERENCES public.escuela_alumnos(id) ON DELETE CASCADE,
  curso_id      uuid NOT NULL REFERENCES public.formacion_cursos(id) ON DELETE CASCADE,
  leccion_id    uuid NOT NULL REFERENCES public.formacion_lecciones(id) ON DELETE CASCADE,
  completada_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, leccion_id)
);

-- 5) Acceso por código al correo. Se guarda el HASH, nunca el código.
CREATE TABLE IF NOT EXISTS public.escuela_accesos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id   uuid NOT NULL REFERENCES public.escuela_alumnos(id) ON DELETE CASCADE,
  codigo_hash text NOT NULL,
  expira_en   timestamptz NOT NULL,
  usado_at    timestamptz,
  intentos    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escuela_accesos_alumno ON public.escuela_accesos(alumno_id);

-- RLS: estas cuatro tablas SOLO se tocan desde el servidor (service-role).
-- Se habilita RLS y NO se crean políticas, igual que la tabla de tokens de la
-- gestoría: cualquier cliente con la clave pública queda fuera.
ALTER TABLE public.escuela_alumnos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escuela_matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escuela_progreso   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escuela_accesos    ENABLE ROW LEVEL SECURITY;
```

### Decisiones que hay que cerrar antes de empezar

1. ~~**Dirección del portal**~~ — **CERRADA (07-sep-2026, Iván): se mantiene `laescuela.balleshosteleros.com`**, la misma de hoy. El alumno no nota el cambio y los enlaces antiguos siguen valiendo.
   - Hoy ese subdominio apunta a GoHighLevel. Repuntarlo al software es **lo ÚLTIMO** de todo: mientras no esté migrado el contenido, cambiar el DNS deja la escuela caída.
   - Hay que añadir el host a `WEB_HOSTS_FIJOS` en `next.config.ts` **y** en `hostname-resolver.ts` (los dos, o la raíz sirve el panel del software), y darlo de alta en Vercel.
   - ⚠️ El DNS de SiteGround no se toca sin permiso expreso de Iván (ver `feedback_dns_siteground_no_tocar`). Este cambio lo hace él, o lo autoriza en el momento.
2. ~~**Quién es alumno**~~ — **CERRADA (07-sep-2026, Iván): SOLO quien tiene contratado el software.** La escuela va incluida en lo que pagan; no hay matrícula abierta ni alumnos de fuera. El alta la hace BALLES desde PRODUCTO → ESCUELA.
3. ~~**Cursos de pago**~~ — **CERRADA por consecuencia de la 2: NO hay cobro.** Ningún curso se vende suelto: todo va incluido con el software. Nada de pasarela ni de precios en el portal.
4. ~~**Cuestionarios y certificado**~~ — **CERRADA (07-sep-2026, Iván): SÍ, test al final del curso y CERTIFICADO al aprobarlo.**
   - El test se reutiliza tal cual: `formacion_cuestionario_preguntas` / `formacion_cuestionario_intentos`, corregido en servidor (`enviarIntentoCuestionario`). No hay que construirlo.
   - El **certificado es trabajo nuevo**: se emite con nombre del alumno, curso y fecha, y debe poder verificarse (código único). Va como fase propia al final, no bloquea el resto.
   - El back-office necesita ver quién ha aprobado cada curso.
5. ~~**Qué pasa con GoHighLevel**~~ — **CERRADA (07-sep-2026, Iván): se APAGA del todo.** Era lo último que quedaba allí.
   - Orden obligatorio y sin atajos: migrar → **verificar curso por curso y vídeo por vídeo** que está todo → repuntar `laescuela` al software → dar de baja la cuenta.
   - Nada de cerrar GHL antes de la verificación: los vídeos originales solo existen ahí, y una vez cerrada la cuenta no hay vuelta atrás.
   - ⚠️ **Al apagar GHL se caen DOS subdominios a la vez**, no solo la escuela. Hoy `balleshosteleros.com` tiene en SiteGround un único registro A → `162.159.140.166` (el Cloudflare de GHL, que NO es de Iván), y `www` no tiene ningún registro. Cerrar GHL deja la raíz sin nada: no vuelve sola a SiteGround.
   - **Decidido (07-sep-2026, Iván): la raíz pasará a servir la web alojada en SiteGround.** Hay que verla y confirmar que sigue valiendo antes del corte, y dar de alta el `www`, que hoy no existe.

6. **Portal de alumnos: se replica el de GHL a partir de capturas de Iván, y por dentro debe ser CONFIGURABLE** (no cableado): lo que hoy es fijo en el portal viejo aquí se ajusta desde el back-office.

---

**TODAS LAS DECISIONES ESTÁN CERRADAS.** El PRP queda listo para ejecutar (`/bucle-agentico`) en cuanto Iván lo apruebe.

---

## Cambios acordados el 08-09-2026 (Iván) — mandan sobre lo escrito arriba

1. **Los vídeos se quedan en YouTube y se INCRUSTAN.** No se descargan ni se suben a R2 «de momento, para no gastar memoria nuestra». Cae por completo el trabajo de `ffmpeg`/HLS de las fases 3 y 4: del portal viejo se copian los TEXTOS y la dirección del vídeo, nada más. `analizarVideo()` (`features/escuela/lib/video.ts`) traduce cualquiera de las cinco formas de YouTube —y Vimeo— a la de incrustar; un vídeo ya subido a R2 sigue reproduciéndose como antes.
2. **CLASES: apartado propio con calendario.** Es el «Eventos» de GoHighLevel, pero enseñando **una miniatura por clase** dentro del día, y al lado **las próximas en orden**. La miniatura se pinta con la IMAGEN DE MARCA (colores de Ajustes + isotipo) cuando la clase no trae una propia: ni se generan ficheros ni quedan huecos grises. Tabla nueva `escuela_clases` (fecha y hora de la EMPRESA, nunca UTC).
3. **Portal del alumno de SOLO LECTURA.** Clases, cursos y su ficha: mira, entra a la clase, ve el vídeo y marca la lección. Nada editable. Todo se monta desde PRODUCTO → ESCUELA.
4. **Ficha del alumno** con sus datos básicos, también sin poder editarlos.
5. **Entrada sin claves desde dentro del software** (`/api/escuela/entrar`): quien ya ha entrado en el software no vuelve a identificarse; se le reconoce por el correo de su usuario y, si aún no era alumno, se da de alta en ese momento.

### Lo que quedó hecho el 08-09-2026

- Migración `20260908120000_escuela_portal_alumnos.sql`: `escuela_clases`, `escuela_alumnos`, `escuela_matriculas`, `escuela_progreso`, `escuela_accesos` (esta última sin políticas: solo servidor).
- `features/escuela/` completo: tipos, `video.ts`, `sesion-alumno.ts` (cookie HttpOnly firmada, 30 días), `calendario.ts`, acciones de clases y alumnos, servicios del portal y del acceso por código.
- Portal en `/escuela` (clases, cursos, curso, perfil) + `/api/escuela/entrar`; `/escuela` y `/api/escuela` dados de alta en `PUBLIC_PREFIXES`.
- Back-office: `EscuelaView` con Clases | Cursos | Alumnos y `/producto/escuela/curso/[cursoId]` (mismo editor que la formación de plantilla).
- `CursoVista` aprende a incrustar YouTube/Vimeo: antes una dirección de YouTube salía en negro.
- Sembrado con lo visible en las capturas: las 11 clases de ago-sep 2026 y el curso «Máster en dirección y gestión hostelera» con el módulo «Bienvenida» y sus 3 lecciones (el texto de la primera, entero).

### Lo que falta

- **El contenido real de GoHighLevel**: la dirección de YouTube de cada lección y los textos del resto de módulos. Está detrás del login de la escuela vieja; hace falta acceso o un volcado.
- **El dominio** `laescuela.balleshosteleros.com`: es lo ÚLTIMO, cuando el contenido esté verificado (ver decisión 5).
- Fase 8 (test y certificado), que sigue sin empezar.

---

## Blueprint (Assembly Line)

### Fase 1: Ámbito «escuela» y aislamiento respecto a RRHH
**Objetivo**: los cursos de la Escuela existen en las tablas de formación sin contaminar el portal de empleados. Migración idempotente del `CHECK` y filtro por ámbito en todas las lecturas de RRHH y Mi panel.
**Validación**: crear un curso de ámbito `escuela` a mano en BD y comprobar que no aparece en `/rrhh/formacion` ni en `/mi-panel/formacion`, y que los cursos de puesto siguen apareciendo.

### Fase 2: Back-office de la Escuela en PRODUCTO
**Objetivo**: `EscuelaView` deja de ser un hueco y pasa a ser la rejilla de cursos con el editor completo (módulos, lecciones, vídeo a R2, documento, texto), reutilizando los componentes de `formacion/` en vez de duplicarlos.
**Validación**: crear un curso con dos módulos y tres lecciones, subir un vídeo y verlo reproducirse; el vídeo aparece en `recordings` con `type='formacion'` y `empresa_id` de BALLES.

### Fase 3: Inventario y descarga de la escuela de GoHighLevel
**Objetivo**: saber exactamente qué hay que traer antes de traerlo. Script que entra con sesión iniciada, recorre la escuela y deja en local el árbol de cursos/módulos/lecciones con sus textos y sus vídeos, con un recuento de horas y de GB.
**Validación**: el inventario cuadra con lo que se ve en `laescuela.balleshosteleros.com` y todos los vídeos descargados se abren y tienen imagen (no negro).

### Fase 4: Importación al software
**Objetivo**: el contenido descargado entra en R2 y en las tablas de formación como cursos de ámbito `escuela`, sin duplicados si el script se vuelve a lanzar.
**Validación**: el back-office muestra los cursos migrados con su estructura y sus vídeos; relanzar el script no crea nada nuevo.

### Fase 5: Acceso del alumno
**Objetivo**: identidad de alumno, envío de código al correo, verificación y sesión en cookie HttpOnly. Ruta pública dada de alta en `PUBLIC_PREFIXES`.
**Validación**: un alumno de prueba recibe el código, entra, y sin código no se ve nada; el código caduca y se agota tras varios intentos.

### Fase 6: Portal de alumnos
**Objetivo**: catálogo de sus cursos con porcentaje completado, visor de lección con vídeo y texto, marcar como vista, y vuelta a donde lo dejó.
**Validación**: recorrer un curso entero como alumno; el progreso persiste al cerrar y volver a entrar, y un alumno no ve los cursos que no tiene matriculados.

### Fase 7: Gestión de alumnos desde el back-office
**Objetivo**: alta, baja y matriculación de alumnos desde PRODUCTO → ESCUELA, con correo de bienvenida y enlace del portal.
**Validación**: dar de alta un alumno, matricularlo en un curso, ver que le llega el correo y que entra; darle de baja y comprobar que ya no entra.

### Fase 8: Test y certificado
**Objetivo**: cada curso puede llevar test final (se reutiliza el cuestionario ya construido, corregido en servidor) y al aprobarlo el alumno obtiene un certificado con su nombre, el curso y la fecha, verificable por un código único. El back-office ve quién ha aprobado cada curso.
**Validación**: suspender el test y no obtener certificado; aprobarlo y descargarlo; el código del certificado se puede comprobar y responde con los datos correctos.

### Fase 9: Validación Final
**Objetivo**: sistema funcionando de punta a punta.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: back-office crea curso, portal reproduce vídeo y guarda progreso
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

---

## Gotchas

- [ ] **El middleware real de Next 16 es `src/lib/supabase/proxy.ts`, no `middleware.ts`.** Sin añadir `/escuela` y `/api/escuela` a `PUBLIC_PREFIXES`, el portal rebota al login y el alumno ve la pantalla de acceso del software.
- [ ] **`formacion_progreso` está atado a `auth.uid()`** (RLS `user_id = auth.uid()`). El alumno no tiene sesión de Supabase: su progreso NO cabe ahí, va en `escuela_progreso` leída y escrita solo desde el servidor.
- [ ] **Los cursos de la Escuela contaminan RRHH si no se filtra por ámbito.** `getFormacionData()`, `FormacionGridAdmin` y `PortalFormacionView` leen todos los cursos de la empresa activa; con BALLES activa saldrían mezclados los de puesto y los de la escuela.
- [ ] **`syncCursosPorPuesto()` crea un curso por puesto** y es idempotente por `puesto_id`; los de la escuela llevan `puesto_id = null`, así que no chocan con el índice único, pero sí con las lecturas.
- [ ] **Los vídeos de R2 se sirven por URL pública** (`PUBLIC_URL/empresa_<id>/formacion/...`). Cerrar el portal con código NO protege el vídeo: quien tenga la dirección lo ve. Decidir si se acepta (es lo que ya pasa hoy con formación) o se sirven firmados.
- [ ] **El vídeo de GoHighLevel no se puede copiar del `src`**: es un `blob:` y sale negro. La dirección real se le pregunta al reproductor ya cargado (`videojs.getAllPlayers()` → `player.tech(true).vhs.source_.src`) y se baja con `ffmpeg` eligiendo la mayor resolución del `master.m3u8`. Está resuelto en `scripts/clonar-web.mjs`.
- [ ] **La escuela de GHL está detrás de login** (Client Portal de clientclub.net): el script necesita sesión iniciada (`storageState` de Playwright), no basta con abrir la URL.
- [ ] **Cuota de R2 por empresa: 500 GB.** Los vídeos de la escuela cuentan en la de BALLES. Hay que medir el volumen en la fase de inventario antes de subir nada.
- [ ] **La landing `software.balleshosteleros.com` vive en otro repo** (`balleshosteleros/Balles-Hosteleros-Web`). Desde aquí no se toca: el enlace al portal se añade allí.
- [ ] **Si se usa dominio propio**, el host debe estar en `WEB_HOSTS_FIJOS` en `next.config.ts` **y** en `hostname-resolver.ts`. Con uno solo, la raíz sirve el panel del software.
- [ ] **Correo saliente**: todo sale de `notificaciones@balleshosteleros.com` vía `sendEmail()`, con Reply-To no-reply. Nadie responde a un correo del software.
- [ ] **Bucket `formacion-docs` es privado**: los documentos se sirven con URL firmada, como hace `formacion-publica.ts`.

## Anti-Patrones

- NO crear tablas nuevas de cursos/módulos/lecciones: se reutilizan las de formación.
- NO meter a los alumnos en `auth.users` ni en `usuarios`: rompería el modelo de acceso de empleados.
- NO duplicar el editor de cursos: se envuelven los componentes de `src/features/formacion/`.
- NO dejar el submódulo Escuela visible en empresas cliente: PRODUCTO es solo de la matriz.
- NO ignorar errores de TypeScript ni omitir Zod en los inputs del portal público.
- NO dejar migraciones no idempotentes.

---

*PRP pendiente aprobación. No se ha modificado código.*
