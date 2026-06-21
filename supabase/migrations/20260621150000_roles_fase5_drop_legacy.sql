-- PRP-063 Fase 5: derivar el flag de plataforma y RETIRAR la duplicidad.
-- 1) Reapunta los helpers RLS (bh_es_admin, is_app_director, has_empresa_role)
--    a la fuente única: usuarios.rol_id -> empresa_roles.es_admin_plataforma.
-- 2) Recrea las 5 políticas que leían usuario_roles / usuarios.role.
-- 3) Dropea la tabla legacy usuario_roles.
-- 4) usuarios.role NO se dropea: muchas políticas RLS dependen de ella. Se deja
--    como ESPEJO derivado (como rol_label), mantenido por el trigger desde
--    rol_id. La fuente única es rol_id; role/rol_label son espejos no-autoritativos.
-- Idempotente. Paridad: usuario_roles solo tenía {director,empleado} y
-- usuarios.role solo {admin,empleado}; "director"/"admin" == es_admin_plataforma.

-- ── 0) Trigger: mantener usuarios.role como espejo derivado del rol ──────────
create or replace function public.sync_usuario_rol_id()
returns trigger language plpgsql as $$
declare v_es_admin boolean;
begin
  if new.rol_label is not null and new.empresa_id is not null then
    if tg_op = 'UPDATE'
       and new.rol_label is not distinct from old.rol_label
       and new.empresa_id is not distinct from old.empresa_id
       and new.rol_id is not null then
      return new;
    end if;
    select er.id, er.es_admin_plataforma into new.rol_id, v_es_admin
    from public.empresa_roles er
    where er.empresa_id = new.empresa_id and er.nombre ilike new.rol_label
    limit 1;
    -- Espejo legacy: usuarios.role derivado del flag (RLS que aún lo leen).
    new.role := case when v_es_admin then 'admin' else 'empleado' end;
  end if;
  return new;
end;
$$;

-- ── 1) Helpers RLS ───────────────────────────────────────────────────────────
create or replace function public.bh_es_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.usuarios u
    join public.empresa_roles er on er.id = u.rol_id
    where u.user_id = auth.uid() and er.es_admin_plataforma
  );
$$;

create or replace function public.is_app_director()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.usuarios u
    join public.empresa_roles er on er.id = u.rol_id
    where u.user_id = auth.uid() and er.es_admin_plataforma
  );
$$;

create or replace function public.has_empresa_role(p_empresa_id uuid, p_role text)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select public.is_member_of_empresa(p_empresa_id) and p_role = (
    case when exists (
      select 1 from public.usuarios u
      join public.empresa_roles er on er.id = u.rol_id
      where u.user_id = auth.uid() and er.es_admin_plataforma
    ) then 'director' else 'empleado' end
  );
$$;

-- ── 2) Políticas que leían usuario_roles / usuarios.role ─────────────────────
drop policy if exists fd_manage_admin on public.firmas_documentos;
create policy fd_manage_admin on public.firmas_documentos for all
using (
  (empresa_id in (select p.empresa_id from public.usuarios p where p.user_id = (select auth.uid()))
   or empresa_id in (select ue.empresa_id from public.usuario_empresas ue where ue.user_id = (select auth.uid())))
  and public.bh_es_admin()
)
with check (
  (empresa_id in (select p.empresa_id from public.usuarios p where p.user_id = (select auth.uid()))
   or empresa_id in (select ue.empresa_id from public.usuario_empresas ue where ue.user_id = (select auth.uid())))
  and public.bh_es_admin()
);

drop policy if exists recetas_delete on public.nuevas_recetas;
create policy recetas_delete on public.nuevas_recetas for delete
using (public.bh_es_admin());

drop policy if exists toques_canjes_manage_admin on public.toques_canjes;
create policy toques_canjes_manage_admin on public.toques_canjes for update
using (empresa_id in (select empresas_del_usuario()) and public.bh_es_admin())
with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists user_empresas_admin_write on public.usuario_empresas;
create policy user_empresas_admin_write on public.usuario_empresas for all
using (public.bh_es_admin())
with check (public.bh_es_admin());

drop policy if exists user_empresas_select on public.usuario_empresas;
create policy user_empresas_select on public.usuario_empresas for select
using (public.bh_es_admin() or user_id = (select auth.uid()));

-- ── 3) Retirar la tabla legacy usuario_roles (la columna usuarios.role se
--       conserva como espejo derivado por el trigger de arriba). ──────────────
drop table if exists public.usuario_roles;
