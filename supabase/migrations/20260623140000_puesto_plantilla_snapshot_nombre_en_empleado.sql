-- Modelo PLANTILLA: el puesto es una plantilla cuyas condiciones y nombre se
-- COPIAN dentro del empleado. Borrar el puesto NO debe tocar al empleado.
-- Las condiciones ya viven en empleado_condiciones (sin FK a puesto). Aquí
-- añadimos el snapshot del NOMBRE del puesto y desacoplamos el enlace para que
-- la asignación del empleado sobreviva al borrado del puesto.
-- Idempotente.

-- 1) Snapshot del nombre del puesto dentro del empleado
alter table empleado_puestos add column if not exists puesto_nombre text;
alter table empleado_condiciones add column if not exists puesto_nombre text;

-- 2) Backfill desde el puesto vivo actual
update empleado_puestos ep set puesto_nombre = p.nombre
  from puestos p where p.id = ep.puesto_id and ep.puesto_nombre is null;
update empleado_condiciones ec set puesto_nombre = p.nombre
  from puestos p where p.id = ec.puesto_id and ec.puesto_nombre is null;

-- 3) Desacoplar empleado_puestos.puesto_id: nullable + FK ON DELETE SET NULL
alter table empleado_puestos alter column puesto_id drop not null;
alter table empleado_puestos drop constraint if exists empleado_puestos_puesto_id_fkey;
alter table empleado_puestos add constraint empleado_puestos_puesto_id_fkey
  foreign key (puesto_id) references puestos(id) on delete set null;
