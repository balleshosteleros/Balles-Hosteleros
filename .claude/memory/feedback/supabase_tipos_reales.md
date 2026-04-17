---
name: Tipos reales BD Supabase — no confiar en migraciones antiguas
description: En esta BD profiles.empresa_id es uuid y profiles.user_id no tiene UNIQUE — al crear tablas nuevas seguir la 038 como modelo, no la 008
type: feedback
---

Al crear migraciones nuevas en esta BD de Supabase, **no copiar los patrones de las migraciones 000-010** — usan tipos/constraints que no coinciden con el esquema real actual.

Patrones correctos confirmados en la BD (2026-04-18):
- `profiles.empresa_id` es **`uuid`** (no `text`) → en tablas nuevas declarar `empresa_id uuid not null references public.empresas(id) on delete cascade`.
- `profiles.user_id` **NO tiene UNIQUE constraint** → prohibido usarlo como target de FK (`references profiles(user_id)` falla con ERROR 42830). Alternativas: (a) `references public.profiles(id)` (PK), o (b) columna `uuid` sin FK guardando `auth.uid()` directo.
- `user_roles.user_id` coincide con `auth.uid()` — usar `where ur.user_id = auth.uid()` en policies.
- No existe `rpc('exec_sql')` → los scripts `apply-migration-*.ts` siempre fallan en auto-aplicar; aplicar manualmente desde Supabase SQL Editor.

**Why:** Migraciones históricas (008, 009) declaran `empresa_id text` y FKs a `profiles(user_id)` que no corresponden al estado real de esta BD. Aplicar ese patrón causa errores 42830 (FK sin UNIQUE) y 42883 (operator does not exist: text = uuid) en las policies RLS.

**How to apply:** Al escribir una migración nueva, usar como modelo las recientes (`035_pos.sql`, `036_direccion_presentaciones.sql`, `038_carta_digital.sql`). Si una migración falla con 42830 o 42883 relacionado con `profiles`/`empresa_id`, casi siempre es este problema de tipos.
