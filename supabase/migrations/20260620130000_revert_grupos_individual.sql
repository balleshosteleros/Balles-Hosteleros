-- Revertir el concepto Grupo: de momento cada empresa es INDIVIDUAL.
-- La copia/duplicacion de empleados se rige por el acceso real del usuario
-- (usuario_empresas) + permiso de Recursos Humanos, no por grupo.

alter table public.empresas drop column if exists grupo_id;
drop table if exists public.grupos;
