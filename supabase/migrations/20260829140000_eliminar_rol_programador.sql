-- El rol PROGRAMADOR no debe existir.
--
-- Era un rol del catalogo del software (src/lib/seeds/roles.ts) pensado para
-- colaboradores de desarrollo. Solo llego a crearse en BALLES HOSTELEROS porque
-- esa empresa se dio de alta el 28-ago-2026, cuando el catalogo ya lo incluia;
-- HABANA y BACANAL son anteriores y nunca lo tuvieron.
--
-- Verificado antes de borrar: 0 usuarios con ese rol_id, 0 con ese rol_label,
-- 0 referencias en cierres_config.rol_excepcion_id y en
-- empresa_role_departamentos.rol_id.
--
-- Tambien se elimina del catalogo en src/lib/seeds/roles.ts para que no vuelva
-- a aparecer en empresas nuevas.
--
-- Idempotente.

delete from public.empresa_roles
where upper(trim(nombre)) = 'PROGRAMADOR';
