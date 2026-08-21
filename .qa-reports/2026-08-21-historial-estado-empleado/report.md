# QA Report: Historial de estado + asignar puesto a un empleado

**Date**: 2026-08-21
**Status**: PARTIALLY_VERIFIED (compilación y datos verificados; UI pendiente de sesión)

## Alcance

1. Historial de altas y bajas en la ficha del empleado, con fecha obligatoria en
   ambos sentidos y aviso de que un alta manual no es una contratación.
2. Asignar un puesto a un empleado desde su ficha: absorbe todo lo que define el
   puesto desde una fecha, previa comparativa campo por campo.

## Test Steps

1. `npx tsc --noEmit` — sin errores tras todos los cambios.
2. Esquema de `empleado_estado_historial` verificado en Supabase: 13 columnas,
   tipos correctos.
3. RLS verificado: solo `SELECT` e `INSERT`. Sin `UPDATE` ni `DELETE` — el
   historial es inmutable.
4. Navegación a la ficha: 307 → `/?auth=1` (redirección de login, sin error de
   compilación de página). Screenshot: `screenshots/01-redirect-login.png`
5. Horarios solapados en producción: **0 empleados** con más de un patrón abierto.
   El bug se cierra antes de haber causado daño.
6. Simulación de la lógica de corte de horario (`cerrarPatronesAnteriores`) contra
   datos reales: los tres casos se resuelven bien — patrón ya terminado se deja
   igual, patrón que aún no había empezado se retira, patrón en curso se cierra la
   víspera.
7. Simulación del nuevo cálculo de tareas contra datos reales: ningún empleado
   pierde tareas. DIRECTOR resuelve a «DIRECCION» y CONTABLE a «CONTABILIDAD»
   gracias a resolver el rol por `puesto_id` y no por nombre.

## Findings

### Bugs preexistentes encontrados y corregidos

- **Horarios solapados**: `asignarPlantillaPuestoAEmpleado` escribía el patrón
  nuevo sin cerrar el anterior. Ambos quedaban abiertos y solapados desde la fecha
  del cambio. Ahora el anterior se cierra la víspera.
- **Fecha de baja no se limpiaba al reactivar**: quedaban empleados Activos con
  fecha de baja en el pasado, descuadrando KPIs de auditoría y avisos de nóminas.
- **El validador no se actualizaba al cambiar de puesto**: `promocionarEmpleado`
  propagaba puesto y departamento pero no `validador_departamento_id`. Ahora sí
  (y si el puesto destino no lo define, se conserva el anterior).
- **Las tareas no seguían al puesto**: se resolvían por el texto del rol y sus
  permisos, así que al cambiar de puesto el empleado seguía viendo las del puesto
  viejo. Ahora mandan los puestos asignados.

### Dato relevante

Alejandro Mojica tiene 3 puestos asignados (GERENTE, LOGÍSTICA, RECURSOS HUMANOS)
= 151 tareas visibles. Con el cambio, dejarle solo GERENTE lo baja a 45. Antes no
había forma de controlarlo.

### Sin registro de cambios (asumido)

`validador_departamento_id` y `departamento_id` se sobreescriben en `empleados`
sin histórico propio. El movimiento sí queda en `empleado_condiciones` y en
`empleado_promociones` (que guarda snapshot completo).

## Pendiente de verificar en navegador

La ficha exige sesión y no hay `storageState` guardado. Falta comprobar:

- Icono de reloj en la tarjeta de estado y su panel.
- Campo que alterna entre «Fecha de alta» y «Fecha de baja».
- Recuadro ámbar de avisos al reactivar.
- Botón «Cambiar de puesto» en la pestaña Puestos y su comparativa completa
  (9 filas: puesto, departamento, salario, jornada, horas, contrato, horario,
  cronograma y validador).

## Screenshots

- `screenshots/01-redirect-login.png` — Ruta protegida redirigiendo al login.
