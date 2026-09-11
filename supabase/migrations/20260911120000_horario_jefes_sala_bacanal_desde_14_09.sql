-- Horario nuevo de los jefes de sala de BACANAL, vigente desde el lunes 14-09-2026.
-- El horario antiguo NO se modifica: se cierra con vigente_hasta = 13-09-2026 y
-- deja de ser la version oficial de su familia. Queda como version 1, historico.
-- Idempotente.

-- 1. Turnos nuevos (familias nuevas, no tocan los turnos existentes)
insert into rrhh_turnos
  (id, empresa_id, nombre, codigo, tramos, activo, departamento,
   familia_id, version, es_oficial, vigente_desde, tipo_jornada, flex_modo)
values
  ('bt-js-mediodia', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'JEFE DE SALA MEDIODIA', 'JSM',
   '[{"inicio":"12:30","fin":"17:00"}]'::jsonb,
   true, 'SALA', 'bt-js-mediodia', 1, true, '2026-09-14', 'fijo', 'diario'),

  ('bt-js-noche', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'JEFE DE SALA NOCHE', 'JSN',
   '[{"inicio":"19:30","fin":"00:00"}]'::jsonb,
   true, 'SALA', 'bt-js-noche', 1, true, '2026-09-14', 'fijo', 'diario'),

  ('bt-js-partido', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'JEFE DE SALA PARTIDO', 'JSP',
   '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"00:00"}]'::jsonb,
   true, 'SALA', 'bt-js-partido', 1, true, '2026-09-14', 'fijo', 'diario'),

  ('bt-js-partido-corto', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'JEFE DE SALA PARTIDO ENTRE SEMANA', 'JSPC',
   '[{"inicio":"12:30","fin":"17:00"},{"inicio":"19:30","fin":"23:30"}]'::jsonb,
   true, 'SALA', 'bt-js-partido-corto', 1, true, '2026-09-14', 'fijo', 'diario'),

  ('bt-js2-partido-fs', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'JEFE DE SALA 2 PARTIDO FIN DE SEMANA', 'JS2F',
   '[{"inicio":"12:30","fin":"17:00"},{"inicio":"20:00","fin":"00:30"}]'::jsonb,
   true, 'SALA', 'bt-js2-partido-fs', 1, true, '2026-09-14', 'fijo', 'diario'),

  ('bt-js3-noche-fs', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'JEFE DE SALA 3 NOCHE FIN DE SEMANA', 'JS3N',
   '[{"inicio":"20:30","fin":"23:30"}]'::jsonb,
   true, 'SALA', 'bt-js3-noche-fs', 1, true, '2026-09-14', 'fijo', 'diario')
on conflict (id) do update
  set nombre = excluded.nombre,
      codigo = excluded.codigo,
      tramos = excluded.tramos,
      activo = true,
      vigente_desde = excluded.vigente_desde,
      updated_at = now();

-- 2. Cerrar los patrones antiguos: siguen igual, pero con fecha de fin y sin ser los oficiales
update rrhh_patrones
   set vigente_hasta = '2026-09-13',
       es_oficial = false,
       updated_at = now()
 where id in ('a0000000-0000-0000-0000-000000000009',
              'a0000000-0000-0000-0000-00000000000a',
              'a0000000-0000-0000-0000-00000000000b');

-- 3. Patrones nuevos (version 2 de la misma familia)
insert into rrhh_patrones
  (id, empresa_id, nombre, tipo, creado_por_nombre, activo,
   vigente_desde, vigente_hasta, tipo_jornada, familia_id, version, es_oficial, departamento)
values
  ('a0000000-0000-0000-0000-000000000209', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'JEFE DE SALA 1', 'semanal', 'Ivan Ballesteros', true,
   '2026-09-14', null, 'fijo', 'a0000000-0000-0000-0000-000000000009', 2, true, 'SALA'),

  ('a0000000-0000-0000-0000-00000000020a', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'JEFE DE SALA 2', 'semanal', 'Ivan Ballesteros', true,
   '2026-09-14', null, 'fijo', 'a0000000-0000-0000-0000-00000000000a', 2, true, 'SALA'),

  ('a0000000-0000-0000-0000-00000000020b', 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
   'JEFE DE SALA 3', 'semanal', 'Ivan Ballesteros', true,
   '2026-09-14', null, 'fijo', 'a0000000-0000-0000-0000-00000000000b', 2, true, 'SALA')
on conflict (id) do update
  set vigente_desde = excluded.vigente_desde,
      es_oficial = true,
      activo = true,
      updated_at = now();

-- 4. La semana de cada patron nuevo (lunes -> domingo)
insert into rrhh_patron_semanas (patron_id, orden, dias)
select v.patron_id, 0, v.dias
  from (values
    ('a0000000-0000-0000-0000-000000000209'::uuid,
     '["bt-js-mediodia", null, "bt-js-partido-corto", "bt-js-mediodia", "bt-js-partido", "bt-js-partido", "bt-js-mediodia"]'::jsonb),
    ('a0000000-0000-0000-0000-00000000020a'::uuid,
     '["bt-js-noche", "bt-js-partido-corto", null, "bt-js-noche", "bt-js2-partido-fs", "bt-js2-partido-fs", "bt-js-noche"]'::jsonb),
    ('a0000000-0000-0000-0000-00000000020b'::uuid,
     '[null, null, null, null, "bt-js3-noche-fs", "bt-js3-noche-fs", null]'::jsonb)
  ) as v(patron_id, dias)
 where not exists (
   select 1 from rrhh_patron_semanas s where s.patron_id = v.patron_id and s.orden = 0
 );

update rrhh_patron_semanas s
   set dias = v.dias
  from (values
    ('a0000000-0000-0000-0000-000000000209'::uuid,
     '["bt-js-mediodia", null, "bt-js-partido-corto", "bt-js-mediodia", "bt-js-partido", "bt-js-partido", "bt-js-mediodia"]'::jsonb),
    ('a0000000-0000-0000-0000-00000000020a'::uuid,
     '["bt-js-noche", "bt-js-partido-corto", null, "bt-js-noche", "bt-js2-partido-fs", "bt-js2-partido-fs", "bt-js-noche"]'::jsonb),
    ('a0000000-0000-0000-0000-00000000020b'::uuid,
     '[null, null, null, null, "bt-js3-noche-fs", "bt-js3-noche-fs", null]'::jsonb)
  ) as v(patron_id, dias)
 where s.patron_id = v.patron_id and s.orden = 0;

-- 5. Cerrar la asignacion antigua de cada empleado el domingo 13
update rrhh_patron_empleados
   set vigente_hasta = '2026-09-13'
 where (patron_id, empleado_id) in (
   ('a0000000-0000-0000-0000-000000000009'::uuid, '050e3c4c-0b43-46ef-ba9d-f6a2d0db44f6'::uuid),
   ('a0000000-0000-0000-0000-00000000000a'::uuid, '4253c611-77a2-4034-afa8-1984a6b38731'::uuid),
   ('a0000000-0000-0000-0000-00000000000b'::uuid, 'dc466218-782d-4401-badc-b2c25c443ee1'::uuid)
 );

-- 6. Asignar el horario nuevo desde el lunes 14
insert into rrhh_patron_empleados (patron_id, empleado_id, vigente_desde, vigente_hasta)
values
  ('a0000000-0000-0000-0000-000000000209', '050e3c4c-0b43-46ef-ba9d-f6a2d0db44f6', '2026-09-14', null),
  ('a0000000-0000-0000-0000-00000000020a', '4253c611-77a2-4034-afa8-1984a6b38731', '2026-09-14', null),
  ('a0000000-0000-0000-0000-00000000020b', 'dc466218-782d-4401-badc-b2c25c443ee1', '2026-09-14', null)
on conflict (patron_id, empleado_id) do update
  set vigente_desde = excluded.vigente_desde,
      vigente_hasta = null;
