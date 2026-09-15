-- Fuera el horario «CALIDAD 1» de BACANAL: no lo usa nadie.
--
-- Era el único patrón del catálogo sin puesto que lo eligiera y sin ningún
-- trabajador asignado (ni ahora ni antes: si alguien lo hubiera tenido habría
-- que conservarlo como histórico). Estaba además apagado desde el 02-09-2026,
-- y al quitar el concepto de «apagado» habría vuelto a aparecer en la lista sin
-- servir para nada. Borrado por decisión del dueño (15-09-2026).
--
-- El borrado arrastra sus semanas (ON DELETE CASCADE).
--
-- Idempotente y con red: solo borra si sigue sin puesto y sin asignaciones.

delete from rrhh_patrones pa
 where pa.familia_id = 'f1656bb3-f463-49de-a9d0-1dd31f11d22c'
   and not exists (
     select 1 from puesto_salarios s where s.patron_familia_id = pa.familia_id
   )
   and not exists (
     select 1 from rrhh_patron_empleados pe where pe.patron_id = pa.id
   );
