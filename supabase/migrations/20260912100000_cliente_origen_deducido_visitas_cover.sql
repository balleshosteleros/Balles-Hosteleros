-- Rellena el canal de entrada (`clientes_sala.origen`) de las fichas que aún
-- lo tienen en blanco. Segunda pasada, continuación de
-- `20260907210100_cliente_origen_deducido_primera_reserva.sql`.
--
-- Dos huecos quedaron entonces:
--
--  1. Las fichas que NACEN al reservar seguían naciendo sin canal: la función
--     `find_or_link_cliente_sala` las crea y no recibe el origen. Eran unas 38
--     desde el 7 de septiembre, y crecían cada día. El agujero se tapa en el
--     código (`sala/lib/cliente-link.ts`, que anota el canal justo después de
--     crear la ficha); aquí se arreglan las que ya entraron así.
--
--  2. Las fichas de CoverManager que NUNCA reservaron en este sistema. No
--     tienen reserva de la que deducir el canal... pero sí tienen VISITAS
--     migradas, y cada visita trae el origen tal cual lo contaba Cover. De ahí
--     salen 1.969 fichas más.
--
-- El diccionario Cover → catálogo propio no se inventa: es el que se aplicó al
-- importar las reservas, comprobado sobre las 25.000 visitas que sí quedaron
-- enlazadas a una reserva:
--     moduloweb / web / appmovil / app-movil → WEB
--     terceros                               → GOOGLE
--     software / sala                        → TELEFONO
--     waitinglist                            → LISTA_ESPERA
--     walk in                                → WALKIN
-- Lo que no esté en esa lista se queda sin tocar: NULL sigue queriendo decir
-- "no se sabe", y no se rellena con un cajón de sastre.
--
-- "Primera" es la de FECHA más antigua, no la grabada antes: la importación
-- volcó veinte mil filas el mismo día, así que `created_at` no ordena nada.
--
-- Idempotente: las dos pasadas actúan solo sobre `origen IS NULL`.

-- ── 1. Desde su primera reserva ────────────────────────────────────────
WITH primera AS (
  SELECT DISTINCT ON (r.cliente_id)
         r.cliente_id,
         r.origen
  FROM public.reservas r
  WHERE r.cliente_id IS NOT NULL
    AND r.origen IS NOT NULL
    AND btrim(r.origen) <> ''
  ORDER BY r.cliente_id, r.fecha ASC NULLS LAST, r.created_at ASC
)
UPDATE public.clientes_sala cs
SET origen = primera.origen,
    updated_at = now()
FROM primera
WHERE cs.id = primera.cliente_id
  AND cs.origen IS NULL;

-- ── 2. Desde su primera visita migrada ─────────────────────────────────
WITH primera_visita AS (
  SELECT DISTINCT ON (v.cliente_id)
         v.cliente_id,
         lower(btrim(v.origen)) AS origen
  FROM public.cliente_visitas v
  WHERE v.origen IS NOT NULL
    AND btrim(v.origen) <> ''
  ORDER BY v.cliente_id, v.fecha ASC NULLS LAST, v.created_at ASC
),
traducido AS (
  SELECT cliente_id,
         CASE origen
           WHEN 'moduloweb'   THEN 'WEB'
           WHEN 'web'         THEN 'WEB'
           WHEN 'appmovil'    THEN 'WEB'
           WHEN 'app-movil'   THEN 'WEB'
           WHEN 'terceros'    THEN 'GOOGLE'
           WHEN 'software'    THEN 'TELEFONO'
           WHEN 'sala'        THEN 'TELEFONO'
           WHEN 'waitinglist' THEN 'LISTA_ESPERA'
           WHEN 'walk in'     THEN 'WALKIN'
           WHEN 'walkin'      THEN 'WALKIN'
         END AS origen
  FROM primera_visita
)
UPDATE public.clientes_sala cs
SET origen = t.origen,
    updated_at = now()
FROM traducido t
WHERE cs.id = t.cliente_id
  AND t.origen IS NOT NULL
  AND cs.origen IS NULL;
