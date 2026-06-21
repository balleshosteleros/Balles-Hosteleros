-- Vacantes: el área operativa/administrativa se deriva del DEPARTAMENTO de la
-- vacante (departamentos.area), no de un match por título contra el organigrama.
-- Para ello toda vacante necesita departamento_id. Este backfill es idempotente:
--   1) Vacantes cuyo título coincide con un departamento → ese departamento.
--   2) Puestos sin departamento homónimo → su departamento natural (overrides).
-- Solo toca vacantes sin departamento, así que es seguro re-ejecutarlo.
-- Además deja todas las vacantes existentes como publicadas + visibles.

with overrides(titulo_norm, dep_nombre) as (
  values
    ('2º jefe de cocina', 'COCINA'),
    ('2º jefe de sala',   'SALA'),
    ('cachimberos',       'SALA'),
    ('camareros',         'SALA'),
    ('cocineros',         'COCINA'),
    ('hostess',           'SALA'),
    ('jefe de cocina',    'COCINA'),
    ('jefe de sala',      'SALA'),
    ('office',            'COCINA'),
    ('rr.hh',             'RECURSOS HUMANOS'),
    ('socios',            'DIRECCIÓN')
),
resolved as (
  select
    v.id          as vacante_id,
    v.empresa_id,
    coalesce(o.dep_nombre, v.titulo) as dep_target
  from public.vacantes v
  left join overrides o on o.titulo_norm = lower(trim(v.titulo))
  where v.departamento_id is null
)
update public.vacantes v
set departamento_id = d.id,
    updated_at = now()
from resolved r
join public.departamentos d
  on d.empresa_id = r.empresa_id
 and lower(trim(d.nombre)) = lower(trim(r.dep_target))
where v.id = r.vacante_id;

-- Publicar todas las vacantes existentes (estado + visibilidad en el portal).
update public.vacantes
set estado_publicacion = 'publicada',
    visible_publicamente = true,
    updated_at = now()
where estado_publicacion <> 'publicada'
   or visible_publicamente is distinct from true;
