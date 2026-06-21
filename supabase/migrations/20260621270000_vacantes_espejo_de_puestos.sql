-- Regla del modelo: «todo puesto tiene su vacante» → las vacantes son espejo
-- 1:1 de los PUESTOS (no de los departamentos). Las vacantes se habían sembrado
-- antes desde el organigrama (nombres de departamento), lo que las descuadraba.
-- Esta migración reconcilia ambos conjuntos para HABANA y BACANAL. Idempotente.
-- Seguro: no había candidatos vinculados a ninguna vacante.

do $$
declare
  emp record;
begin
  for emp in
    select id from public.empresas where nombre in ('BACANAL','HABANA')
  loop
    -- 1) Enlazar vacantes existentes a su puesto homónimo (+ departamento).
    update public.vacantes v
    set puesto_id = pu.id,
        departamento_id = coalesce(v.departamento_id, pu.departamento_id),
        updated_at = now()
    from public.puestos pu
    where pu.empresa_id = emp.id
      and v.empresa_id = emp.id
      and pu.estado = 'activo'
      and lower(trim(pu.nombre)) = lower(trim(v.titulo));

    -- 2) Borrar vacantes que no corresponden a ningún puesto (departamentos).
    delete from public.vacantes v
    where v.empresa_id = emp.id
      and not exists (
        select 1 from public.puestos pu
        where pu.empresa_id = emp.id and pu.estado = 'activo'
          and lower(trim(pu.nombre)) = lower(trim(v.titulo))
      );

    -- 3) Crear una vacante por cada puesto que aún no la tenga.
    insert into public.vacantes
      (empresa_id, titulo, puesto_id, departamento_id, tipo_jornada,
       estado_publicacion, visible_publicamente, cuestionario, favorita)
    select pu.empresa_id, pu.nombre, pu.id, pu.departamento_id, 'Completa',
           'publicada', true, false, false
    from public.puestos pu
    where pu.empresa_id = emp.id
      and pu.estado = 'activo'
      and not exists (
        select 1 from public.vacantes v
        where v.empresa_id = emp.id and lower(trim(v.titulo)) = lower(trim(pu.nombre))
      );

    -- 4) Todas publicadas + visibles.
    update public.vacantes
    set estado_publicacion = 'publicada', visible_publicamente = true, updated_at = now()
    where empresa_id = emp.id
      and (estado_publicacion <> 'publicada' or visible_publicamente is distinct from true);
  end loop;
end $$;
