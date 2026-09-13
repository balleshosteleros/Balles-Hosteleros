-- Condiciones y horario reales del DIRECTOR (Iván Ballesteros) en las dos
-- sociedades donde tiene ficha.
--
-- Reparto acordado (13-09-2026):
--   • BACANAL  L–V de 06:00 a 10:00  → 20 h/semana, 1.000 € brutos/mes
--   • HABANA   L–V de 10:00 a 14:00  → 20 h/semana, 1.000 € brutos/mes
--   • Sábado y domingo libres en ambas (2 días libres)
--   • Alta: 01-05-2022 en BACANAL y 01-05-2020 en HABANA
--
-- La jornada queda «Parcial» en CADA sociedad porque son 20 h en cada una: el
-- umbral de completa (40 h, convenio de Hostelería de Madrid) se mide por
-- contrato, que es lo que ve la gestoría. Las 40 h totales son la suma de dos
-- contratos, no una jornada completa en ninguno de los dos.
--
-- Las vacaciones no se tocan aquí: los 30 días/año ya están configurados por
-- empresa (Ajustes → Calendario). Antes salían 15 porque se prorrateaban desde
-- un alta de julio de 2026; con el alta real se devengan enteros.
--
-- Idempotente: se puede reaplicar sin duplicar nada.

-- ─── 1. Turnos del director ───────────────────────────────────────────────
insert into rrhh_turnos
  (id, empresa_id, nombre, codigo, tramos, dias, tipo_jornada,
   familia_id, version, es_oficial, activo, departamento, vigente_desde)
values
  ('bt-dir-manana', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'DIRECTOR MAÑANA', 'DIR-M',
   '[{"inicio":"06:00","fin":"10:00"}]'::jsonb, '{}'::text[], 'fijo',
   'bt-dir-manana', 1, true, true, 'DIRECCIÓN', '2022-05-01'),
  ('ht-dir-mediodia', '00000000-0000-0000-0000-000000000001',
   'DIRECTOR MEDIODÍA', 'DIR-MD',
   '[{"inicio":"10:00","fin":"14:00"}]'::jsonb, '{}'::text[], 'fijo',
   'ht-dir-mediodia', 1, true, true, 'DIRECCIÓN', '2020-05-01')
on conflict (id) do update
  set nombre        = excluded.nombre,
      codigo        = excluded.codigo,
      tramos        = excluded.tramos,
      tipo_jornada  = excluded.tipo_jornada,
      activo        = true,
      departamento  = excluded.departamento,
      vigente_desde = excluded.vigente_desde,
      vigente_hasta = null,
      updated_at    = now();

-- ─── 2. Patrones semanales: L–V con turno, fin de semana libre ────────────
-- Los dos días sin turno del patrón son los días LIBRES. Es el patrón lo que
-- convierte «no tiene nada puesto» en «libra»: sin patrón asignado el horario
-- no existe, no es que libre toda la semana.
insert into rrhh_patrones
  (id, empresa_id, nombre, tipo, tipo_jornada, familia_id, version, es_oficial,
   activo, departamento, puesto_id, creado_por_user_id, creado_por_nombre,
   vigente_desde)
values
  ('d1000000-0000-0000-0000-000000000001', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'DIRECTOR', 'semanal', 'fijo',
   'd1000000-0000-0000-0000-000000000001', 1, true, true, 'DIRECCIÓN',
   'e1873789-a8e8-4415-ae3c-4baebd741a81',
   '59c496f2-9bc8-4a0b-9004-c3b2770d8982', 'Iván Ballesteros', '2022-05-01'),
  ('d1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'DIRECTOR', 'semanal', 'fijo',
   'd1000000-0000-0000-0000-000000000002', 1, true, true, 'DIRECCIÓN',
   '3e09df9f-823c-4c6a-b03b-21a7bfb56e55',
   '59c496f2-9bc8-4a0b-9004-c3b2770d8982', 'Iván Ballesteros', '2020-05-01')
on conflict (id) do update
  set nombre        = excluded.nombre,
      activo        = true,
      departamento  = excluded.departamento,
      puesto_id     = excluded.puesto_id,
      vigente_desde = excluded.vigente_desde,
      vigente_hasta = null,
      updated_at    = now();

-- Semana única del ciclo: lunes a viernes trabajando, sábado y domingo libres.
delete from rrhh_patron_semanas
 where patron_id in ('d1000000-0000-0000-0000-000000000001',
                     'd1000000-0000-0000-0000-000000000002');

insert into rrhh_patron_semanas (patron_id, orden, dias)
values
  ('d1000000-0000-0000-0000-000000000001', 0,
   '["bt-dir-manana","bt-dir-manana","bt-dir-manana","bt-dir-manana","bt-dir-manana",null,null]'::jsonb),
  ('d1000000-0000-0000-0000-000000000002', 0,
   '["ht-dir-mediodia","ht-dir-mediodia","ht-dir-mediodia","ht-dir-mediodia","ht-dir-mediodia",null,null]'::jsonb);

-- ─── 3. El patrón, asignado a su ficha de cada sociedad ───────────────────
insert into rrhh_patron_empleados
  (patron_id, empleado_id, asignado_por_user_id, vigente_desde)
values
  ('d1000000-0000-0000-0000-000000000001', 'e2dff389-b0b5-435e-8b7f-77da71a64265',
   '59c496f2-9bc8-4a0b-9004-c3b2770d8982', '2022-05-01'),
  ('d1000000-0000-0000-0000-000000000002', '69da9df0-1b2f-41cb-bc9f-4a9e58d22b50',
   '59c496f2-9bc8-4a0b-9004-c3b2770d8982', '2020-05-01')
on conflict (patron_id, empleado_id) do update
  set vigente_desde = excluded.vigente_desde,
      vigente_hasta = null;

-- ─── 4. Fecha de alta y jornada de cada ficha ─────────────────────────────
update empleados
   set fecha_alta   = '2022-05-01',
       tipo_jornada = 'Parcial'
 where id = 'e2dff389-b0b5-435e-8b7f-77da71a64265';

update empleados
   set fecha_alta   = '2020-05-01',
       tipo_jornada = 'Parcial'
 where id = '69da9df0-1b2f-41cb-bc9f-4a9e58d22b50';

-- ─── 5. Condiciones pactadas (la única fuente del salario) ────────────────
-- BACANAL: ya tenía fila vigente, se actualiza.
update empleado_condiciones
   set salario_bruto    = 1000,
       modo_pago        = 'MENSUAL',
       coste_hora       = round(1000 / (20 * 52 / 12.0), 4),  -- 11,5385 €/h
       jornada_contrato = 'Parcial',
       horas_semanales  = 20,
       dias_libres      = 2,
       vacaciones       = '30 días',
       primer_dia       = '2022-05-01',
       vigente_desde    = '2022-05-01',
       updated_at       = now()
 where empleado_id = 'e2dff389-b0b5-435e-8b7f-77da71a64265'
   and vigente_hasta is null;

-- HABANA: no tenía ninguna. Su pantalla decía «falta por publicar».
insert into empleado_condiciones
  (empleado_id, empresa_id, puesto_id, puesto_nombre, nivel,
   salario_bruto, modo_pago, coste_hora, jornada_contrato, horas_semanales,
   dias_libres, vacaciones, primer_dia, vigente_desde, motivo)
select '69da9df0-1b2f-41cb-bc9f-4a9e58d22b50',
       '00000000-0000-0000-0000-000000000001',
       '3e09df9f-823c-4c6a-b03b-21a7bfb56e55', 'DIRECTOR', 1,
       1000, 'MENSUAL', round(1000 / (20 * 52 / 12.0), 4), 'Parcial', 20,
       2, '30 días', '2020-05-01', '2020-05-01', 'alta'
 where not exists (
   select 1 from empleado_condiciones
    where empleado_id = '69da9df0-1b2f-41cb-bc9f-4a9e58d22b50'
      and vigente_hasta is null
 );

update empleado_condiciones
   set salario_bruto    = 1000,
       modo_pago        = 'MENSUAL',
       coste_hora       = round(1000 / (20 * 52 / 12.0), 4),
       jornada_contrato = 'Parcial',
       horas_semanales  = 20,
       dias_libres      = 2,
       vacaciones       = '30 días',
       primer_dia       = '2020-05-01',
       vigente_desde    = '2020-05-01',
       updated_at       = now()
 where empleado_id = '69da9df0-1b2f-41cb-bc9f-4a9e58d22b50'
   and vigente_hasta is null;
