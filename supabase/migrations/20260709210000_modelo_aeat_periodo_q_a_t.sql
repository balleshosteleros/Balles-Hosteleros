-- Renombra los periodos trimestrales de modelos AEAT de Q1-Q4 a T1-T4.
-- Recrea el enum limpio (sin valores Q huérfanos) y migra los datos existentes.
-- Idempotente: si el tipo ya está en T1-T4, no hace nada.

do $$
begin
  -- Solo actuar si el enum todavía contiene los valores antiguos 'Q1'..'Q4'.
  if exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'modelo_aeat_periodo' and e.enumlabel = 'Q1'
  ) then
    -- 1. Nuevo enum limpio.
    create type public.modelo_aeat_periodo_new as enum ('T1','T2','T3','T4','ANUAL');

    -- 2. Cambiar la columna a texto para poder remapear los valores.
    alter table public.modelos_aeat
      alter column periodo type text using periodo::text;

    -- 3. Remapear Q -> T en los datos existentes.
    update public.modelos_aeat set periodo = 'T1' where periodo = 'Q1';
    update public.modelos_aeat set periodo = 'T2' where periodo = 'Q2';
    update public.modelos_aeat set periodo = 'T3' where periodo = 'Q3';
    update public.modelos_aeat set periodo = 'T4' where periodo = 'Q4';

    -- 4. Convertir la columna al enum nuevo.
    alter table public.modelos_aeat
      alter column periodo type public.modelo_aeat_periodo_new
      using periodo::public.modelo_aeat_periodo_new;

    -- 5. Eliminar el enum viejo y renombrar el nuevo al nombre canónico.
    drop type public.modelo_aeat_periodo;
    alter type public.modelo_aeat_periodo_new rename to modelo_aeat_periodo;
  end if;
end $$;
