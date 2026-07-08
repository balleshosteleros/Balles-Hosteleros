-- Patrones de horario nombrados como el PUESTO (Bacanal).
--
-- Los patrones semanales de Bacanal se sembraron con nombres de "rol de turno"
-- (JEFE COCINA 1, ARTISTA 1, MANTENIMIENTO, LIMPIEZA/OFFICE...). El criterio
-- acordado es que el patrón se llame IGUAL QUE EL PUESTO del empleado, numerado
-- cuando varios empleados comparten puesto pero tienen combinaciones de turnos
-- distintas (p.ej. 2 jefes de cocina con semanas diferentes -> ...1 y ...2).
--
-- Esta migración deja en el repo lo que ya se aplicó en producción:
--   1. Corrige el puesto de Eduardo Charro (era JEFE DE COCINA; es COCINERO).
--   2. Normaliza empleados.puesto (guardaba el DEPARTAMENTO "COCINA"/"SALA" en
--      lugar del puesto real).
--   3. Renombra los patrones existentes al nombre del puesto + número.
--   4. Crea los patrones administrativos que faltaban (CONTABLE 1, CALIDAD 1) a
--      partir de los turnos que esos empleados YA tenían asignados en el horario.
--
-- NO incluye el alta del empleado Borja Garrido ni su usuario de acceso: las
-- cuentas de auth.users no se versionan como migración (se crean vía la API de
-- Auth / alta de RRHH). El patrón JEFE DE COCINA 1 ya existía y aquí solo se
-- renombra; su asignación a Borja vive como dato, no como migración.
--
-- Idempotente: los UPDATE son por id fijo; los INSERT de patrón nuevo usan
-- ON CONFLICT DO NOTHING sobre id determinista. Re-ejecutable sin error.

do $$
declare
  v_empresa   uuid := 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47';  -- BACANAL
  v_cocinero  uuid := '373fe082-4258-4cd3-8594-7e2b90c8a854';  -- puesto COCINEROS
  -- ids de los patrones administrativos nuevos (los ya creados en producción)
  v_contable  uuid := 'bd024b52-41a0-417c-b269-7a98fa2863ec';
  v_calidad   uuid := 'f1656bb3-f463-49de-a9d0-1dd31f11d22c';
begin
  -- 1) Eduardo Charro -> COCINERO (no es jefe de cocina)
  update public.empleado_puestos
    set puesto_id = v_cocinero, puesto_nombre = 'COCINERO'
    where empleado_id = 'a3b3d76f-658b-41e1-a1c5-e14c8c842428' and es_principal;
  update public.empleados
    set puesto = 'COCINERO'
    where id = 'a3b3d76f-658b-41e1-a1c5-e14c8c842428';

  -- 2) Normalizar empleados.puesto (guardaba el DEPARTAMENTO, no el puesto real)
  update public.empleados set puesto = 'JEFE DE COCINA'
    where id = 'ea55f352-e2d9-4373-806f-0a658a14ea73';                  -- Farid
  update public.empleados set puesto = 'JEFE DE SALA'
    where id in ('4253c611-77a2-4034-afa8-1984a6b38731',               -- David Kenny
                 '050e3c4c-0b43-46ef-ba9d-f6a2d0db44f6',               -- Ezequiel
                 'dc466218-782d-4401-badc-b2c25c443ee1');              -- Marcos

  -- 3) Renombrar patrones existentes al nombre del puesto (+ número)
  update public.rrhh_patrones set nombre = 'JEFE DE COCINA 1' where id = 'a0000000-0000-0000-0000-00000000000f';
  update public.rrhh_patrones set nombre = 'JEFE DE COCINA 2' where id = 'a0000000-0000-0000-0000-000000000010';
  update public.rrhh_patrones set nombre = 'COCINERO 1'       where id = '8bcfb7de-b6d4-40c9-9f38-d120374fb188';
  update public.rrhh_patrones set nombre = 'MUSICO 1'         where id = 'a0000000-0000-0000-0000-000000000001';
  update public.rrhh_patrones set nombre = 'CANTANTE 1'       where id = 'a0000000-0000-0000-0000-000000000002';
  update public.rrhh_patrones set nombre = 'TECNICO 1'        where id = 'a0000000-0000-0000-0000-00000000000d';
  update public.rrhh_patrones set nombre = 'LIMPIEZA 1'       where id = 'a0000000-0000-0000-0000-00000000000c';
  -- JEFE DE SALA 1/2/3 ya tenían el nombre correcto.

  -- 4) Patrones administrativos nuevos, construidos con los turnos que ya tenían
  --    en el horario. Índices del array: [L, M, X, J, V, S, D].

  -- CONTABLE 1 (Javier Mora): L-V con el turno CONTABILIDAD (bt-con).
  insert into public.rrhh_patrones (id, empresa_id, nombre, tipo, creado_por_nombre, departamento, activo, es_oficial)
  values (v_contable, v_empresa, 'CONTABLE 1', 'semanal', 'Ivan Ballesteros', 'CONTABILIDAD', true, true)
  on conflict (id) do nothing;
  insert into public.rrhh_patron_semanas (patron_id, orden, dias)
  values (v_contable, 0, '["bt-con","bt-con","bt-con","bt-con","bt-con",null,null]'::jsonb)
  on conflict (patron_id, orden) do nothing;
  insert into public.rrhh_patron_empleados (patron_id, empleado_id, asignado_at, vigente_desde)
  values (v_contable, '3d8725dd-358c-4cc4-88bf-98449ba4678a', now(), '2026-01-01')
  on conflict do nothing;

  -- CALIDAD 1 (Sofía Terrón): solo Lunes con el turno CALIDAD (bt-cal).
  insert into public.rrhh_patrones (id, empresa_id, nombre, tipo, creado_por_nombre, departamento, activo, es_oficial)
  values (v_calidad, v_empresa, 'CALIDAD 1', 'semanal', 'Ivan Ballesteros', 'CALIDAD', true, true)
  on conflict (id) do nothing;
  insert into public.rrhh_patron_semanas (patron_id, orden, dias)
  values (v_calidad, 0, '["bt-cal",null,null,null,null,null,null]'::jsonb)
  on conflict (patron_id, orden) do nothing;
  insert into public.rrhh_patron_empleados (patron_id, empleado_id, asignado_at, vigente_desde)
  values (v_calidad, '65d193e2-28dc-43f4-b93a-4be069632c39', now(), '2026-01-01')
  on conflict do nothing;
end $$;
