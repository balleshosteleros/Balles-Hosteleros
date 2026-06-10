-- Automatiza "un curso por puesto": al crear un puesto se crea su curso de
-- formación (vacío, pero con la estructura lista). Al renombrar el puesto, el
-- título del curso se mantiene "tal cual". El borrado del puesto ya cascada el
-- curso (FK on delete cascade).

create or replace function public.formacion_crear_curso_para_puesto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.formacion_cursos
    (empresa_id, puesto_id, ambito, titulo, descripcion, categoria, orden, publicado, autor)
  values
    (new.empresa_id, new.id, 'puesto', new.nombre, '', 'operativa', 0, true, 'Sistema')
  on conflict (puesto_id) where puesto_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists trg_formacion_curso_por_puesto on public.puestos;
create trigger trg_formacion_curso_por_puesto
  after insert on public.puestos
  for each row
  execute function public.formacion_crear_curso_para_puesto();

create or replace function public.formacion_sync_titulo_curso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nombre is distinct from old.nombre then
    update public.formacion_cursos
      set titulo = new.nombre
      where puesto_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_formacion_sync_titulo on public.puestos;
create trigger trg_formacion_sync_titulo
  after update on public.puestos
  for each row
  execute function public.formacion_sync_titulo_curso();

-- Backfill: crear el curso de los puestos que YA existen.
insert into public.formacion_cursos
  (empresa_id, puesto_id, ambito, titulo, descripcion, categoria, orden, publicado, autor)
select p.empresa_id, p.id, 'puesto', p.nombre, '', 'operativa', 0, true, 'Sistema'
from public.puestos p
on conflict (puesto_id) where puesto_id is not null do nothing;
