# Incidente: un usuario se quedó sin rol y el menú apareció vacío

**Fecha:** 04-09-2026 · **Gravedad:** seguridad (pérdida silenciosa de acceso) · **Estado:** resuelto y blindado

## Qué se vio

La cuenta de dirección de HABANA (`direccion.grupohabana@gmail.com`, Iván) entró en el
software y el menú lateral mostraba el título "MIS DEPARTAMENTOS" sin ninguna entrada
debajo. Ningún error, ningún aviso: simplemente no había nada.

## Causa raíz

No era un fallo del sidebar. Era el DATO: `usuarios.rol_id` estaba en `NULL`.

La ficha conservaba `rol_label = 'DIRECCIÓN'` (texto), pero el enlace real al rol estaba
vacío. Y toda la visibilidad se decide leyendo los permisos del rol enlazado por ID
(`usuarios.rol_id → empresa_roles.permisos`), NUNCA la etiqueta de texto y NUNCA el cargo:
no hay bypass de dirección. Sin rol enlazado → 0 permisos → menú vacío.

El enlace lo borró el trigger `sync_usuario_rol_id`. Buscaba el rol por
`empresa_id` + `rol_label` y asignaba el resultado **sin comprobar si había encontrado
algo**:

```sql
select er.id into v_id from empresa_roles er
where er.empresa_id = new.empresa_id and er.nombre ilike new.rol_label limit 1;
new.rol_id := v_id;   -- si no encontró nada, v_id es NULL → BORRA el enlace bueno
```

Basta con que en el momento de tocar la ficha el rol no fuese localizable (rol aún no
creado en esa empresa, o un cambio de empresa a medias) para que un enlace correcto se
perdiera. En silencio.

## Por qué es un fallo de seguridad, no cosmético

Un usuario sin `rol_id` pierde el acceso a su trabajo sin que nadie se entere: no hay
error, no hay log, no salta nada. El fallo es silencioso y solo se detecta cuando la
persona afectada se queja. Aplicado a un gerente o a RRHH en plena operativa, es un corte
de servicio.

## Arreglo (2 capas + detector)

1. **`20260904220000_el_rol_no_se_borra_solo.sql`** — el trigger, si no encuentra rol,
   deja el enlace como estaba en vez de vaciarlo. Un cambio REAL de rol se sigue
   aplicando (eso ocurre cuando SÍ encuentra el nuevo).
2. **`20260904230000_nadie_se_queda_sin_rol.sql`** — red de seguridad independiente de
   quién escriba (pantalla, script, arreglo a mano): el trigger `trg_repone_rol_si_falta`
   repone el rol si la fila se quedaría sin él, primero por `rol_label` y si no por
   `departamento` (rol y departamento comparten nombre).
3. **Vista `usuarios_sin_permisos`** — detector permanente. Debe estar SIEMPRE vacía:
   `select * from usuarios_sin_permisos;`

## Verificado

Probado en transacción con rollback, sobre datos reales:

| Escenario | Resultado |
|---|---|
| Poner `rol_id = NULL` a mano | Se repone solo ✅ |
| Cambiar de empresa | Reengancha al rol de la nueva empresa ✅ |
| `rol_label` corrupto/inexistente | Conserva los permisos, no los vacía ✅ |
| Cambio REAL de rol (DIRECCIÓN → SALA) | Baja de 15 permisos a 1, admin → empleado ✅ |

La última fila es la importante: la red **repone lo que falta, nunca regala permisos**.
Degradar a alguien sigue funcionando.

Estado tras el arreglo: 0 usuarios sin rol de 25, 0 con rol de otra empresa, 0 con
etiqueta desincronizada.

## Reglas que deja este incidente

- Ante un menú, módulo o permiso que "desaparece", **mirar `usuarios.rol_id` ANTES** de
  tocar código de UI o de auth. El síntoma parece de frontend y el fallo es de dato.
- En cualquier trigger o código que reenlace roles: **no escribir NULL cuando la búsqueda
  falla**. Conservar el valor vigente. Perder permisos por accidente es peor que no
  actualizarlos.
- No dar por bueno un enlace por ID que se rellena desde un texto: el texto puede no
  resolver, y el fallo no da la cara.

## Deuda detectada de paso

`user_has_credencial_role()` referencia la tabla `app_credencial_roles`, que ya no existe,
y no la usa ninguna política RLS. Función muerta, pendiente de borrar.
