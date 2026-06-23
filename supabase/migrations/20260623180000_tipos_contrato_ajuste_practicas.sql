-- Ajuste del catálogo de tipos de contrato:
--   - eliminar "Fijo discontinuo" y "Formación y prácticas" (solo si no están en uso)
--   - añadir "Prácticas"
-- Resultado: Indefinido · Temporal · Prácticas
delete from public.tipos_contrato tc
where lower(tc.nombre) in ('fijo discontinuo', 'formación y prácticas', 'formacion y practicas')
  and not exists (
    select 1 from public.vacantes v
    where v.empresa_id = tc.empresa_id and lower(v.tipo_contrato) = lower(tc.nombre)
  );

insert into public.tipos_contrato (empresa_id, nombre, orden)
select e.id, 'Prácticas', 3
from public.empresas e
where not exists (
  select 1 from public.tipos_contrato x
  where x.empresa_id = e.id and lower(x.nombre) in ('prácticas', 'practicas')
);
