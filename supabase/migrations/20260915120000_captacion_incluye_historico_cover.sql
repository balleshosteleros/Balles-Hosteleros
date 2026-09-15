-- Captación tiene que enseñar TODO el histórico, también el anterior al software.
--
-- La pantalla contaba solo la tabla `reservas`, que arranca en septiembre de
-- 2022 —cuando empezó a usarse este sistema—. Lo de antes existe: son las filas
-- de `cliente_visitas` que llegaron de CoverManager y que nunca tuvieron reserva
-- aquí (`reserva_id IS NULL`). Faltaban 1.778 servicios de HABANA de 2021,
-- 2.087 de 2022, y 538 de BACANAL.
--
-- No hay riesgo de contar dos veces: las huérfanas caen justo en los meses en
-- los que no hay ni una sola reserva (julio de 2021 a agosto de 2022), y de
-- septiembre de 2022 en adelante lo migrado quedó enlazado a su reserva y por
-- tanto queda fuera de este añadido.
--
-- Lo que sí hace falta es traducir: CoverManager escribía el canal en su propio
-- vocabulario ("moduloweb", "terceros", "software") y el estado en texto libre
-- ("Cancelado por el cliente", "No show"). El diccionario es el mismo que se
-- aplicó al importar las reservas, comprobado sobre las 25.000 visitas que sí
-- quedaron enlazadas.

-- ── El diccionario, en un solo sitio ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.bh_origen_cover(p_origen text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(coalesce(p_origen, '')))
    WHEN 'moduloweb'   THEN 'WEB'
    WHEN 'web'         THEN 'WEB'
    WHEN 'appmovil'    THEN 'WEB'
    WHEN 'app-movil'   THEN 'WEB'
    -- OJO: 'terceros' NO es Google. Era el cajón de Cover para todo lo que
    -- entraba por un portal de fuera; al reconstruir los canales con el
    -- prescriptor se vio que dentro había Instagram (276) y Facebook (34)
    -- además de Google. Este histórico llegó SIN prescriptor, así que se queda
    -- en lo único que se sabe con certeza: un portal externo sin identificar.
    WHEN 'terceros'    THEN 'TERCEROS'
    WHEN 'software'    THEN 'TELEFONO'
    WHEN 'sala'        THEN 'TELEFONO'
    WHEN 'waitinglist' THEN 'LISTA_ESPERA'
    WHEN 'walk in'     THEN 'WALKIN'
    WHEN 'walkin'      THEN 'WALKIN'
    -- Lo que no esté en la lista conserva su nombre en mayúsculas; nunca cae en
    -- un cajón de "otros". Vacío es vacío: dato que falta, no canal.
    ELSE NULLIF(upper(btrim(coalesce(p_origen, ''))), '')
  END;
$$;

COMMENT ON FUNCTION public.bh_origen_cover(text) IS
  'Traduce el canal tal y como lo escribía CoverManager al catálogo propio (WEB, GOOGLE, TELEFONO...).';

-- ── La pantalla, ahora sobre el histórico completo ─────────────────────
CREATE OR REPLACE FUNCTION public.marketing_captacion_canales(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH servicios AS (
    -- Lo que ha pasado por este sistema.
    SELECT r.fecha,
           r.origen AS canal,
           r.personas,
           r.cliente_id,
           r.estado = 'NO_SHOW'   AS es_no_show,
           r.estado = 'CANCELADA' AS es_cancelada
    FROM public.reservas r
    WHERE r.empresa_id = p_empresa_id
      AND r.fecha IS NOT NULL
    UNION ALL
    -- Y el histórico de CoverManager anterior al software.
    SELECT v.fecha,
           public.bh_origen_cover(v.origen) AS canal,
           v.personas,
           v.cliente_id,
           lower(btrim(coalesce(v.estado, ''))) = 'no show'        AS es_no_show,
           lower(btrim(coalesce(v.estado, ''))) LIKE 'cancelad%'   AS es_cancelada
    FROM public.cliente_visitas v
    WHERE v.empresa_id = p_empresa_id
      AND v.reserva_id IS NULL
      AND v.fecha IS NOT NULL
  ),
  con_canal AS (
    SELECT * FROM servicios WHERE canal IS NOT NULL AND btrim(canal) <> ''
  ),
  por_mes AS (
    SELECT EXTRACT(YEAR FROM fecha)::int AS anio,
           EXTRACT(MONTH FROM fecha)::int AS mes,
           canal,
           count(*)::int AS reservas,
           coalesce(sum(personas), 0)::int AS comensales
    FROM con_canal
    GROUP BY 1, 2, 3
  ),
  calidad AS (
    SELECT canal,
           count(*)::int AS reservas,
           round(avg(personas)::numeric, 2) AS media_personas,
           count(*) FILTER (WHERE es_no_show)::int AS no_show,
           count(*) FILTER (WHERE es_cancelada)::int AS canceladas
    FROM con_canal
    WHERE fecha >= (current_date - INTERVAL '24 months')
      AND fecha <= current_date
    GROUP BY 1
  ),
  visitas_por_cliente AS (
    SELECT cliente_id, count(*)::int AS n
    FROM servicios
    WHERE cliente_id IS NOT NULL
      AND NOT es_cancelada
      AND NOT es_no_show
    GROUP BY 1
  ),
  clientes AS (
    SELECT c.origen AS canal,
           count(*)::int AS clientes,
           count(*) FILTER (WHERE c.email IS NOT NULL AND btrim(c.email) <> '')::int AS con_email,
           count(*) FILTER (WHERE c.telefono IS NOT NULL AND btrim(c.telefono) <> '')::int AS con_telefono,
           count(*) FILTER (WHERE coalesce(v.n, 0) >= 1)::int AS han_venido,
           count(*) FILTER (WHERE coalesce(v.n, 0) >= 2)::int AS repiten
    FROM public.clientes_sala c
    LEFT JOIN visitas_por_cliente v ON v.cliente_id = c.id
    WHERE c.empresa_id = p_empresa_id
      AND c.origen IS NOT NULL
      AND btrim(c.origen) <> ''
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'porMes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'anio', anio, 'mes', mes, 'canal', canal,
               'reservas', reservas, 'comensales', comensales
             ) ORDER BY anio, mes, reservas DESC)
      FROM por_mes), '[]'::jsonb),
    'calidad', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'canal', canal, 'reservas', reservas,
               'mediaPersonas', media_personas,
               'noShow', no_show, 'canceladas', canceladas
             ) ORDER BY reservas DESC)
      FROM calidad), '[]'::jsonb),
    'clientes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'canal', canal, 'clientes', clientes,
               'conEmail', con_email, 'conTelefono', con_telefono,
               'hanVenido', han_venido, 'repiten', repiten
             ) ORDER BY clientes DESC)
      FROM clientes), '[]'::jsonb),
    'sinOrigen', jsonb_build_object(
      'reservas', (SELECT count(*)::int FROM servicios
                    WHERE canal IS NULL OR btrim(canal) = ''),
      'clientes', (SELECT count(*)::int FROM public.clientes_sala c
                    WHERE c.empresa_id = p_empresa_id
                      AND (c.origen IS NULL OR btrim(c.origen) = ''))
    )
  );
$$;
