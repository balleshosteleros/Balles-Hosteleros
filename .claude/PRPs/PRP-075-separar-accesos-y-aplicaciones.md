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

**Fase 3 — RLS estricta**
Aplicar las políticas del punto 4 + `FORCE ROW LEVEL SECURITY`.
*Validación:* un usuario sin rol autorizado NO ve la fila; dirección sí.

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

1. ¿Apruebas el modelo de dos tablas del punto 3?
2. ¿Ejecutamos las fases 0–3 (seguridad) primero y dejamos 4–6 para después?
3. ¿La escritura de credenciales queda **solo** en dirección, o algún rol más
   (p. ej. gerencia) debe poder crear/editar?
