---
name: migracion_sesame_vacaciones_cortas
description: La migración de Sesame convirtió en «permiso» las vacaciones de menos de 7 días; corregido el 11-09-2026
metadata:
  type: project
---

La migración de ausencias de Sesame aplicó una regla inventada: **todo bloque de vacaciones
de menos de 7 días entró como «permiso»**, no como vacaciones. Quedaba escrito en el motivo:
«Migrado de Sesame (marcado como vacaciones en Sesame; bloque menor de 7 dias)».

Lo detectó Iván el 11-09-2026 con David Kenny Zapata (08→12 septiembre, 5 días, que son
vacaciones). Corregidas las **7 filas** afectadas de `solicitudes_personal` a
`subtipo='vacaciones'` con motivo «Migrado de Sesame (vacaciones)»: David Kenny (5 d),
Eduardo Charro (3 d), Jorge Belda (3 sueltos), Ruth González (2 sueltos).

**Por qué importa:** «Permiso» **no es remunerado** y no gasta días de vacaciones; «Vacaciones»
sí. La regla falseaba tanto la nómina como el contador anual de vacaciones.

**Cómo aplicarlo:** en cualquier migración de ausencias, el tipo sale **tal cual del origen**;
la duración NUNCA decide el tipo. Los permisos de verdad de Sesame (4 de Javier Casarrubios)
y la baja médica de Yesmeri llevan el motivo limpio «Migrado de Sesame» y están bien.
Relacionado: [[vacaciones_devengo_norma]], [[migracion_comunicados_sesame]],
[[datos_completos_obligatorio]].
