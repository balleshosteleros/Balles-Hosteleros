---
name: migracion_sesame_vacaciones_cortas
description: David Kenny 08→12-09-2026 son VACACIONES, no permiso; el resto de la migración de Sesame está bien
metadata:
  type: project
---

La migración de ausencias de Sesame metió como **«permiso»** los bloques de vacaciones de
menos de 7 días, dejándolo escrito en el motivo: «Migrado de Sesame (marcado como vacaciones
en Sesame; bloque menor de 7 dias)».

**Lo único que había que corregir (11-09-2026, dicho por Iván): David Kenny Zapata,
08→12-09-2026, 5 días = VACACIONES.** Ya está cambiado en `solicitudes_personal`.

**El resto de esas filas están BIEN como permiso y NO se tocan**: Eduardo Charro (03→05-04),
Jorge Belda (27-02, 03-04, 15-05) y Ruth González (31-01, 21-02). Aunque el cuadrante
exportado de Sesame pinte «Vacaciones» en algunos de esos días, Iván lo dio por bueno:
**solo era el caso de David**. No volver a proponer el cambio.

**Por qué importa:** «Permiso» no es remunerado y no gasta días de vacaciones; «Vacaciones» sí.
En el calendario del empleado la ausencia manda sobre el turno, así que a David esos 5 días le
salen ya como «VACAC.» y sin horario, no como día de trabajo.

**Cómo aplicarlo:** no cambiar en bloque registros migrados por deducción propia. Corregir solo
lo que Iván señala y preguntar caso por caso el resto.
Relacionado: [[vacaciones_devengo_norma]], [[migracion_comunicados_sesame]],
[[preguntas_una_a_una]].
