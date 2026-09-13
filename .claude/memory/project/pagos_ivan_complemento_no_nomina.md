# Los pagos de Iván van en COMPLEMENTO, nunca en nómina — 12/09/2026

Iván Ballesteros **no está en nómina** en ninguna sociedad: cobra **complemento**,
**1.250 € al mes en HABANA + 1.250 € en BACANAL** (enero y febrero de 2026 fueron 1.500 €).
Sus filas de `rrhh_pagos` van siempre con `nomina = 0`, `ss_empleado = 0`, `ss_empresa = 0`,
`irpf = 0` y sin nómina adjunta.

## Por qué importa la columna

`nominas-trimestre.ts` suma `rrhh_pagos.nomina` para la **base de rendimientos del trabajo
del modelo 111**. Si su importe se mete ahí, entra como si fuera un trabajador más y sin
retención, y además infla el coste de personal de Ratios.

Pasó en **BACANAL mayo y junio de 2026**: 1.250 € de cada mes estaban en `nomina`.
Corregido el 12-09-2026 a `complemento` (el total del mes no cambió). El 111 de T2-2026 de
BACANAL seguía en BORRADOR, así que no había nada presentado con ese dato.

## Un mes sin cobrar se deja EN BLANCO

**Agosto de 2026 se le debe todavía** (dicho por él el 12-09-2026): su fila de agosto se
queda a **0 y sin marcar como cobrada** en las dos empresas. No se rellena el importe
"para que conste la deuda" ni se marca `pagado`. Julio 2026 sí está puesto y cobrado.

## Los meses cerrados están bloqueados

`trg_rrhh_pagos_lock` (liquidación enviada) y `trg_rrhh_pagos_lock_nomina` (nóminas del mes
confirmadas) impiden tocar importes desde la pantalla de Pagos. Una corrección de datos se
hace en BD con los triggers desactivados (`session_replication_role = replica`) y
**sin reabrir el mes**: devolver el mes a la gestoría borra las nóminas y las rehace.
