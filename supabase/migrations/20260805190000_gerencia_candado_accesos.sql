-- PRP-075 — Conceder al rol GERENCIA el candado de Accesos (escudo 1).
--
-- Autorizado por Ivan (2026-08-05). Aplicado ya a produccion; esta migracion
-- deja el cambio versionado y reproducible en cualquier entorno.
--
-- ESCUDO 1 (este cambio): GERENCIA puede ENTRAR al modulo de accesos.
-- ESCUDO 2 (ya en los datos): dentro, solo vera los accesos donde su rol este
--   marcado. En produccion: 9 de 77 en BACANAL y 7 de 68 en HABANA.
--
-- ver=true / editar=false a proposito: quien puede editar un acceso podria
-- marcarse a si mismo entre los roles autorizados y saltarse el escudo 2.
-- Gerencia consulta; direccion administra.
--
-- Idempotente: el NOT EXISTS evita duplicar el permiso si ya se aplico.

update empresa_roles
set permisos = coalesce(permisos, '[]'::jsonb)
               || jsonb_build_array(
                    jsonb_build_object('modulo', 'HERR_ACCESOS', 'ver', true, 'editar', false)
                  ),
    updated_at = now()
where upper(trim(nombre)) = 'GERENCIA'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(permisos, '[]'::jsonb)) p
    where p->>'modulo' = 'HERR_ACCESOS'
  );
