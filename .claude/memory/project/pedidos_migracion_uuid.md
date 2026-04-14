---
name: Migración pedidos empresa_id UUID
description: SQL pendiente de ejecutar en Supabase — fix empresa_id TEXT→UUID en tabla pedidos + recrear políticas RLS
type: project
---

## Migración pendiente: pedidos empresa_id TEXT → UUID

Esta migración aún NO se ha ejecutado en Supabase. Ejecutarla antes de probar el módulo de logística/pedidos.

```sql
-- Eliminar políticas antiguas (tipo incorrecto text vs uuid)
drop policy if exists "pedidos_read"  on public.pedidos;
drop policy if exists "pedidos_write" on public.pedidos;
drop policy if exists "lineas_read"   on public.lineas_pedido;
drop policy if exists "lineas_write"  on public.lineas_pedido;

-- Cambiar empresa_id de TEXT a UUID
alter table public.pedidos
  alter column empresa_id type uuid using empresa_id::uuid;

-- Recrear políticas con tipos correctos
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
```

**Why:** Las políticas RLS de pedidos fallaban porque empresa_id era TEXT mientras profiles.empresa_id es UUID — mismatch de tipos causaba error en el JOIN de la policy.

**How to apply:** Antes de cualquier trabajo en el módulo de pedidos/logística, verificar si esta migración ya se ejecutó. Si no, ejecutarla primero vía Supabase SQL Editor o skill /supabase.
