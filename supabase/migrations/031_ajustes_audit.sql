-- ============================================================
-- 031_ajustes_audit.sql
-- Módulo Ajustes: Auditoría de cambios, configuración de integraciones,
--                 logs de acceso y plantillas de notificaciones.
--
-- CONEXIONES CRUZADAS:
--   - audit_log → todas las tablas (registro de cambios críticos)
--   - integraciones_config → agora_sync_log (Logística), empresas (Ajustes)
--   - notificaciones → profiles (usuarios), empleados (RRHH)
-- ============================================================

-- ─── 1. AUDIT LOG ──────────────────────────────────────────
-- Registro inmutable de cambios en datos críticos.
-- Conecta con: TODAS las tablas del sistema (via trigger genérico).

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references public.empresas(id) on delete set null,
  tabla       text not null,
  registro_id text not null,      -- UUID del registro afectado como text
  operacion   text not null check (operacion in ('INSERT','UPDATE','DELETE')),
  campos_antes jsonb,             -- valores previos (solo UPDATE/DELETE)
  campos_despues jsonb,           -- valores nuevos (solo INSERT/UPDATE)
  usuario_id  uuid references auth.users(id) on delete set null,
  usuario_email text,             -- desnormalizado para conservar tras borrado de user
  ip_address  inet,
  created_at  timestamptz not null default now()
);

-- Solo índices de lectura — la tabla no se actualiza, solo inserta
create index if not exists idx_audit_empresa
  on public.audit_log(empresa_id, created_at desc);
create index if not exists idx_audit_tabla
  on public.audit_log(tabla, registro_id);
create index if not exists idx_audit_usuario
  on public.audit_log(usuario_id, created_at desc);

comment on table public.audit_log is
  'Log inmutable de cambios críticos. Solo INSERT permitido. Nunca UPDATE/DELETE.';

-- RLS: solo lectura para admins; escritura solo vía funciones internas
alter table public.audit_log enable row level security;
create policy "audit_read" on public.audit_log for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
-- No policy de write — solo funciones server-side pueden insertar

-- ─── 2. FUNCIÓN GENÉRICA DE AUDITORÍA ──────────────────────
-- Trigger function reutilizable que registra cambios en cualquier tabla.
-- Uso: CREATE TRIGGER tbl_audit AFTER INSERT OR UPDATE OR DELETE ON tabla
--        FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

create or replace function public.fn_audit_log()
returns trigger language plpgsql security definer as $$
declare
  v_empresa_id uuid;
  v_registro_id text;
  v_antes jsonb;
  v_despues jsonb;
begin
  -- Extraer empresa_id si existe en el registro
  if tg_op = 'DELETE' then
    v_empresa_id := (old.empresa_id)::uuid;
    v_registro_id := old.id::text;
    v_antes := to_jsonb(old);
    v_despues := null;
  elsif tg_op = 'INSERT' then
    v_empresa_id := (new.empresa_id)::uuid;
    v_registro_id := new.id::text;
    v_antes := null;
    v_despues := to_jsonb(new);
  else -- UPDATE
    v_empresa_id := (new.empresa_id)::uuid;
    v_registro_id := new.id::text;
    v_antes := to_jsonb(old);
    v_despues := to_jsonb(new);
  end if;

  insert into public.audit_log (
    empresa_id, tabla, registro_id, operacion,
    campos_antes, campos_despues,
    usuario_id, created_at
  ) values (
    v_empresa_id, tg_table_name, v_registro_id, tg_op,
    v_antes, v_despues,
    auth.uid(), now()
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Activar auditoría en tablas críticas
drop trigger if exists audit_pedidos on public.pedidos;
create trigger audit_pedidos after insert or update or delete on public.pedidos
  for each row execute function public.fn_audit_log();

drop trigger if exists audit_nominas on public.nominas;
create trigger audit_nominas after insert or update or delete on public.nominas
  for each row execute function public.fn_audit_log();

drop trigger if exists audit_contratos on public.contratos;
create trigger audit_contratos after insert or update or delete on public.contratos
  for each row execute function public.fn_audit_log();

drop trigger if exists audit_facturas on public.facturas;
create trigger audit_facturas after insert or update or delete on public.facturas
  for each row execute function public.fn_audit_log();

drop trigger if exists audit_stock on public.stock;
create trigger audit_stock after update on public.stock
  for each row when (old.cantidad_actual is distinct from new.cantidad_actual)
  execute function public.fn_audit_log();

-- ─── 3. INTEGRACIONES CONFIG ───────────────────────────────
-- Configuración de integraciones externas por empresa.
-- Conecta con: agora_sync_log (Logística), empresas (Ajustes).

create table if not exists public.integraciones_config (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  tipo            text not null
                    check (tipo in ('Agora','Facturae','Email','WhatsApp','Slack','Otro')),
  nombre          text not null,
  activa          boolean not null default false,
  config          jsonb not null default '{}',  -- credenciales cifradas por la app
  ultimo_sync_at  timestamptz,
  ultimo_estado   text,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, tipo)
);

create index if not exists idx_integraciones_empresa
  on public.integraciones_config(empresa_id);

create or replace function public.set_integraciones_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists integraciones_updated_at on public.integraciones_config;
create trigger integraciones_updated_at
  before update on public.integraciones_config
  for each row execute function public.set_integraciones_updated_at();

alter table public.integraciones_config enable row level security;
create policy "integ_read" on public.integraciones_config for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "integ_manage" on public.integraciones_config for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- ─── 4. NOTIFICACIONES ─────────────────────────────────────
-- Notificaciones internas del sistema (alertas, avisos, mensajes del sistema).
-- Conecta con: profiles (Ajustes), empleados (RRHH), pedidos (Logística), etc.

create table if not exists public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  usuario_id      uuid not null references auth.users(id) on delete cascade,
  tipo            text not null
                    check (tipo in ('info','alerta','error','exito','recordatorio')),
  titulo          text not null,
  mensaje         text not null,
  leida           boolean not null default false,
  leida_at        timestamptz,
  -- Referencia al origen (ej: pedido_id, empleado_id, etc.)
  entidad_tipo    text,      -- 'pedido', 'nomina', 'stock', etc.
  entidad_id      uuid,
  accion_url      text,      -- ruta interna a la que navegar al hacer click
  created_at      timestamptz not null default now()
);

create index if not exists idx_notif_usuario
  on public.notificaciones(usuario_id, leida, created_at desc);
create index if not exists idx_notif_empresa
  on public.notificaciones(empresa_id, created_at desc);

alter table public.notificaciones enable row level security;
-- Cada usuario solo ve sus propias notificaciones
create policy "notif_read" on public.notificaciones for select to authenticated
  using (usuario_id = auth.uid());
create policy "notif_update" on public.notificaciones for update to authenticated
  using (usuario_id = auth.uid());
-- Solo el sistema (service_role) puede insertar notificaciones
create policy "notif_insert" on public.notificaciones for insert to authenticated
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

comment on table public.notificaciones is
  'Notificaciones in-app. Cada usuario solo accede a las suyas vía RLS.';

-- ─── 5. ALERTAS DE STOCK BAJO ──────────────────────────────
-- Cuando stock cae bajo mínimo, crear notificación automáticamente.

create or replace function public.fn_alerta_stock_bajo()
returns trigger language plpgsql security definer as $$
declare
  v_empresa_uuid uuid;
  v_usuarios record;
begin
  -- Solo actuar si la cantidad cae por debajo del mínimo
  if new.cantidad_actual <= new.cantidad_minima and
     (old.cantidad_actual is null or old.cantidad_actual > old.cantidad_minima) then

    -- Obtener empresa_id del producto
    select empresa_id into v_empresa_uuid
    from public.productos where id = new.producto_id limit 1;

    if v_empresa_uuid is not null then
      -- Notificar a todos los usuarios de la empresa con rol admin/director/responsable
      for v_usuarios in
        select ur.user_id
        from public.user_roles ur
        join public.profiles pr on pr.user_id = ur.user_id
        where pr.empresa_id = v_empresa_uuid
          and ur.role in ('admin','director','responsable')
      loop
        insert into public.notificaciones (
          empresa_id, usuario_id, tipo, titulo, mensaje,
          entidad_tipo, entidad_id
        ) values (
          v_empresa_uuid,
          v_usuarios.user_id,
          'alerta',
          'Stock bajo: ' || new.producto_nombre,
          'El stock de "' || new.producto_nombre || '" está por debajo del mínimo (' ||
          new.cantidad_actual || ' / ' || new.cantidad_minima || ' ' || new.unidad || ').',
          'stock',
          new.id
        );
      end loop;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stock_bajo_alerta on public.stock;
create trigger stock_bajo_alerta
  after update on public.stock
  for each row execute function public.fn_alerta_stock_bajo();
