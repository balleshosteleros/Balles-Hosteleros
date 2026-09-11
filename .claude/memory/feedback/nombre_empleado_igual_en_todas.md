# El nombre del empleado sale IGUAL en todas las pantallas

Regla de Iván (12/09/2026): *"debe salir el nombre de empleado igual en todas"*.

Varias tablas guardan una **copia congelada** del nombre (`empleado_nombre` en `fichajes`,
`rrhh_pagos`, `solicitudes_personal`, `toques_*`). Es un dato histórico, NO la fuente.
La fuente es siempre la ficha: `empleados.nombre + apellidos`.

**Al pintar un nombre, resolverlo por `empleado_id` contra la ficha** y dejar la copia
solo como respaldo cuando no haya ficha. Incluir también las fichas **inactivas**: si se
filtra por `estado = 'Activo'`, un ex-empleado cae por la rama de "externos" y se queda
con el nombre viejo para siempre. Ese fue justo el caso de Alberto Cieliczka.

Hecho así en `loadPagos` y `loadPagosRango` (helper `nombresDeFicha`,
`src/features/rrhh/actions/pagos-actions.ts`). Falta repasarlo en fichajes, solicitudes
y en los correos de liquidación, que siguen leyendo la copia.

⚠️ `rrhh_pagos.empleado_nombre` está congelado si la liquidación ya se envió: el trigger
`rrhh_pagos_lock_confirmado()` lo bloquea junto con los importes. Para corregir una
errata de nombre en histórico hay que apagar SOLO `trg_rrhh_pagos_lock` dentro de un
bloque `DO` (atómico: si algo falla, el candado vuelve solo), cambiar el texto y
volver a encenderlo. Nunca reabrir la liquidación para esto: eso borra la marca de
enviada y de aceptada. Y nunca apagarlo para tocar importes.
Otra razón más para pintar siempre desde la ficha.
