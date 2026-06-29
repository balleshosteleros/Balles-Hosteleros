-- Comprobación de candidaturas duplicadas por email O teléfono en TODA la empresa.
--
-- Regla de negocio: un mismo candidato (identificado por su email o su teléfono)
-- solo puede tener UNA candidatura en la empresa, en cualquier vacante. Si el
-- email o el teléfono ya están registrados en otra candidatura de la misma
-- empresa, se rechaza la nueva y se avisa del motivo al candidato.
--
-- El teléfono se compara NORMALIZADO (solo dígitos, sin prefijos +34 / 0034 /
-- espacios / guiones) para que «+34 600 11 22 33», «600112233» y «0034600112233»
-- cuenten como el mismo número. Se comparan los últimos 9 dígitos (longitud de un
-- móvil español) para tolerar prefijos internacionales escritos de formas distintas.
--
-- Devuelve qué campo colisiona ('email', 'telefono' o ambos) para que la UI
-- pueda señalar en rojo el campo concreto. SECURITY DEFINER: la usa el portal
-- público (service role) y no necesita exponer la tabla candidatos vía RLS.

CREATE OR REPLACE FUNCTION public.candidato_duplicado_check(
  p_empresa_id UUID,
  p_email      TEXT DEFAULT NULL,
  p_telefono   TEXT DEFAULT NULL
)
RETURNS TABLE (email_existe BOOLEAN, telefono_existe BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH norm AS (
    SELECT
      lower(trim(coalesce(p_email, '')))                                   AS email_norm,
      right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 9)    AS tel_norm
  )
  SELECT
    -- email: coincidencia exacta (case-insensitive), solo si se pasó email
    (norm.email_norm <> '' AND EXISTS (
       SELECT 1 FROM public.candidatos c
       WHERE c.empresa_id = p_empresa_id
         AND lower(trim(c.email)) = norm.email_norm
    )) AS email_existe,
    -- teléfono: coincidencia por últimos 9 dígitos, solo si hay ≥9 dígitos
    (length(norm.tel_norm) = 9 AND EXISTS (
       SELECT 1 FROM public.candidatos c
       WHERE c.empresa_id = p_empresa_id
         AND right(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g'), 9) = norm.tel_norm
    )) AS telefono_existe
  FROM norm;
$$;

COMMENT ON FUNCTION public.candidato_duplicado_check(UUID, TEXT, TEXT) IS
  'Indica si un email o teléfono ya están registrados en alguna candidatura de la empresa (one-candidate-per-company). Teléfono comparado por sus últimos 9 dígitos normalizados.';

GRANT EXECUTE ON FUNCTION public.candidato_duplicado_check(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
