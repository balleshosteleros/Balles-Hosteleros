-- Desacople vacante <-> puesto: la vacante guarda el NOMBRE del puesto como
-- snapshot informativo (congelado al guardar). Renombrar/mover/borrar el puesto
-- NO altera la vacante. `puesto_id` queda como referencia informativa (sin FK dura).
alter table public.vacantes add column if not exists puesto_snapshot text;

-- Backfill: copiar el nombre actual del puesto a las vacantes que ya lo tienen.
update public.vacantes v
   set puesto_snapshot = p.nombre
  from public.puestos p
 where v.puesto_id = p.id
   and (v.puesto_snapshot is null or v.puesto_snapshot = '');
