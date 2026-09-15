-- Un patrón no se activa ni se desactiva; lo que termina es el horario de UNA
-- PERSONA, el día que causa baja.
--
-- NORMA (15-09-2026, decisión del dueño): «apagado» no existe para un patrón. Un
-- horario del catálogo está ahí para usarlo; si sobra, se borra, y si se cambia,
-- se versiona. Tres patrones de BACANAL estaban apagados y, como la lista los
-- filtra, no salían en pantalla: existían pero nadie podía verlos ni elegirlos.
-- Peor aún, dos de ellos eran el horario de los puestos CAMARERO y CONTABLE, que
-- se quedaban señalando a un horario invisible.
--
-- Lo que sí tiene fin es la ASIGNACIÓN al empleado: desde su fecha de baja no
-- puede tener horario. Eso ya lo hace `recortarHorarioFuturoPorBaja` al tramitar
-- la baja, pero quedaban asignaciones antiguas sin recortar.
--
-- Idempotente.

-- ─── 1. Ningún patrón está apagado ────────────────────────────────────────
update rrhh_patrones
   set activo = true, updated_at = now()
 where activo is not true;

-- ─── 2. La baja del empleado cierra su horario ────────────────────────────
-- Toda asignación sin fin, o que iría más allá del último día trabajado, se
-- recorta a la fecha de baja. Las que ya terminaban antes no se tocan.
update rrhh_patron_empleados pe
   set vigente_hasta = e.fecha_baja
  from empleados e
 where e.id = pe.empleado_id
   and e.fecha_baja is not null
   and (pe.vigente_hasta is null or pe.vigente_hasta > e.fecha_baja);

update rrhh_turno_empleados te
   set vigente_hasta = e.fecha_baja
  from empleados e
 where e.id = te.empleado_id
   and e.fecha_baja is not null
   and (te.vigente_hasta is null or te.vigente_hasta > e.fecha_baja);
