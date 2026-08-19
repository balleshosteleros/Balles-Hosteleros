-- ═══════════════════════════════════════════════════════════════════════════
-- Ajustes sobre el canal de denuncias.
--
-- Este fichero recoge dos cambios que se aplicaron sueltos y no tenían aún su
-- migración en el repo, para que un reseteo desde cero deje la base igual que
-- producción.
--
--   1. Se retiran las categorías "acoso_sexual" y "acoso_razon_sexo": el acoso
--      se comunica bajo "acoso_laboral" (encargo de Iván).
--   2. Se retira `igualdad_confirmaciones`. El apartado de Igualdad era un
--      módulo entero para algo de uso mínimo; lo que hacía falta era un tipo
--      más de solicitud (quejas, con sus categorías) y eso ya está cubierto
--      por `denuncias`. La tabla estaba vacía.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.denuncias DROP CONSTRAINT IF EXISTS denuncias_categoria_chk;

ALTER TABLE public.denuncias
  ADD CONSTRAINT denuncias_categoria_chk
  CHECK (categoria IN ('acoso_laboral', 'discriminacion', 'seguridad_salud',
                       'irregularidad', 'trato_cliente', 'queja_general', 'otro'));

DROP TABLE IF EXISTS public.igualdad_confirmaciones;
