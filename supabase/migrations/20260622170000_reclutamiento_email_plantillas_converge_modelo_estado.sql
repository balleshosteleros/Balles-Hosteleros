-- Reconciliación: deja `reclutamiento_email_plantillas` en el modelo
-- "1 fila por empresa×estado" (el que usan tanto el sync como las acciones de
-- `reclutamiento-email-plantillas-actions.ts`).
--
-- La migración 20260622140000 había añadido `nombre` NOT NULL, hecho `estado`
-- nullable y quitado el UNIQUE como una dirección anterior ya descartada. Esos
-- restos rompían los inserts del sync (que no aportan `nombre`).

-- 1) `nombre` es vestigial y, al ser NOT NULL, rompía los inserts del sync.
ALTER TABLE public.reclutamiento_email_plantillas
  DROP COLUMN IF EXISTS nombre;

-- 2) `estado` vuelve a ser la clave del modelo.
UPDATE public.reclutamiento_email_plantillas SET estado = 'nuevo' WHERE estado IS NULL;
ALTER TABLE public.reclutamiento_email_plantillas
  ALTER COLUMN estado SET NOT NULL;

-- 3) Restaura la unicidad por (empresa_id, estado) que usan los upsert.
ALTER TABLE public.reclutamiento_email_plantillas
  DROP CONSTRAINT IF EXISTS reclutamiento_email_plantillas_unq;
ALTER TABLE public.reclutamiento_email_plantillas
  ADD CONSTRAINT reclutamiento_email_plantillas_unq UNIQUE (empresa_id, estado);
