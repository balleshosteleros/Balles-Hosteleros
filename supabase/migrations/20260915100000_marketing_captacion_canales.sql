-- De dónde entra la gente: los números de Marketing → Captación.
--
-- La pantalla compara canales año por año sobre TODA la historia (32.000
-- reservas y 36.000 fichas de cliente). Traerlas al navegador para sumarlas
-- allí serían decenas de vueltas a la base y varios segundos de espera cada vez
-- que alguien abre la pantalla; aquí se suman donde están los datos y vuelve un
-- único JSON de unos pocos kilobytes.
--
-- SECURITY INVOKER (el de serie) a propósito: la función se ejecuta con los
-- permisos de quien la llama, así que la RLS sigue mandando. El filtro por
-- `p_empresa_id` es el que acota a la empresa ACTIVA, que la RLS no distingue.
--
-- Tres bloques, que son las tres preguntas de la pantalla:
--   1. `por_mes`   — cuántas reservas y comensales trajo cada canal cada mes.
--                    Por MES y no por año para poder comparar el año en curso
--                    con el mismo tramo del anterior: a mitad de septiembre,
--                    enfrentar un año a medias contra doce meses enteros diría
--                    que todo se hunde cuando no ha pasado nada.
--   2. `calidad`   — de las de los últimos 24 meses, cuántas acabaron en mesa
--                    vacía (canceladas y no show) y de cuánta gente eran.
--   3. `clientes`  — cuántas fichas entraron por cada canal, a cuántas se les
--                    puede escribir y cuántas han vuelto alguna vez.
--
-- El origen se devuelve TAL CUAL está en la base, sin agrupar en ningún cajón
-- de "otros": quien pinta decide qué destacar. Una reserva sin origen (dato que
-- falta, no canal) queda fuera de los tres bloques.

CREATE OR REPLACE FUNCTION public.marketing_captacion_canales(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH por_mes AS (
    SELECT EXTRACT(YEAR FROM r.fecha)::int AS anio,
           EXTRACT(MONTH FROM r.fecha)::int AS mes,
           r.origen AS canal,
           count(*)::int AS reservas,
           coalesce(sum(r.personas), 0)::int AS comensales
    FROM public.reservas r
    WHERE r.empresa_id = p_empresa_id
      AND r.origen IS NOT NULL
      AND btrim(r.origen) <> ''
      AND r.fecha IS NOT NULL
    GROUP BY 1, 2, 3
  ),
  calidad AS (
    SELECT r.origen AS canal,
           count(*)::int AS reservas,
           round(avg(r.personas)::numeric, 2) AS media_personas,
           count(*) FILTER (WHERE r.estado = 'NO_SHOW')::int AS no_show,
           count(*) FILTER (WHERE r.estado = 'CANCELADA')::int AS canceladas
    FROM public.reservas r
    WHERE r.empresa_id = p_empresa_id
      AND r.origen IS NOT NULL
      AND btrim(r.origen) <> ''
      AND r.fecha >= (current_date - INTERVAL '24 months')
      AND r.fecha <= current_date
    GROUP BY 1
  ),
  visitas_por_cliente AS (
    SELECT r.cliente_id, count(*)::int AS n
    FROM public.reservas r
    WHERE r.empresa_id = p_empresa_id
      AND r.cliente_id IS NOT NULL
      AND r.estado NOT IN ('CANCELADA', 'NO_SHOW')
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
      'reservas', (SELECT count(*)::int FROM public.reservas r
                    WHERE r.empresa_id = p_empresa_id
                      AND (r.origen IS NULL OR btrim(r.origen) = '')),
      'clientes', (SELECT count(*)::int FROM public.clientes_sala c
                    WHERE c.empresa_id = p_empresa_id
                      AND (c.origen IS NULL OR btrim(c.origen) = ''))
    )
  );
$$;

COMMENT ON FUNCTION public.marketing_captacion_canales(uuid) IS
  'Reservas y clientes por canal de entrada, para Marketing → Captación. Suma en la base para no traer 32.000 filas al navegador.';

GRANT EXECUTE ON FUNCTION public.marketing_captacion_canales(uuid) TO authenticated;
