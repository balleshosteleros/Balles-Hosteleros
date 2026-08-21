# QA Report: Historial de altas y bajas del empleado

**Date**: 2026-08-21
**Status**: PARTIALLY_VERIFIED (verificación en BD y compilación OK; UI pendiente de sesión)

## Alcance

Añadir historial de altas/bajas en la tarjeta "Estado y acceso al sistema" de la
ficha de empleado, hacer obligatoria la fecha en ambos sentidos, y avisar de que
un alta manual se salta el flujo de contratación de Reclutamiento.

## Test Steps

1. `npx tsc --noEmit` — sin errores. Compila limpio tras los cambios.
2. Navegación a la ficha de empleado — devuelve 307 → `/?auth=1` (redirección de
   login correcta, sin error de compilación de la página).
   Screenshot: `screenshots/01-redirect-login.png`
3. Verificación del esquema en Supabase — tabla `empleado_estado_historial`
   creada con las 13 columnas esperadas y tipos correctos.
4. Verificación de RLS — solo existen policies `SELECT` e `INSERT`. No hay
   `UPDATE` ni `DELETE`: el historial es inmutable por diseño.
5. Búsqueda de llamadas rotas a `setEmpleadoEstado` — la única externa
   (`candidatos-actions.ts:237`, baja al pasar a ex-empleado) pasa `fechaBaja`,
   así que la nueva validación de fecha de alta no la afecta.

## Findings

- La tabla y sus policies quedan como se esperaba.
- Los dos caminos de baja (normal y con sustitución de validador) escriben ahora
  en el historial. El de sustitución usa cliente admin, por eso lee el estado
  previo aparte.
- Corregido de paso un bug preexistente: al reactivar, la `fecha_baja` antigua se
  quedaba puesta, dejando empleados Activos con fecha de baja en el pasado
  (descuadraba KPIs de auditoría y avisos de nóminas de ex-empleados). Ahora se
  limpia y el movimiento anterior queda en el historial.

## Pendiente de verificar en navegador

La ficha exige sesión iniciada y no hay `storageState` guardado, así que no se ha
podido pulsar la interfaz. Falta comprobar visualmente:

- El icono de reloj en la cabecera de la tarjeta roja y su panel.
- Que el campo cambia entre "Fecha de alta" y "Fecha de baja" según el estado.
- El recuadro ámbar de avisos al confirmar una reactivación.
- Que tras guardar un alta, el historial se recarga y muestra el movimiento.

## Screenshots

- `screenshots/01-redirect-login.png` — Ruta protegida redirigiendo al login.
