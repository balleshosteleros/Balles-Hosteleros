-- Reclutamiento · una sola vacante por puesto, sin las numeradas.
--
-- Los puestos numerados (JEFE DE SALA 1 · 2 · 3, CAMAREROS 1 · 2, JEFE DE COCINA
-- 1 · 2) son versiones del MISMO puesto —plazas distintas de lo mismo—, así que
-- comparten una única oferta: «JEFE DE SALA», «CAMAREROS», «JEFE DE COCINA».
-- La creación automática de vacantes por puesto las había duplicado con número.
--
-- 1) Los candidatos de una vacante numerada pasan a su vacante base.
-- 2) Se borran las vacantes numeradas que tienen base (nunca las que no la
--    tienen: esas se quedan, para no dejar candidatos huérfanos).
-- Idempotente: si ya no quedan vacantes numeradas, ambos pasos no tocan nada.

WITH numeradas AS (
  SELECT v.id, v.empresa_id,
         upper(btrim(regexp_replace(v.titulo, '\s+[0-9]+$', ''))) AS base
  FROM public.vacantes v
  WHERE v.titulo ~ '\s+[0-9]+$'
),
pares AS (
  SELECT n.id AS numerada, b.id AS base
  FROM numeradas n
  JOIN public.vacantes b
    ON b.empresa_id = n.empresa_id
   AND upper(btrim(b.titulo)) = n.base
)
UPDATE public.candidatos c
SET vacante_id = p.base
FROM pares p
WHERE c.vacante_id = p.numerada;

WITH numeradas AS (
  SELECT v.id, v.empresa_id,
         upper(btrim(regexp_replace(v.titulo, '\s+[0-9]+$', ''))) AS base
  FROM public.vacantes v
  WHERE v.titulo ~ '\s+[0-9]+$'
)
DELETE FROM public.vacantes v
USING numeradas n
WHERE v.id = n.id
  AND EXISTS (
    SELECT 1 FROM public.vacantes b
    WHERE b.empresa_id = n.empresa_id
      AND upper(btrim(b.titulo)) = n.base
  );
