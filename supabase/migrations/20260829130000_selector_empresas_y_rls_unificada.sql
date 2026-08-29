-- Continuacion de 20260829120000_aislamiento_empresa_activa.sql
--
-- Dos correcciones necesarias tras aplicar el candado de empresa activa:
--
-- 1) EL SELECTOR SE QUEDO CON UNA SOLA EMPRESA.
--    La tabla `empresas` se protege con `user_has_empresa_access()`, que se
--    apoyaba en `empresas_del_usuario()` — ahora restringida a la activa. Como
--    `empresas` es el CATALOGO de "a que empresas puedes entrar" (pertenencia,
--    no datos de negocio), debe listarlas TODAS o el usuario no puede cambiar
--    de sociedad.
--
-- 2) 66 TABLAS SE SALTABAN EL CANDADO.
--    empleados, puestos, turnos, documentos, bancos, candidatos, inspecciones...
--    llevaban la lista de empresas COPIADA A MANO dentro de sus propias
--    politicas en vez de llamar a `empresas_del_usuario()`, en 5 redacciones
--    distintas. Se reescribieron las 127 politicas afectadas para que pasen por
--    la funcion canonica. La logica no cambia: donde ponia "las empresas del
--    usuario" ahora pone lo mismo a traves de la funcion, que es la que aplica
--    el aislamiento.
--
-- Aplicado en produccion el 29-ago-2026 mediante las migraciones:
--   selector_empresas_no_se_restringe
--   rls_unificar_en_empresas_del_usuario
--   rls_unificar_variantes_restantes
--   rls_unificar_ultimas_variantes_union
--   rls_firmas_eventos_y_gestoria_staging
--   rls_productos_config_y_turno_empleados
--
-- Respaldo del estado anterior de las 681 politicas: tabla
-- `public.bh_rls_backup_20260829` (conservarla hasta validar en uso real).
--
-- Este archivo deja versionado lo esencial y es idempotente.

-- ── Pertenencia: TODAS las empresas del usuario (selector) ──────────────────
create or replace function public.empresas_del_usuario_todas()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select empresa_id from public.usuarios
    where user_id = auth.uid() and empresa_id is not null
  union
  select empresa_id from public.usuario_empresas
    where user_id = auth.uid() and empresa_id is not null
$$;

comment on function public.empresas_del_usuario_todas() is
  'TODAS las empresas del usuario, sin filtrar por la activa. Solo para pertenencia (selector de empresa), NUNCA para datos de negocio.';

create or replace function public.user_has_empresa_access(emp_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select emp_id in (select public.empresas_del_usuario_todas());
$$;

comment on function public.user_has_empresa_access(uuid) is
  'Pertenencia del usuario a una empresa (selector, guards de acceso). NO aisla por empresa activa: para datos de negocio se usa empresas_del_usuario().';

-- ── Politicas que no admitian reescritura automatica ────────────────────────
drop policy if exists fe_select on public.firmas_eventos;
create policy fe_select on public.firmas_eventos
  as permissive for select to authenticated
  using (
    documento_id in (
      select d.id from public.firmas_documentos d
      where d.empleado_id in (
        select e.id from public.empleados e where e.user_id = (select auth.uid())
      )
    )
    or documento_id in (
      select d.id from public.firmas_documentos d
      where d.empresa_id in (select public.empresas_del_usuario())
    )
  );

drop policy if exists gestoria_modelos_staging_read on public.gestoria_modelos_staging;
create policy gestoria_modelos_staging_read on public.gestoria_modelos_staging
  as permissive for select to authenticated
  using (
    token_id in (
      select t.id from public.gestoria_modelos_tokens t
      where t.empresa_id in (select public.empresas_del_usuario())
    )
  );

-- `productos_config` solo miraba `usuario_empresas` y NO la empresa primaria
-- del perfil: un usuario sin fila en `usuario_empresas` quedaba fuera de su
-- propia empresa. `empresas_del_usuario()` contempla ambas.
drop policy if exists productos_config_select on public.productos_config;
create policy productos_config_select on public.productos_config
  as permissive for select to authenticated
  using (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists productos_config_insert on public.productos_config;
create policy productos_config_insert on public.productos_config
  as permissive for insert to authenticated
  with check (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists productos_config_update on public.productos_config;
create policy productos_config_update on public.productos_config
  as permissive for update to authenticated
  using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists productos_config_delete on public.productos_config;
create policy productos_config_delete on public.productos_config
  as permissive for delete to authenticated
  using (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists rrhh_turno_empleados_all on public.rrhh_turno_empleados;
create policy rrhh_turno_empleados_all on public.rrhh_turno_empleados
  as permissive for all to authenticated
  using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));
