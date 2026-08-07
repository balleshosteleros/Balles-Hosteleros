-- CONFIRMACIÓN DEL MES DE NÓMINAS: borrador editable → confirmado inmutable.
--
-- Flujo:
--   1. La gestoría sube las nóminas → el mes queda en BORRADOR.
--      RRHH puede revisar, borrar nóminas mal subidas y volver a subirlas.
--   2. RRHH pulsa "Confirmar nóminas del mes" → CONFIRMADO.
--      A partir de ahí NADIE (ningún rol) puede tocar los importes que vienen de
--      la nómina, ni borrar/añadir nóminas de ese mes. Y solo entonces las
--      nóminas se publican en la carpeta del empleado en su portal.
--
-- Se cierran además dos agujeros detectados:
--   a) `rrhh_pagos_nominas` tenía UNA policy `FOR ALL` con solo
--      `user_has_empresa_access`: CUALQUIER trabajador de la empresa podía
--      borrar o alterar importes de nóminas (suyas o de otros). Ahora escribir
--      exige `puede_gestionar_pagos()` y leer, ser gestor o dueño de la nómina.
--   b) El trigger de bloqueo de `rrhh_pagos` no congelaba `ss_empleado`,
--      `ss_empresa` ni `irpf` (se añadieron después). Ahora sí.
--
-- Idempotente: re-ejecutable sin error.

-- ── 1. Marca de confirmación, por empresa+periodo ───────────────────────────
create table if not exists public.rrhh_nominas_mes (
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  periodo      text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  confirmado_en  timestamptz,
  confirmado_por uuid references auth.users(id),
  primary key (empresa_id, periodo)
);

comment on table public.rrhh_nominas_mes is
  'Estado del mes de nóminas. Con `confirmado_en` no null, el mes es INMUTABLE: no se pueden editar importes de nómina ni añadir/borrar nóminas.';

alter table public.rrhh_nominas_mes enable row level security;

drop policy if exists "rrhh_nominas_mes_read" on public.rrhh_nominas_mes;
create policy "rrhh_nominas_mes_read" on public.rrhh_nominas_mes
  for select to authenticated
  using (public.user_has_empresa_access(empresa_id));

-- Solo quien gestiona pagos confirma o reabre el mes.
drop policy if exists "rrhh_nominas_mes_write" on public.rrhh_nominas_mes;
create policy "rrhh_nominas_mes_write" on public.rrhh_nominas_mes
  for all to authenticated
  using (public.user_has_empresa_access(empresa_id) and public.puede_gestionar_pagos())
  with check (public.user_has_empresa_access(empresa_id) and public.puede_gestionar_pagos());

/** ¿Está el mes confirmado (y por tanto cerrado a cambios)? */
create or replace function public.mes_nominas_confirmado(p_empresa uuid, p_periodo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rrhh_nominas_mes
    where empresa_id = p_empresa and periodo = p_periodo and confirmado_en is not null
  );
$$;

-- ── 2. `rrhh_pagos_nominas`: escritura solo gestores, y nunca si está cerrado ──
drop policy if exists "rrhh_pagos_nominas_rw" on public.rrhh_pagos_nominas;

drop policy if exists "rrhh_pagos_nominas_read" on public.rrhh_pagos_nominas;
create policy "rrhh_pagos_nominas_read" on public.rrhh_pagos_nominas
  for select to authenticated
  using (
    public.user_has_empresa_access(empresa_id)
    and (
      public.puede_gestionar_pagos()
      -- El propio trabajador ve SOLO sus nóminas, y solo del mes ya confirmado.
      or (
        empleado_id in (select id from public.empleados where user_id = auth.uid())
        and public.mes_nominas_confirmado(empresa_id, periodo)
      )
    )
  );

drop policy if exists "rrhh_pagos_nominas_write" on public.rrhh_pagos_nominas;
create policy "rrhh_pagos_nominas_write" on public.rrhh_pagos_nominas
  for all to authenticated
  using (
    public.user_has_empresa_access(empresa_id)
    and public.puede_gestionar_pagos()
    and not public.mes_nominas_confirmado(empresa_id, periodo)
  )
  with check (
    public.user_has_empresa_access(empresa_id)
    and public.puede_gestionar_pagos()
    and not public.mes_nominas_confirmado(empresa_id, periodo)
  );

-- ── 3. Candado duro: ni service-role puede tocar un mes confirmado ───────────
-- Las rutas de volcado/revisión usan service-role (salta RLS), así que el cierre
-- se refuerza con trigger, que sí se aplica siempre.
create or replace function public.rrhh_nominas_bloqueo_mes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_periodo text;
begin
  if tg_op = 'DELETE' then
    v_empresa := old.empresa_id; v_periodo := old.periodo;
  else
    v_empresa := new.empresa_id; v_periodo := new.periodo;
  end if;

  if public.mes_nominas_confirmado(v_empresa, v_periodo) then
    raise exception 'Las nóminas de % ya están confirmadas: no se pueden modificar.', v_periodo
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_rrhh_nominas_bloqueo_mes on public.rrhh_pagos_nominas;
create trigger trg_rrhh_nominas_bloqueo_mes
  before insert or update or delete on public.rrhh_pagos_nominas
  for each row execute function public.rrhh_nominas_bloqueo_mes();

-- ── 4. Congelar también SS e IRPF en `rrhh_pagos` ────────────────────────────
-- Los importes que vienen de la nómina no se editan a mano: para cambiarlos hay
-- que borrar la nómina y volver a subirla. Y con el mes confirmado, nada se toca.
create or replace function public.rrhh_pagos_lock_nomina()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.mes_nominas_confirmado(new.empresa_id, new.periodo) then
    if new.nomina is distinct from old.nomina
       or new.ss_empleado is distinct from old.ss_empleado
       or new.ss_empresa  is distinct from old.ss_empresa
       or new.irpf        is distinct from old.irpf
       or new.total       is distinct from old.total
       or new.pago        is distinct from old.pago
       or new.propina     is distinct from old.propina
       or new.ajuste      is distinct from old.ajuste
       or new.horas_extras is distinct from old.horas_extras
       or new.bonus       is distinct from old.bonus then
      raise exception 'Las nóminas de % ya están confirmadas: la liquidación no se puede modificar.', new.periodo
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rrhh_pagos_lock_nomina on public.rrhh_pagos;
create trigger trg_rrhh_pagos_lock_nomina
  before update on public.rrhh_pagos
  for each row execute function public.rrhh_pagos_lock_nomina();
