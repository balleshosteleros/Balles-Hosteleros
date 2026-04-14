-- ============================================================
-- 017_fix_pedidos_empresa_id.sql
-- Corrige el tipo de empresa_id en pedidos (text → uuid)
-- y recrea las políticas RLS para evitar error de tipos.
-- ============================================================

-- 1. Eliminar políticas antiguas (creadas en 009 con tipo incorrecto)
drop policy if exists "pedidos_read"  on public.pedidos;
drop policy if exists "pedidos_write" on public.pedidos;
drop policy if exists "lineas_read"   on public.lineas_pedido;
drop policy if exists "lineas_write"  on public.lineas_pedido;

-- 2. Cambiar empresa_id de TEXT a UUID (tabla vacía o con UUIDs válidos)
alter table public.pedidos
  alter column empresa_id type uuid using empresa_id::uuid;

-- 3. Recrear políticas con tipos correctos
create policy "pedidos_read" on public.pedidos
  for select to authenticated
  using (empresa_id in (
    select p.empresa_id from public.profiles p where p.user_id = auth.uid()
  ));

create policy "pedidos_write" on public.pedidos
  for all to authenticated
  using (true) with check (true);

create policy "lineas_read" on public.lineas_pedido
  for select to authenticated using (true);

create policy "lineas_write" on public.lineas_pedido
  for all to authenticated using (true) with check (true);
