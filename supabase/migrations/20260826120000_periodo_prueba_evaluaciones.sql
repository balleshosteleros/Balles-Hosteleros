-- ============================================================
-- Periodo de prueba: seguimiento, evaluaciones y decisión final
--
-- Hasta ahora el periodo de prueba solo existía como una duración en
-- `reclutamiento_config` + un aviso único a RRHH. No había forma de saber
-- cuánto le quedaba a cada trabajador, ni de dejar constancia de que se le
-- había validado, ni de decidir su continuidad con un criterio numérico.
--
-- Esta migración añade:
--   1. `empleado_periodo_prueba`      — un periodo por trabajador (fechas, nota, decisión)
--   2. `empleado_prueba_evaluaciones` — los hitos de validación (2 o 3) con nota 0–10
--   3. Config: nº de evaluaciones y nota de corte
--   4. Nivel de points «Pruebas» (orden 0): no devenga points hasta superar el periodo
--
-- Idempotente.
-- ============================================================

-- ─── 1. CONFIG por empresa ───────────────────────────────────
alter table public.reclutamiento_config
  add column if not exists prueba_evaluaciones_num integer not null default 3;
alter table public.reclutamiento_config
  add column if not exists prueba_nota_corte numeric(3,1) not null default 6.0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reclutamiento_config_prueba_eval_num_chk'
  ) then
    alter table public.reclutamiento_config
      add constraint reclutamiento_config_prueba_eval_num_chk
      check (prueba_evaluaciones_num between 1 and 5);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'reclutamiento_config_prueba_nota_corte_chk'
  ) then
    alter table public.reclutamiento_config
      add constraint reclutamiento_config_prueba_nota_corte_chk
      check (prueba_nota_corte >= 0 and prueba_nota_corte <= 10);
  end if;
end $$;

comment on column public.reclutamiento_config.prueba_evaluaciones_num is
  'Número de validaciones que RRHH debe completar durante el periodo de prueba (2 o 3).';
comment on column public.reclutamiento_config.prueba_nota_corte is
  'Nota mínima (0–10) para que el sistema recomiende continuar. Nunca decide solo.';

-- ─── 2. PERIODO DE PRUEBA (uno por trabajador) ───────────────
create table if not exists public.empleado_periodo_prueba (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  empleado_id       uuid references public.empleados(id) on delete cascade,
  candidato_id      uuid references public.candidatos(id) on delete cascade,

  fecha_inicio      date not null,
  duracion_dias     integer not null,
  fecha_fin         date not null,

  -- Media de las evaluaciones completadas (0–10). NULL = aún sin evaluar.
  -- NULL significa «sin dato», nunca 0: un 0 es un suspenso real.
  nota_final        numeric(3,1),
  nota_corte        numeric(3,1) not null default 6.0,

  -- La decide SIEMPRE una persona. El sistema solo recomienda.
  decision          text not null default 'pendiente',
  decidido_por      uuid references auth.users(id),
  decidido_at       timestamptz,
  decision_motivo   text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint empleado_periodo_prueba_decision_chk
    check (decision in ('pendiente','continua','no_continua')),
  constraint empleado_periodo_prueba_nota_chk
    check (nota_final is null or (nota_final >= 0 and nota_final <= 10)),
  constraint empleado_periodo_prueba_duracion_chk
    check (duracion_dias between 1 and 365),
  -- Debe colgar de alguien: empleado o candidato (normalmente ambos).
  constraint empleado_periodo_prueba_sujeto_chk
    check (empleado_id is not null or candidato_id is not null)
);

-- Un solo periodo ABIERTO por empleado (los cerrados quedan como histórico).
create unique index if not exists empleado_periodo_prueba_abierto_uniq
  on public.empleado_periodo_prueba (empleado_id)
  where decision = 'pendiente' and empleado_id is not null;

create unique index if not exists empleado_periodo_prueba_cand_abierto_uniq
  on public.empleado_periodo_prueba (candidato_id)
  where decision = 'pendiente' and candidato_id is not null;

create index if not exists empleado_periodo_prueba_empresa_idx
  on public.empleado_periodo_prueba (empresa_id, decision);
create index if not exists empleado_periodo_prueba_empleado_idx
  on public.empleado_periodo_prueba (empleado_id);
create index if not exists empleado_periodo_prueba_fin_idx
  on public.empleado_periodo_prueba (fecha_fin) where decision = 'pendiente';

comment on table public.empleado_periodo_prueba is
  'Periodo de prueba de un trabajador: fechas, nota final y decisión de continuidad.';

-- ─── 3. EVALUACIONES (los hitos de validación) ───────────────
create table if not exists public.empleado_prueba_evaluaciones (
  id                uuid primary key default gen_random_uuid(),
  periodo_id        uuid not null references public.empleado_periodo_prueba(id) on delete cascade,
  empresa_id        uuid not null references public.empresas(id) on delete cascade,

  -- 1, 2, 3… en orden cronológico dentro del periodo.
  numero            smallint not null,
  fecha_prevista    date not null,

  estado            text not null default 'pendiente',
  -- Nota 0–10 que pone el responsable. NULL mientras esté pendiente.
  nota              numeric(3,1),
  comentario        text,

  evaluado_por      uuid references auth.users(id),
  evaluado_at       timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint empleado_prueba_eval_estado_chk
    check (estado in ('pendiente','completada')),
  constraint empleado_prueba_eval_nota_chk
    check (nota is null or (nota >= 0 and nota <= 10)),
  -- Una evaluación completada SIEMPRE lleva nota: si no, no valida nada.
  constraint empleado_prueba_eval_completada_chk
    check (estado <> 'completada' or nota is not null),
  constraint empleado_prueba_eval_numero_uniq
    unique (periodo_id, numero)
);

create index if not exists empleado_prueba_eval_periodo_idx
  on public.empleado_prueba_evaluaciones (periodo_id, numero);
create index if not exists empleado_prueba_eval_pendientes_idx
  on public.empleado_prueba_evaluaciones (fecha_prevista) where estado = 'pendiente';

comment on table public.empleado_prueba_evaluaciones is
  'Hitos de validación del periodo de prueba. Cada uno con nota 0–10 puesta por el responsable.';

-- ─── 4. Triggers updated_at ──────────────────────────────────
create or replace function public.periodo_prueba_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists empleado_periodo_prueba_touch on public.empleado_periodo_prueba;
create trigger empleado_periodo_prueba_touch
  before update on public.empleado_periodo_prueba
  for each row execute function public.periodo_prueba_touch_updated_at();

drop trigger if exists empleado_prueba_eval_touch on public.empleado_prueba_evaluaciones;
create trigger empleado_prueba_eval_touch
  before update on public.empleado_prueba_evaluaciones
  for each row execute function public.periodo_prueba_touch_updated_at();

-- ─── 5. RLS (helpers canónicos `empresas_del_usuario()` + `puede_gestionar_pagos()`) ───────
alter table public.empleado_periodo_prueba      enable row level security;
alter table public.empleado_prueba_evaluaciones enable row level security;

-- LECTURA del periodo: cualquiera de la empresa (el propio trabajador necesita
-- ver su estado «Pruebas» en points; las notas no se le muestran en la UI).
drop policy if exists "empleado_periodo_prueba_read" on public.empleado_periodo_prueba;
create policy "empleado_periodo_prueba_read" on public.empleado_periodo_prueba
  for select to authenticated
  using (empresa_id in (select public.empresas_del_usuario()));

-- ESCRITURA: solo quien puede gestionar RRHH. El trabajador nunca se autoevalúa.
-- `puede_gestionar_pagos()` = permiso «ver» sobre el módulo RECURSOS HUMANOS.
drop policy if exists "empleado_periodo_prueba_write" on public.empleado_periodo_prueba;
create policy "empleado_periodo_prueba_write" on public.empleado_periodo_prueba
  for all to authenticated
  using (
    empresa_id in (select public.empresas_del_usuario())
    and public.puede_gestionar_pagos()
  )
  with check (empresa_id in (select public.empresas_del_usuario()));

-- LECTURA de evaluaciones: SOLO gestión. Las notas del periodo de prueba no
-- son visibles para el trabajador (decisión de producto: informa sin exponer).
drop policy if exists "empleado_prueba_eval_read" on public.empleado_prueba_evaluaciones;
create policy "empleado_prueba_eval_read" on public.empleado_prueba_evaluaciones
  for select to authenticated
  using (
    empresa_id in (select public.empresas_del_usuario())
    and public.puede_gestionar_pagos()
  );

drop policy if exists "empleado_prueba_eval_write" on public.empleado_prueba_evaluaciones;
create policy "empleado_prueba_eval_write" on public.empleado_prueba_evaluaciones
  for all to authenticated
  using (
    empresa_id in (select public.empresas_del_usuario())
    and public.puede_gestionar_pagos()
  )
  with check (empresa_id in (select public.empresas_del_usuario()));

-- ─── 6. Nivel de points «Pruebas» (orden 0) ──────────────────
-- Estado previo a Aprendiz: el trabajador en periodo de prueba aparece aquí y
-- NO devenga points. Al superar el periodo entra en Aprendiz y empieza a jugar.
-- Gris neutro a propósito: no es un logro, es una antesala.
--
-- `toques_min = -1` es deliberado: NO se alcanza acumulando puntos (nadie tiene
-- -1), sino por estar en periodo de prueba abierto. Si fuese 0 empataría con
-- Aprendiz y el cálculo «último nivel cuyo mínimo alcanzo» nunca lo mostraría.
insert into public.toques_niveles (empresa_id, orden, nombre, toques_min, badge_color, badge_icon)
select e.id, 0::smallint, 'Pruebas', -1, '#94a3b8', 'Hourglass'
from public.empresas e
on conflict (empresa_id, orden) do nothing;

comment on table public.toques_niveles is
  'Niveles de progresión por empresa. El orden 0 («Pruebas») es la antesala: no devenga points.';
