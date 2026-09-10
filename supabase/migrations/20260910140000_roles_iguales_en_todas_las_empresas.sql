-- ════════════════════════════════════════════════════════════════════════
-- Los ROLES son del GRUPO: el mismo rol, los mismos permisos en las tres
-- empresas.
--
-- BACANAL y HABANA ya eran idénticas. BALLES se había quedado atrás: a
-- DIRECCIÓN le faltaban Videovigilancia, Aplicaciones y Contraseñas, y a
-- GERENCIA además SALA, COCINA, LOGÍSTICA y RECURSOS HUMANOS. Eso hacía que la
-- misma persona viera cosas distintas según por dónde mirase el software: el
-- menú y las rutas leen el rol FIJO del usuario (`usuarios.rol_id`), mientras
-- que el chat, las tareas y los cronogramas leen el rol de la EMPRESA ACTIVA
-- emparejado por nombre.
--
-- Se toma BACANAL como referencia y se copia a los roles del mismo nombre de
-- las demás, CONSERVANDO los módulos que solo existen en la otra empresa
-- (PRODUCTO en la matriz): borrarlos dejaría a dirección sin su propio módulo.
--
-- Idempotente: al volver a lanzarla no cambia ninguna fila.
-- ════════════════════════════════════════════════════════════════════════
with referencia as (
  select r.nombre, r.permisos
  from empresa_roles r join empresas e on e.id = r.empresa_id
  where e.nombre = 'BACANAL'
),
fusion as (
  select
    d.id,
    ref.permisos || coalesce(
      (
        select jsonb_agg(p)
        from jsonb_array_elements(d.permisos) p
        where not exists (
          select 1 from jsonb_array_elements(ref.permisos) q
          where public.bh_norm(q->>'modulo') = public.bh_norm(p->>'modulo')
        )
      ),
      '[]'::jsonb
    ) as permisos
  from empresa_roles d
  join empresas e on e.id = d.empresa_id
  join referencia ref on public.bh_norm(ref.nombre) = public.bh_norm(d.nombre)
  where e.nombre <> 'BACANAL'
)
update empresa_roles t
set permisos = f.permisos
from fusion f
where t.id = f.id and t.permisos is distinct from f.permisos;
