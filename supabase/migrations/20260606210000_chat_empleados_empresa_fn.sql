-- Lista de empleados de una empresa para el selector de miembros del chat.
-- profiles tiene RLS que solo deja ver el propio perfil, por eso el selector
-- de "usuarios concretos" salía vacío. Esta función SECURITY DEFINER devuelve
-- los empleados de una empresa SOLO si el usuario pertenece a ella (directos +
-- multi-empresa vía user_empresas).
create or replace function public.chat_empleados(p_empresa uuid)
returns table (
  user_id uuid,
  nombre text,
  apellidos text,
  rol_label text,
  departamento text
) language sql stable security definer set search_path = public as $$
  select distinct p.user_id, p.nombre, p.apellidos, p.rol_label, p.departamento
  from public.profiles p
  where p.user_id is not null
    and (
      p.empresa_id = p_empresa
      or p.user_id in (select ue.user_id from public.user_empresas ue where ue.empresa_id = p_empresa)
    )
    and p_empresa in (select public.empresas_del_usuario())
  order by p.nombre;
$$;
