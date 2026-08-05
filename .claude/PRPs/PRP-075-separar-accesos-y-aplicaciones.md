# PRP-075 — Separar Aplicaciones (enlaces) y Accesos (contraseñas) en dos almacenes

**Estado:** propuesto — pendiente de aprobación de Ivan. NO ejecutado.
**Fecha:** 2026-08-05
**Origen:** Ivan detecta que enlaces y contraseñas comparten tabla y exige que los
secretos vivan aparte y con más seguridad ("las app y los accesos son tablas
diferentes, la de acceso tiene mucha más seguridad o debe tenerla").

---

## 1. Situación actual (verificada en producción)

Hoy **existe una sola tabla**: `public.accesos_apps`. Cada fila mezcla el enlace
y sus secretos:

| Parte | Columnas |
|---|---|
| Enlace (no sensible) | `nombre`, `url`, `logo_url`, `categoria`, `departamentos`, `estado`… |
| Secretos (sensible) | `accesos` (jsonb: usuario, contraseña cifrada, `datos_extra`), `usuario`, `contrasena` |

**Volumen real:** 99 aplicaciones · 145 credenciales · 54 datos extra (PIN/PUK) · 2 empresas.

### Lo que YA está bien
- Las contraseñas están **cifradas con AES-256-GCM** (formato `iv:tag:cifrado`).
  Verificado: en BD se ve `bku/7H3rAU3UrJc+:RO8vdd9…`, nunca texto plano.
- La clave `CREDENCIALES_ENCRYPTION_KEY` vive **fuera de la BD** (env del servidor).
  Un volcado de la tabla no revela ninguna contraseña.
- El descifrado ocurre solo en servidor (`revelarAccesoApp`), con verificación de
  identidad y filtrado por rol.

### El problema real (esto es lo que hay que arreglar)
1. **RLS demasiado permisiva.** `accesos_apps_tenant_read` deja leer las filas a
   *cualquier* usuario autenticado de la empresa. El enlace y el secreto tienen
   idéntico nivel de protección.
2. **Escritura sin distinción de rol.** `accesos_apps_tenant_write` es `FOR ALL`
   para cualquier empleado de la empresa: un usuario raso podría alterar o borrar
   credenciales. Es el riesgo más grave.
3. **Sin trazabilidad.** No hay registro de quién revela cada secreto.
4. **Radio de impacto.** Un fallo de permisos en la vista de enlaces expone la
   misma fila donde viven los secretos.

---

## 1-bis. Auditoría del doble filtro por rol (pedido por Ivan)

### Regla, en palabras de Ivan (2026-08-05)

> "Si un rol de gerencia puede ver accesos, le deja verlos, pero luego hay un
> segundo escudo: de los accesos que hay creados solo podrá ver los que le
> permita el rol de gerencia. Si no está puesto ese rol dentro del acceso, **no
> le saldrá en el listado de accesos**."

Los dos escudos son **independientes y acumulativos**:

| Escudo | Pregunta | Si falla |
|---|---|---|
| **1 — Entrar** | ¿Su rol tiene permiso de accesos? | No entra al módulo |
| **2 — Listar** | ¿Su rol está marcado *dentro de ese acceso*? | **Ese acceso NO aparece en el listado** |

Consecuencias de diseño (decididas, no abiertas):
- El escudo 1 **no** concede nada por sí solo: da entrada al módulo, no a los
  accesos. Gerencia con permiso pero sin estar marcada en ningún acceso ve el
  listado **vacío**.
- Un acceso que no le corresponde **no se muestra de ninguna forma**: ni en gris,
  ni bloqueado, ni con el usuario tapado. No existe para él.
- Por tanto el servidor **no debe enviar** esas filas al navegador (hoy sí las
  envía; ver Hueco 2).
- `roles` vacío en un acceso = solo dirección (*fail-closed*, ya correcto).

### Cómo queda con los datos reales (verificado en producción)

Las **145 credenciales ya tienen roles marcados** — ninguna quedaría huérfana ni
pasaría a "solo dirección" por descuido. Reparto actual:

| Rol | Credenciales que verá |
|---|---|
| DIRECCIÓN | 107 (además, bypass total) |
| CONTABILIDAD | 22 |
| **GERENCIA** | **16** |
| MARKETING | 15 |
| LOGÍSTICA | 10 |
| CALIDAD | 9 |
| RECURSOS HUMANOS | 4 |
| GESTORÍA | 2 |
| JURÍDICO | 2 |

Es decir, el ejemplo de Ivan se cumple: gerencia entra al módulo y ve **16 de
145**; las otras 129 no le aparecen en el listado.

⚠️ **Riesgo detectado:** cuatro roles llevan tilde (`LOGÍSTICA`, `GESTORÍA`,
`JURÍDICO`, `DIRECCIÓN`). La comparación actual hace `trim` + `lowercase` pero
**no quita acentos**, así que un desajuste de tilde dejaría a ese rol sin ver
nada. De ahí la normalización del punto 4 del cierre — no es teórica.

### El selector de roles dentro de cada acceso (UI) — ya existe y es correcto

En el modal de una credencial hay un desplegable "¿Quién puede ver esta
contraseña?" que ya cumple lo pedido:

- Lista **todos** los roles de la empresa (`getRolesEmpresaNombres` lee
  `empresa_roles` sin filtrar, `roles-actions.ts`).
- Permite marcar **de 0 a todos**, con "Seleccionar todos" y "Limpiar".
- 0 roles marcados = solo dirección (*fail-closed*).

**No requiere cambios de UI.** Lo que falla no es el selector, sino que el
servidor no respeta lo marcado al listar (Hueco 2).

### Estado de los candados por rol (verificado en producción)

`empresa_roles` tiene **13 roles por empresa**: ARTISTAS, CALIDAD, COCINA,
CONTABILIDAD, DIRECCIÓN, GERENCIA, GESTORÍA, JURÍDICO, LOGÍSTICA, MANTENIMIENTO,
MARKETING, RECURSOS HUMANOS, SALA.

⚠️ **Hoy solo DIRECCIÓN tiene `HERR_ACCESOS` activado.** Los otros 12 lo tienen
en `false`.

Consecuencia práctica: aunque un acceso tenga marcada GERENCIA (16 los tienen),
gerencia **no vería nada** porque le falta el escudo 1. Los datos ya están
preparados para el modelo de dos escudos; simplemente el candado no se ha
concedido todavía a ningún rol salvo dirección.

No es un fallo: es una decisión de configuración que Ivan toma en
Ajustes → Roles, activando el candado a los roles que correspondan.

#### ✅ APLICADO (2026-08-05): candado concedido a GERENCIA

Ivan lo autoriza expresamente. Aplicado a los **dos** roles GERENCIA (uno por
empresa: BACANAL `dd35ea33…`, HABANA `0a31c861…`):

```json
{ "modulo": "HERR_ACCESOS", "ver": true, "editar": false }
```

`editar: false` a propósito: quien puede editar un acceso podría marcarse a sí
mismo entre los roles autorizados y saltarse el escudo 2. Gerencia consulta,
dirección administra. Si Ivan decide luego que gerencia también cree/edite, es
cambiar ese flag (punto 4 de decisiones).

**Efecto real (escudo 1 + escudo 2 combinados):**

| Empresa | Credenciales totales | Las que verá gerencia |
|---|---|---|
| BACANAL | 77 | **9** |
| HABANA | 68 | **7** |

Las demás no le aparecen en el listado. Nada más se ha modificado: solo se ha
añadido esa entrada de permiso a dos filas de `empresa_roles`.

⚠️ Recordatorio: hasta que se cierre el Hueco 2 (Fase 3), ese filtrado sigue
siendo **de pantalla**. El navegador de gerencia aún recibe metadatos de las
credenciales que no le tocan. Por eso la Fase 3 no es opcional.

### Estructura de un acceso (confirmada por Ivan) y verificación del bloqueo

Dentro de **una aplicación** (p. ej. BBVA) se pueden crear **varios accesos**
independientes; cada uno con su etiqueta, usuario, contraseña, sus **datos extra**
(clave, PIN, API KEY…) y **su propia lista de roles**.

Verificado en el código:
- Hasta **50 accesos por aplicación** (`MAX_ACCESOS_POR_APP = 50`).
- **Datos extra sin límite** por acceso. Caso real ya en producción: Adyen tiene
  5 (Username, API KEY, API CLIENT, ID Merchant, ID Store). El límite de "5" que
  mencionaba Ivan no existe como tope técnico: caben más.
- Los roles se marcan **por acceso**, no por aplicación. Correcto: en un mismo
  BBVA, un acceso puede verlo contabilidad y otro solo dirección.

### ¿Un rol SIN marcar puede ver ese acceso? — comprobación con datos reales

Pregunta de Ivan: si no marca a gerencia (o a **cualquier rol**) en un acceso,
¿puede verlo aunque tenga el candado?

**La contraseña: NO. Bloqueo verificado en servidor.**
`accesos-apps-actions.ts:538-544` — antes de descifrar nada:

```ts
if (!esDirector) {
  const roles = (acc.roles ?? []).map((r) => r.trim().toLowerCase());
  const mio = (rolNombre ?? "").trim().toLowerCase();
  if (roles.length === 0 || !roles.includes(mio)) return { ok: false, error: "No autorizado" };
}
```

El rol se lee de la BD con la sesión del usuario (`getRolContext`), no de lo que
mande el navegador. Contraste real sobre las 145 credenciales:

| ¿Gerencia marcada? | Credenciales | Resultado al intentar revelar |
|---|---|---|
| Sí | 16 | Puede revelar |
| **No** | **129** | **"No autorizado" — bloqueado en servidor** |

Y esto **no depende del candado**: tener `HERR_ACCESOS` permite entrar al módulo,
pero no salta este check. Vale igual para gerencia y para cualquier otro rol.

**Los metadatos: SÍ llegan al navegador (Hueco 2).**
`rowToApp` (L97-135) borra la contraseña (`PWD_OCULTA`) y el valor de los datos
extra antes de salir, pero **conserva `usuario` y los nombres de los datos
extra**, y `listAccesosApps` no filtra por `roles`. Así que de esas 129, el
navegador de gerencia recibe el login y la existencia de la credencial, aunque
la pantalla no se los muestre.

**Conclusión:** las contraseñas están seguras hoy; lo que se filtra son
metadatos. La Fase 3 convierte el ocultado de pantalla en un filtrado real en
servidor + RLS.

### Estado del código actual frente a esa regla

| Control | Veredicto | Dónde |
|---|---|---|
| A · Permiso `HERR_ACCESOS` para entrar | **FLOJO — solo cliente** | `app-layout.tsx:318` |
| B · Filtrado por `acc.roles` en pantalla | Correcto, *fail-closed* | `AccesosDrawers.tsx:460-464` |
| B · Filtrado por `acc.roles` en servidor | **AUSENTE** | `accesos-apps-actions.ts:298-327` |
| Revelar contraseña revalida rol | **CORRECTO** | `accesos-apps-actions.ts:536-544` |
| Verificación de identidad exigida en servidor | **AUSENTE** | solo cliente, `AccesosDrawers.tsx:121` |
| Bypass dirección | Correcto e intencional | 4 puntos, vía `es_admin_plataforma` |

### Hueco 1 — `HERR_ACCESOS` no existe en el servidor
`grep -rn "HERR_ACCESOS" src/` → 6 coincidencias, **ninguna en una server action**.
El permiso solo oculta el candado en el navegador. Quitarle el permiso a un rol
**no le impide** invocar `listAccesosApps` directamente. La puerta A es cosmética.

### Hueco 2 — el servidor no filtra por `acc.roles`
`listAccesosApps` filtra por empresa y por **departamento de la app**, pero nunca
mira los `roles` de cada acceso. Consecuencia: el navegador recibe **etiqueta,
usuario/login y la existencia** de credenciales que ese rol no debería ver.

**Matiz importante:** la contraseña **no** se filtra. `rowToApp` la sustituye por
`PWD_OCULTA` antes de salir del servidor, y `revelarAccesoApp` revalida el rol
contra la BD antes de descifrar. Lo que se escapa son metadatos, no secretos.

### Hueco 3 — la verificación de identidad no se exige en servidor
`ensureVerificado()` es un diálogo de cliente. `revelarAccesoApp` no pide prueba
de verificación reciente, así que un cliente manipulado puede saltarse el diálogo
(aunque seguiría topando con el check de rol).

### Cierre propuesto (entra en el alcance de este PRP)
1. `listAccesosApps` filtra por `roles` **en servidor** y no devuelve ni el
   usuario de los accesos que no correspondan.
2. Comprobar `HERR_ACCESOS` **en servidor** al inicio de `listAccesosApps`,
   `revelarAccesoApp` y `verificarIdentidadAccesos`.
3. Exigir en servidor una verificación de identidad reciente (token con caducidad).
4. Normalizar roles quitando acentos al comparar ("Gestoría" vs "Gestoria"),
   igual que hace `normalizarModulo`.
5. Mantener `roles` vacío = solo dirección (*fail-closed* ya correcto).

---

## 2. Objetivo

Dos almacenes con **niveles de seguridad distintos**:

- `aplicaciones` → enlaces. Poco sensible, legible por la empresa.
- `credenciales` → secretos. Muy restringida: lectura solo por rol autorizado,
  escritura solo dirección, y cada revelado queda auditado.

---

## 3. Modelo propuesto

```
aplicaciones                       credenciales
------------                       ------------
id            uuid pk              id             uuid pk
empresa_id    uuid                 aplicacion_id  uuid fk → aplicaciones(id)
nombre        text                 empresa_id     uuid
url           text                 etiqueta       text
logo_url      text                 usuario        text
categoria     text                 secreto        text   -- AES-256-GCM
departamentos text[]               datos_extra    jsonb  -- PIN/PUK, cifrados
estado        text                 roles          text[] -- quién puede revelar
                                   creado_por     uuid
credencial_revelados (auditoría)
--------------------
id, credencial_id, user_id, revelado_en, ip, campo
```

Notas de diseño:
- `credenciales.aplicacion_id` es **NULLABLE**: los 51 secretos sin enlace (caja
  fuerte, PIN de TPV, wifi, SIM) no cuelgan de ninguna app. Es su sitio natural.
- El valor cifrado **se copia tal cual**, sin descifrar/recifrar: mismo formato,
  misma clave. Evita cualquier riesgo de corromper secretos.

---

## 4. Seguridad (el núcleo del PRP)

### `aplicaciones` (enlaces)
- SELECT: cualquier usuario autenticado de la empresa.
- INSERT/UPDATE/DELETE: solo rol con permiso de gestión.

### `credenciales` (secretos) — RLS estricta

Las **dos puertas de Ivan**, ambas en servidor (no solo en pantalla):

**Puerta A — entrar al módulo.** El rol debe tener el permiso de accesos
(`HERR_ACCESOS`) en `empresa_roles.permisos`. Se comprueba al inicio de cada
server action, no solo ocultando el candado. Sin permiso: cero filas.

**Puerta B — qué credenciales ve.** Ya dentro, solo las filas cuyo `roles`
contiene su rol. Cada credencial declara al crearse quién puede verla; si no se
marca ningún rol, solo dirección. La RLS lo aplica en la propia base de datos:

```sql
create policy credenciales_lectura_por_rol on credenciales
for select to authenticated
using (
  empresa_id in (select empresa_id from usuario_empresas where user_id = auth.uid())
  and (
    es_director(auth.uid())                        -- bypass dirección
    or (
      rol_tiene_permiso(auth.uid(), 'HERR_ACCESOS') -- puerta A
      and rol_del_usuario(auth.uid()) = any(roles)  -- puerta B
    )
  )
);
```

Así, aunque alguien llamase a la API saltándose la interfaz, la base de datos
**no le devuelve la fila**. Hoy eso no ocurre: el filtro vive en el navegador.

- SELECT: solo si `roles` incluye el rol del usuario **o** es dirección.
  Nunca "todos los de la empresa".
- INSERT/UPDATE/DELETE: **solo dirección**. Se acaba el `FOR ALL` abierto.
- `FORCE ROW LEVEL SECURITY` activado (hoy está en `false`), para que ni el
  propietario de la tabla se salte las políticas.
- El descifrado sigue siendo exclusivo del servidor. El cliente jamás recibe
  `secreto`; solo el resultado puntual de `revelarAcceso`.
- Cada revelado escribe en `credencial_revelados`.

**Defensa en profundidad:** aunque la RLS fallara, el atacante obtiene texto
cifrado inútil sin la clave del servidor.

---

## 5. Plan de ejecución por fases

Cada fase es reversible y se valida antes de pasar a la siguiente.

**Fase 0 — Copia de seguridad**
`create table accesos_apps_backup_20260805 as select * from accesos_apps;`
Sin esto no se empieza.

**Fase 1 — Crear tablas nuevas (vacías)**
Migración idempotente. No toca `accesos_apps`. Riesgo nulo.

**Fase 2 — Copiar datos (no mover)**
Volcar 99 enlaces → `aplicaciones`; 145 credenciales + 54 datos extra →
`credenciales`. `accesos_apps` queda intacta como red de seguridad.

*Validación obligatoria:* recuentos 99 / 145 / 54 exactos, y prueba de que una
credencial migrada **se descifra correctamente** antes de continuar.

**Fase 3 — RLS estricta + doble filtro en servidor**
Aplicar las políticas del punto 4 + `FORCE ROW LEVEL SECURITY`, y cerrar los tres
huecos del punto 1-bis: `HERR_ACCESOS` comprobado en servidor, `listAccesosApps`
filtrando por `roles`, y normalización de acentos al comparar roles.

*Validación con usuarios reales, uno por rol. Se comprueba la **respuesta de red**,
no solo lo que se ve en pantalla:*
1. Escudo 1 · Rol **sin** permiso de accesos → no entra; 0 filas incluso llamando
   a la API a mano.
2. Escudo 2 · **Gerencia** con permiso → recibe exactamente **16 filas** (dato
   real de producción). Las otras 129 **no viajan** al navegador: ni etiqueta,
   ni usuario, ni el hecho de que existan.
3. Gerencia con permiso pero marcada en **ninguno** → listado **vacío**. El
   permiso no concede nada por sí solo.
4. Credencial sin roles marcados → solo dirección.
5. Dirección → lo ve todo (bypass intencional).
6. Roles con tilde (`LOGÍSTICA`, `GESTORÍA`, `JURÍDICO`) → ven sus credenciales.
   Probar explícitamente: es donde fallaría la comparación sin normalizar.

**Fase 4 — Apuntar la app a las tablas nuevas**
`AplicacionesTab` → `aplicaciones`. `AccesosTab` y el candado → `credenciales`.
Mismo comportamiento visible; cambia solo el origen de datos.

**Fase 5 — Auditoría de revelados**
Registrar cada revelado y mostrar el histórico a dirección.

**Fase 6 — Retirada (solo tras días de uso estable)**
Renombrar `accesos_apps` a `accesos_apps_obsoleta`. **No se borra.**
El borrado definitivo es decisión expresa tuya, más adelante.

---

## 6. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Perder contraseñas al migrar | Copia previa + copiar sin descifrar + validar descifrado en Fase 2 antes de seguir |
| Cerrar el acceso a quien lo necesita | Fase 3 se prueba con usuario real de cada rol antes de dar por buena |
| Quedarse a medias entre dos modelos | `accesos_apps` intacta hasta Fase 6; revertir = apuntar el código a la tabla vieja |
| Migración a medias por error | Cada fase en su migración idempotente, con recuentos de control |

**Reversión:** hasta Fase 5 basta con devolver el código a `accesos_apps`, que
sigue completa y funcionando.

---

## 7. Qué NO entra aquí

- No se borra ninguna credencial.
- No se cambia el algoritmo de cifrado ni la clave.
- No se toca el diseño visual: Aplicaciones y Accesos se ven igual.

---

## 8. Decisión pendiente de Ivan

1. **Modelo de dos tablas** (punto 3): aprobado por Ivan (2026-08-05).
2. **Doble filtro por rol** (punto 1-bis): aprobado por Ivan. Entra en Fase 3.
3. **Credencial no autorizada = invisible**: resuelto por Ivan (2026-08-05). No
   aparece en el listado; el servidor no la envía. Ver punto 1-bis.
4. **PENDIENTE — único punto abierto:** la creación y edición de credenciales,
   ¿queda **solo** en dirección, o algún rol más (p. ej. gerencia) debe poder
   crear/editar? Ojo: quien pueda editar un acceso puede marcarse a sí mismo
   entre los roles autorizados, así que este permiso equivale de facto a poder
   verlo todo. Recomendación: solo dirección.
