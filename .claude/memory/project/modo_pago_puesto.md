# Cómo se paga un puesto: MENSUAL o por HORAS — 07/09/2026

`puesto_salarios.modo_pago` y `empleado_condiciones.modo_pago` (migración
`20260907200000`). Por defecto `MENSUAL`, así que nada cambia hasta que se marque.

## Qué significa el salario bruto en cada modo

- **MENSUAL**: `salario_bruto` = sueldo del mes. El coste de la hora se deduce
  (bruto × 12 ÷ 52 ÷ horas semanales) salvo que se escriba a mano.
- **HORAS**: `salario_bruto` = **precio bruto de UNA hora**. No hay sueldo mensual ni
  horas semanales. `coste_hora` se mantiene igual al bruto (no se escribe dos veces).

Helper único: `costeHoraSegunModo()` en `src/features/rrhh/lib/coste-hora.ts`.

## Consecuencias

- **TODOS los puestos llevan las MISMAS casillas**, cobren por mes o por hora (norma de
  Iván, 08/09/2026). Lo que cambia entre modos es qué SIGNIFICA el bruto, no qué datos hay
  que dar. Nada de ocultar campos según el modo.
- **Vacaciones es un selector**: "30 días" o **"Incluidas en salario"** (esta última para
  quien cobra por hora: su parte de vacaciones ya va dentro del precio). Si un puesto tenía
  otro texto guardado, se conserva como opción para no perderlo.
- En modo HORAS **no hay coste de ausencias**: si no trabaja, no cobra. Sus vacaciones
  ni siquiera aparecen en el apartado de Ausencias de Ratios (es un apartado de coste).
  Esto quitaba ~1.493 € de descuadre en BACANAL en agosto.
- El modo viaja del PUESTO al EMPLEADO al contratar o promocionar, y queda congelado en
  su histórico igual que el resto de condiciones.

## Precio de la hora extra (`precio_hora_extra`)

Migración `20260908100000`. Las horas extras que se hacen cada mes NO son del puesto
(van en la nómina), pero **su precio sí** y además es exacto. Decisión de Iván 08/09/2026:
**10 € en todos los puestos**, y quien cobra POR HORA la tiene **al mismo precio que su
hora normal**. Viaja al empleado al contratar, como el resto de condiciones.

## Puestos ya en modo HORAS (08/09/2026)

| Puesto | Empresa | €/hora | Hora extra |
|---|---|---|---|
| CANTANTE (Ruth González) | BACANAL | 62,50 € | 62,50 € |
| MUSICO (Jorge Belda) | BACANAL | 62,50 € | 62,50 € |
| DJ (Daniel Cantalejo) | HABANA | 18,00 € | 18,00 € |

Los precios salen de sus nóminas reales y son constantes mes a mes (el DJ solo se sale en
mayo, 27,07 €, que parece un extra puntual).

## ⚠️ Los salarios del seed NO son reales

Los importes que traían los puestos (3.000 € director, 2.000 € jefe de cocina, 1.400 €
cantante…) vienen de `src/lib/seeds/puestos.ts`, que es una **referencia de convenio**
replicada igual a todas las empresas. **De Sesame NO se migró ningún salario** (solo los
tipos de ausencia). Los salarios reales están en `rrhh_pagos` (nóminas de la gestoría).
⚠️ Ojo: `rrhh_pagos.nomina` es el **NETO**. La nómina BRUTA = nomina + ss_empleado + irpf.

## Por qué hacía falta

Ruth González (CANTANTE) y Jorge Belda (MUSICO) estaban como MENSUAL a 1.400 € y
20 h/semana. La realidad de sus nóminas: trabajan **6-10 horas AL MES** y cobran
exactamente **62,50 €/hora** los dos. Cobraban entre 62 € y 656 € al mes, no 1.400 €.
⏳ Pendiente: Iván dará los puestos actualizados. NO se han tocado sus datos.

## Ojo

Ningún empleado tiene condiciones propias en su ficha, así que todos tiran del PUESTO.
Y el puesto no coincide con lo que se cobra: Borja Garrido cobra **1.900 €** constante
(1.510 nómina + 390 complemento) pero su puesto dice 2.000 €. Ver
[[condiciones_empleado_fuentes]] y [[ratios_coste_personal]].
