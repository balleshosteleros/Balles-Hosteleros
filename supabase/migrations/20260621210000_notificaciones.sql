-- PRP-064 Fase 1: extiende la tabla `notificaciones` existente (avisos del
-- software al usuario). Ya existía con: usuario_id, tipo, titulo, mensaje, leida,
-- leida_at, entidad_tipo, entidad_id, accion_url (único productor:
-- promocion-actions.ts vía service role). Aquí se añade lo necesario para:
--  - dirigir por ficha de empleado (empleado_id),
--  - acciones de acuse (Visto / LIQUIDAR) con traza (vista_at / accionada_at),
--  - datos estructurados (payload) p.ej. desglose de liquidación,
--  - registro de Dirección (lectura por gestor) e inserción por gestor (cliente
--    de usuario, no solo service role).
-- Idempotente. No rompe al productor existente (sigue usando sus columnas).

-- Ampliar los tipos permitidos (el CHECK original no contemplaba liquidaciones).
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check
  check (tipo = any (array[
    'info','alerta','error','exito','recordatorio','liquidacion','liquidacion_pagada'
  ]));

alter table public.notificaciones
  add column if not exists empleado_id     uuid references public.empleados(id) on delete set null,
  add column if not exists payload         jsonb not null default '{}'::jsonb,
  add column if not exists accion_label    text not null default 'Visto',
  add column if not exists requiere_accion boolean not null default false,
  add column if not exists vista_at        timestamptz,
  add column if not exists accionada_at    timestamptz,
  add column if not exists created_by      uuid;

create index if not exists idx_notificaciones_usuario_sin_ver
  on public.notificaciones(usuario_id) where vista_at is null;
create index if not exists idx_notificaciones_empleado
  on public.notificaciones(empleado_id);
create index if not exists idx_notificaciones_empresa_fecha
  on public.notificaciones(empresa_id, created_at desc);

-- SELECT propio (empleado): ahora también por ficha de empleado.
drop policy if exists notif_self_read on public.notificaciones;
create policy notif_self_read on public.notificaciones
  for select using (
    usuario_id = (select auth.uid())
    or empleado_id in (select public.mis_empleado_ids())
  );

-- SELECT gestor/director: registro de su empresa (Dirección → Notificaciones).
drop policy if exists notif_manager_read on public.notificaciones;
create policy notif_manager_read on public.notificaciones
  for select using (
    empresa_id in (select empresas_del_usuario())
    and public.puede_gestionar_pagos()
  );

-- UPDATE propio (acuse Visto / LIQUIDAR).
drop policy if exists notif_self_update on public.notificaciones;
create policy notif_self_update on public.notificaciones
  for update using (
    usuario_id = (select auth.uid())
    or empleado_id in (select public.mis_empleado_ids())
  ) with check (
    usuario_id = (select auth.uid())
    or empleado_id in (select public.mis_empleado_ids())
  );

-- INSERT por gestor (cliente de usuario). El productor por service role
-- (promocion-actions) ya bypassa RLS; esto habilita la emisión desde Pagos.
drop policy if exists notif_manager_insert on public.notificaciones;
create policy notif_manager_insert on public.notificaciones
  for insert with check (
    empresa_id in (select empresas_del_usuario())
    and public.puede_gestionar_pagos()
  );

-- DELETE por gestor.
drop policy if exists notif_manager_delete on public.notificaciones;
create policy notif_manager_delete on public.notificaciones
  for delete using (
    empresa_id in (select empresas_del_usuario())
    and public.puede_gestionar_pagos()
  );
