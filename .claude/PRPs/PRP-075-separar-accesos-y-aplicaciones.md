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

Ivan exige dos puertas: **(A)** solo entra al módulo quien tenga un rol con
permiso de accesos, y **(B)** dentro, cada usuario ve únicamente los accesos
cuyos roles le incluyen. Auditado en el código actual:

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

*Validación con usuarios reales, uno por rol:*
1. Rol **sin** permiso de accesos → 0 filas, incluso llamando a la API a mano.
2. Rol **con** permiso → ve solo sus credenciales, y **no recibe el usuario/login**
   de las demás (comprobar la respuesta de red, no solo la pantalla).
3. Credencial sin roles marcados → solo dirección.
4. Dirección → lo ve todo.

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
3. ¿La escritura de credenciales queda **solo** en dirección, o algún rol más
   (p. ej. gerencia) debe poder crear/editar?
4. ¿Un usuario con permiso de accesos debe **ver que existe** una credencial que
   no puede revelar (en gris, sin login), o no debe aparecerle en absoluto?
   Recomendación: que no aparezca — menos información filtrada.
