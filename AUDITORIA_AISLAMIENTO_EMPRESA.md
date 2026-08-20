# Auditoría de aislamiento entre empresas

**Fecha:** 20-ago-2026 · **Origen:** Alejandro Mojica vio la plantilla de BACANAL con HABANA activa.

## Regla que hay que entender antes de leer nada

**La RLS NO aísla por empresa activa, y nunca lo hará.** Las políticas autorizan
`empresa_id IN (todas las empresas del usuario)` porque el modelo es multiempresa
a propósito. Un usuario con acceso a BACANAL y HABANA pasa la RLS en ambas.

> El aislamiento por empresa activa lo hace **solo el código**.
> Donde el código no filtre, no hay red debajo.

Los comentarios del tipo *"el alcance por empresa lo aplica la RLS"* que aparecen
en varios archivos son **falsos** bajo este modelo. Son el error de razonamiento
que originó todos los hallazgos de abajo.

Afectados hoy: **7 usuarios multiempresa**, **5 con ficha espejo** (Albero
Cieliczka, Alejandro Mojica, Iván Ballesteros, Javier Mora, Sofía Terrón).

---

## A. Fugas de datos entre empresas

### ✅ ARREGLADO — Pagos: plantilla de otra empresa
- `src/features/rrhh/actions/pagos-actions.ts` — `.or()` cuya 2ª rama (`user_id.in`)
  no filtraba por empresa. Ahora `.eq("empresa_id", empresaId)` estricto.
- `src/features/rrhh/components/pagos/PagosView.tsx` — la clave de caché era solo
  el periodo; al cambiar de empresa el efecto de carga veía caché y hacía `return`
  sin recargar. Ahora la clave lleva `empresaActual.id`.
- Verificado: la consulta corregida devuelve 11 empleados, todos de HABANA (antes
  se colaban 4 de BACANAL).

> **ESTADO 20-ago-2026: las 5 fugas están CORREGIDAS.** Typecheck 0 errores.
> Verificado contra la BD: fichas con espejo 10 → 5 (solo HABANA); credenciales
> 99 → 41 (solo HABANA). Lo de abajo se conserva como registro del fallo.

### ✅ CORREGIDA 1 — CRÍTICA · `getMiInformacionLaboral`
`src/features/rrhh/actions/empleados-actions.ts:1553`
```ts
.select(`*, departamentos(nombre), puestos_trabajo(nombre)`)
.eq("user_id", userId)      // ← empresaId se obtiene en :1549 y NO se usa
.maybeSingle();
```
Con ficha espejo devuelve una fila **no determinista** (orden físico de Postgres):
el empleado puede ver su contrato de la empresa equivocada, y distinto entre
recargas. `select("*")` arrastra DNI, dirección, IBAN, nº SS y contacto de
emergencia. Riesgo añadido: `.maybeSingle()` con >1 fila puede dar error en
PostgREST recientes.
**Arreglo:** añadir `.eq("empresa_id", empresaId)`.

### ✅ CORREGIDA 2 — CRÍTICA · Inspecciones cruzadas
`src/features/rrhh/actions/inspecciones-empleado-actions.ts:78-97`
Expande a los `empleado_id` de **todas** las empresas (`.eq("user_id", ...)`) y
el `.or()` no lleva ninguna rama con `empresa_id`. Es el mismo patrón que falló
en pagos. El comentario de la línea 63 delega en una RLS que no encontramos.
**Arreglo:** acotar los espejos a la empresa activa + `.eq("empresa_id", empresaId)`.

### ✅ CORREGIDA 3 — CRÍTICA · Cuestionarios de evaluación
`src/features/rrhh/actions/cuestionarios-empleado-actions.ts:40-58, 79-84`
`empleadoIdsEspejo()` recoge ids de todas las empresas y la consulta no filtra
empresa. Expone puntuaciones de desempeño, aprobado/no aprobado y notas de
reunión de la otra empresa. `getAppContext()` se desestructura sin usar
`empresaId` en las 3 funciones del archivo (:74, :145, :217).

### ✅ CORREGIDA 4 — ALTA · Documentos del empleado
`src/features/mi-panel/actions/mis-documentos-actions.ts:71-85`
Ni nóminas (`rrhh_pagos_nominas`) ni `documentos_empleado` filtran empresa; el
archivo no usa `getAppContext()`. Mezcla documentos legales de **dos empleadores**
en la misma carpeta, sin distintivo: dos nóminas del mismo mes salen como
`Nómina {mes}` duplicado e indistinguible.
**Atenuante medido:** hoy hay **0 nóminas con PDF adjunto**, así que no se
manifiesta todavía. Se activará con el primer volcado de la gestoría.
**Matiz:** son datos del propio usuario, no fuga entre personas.

### ✅ CORREGIDA 5 — LATENTE (no activa) · Credenciales de accesos
`src/features/rrhh/actions/accesos-apps-actions.ts:460`
```ts
let q = admin.from("accesos_apps").select("*");   // cliente admin: se salta RLS
if (empresaSlug) q = q.eq("empresa_slug", empresaSlug);   // filtro OPCIONAL
```
Ya ocurrió antes (lo documenta el comentario de :455) y el arreglo dejó el
parámetro opcional en vez de derivarlo de `getAppContext()`. Cualquier llamada
que lo omita lista credenciales de todas las empresas. `recortarSegunCredenciales`
(:413) no cierra el hueco: recorta por RLS multiempresa, no por empresa activa.
**Arreglo:** sin argumento usa la empresa activa; el alcance multiempresa se pide
explícito con `TODAS_LAS_EMPRESAS`.

**CORRECCIÓN (20-ago-2026):** llegué a decir que la fuga estaba ACTIVA porque
`AccesosAdminTab` llamaba sin argumento. **Falso: ese componente no lo importa
nadie — es código muerto.** La pantalla viva es `AccesosTab`, que ya pasaba
`empresaActual.id` correctamente. La fuga era LATENTE (en la firma de la
función), como decía la auditoría original. El arreglo se conserva porque hace
la función segura por defecto, pero no había ningún agujero abierto.

**Además:** el guard `userTieneRolAdminODirector` tiene un nombre engañoso — no
mira DIRECCIÓN, comprueba `puedeVerHerramienta(permisos, "HERR_ACCESOS")`, o sea
lo configurado en Roles. No hay nada atado al rol de dirección
(ver [[feedback_permisos_iguales_en_todas_las_empresas]] y el propio comentario
del código: "Sin excepción para dirección: manda el permiso").

**Pendiente menor:** `AccesosAdminTab.tsx` es código muerto; valorar si se borra.

### Falsos positivos (NO tocar)
- `empleados-actions.ts:74,306`, `targeting.ts:63`, `llamadas-actions.ts:303` — el
  `.or(empresa_id.eq.X, user_id.in.(...))` es correcto **aquí**: `userIdsConAcceso`
  ya se deriva de `usuario_empresas WHERE empresa_id = empresaId`, más dedup por
  `es_principal`. Es la versión bien hecha del patrón que falló en pagos.
- `.or()` sobre `vigente_hasta` (horarios, vacaciones) — rangos de fechas, no identidad.
- `validadores-actions.ts:326`, `promocion-actions.ts:224` — llevan `.eq("empresa_id")`
  antes del `.or()`, que compone con AND.
- `src/app/api/cron/**` — legítimamente globales, iteran todas las empresas por diseño.

### Cachés en cliente (patrón B): limpio
Revisados todos los `Record`/`Map` con clave de agrupación. `PagosView` era el
único `if (cache[clave]) return;` del repo y ya está arreglado. Las claves de
localStorage sensibles ya llevan discriminante de empresa o usuario.

---

## B. Permisos al cambiar de empresa

**Hallazgo de fondo: los permisos no son por empresa.** El selector solo escribe
la cookie `bh_empresa_activa`, y la capa de permisos **nunca la lee**.

- `src/features/auth/actions/permisos-actions.ts:60-79` — `getRolContext` resuelve
  el rol con `.eq("user_id", userId)`, sin empresa activa.
- `usuarios.rol_id` es **uno solo**; `usuario_empresas` **no tiene** columna de rol.

Consecuencia: **no se puede configurar que alguien vea unas cosas en una empresa
y otras en la otra.** Es imposible con el modelo de datos actual. Hoy cada uno
entra en ambas empresas con el mismo rol:

| Usuario | Rol único | Rol es de | Entra en |
|---|---|---|---|
| Alejandro Mojica | GERENCIA | HABANA | BACANAL + HABANA |
| Javier Mora | CONTABILIDAD | BACANAL | BACANAL + HABANA |
| Sofía Terrón | CALIDAD | BACANAL | BACANAL + HABANA |
| Albero Cieliczka | MANTENIMIENTO | BACANAL | BACANAL + HABANA |
| Fernando / Iván / Agora Demo | DIRECCIÓN | — | ambas (bypass total) |

Los roles duplicados por empresa existen en `empresa_roles` y **tienen hoy los
mismos permisos** en ambas (GERENCIA 7 y 7, RRHH 4 y 4, DIRECCIÓN 15 y 15): son
copias del mismo seed.

### Barreras y cuál falla
| # | Barrera | Estado |
|---|---|---|
| 1 | Sidebar oculta módulos | Funciona, pero cosmético (no bloquea URLs) |
| 2 | `resolveDestinoCambioEmpresa` (`nav-routes.tsx:413`) | **Falla** — evalúa permisos ANTES del cambio y no ligados a la empresa destino |
| 3 | Gate en páginas/layouts de módulo | **No existe** (de 134 `page.tsx`, ninguna) |
| 4 | Gate en `proxy.ts:173` | **Falla** — cubre `/rrhh`, `/sala`, etc., pero valida contra `usuarios.empresa_id`, no contra la cookie |
| 5 | Autorización por server action | No auditado |

La decisiva es la **#4**: es la única autoritativa en servidor, y mide la empresa
equivocada. Pregunta *"¿tiene el módulo en su rol?"*, nunca *"¿en esta empresa?"*.

⚠️ `proxy.ts:121` — sin `SUPABASE_SERVICE_ROLE_KEY` el gate hace **fail-open**.

### DECISIÓN DEL NEGOCIO (20-ago-2026): no se implementa la expulsión

Iván lo cierra explícitamente:

> "No le puede echar, porque no hay nadie ni habrá nadie que no tenga acceso a
> ambos módulos y sí a ambas empresas. Siempre que cambias de empresa es porque
> tienes acceso a esa pantalla en la otra empresa, por lo que no afecta."

Es coherente con los datos: los 7 usuarios multiempresa entran en ambas con el
mismo rol, y los roles homónimos tienen permisos idénticos (copias del seed).

**Consecuencias:**
- ❌ NO se implementa expulsar del módulo al cambiar de empresa.
- ❌ NO se cambia el modelo de roles (rol por empresa). Resolvería un problema
  que el negocio decide no tener.
- ⚠️ Si algún día se quiere dar permisos DISTINTOS por empresa, hay que retomar
  esto ANTES: hoy el sistema no puede expresarlo, y el gate del proxy valida
  contra `usuarios.empresa_id`, no contra la empresa activa.

**Importante — esto NO invalida las 5 fugas corregidas.** No dependían de los
permisos: Alejandro TENÍA acceso a pagos en ambas empresas (la regla de arriba
se cumplía) y aun así vio la plantilla de BACANAL con HABANA activa. El fallo era
que la pantalla no filtraba por empresa, no que le faltara permiso.

## Qué queda pendiente

1. **`proxy.ts:121` — fail-open**: sin `SUPABASE_SERVICE_ROLE_KEY` el gate deja
   pasar todo. Es lo único de la parte B que sigue mereciendo arreglo, y es
   independiente de la decisión sobre roles.
2. Barrera #5 (autorización dentro de cada server action): sin auditar.
3. (Descartado por decisión de negocio: modelo de rol por empresa y expulsión.)

## Hallazgos extra durante la corrección

- **`getDocumentoEmpleadoUrl`** (`mis-documentos-actions.ts:133`) no salió en la
  auditoría inicial y era igual de grave: con el id de un documento de la otra
  empresa firmaba una URL de descarga del PDF. Corregido.
- **`accesos_apps.empresa_slug` guarda el SLUG** ("habana"), no el UUID. El
  arreglo traduce id → slug vía `empresas.slug`; usar el UUID habría dejado la
  pantalla vacía en silencio.
- **`AccesosAdminTab` sí llamaba sin argumento**: la fuga de credenciales estaba
  ACTIVA, no latente. Ahora esa vista global pide el alcance con el centinela
  `TODAS_LAS_EMPRESAS` (`src/features/accesos/lib/alcance.ts`), que vive fuera
  del archivo de actions porque `"use server"` solo exporta funciones async.

## Aparte, no relacionado con esto
- Fila duplicada: "Alejandro Mójica " (con tilde y espacio final), sin empresa ni
  rol, además de "Alejandro Mojica". Revisar si es basura de un alta antigua.
- Error de TypeScript preexistente que rompe el build:
  `src/features/notificaciones/actions/notificaciones-actions.ts:223` (falta `accion_url`).
