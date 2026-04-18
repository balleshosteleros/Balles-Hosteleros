---
name: Supabase Realtime en este repo
description: Patrón de uso cuando una feature necesita eventos postgres_changes en vivo
type: feedback
---

Cuando una feature necesita eventos en vivo de la BD, usar Supabase Realtime en vez de polling.

**Why:** primera vez introducido en el PRP-027 (KDS). El polling degrada rendimiento y ensucia logs; Realtime ya cubre el caso con RLS aplicada también a eventos.

**How to apply:**
- En la migración, añadir la tabla a la publication de forma idempotente:
  ```sql
  do $$ begin
    if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='TABLA') then
      execute 'alter publication supabase_realtime add table public.TABLA';
    end if;
  end $$;
  ```
- Cliente: `createClient()` de `@/lib/supabase/client` (browser, no service) y `supabase.channel('nombre').on('postgres_changes', {event, schema:'public', table}, cb).subscribe(status => ...)`.
- **RLS aplica también a eventos** → no necesitas filtrar por empresa_id en el canal; las policies se aplican. Pero `pos_ticket_lineas` no tiene `empresa_id` directo, así que hace falta join vía `pos_tickets` (la RLS actual lo hace).
- Para UPDATE masivo, aplicar patch local en reducer (no re-fetch). Para INSERT con datos derivados, hacer re-fetch con debounce (400 ms). Referencia: [useComandasRealtime](src/features/cocina/comandas/hooks/useComandasRealtime.ts).
- No crear un timer por componente si necesitas "tiempo vivo" — usar un único tick global via context (patrón `CronometroProvider`).
