-- Fix: el trigger de catálogos de logística impedía crear empresas nuevas
--
-- PROBLEMA
-- `seed_catalogos_logistica_empresa()` (disparada por el trigger
-- empresas_seed_catalogos_logistica en el INSERT de `empresas`) escribía en
-- tres tablas que YA NO EXISTEN:
--     unidades_medida  → renombrada a `medidas`
--     formatos_medida  → renombrada a `formatos`
--     preparaciones    → eliminada
-- El trigger corre dentro de la transacción del INSERT, así que reventaba con
--     42P01: relation "public.unidades_medida" does not exist
-- y tumbaba el alta de empresa entera: hoy NO se puede crear ninguna empresa.
--
-- Además sus datos estaban obsoletos frente al modelo actual: los catálogos ahora
-- llevan columna `tipo` NOT NULL (compra/venta/elaboracion) y son independientes
-- por tipo, y los formatos reales son un listado curado, no una serie 1..100.
--
-- SOLUCIÓN
-- La siembra de estos catálogos pasa a los seeds canónicos en TypeScript
-- (src/lib/seeds/catalogos-logistica.ts + syncCatalogosLogisticaAEmpresa en
-- src/lib/seeds/sync.ts), que ya es donde viven los otros pilares y desde donde
-- `createEmpresa()` llama a seedEmpresaDefaults(). Así queda en un único sitio,
-- versionado en git y propagable a todas las empresas con syncSeedsToAllEmpresas().
--
-- Se elimina el trigger y la función obsoleta. No se toca ningún dato existente.
-- Idempotente.

drop trigger if exists empresas_seed_catalogos_logistica on public.empresas;
drop function if exists public.tg_seed_catalogos_logistica();
drop function if exists public.seed_catalogos_logistica_empresa(uuid);
