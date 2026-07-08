-- Turnos y patrón GERENTE de Alejandro Mojica, repartido entre HABANA y BACANAL.
--
-- Alex trabaja en las DOS empresas. Modelo multi-empresa del proyecto: DOS fichas
-- de empleado espejo (una por empresa), horarios/nóminas AISLADOS por empresa_id.
-- Su jornada (40h/sem) se DIVIDE y se modela como si trabajara por separado en
-- cada empresa: 20h en Bacanal + 20h en Habana. Cada empresa solo ve sus turnos.
--
-- Reparto (verificado a 40h):
--   BACANAL (20h):  Mar 09:00-15:00 · Jue 09:00-15:00 · Vie 19:30-23:30 · Sab 19:30-23:30
--   HABANA  (20h):  Mie 09:00-15:00 · Vie 09:00-15:00 + 23:30-03:30 · Sab 23:30-03:30
-- Las noches de viernes y sábado encadenan: primero Bacanal (hasta 23:30), luego
-- Habana (23:30-03:30). El viernes de Habana es UN turno con DOS tramos
-- (mañana + noche), porque el patrón semanal admite un solo turno_id por día y un
-- turno puede tener varios tramos.
--
-- Idempotente: INSERT con ON CONFLICT DO NOTHING sobre ids fijos.

do $$
declare
  v_hab     uuid := '00000000-0000-0000-0000-000000000001';  -- HABANA
  v_bac     uuid := 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47';  -- BACANAL
  v_emp_hab uuid := 'f52991fa-ffcd-4b2a-9f89-17d9915dff34';  -- Alex ficha HABANA
  v_emp_bac uuid := 'f0a34db6-b267-403e-8fe0-dcfb7ae40912';  -- Alex ficha BACANAL
  v_pat_hab uuid := 'c0000000-0000-0000-0000-0000000000a1';
  v_pat_bac uuid := 'c0000000-0000-0000-0000-0000000000a2';
begin
  -- ── Turnos BACANAL ──────────────────────────────────────────────
  insert into public.rrhh_turnos (id, empresa_id, nombre, codigo, tramos, departamento, familia_id) values
    ('bt-ger-mar',   v_bac, 'GERENTE MARTES',        'GER', '[{"inicio":"09:00","fin":"15:00"}]'::jsonb, 'GERENCIA', 'bt-ger-mar'),
    ('bt-ger-jue',   v_bac, 'GERENTE JUEVES',        'GER', '[{"inicio":"09:00","fin":"15:00"}]'::jsonb, 'GERENCIA', 'bt-ger-jue'),
    ('bt-ger-vie-n', v_bac, 'GERENTE VIERNES NOCHE', 'GER', '[{"inicio":"19:30","fin":"23:30"}]'::jsonb, 'GERENCIA', 'bt-ger-vie-n'),
    ('bt-ger-sab-n', v_bac, 'GERENTE SABADO NOCHE',  'GER', '[{"inicio":"19:30","fin":"23:30"}]'::jsonb, 'GERENCIA', 'bt-ger-sab-n')
  on conflict (id) do nothing;

  -- ── Turnos HABANA ───────────────────────────────────────────────
  -- Viernes = mañana + noche en un solo turno con dos tramos.
  insert into public.rrhh_turnos (id, empresa_id, nombre, codigo, tramos, departamento, familia_id) values
    ('ht-ger-mie', v_hab, 'GERENTE MIERCOLES',    'GER', '[{"inicio":"09:00","fin":"15:00"}]'::jsonb, 'GERENCIA', 'ht-ger-mie'),
    ('ht-ger-vie', v_hab, 'GERENTE VIERNES',      'GER', '[{"inicio":"09:00","fin":"15:00"},{"inicio":"23:30","fin":"03:30"}]'::jsonb, 'GERENCIA', 'ht-ger-vie'),
    ('ht-ger-sab-n', v_hab, 'GERENTE SABADO NOCHE', 'GER', '[{"inicio":"23:30","fin":"03:30"}]'::jsonb, 'GERENCIA', 'ht-ger-sab-n')
  on conflict (id) do nothing;

  -- ── Patrón BACANAL: GERENTE 1 ───────────────────────────────────
  -- [L, M, X, J, V, S, D]
  insert into public.rrhh_patrones (id, empresa_id, nombre, tipo, creado_por_nombre, departamento, activo, es_oficial)
  values (v_pat_bac, v_bac, 'GERENTE 1', 'semanal', 'Ivan Ballesteros', 'GERENCIA', true, true)
  on conflict (id) do nothing;
  insert into public.rrhh_patron_semanas (patron_id, orden, dias)
  values (v_pat_bac, 0, '[null,"bt-ger-mar",null,"bt-ger-jue","bt-ger-vie-n","bt-ger-sab-n",null]'::jsonb)
  on conflict (patron_id, orden) do nothing;
  insert into public.rrhh_patron_empleados (patron_id, empleado_id, asignado_at, vigente_desde)
  values (v_pat_bac, v_emp_bac, now(), '2026-01-01') on conflict do nothing;

  -- ── Patrón HABANA: GERENTE 1 ────────────────────────────────────
  insert into public.rrhh_patrones (id, empresa_id, nombre, tipo, creado_por_nombre, departamento, activo, es_oficial)
  values (v_pat_hab, v_hab, 'GERENTE 1', 'semanal', 'Ivan Ballesteros', 'GERENCIA', true, true)
  on conflict (id) do nothing;
  insert into public.rrhh_patron_semanas (patron_id, orden, dias)
  values (v_pat_hab, 0, '[null,null,"ht-ger-mie",null,"ht-ger-vie","ht-ger-sab-n",null]'::jsonb)
  on conflict (patron_id, orden) do nothing;
  insert into public.rrhh_patron_empleados (patron_id, empleado_id, asignado_at, vigente_desde)
  values (v_pat_hab, v_emp_hab, now(), '2026-01-01') on conflict do nothing;
end $$;
