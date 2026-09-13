-- ============================================================
-- 20260914120000_altas_agora_pendientes.sql
-- Lo que Ágora vende y Balles no conoce deja de perderse en silencio.
--
-- PRP-080 Fase 5, cimientos SQL. Regla decidida por Iván (§7, DECISIÓN G): cuando
-- llega una venta de un producto que Balles no tiene, el sistema **avisa y obliga**
-- a darlo de alta, y esas ventas **no se descartan: quedan en espera** y se procesan
-- hacia atrás al completar la ficha.
--
-- QUÉ HAY HOY EN PRODUCCIÓN (medido 10-sep, re-medido 12-sep)
--   · 360 líneas de venta huérfanas de 5 productos: cuatro cócteles de HABANA
--     (Boom-Boom, Danza Macabra, Desliz de cobra, Fiesta del Caribe) y MENU BACANAL.
--   · 821 complementos huérfanos de 16 nombres: los sabores de shisha, cuatro
--     «Ud. Extra…» de BACANAL y SEXY GREEN.
--   Todos siguen vendiéndose. La ingesta SÍ los guarda (con `agora_product_id` y el
--   nombre de Ágora), pero **nadie lee ese dato**: no hay consulta, ni pantalla, ni aviso.
--
-- POR QUÉ UNA TABLA DE ALIAS Y NO SOLO `productos.agora_id`
--   Ocho de esos complementos **ya existen** en Balles con ficha propia, pero con OTRO
--   `agora_id`: en Ágora el mismo tabaco está dado de alta dos veces, como producto y
--   como complemento, con identificadores distintos (Big Boy 1319 y 1683, Love 66 1337
--   y 1681, Huracán 2280 y 2281…). `productos.agora_id` es una sola columna y es única
--   por (empresa, agora_id, tipo), así que no puede guardar los dos. Sin alias, esos
--   consumos volverían a quedar huérfanos cada noche.
--
--   Cuando el producto NO tiene todavía `agora_id` (el caso de Sexy Green), no hace
--   falta alias: se escribe directamente en su ficha. El alias es solo para el segundo.
--
-- QUÉ CREA
--   1. `producto_agora_alias` — el segundo identificador de Ágora de un producto.
--   2. `agora_ventas_huerfanas(empresa)` — la lista de pendientes, DERIVADA de los dos
--      índices parciales de huérfanos que ya existen. Sin tabla de estado: la doctrina
--      prohíbe descartar, así que no hay nada que guardar, y una tabla habría que
--      mantenerla sincronizada con cada ingesta (granja de fallos).
--   3. `vincular_ventas_huerfanas(empresa, agora_id, producto)` — enlaza de golpe todo
--      el histórico de ese identificador y devuelve los días afectados.
--   4. El tipo de aviso `producto_agora_sin_alta` en el CHECK de notificaciones.
--
-- POR QUÉ EL ENLACE VA POR UPDATE Y NO RE-INGIRIENDO EL DÍA
--   Re-ingerir vuelve a resolverlo, sí, pero cuesta una llamada al servidor del
--   restaurante por cada día (son ~90), la retención de Ágora no está documentada en
--   ninguna parte, y **recrea los identificadores de todas las líneas del día**, lo que
--   obliga a rehacer el kardex entero de esa jornada. El UPDATE dirigido conserva los
--   identificadores, así que los movimientos de almacén que los referencian siguen
--   siendo válidos.
--
-- No cambia ninguna existencia ni descuenta nada: solo enlaza y consulta.
-- Idempotente.
-- ============================================================

-- ── 1. El segundo identificador de Ágora ─────────────────────────────────────
create table if not exists public.producto_agora_alias (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  -- El identificador de Ágora que hay que redirigir a este producto.
  agora_product_id integer not null,
  producto_id      uuid not null references public.productos(id) on delete cascade,
  nota             text,
  created_by       uuid,
  created_at       timestamptz not null default now()
);

comment on table public.producto_agora_alias is
  'Identificadores de Ágora ADICIONALES de un producto (PRP-080 Fase 5). En Ágora el '
  'mismo artículo puede estar dado de alta dos veces —como producto y como complemento— '
  'con ids distintos; `productos.agora_id` solo guarda uno. La ingesta consulta esta '
  'tabla como segundo intento cuando el id no casa con ningún producto.';

-- Un identificador de Ágora apunta a UN solo producto dentro de la empresa.
create unique index if not exists uq_paa_empresa_agora
  on public.producto_agora_alias(empresa_id, agora_product_id);
create index if not exists idx_paa_empresa_producto
  on public.producto_agora_alias(empresa_id, producto_id);

alter table public.producto_agora_alias enable row level security;

drop policy if exists "paa_select" on public.producto_agora_alias;
create policy "paa_select" on public.producto_agora_alias
  for select to authenticated using (empresa_id in (select empresas_del_usuario()));
-- Sin policies de escritura: escribe la acción del servidor con la clave de servicio,
-- igual que `pos_ticket_linea_addins`.

-- ── 2. La lista de pendientes, derivada ──────────────────────────────────────
create or replace function public.agora_ventas_huerfanas(p_empresa uuid)
returns table (
  origen           text,
  agora_product_id integer,
  nombre           text,
  veces            bigint,
  unidades         numeric,
  desde            date,
  hasta            date
)
language sql stable security definer
set search_path = public as $fn$
  -- Líneas de venta: `pos_ticket_lineas` no tiene empresa, va por su ticket.
  select 'venta'::text,
         l.agora_product_id,
         mode() within group (order by l.nombre),   -- el nombre más repetido de Ágora
         count(*),
         sum(coalesce(l.cantidad, 0)),
         min(t.cerrado_at)::date,
         max(t.cerrado_at)::date
    from public.pos_ticket_lineas l
    join public.pos_tickets t on t.id = l.ticket_id
   where t.empresa_id = p_empresa
     and l.producto_id is null
     and l.agora_product_id is not null
   group by l.agora_product_id
  union all
  -- Complementos: estos sí llevan la empresa encima.
  select 'complemento'::text,
         a.agora_product_id,
         mode() within group (order by a.nombre),
         count(*),
         sum(coalesce(a.ratio, 1)),
         min(t.cerrado_at)::date,
         max(t.cerrado_at)::date
    from public.pos_ticket_linea_addins a
    join public.pos_ticket_lineas l on l.id = a.linea_id
    join public.pos_tickets t on t.id = l.ticket_id
   where a.empresa_id = p_empresa
     and a.producto_id is null
     and a.agora_product_id is not null
   group by a.agora_product_id
   order by 4 desc;
$fn$;

comment on function public.agora_ventas_huerfanas(uuid) is
  'Lo que Ágora ha vendido y Balles no sabe a qué producto corresponde, agrupado por '
  'identificador de Ágora. Se calcula al vuelo sobre los índices parciales de huérfanos: '
  'no hay tabla de pendientes que mantener.';

revoke all on function public.agora_ventas_huerfanas(uuid) from public, anon, authenticated;

-- ── 3. Enlazar todo el histórico de un identificador ─────────────────────────
create or replace function public.vincular_ventas_huerfanas(
  p_empresa uuid, p_agora_id integer, p_producto uuid
)
returns table (lineas integer, addins integer, dias date[])
language plpgsql security definer
set search_path = public as $fn$
declare
  v_lineas integer := 0;
  v_addins integer := 0;
  v_dias_lineas date[] := '{}';
  v_dias_addins date[] := '{}';
begin
  -- El producto tiene que ser de esta empresa: `security definer` no relaja el inquilino.
  if not exists (
    select 1 from public.productos
     where id = p_producto and empresa_id = p_empresa
  ) then
    raise exception 'Ese producto no es de esta empresa.';
  end if;

  with upd as (
    update public.pos_ticket_lineas l
       set producto_id = p_producto
      from public.pos_tickets t
     where l.ticket_id = t.id
       and t.empresa_id = p_empresa
       and l.agora_product_id = p_agora_id
       and l.producto_id is null
    returning t.cerrado_at::date as dia
  )
  select count(*), coalesce(array_agg(distinct dia) filter (where dia is not null), '{}')
    into v_lineas, v_dias_lineas
    from upd;

  -- Los días de los complementos se recogen APARTE: un complemento huérfano puede
  -- colgar de una línea que sí se resolvió, así que su día no tiene por qué estar
  -- entre los de arriba.
  with upd as (
    update public.pos_ticket_linea_addins a
       set producto_id = p_producto
      from public.pos_ticket_lineas l
      join public.pos_tickets t on t.id = l.ticket_id
     where a.linea_id = l.id
       and a.empresa_id = p_empresa
       and a.agora_product_id = p_agora_id
       and a.producto_id is null
    returning t.cerrado_at::date as dia
  )
  select count(*), coalesce(array_agg(distinct dia) filter (where dia is not null), '{}')
    into v_addins, v_dias_addins
    from upd;

  return query
    select v_lineas,
           v_addins,
           (select coalesce(array_agg(distinct d order by d), '{}')
              from unnest(v_dias_lineas || v_dias_addins) as d);
end
$fn$;

comment on function public.vincular_ventas_huerfanas(uuid, integer, uuid) is
  'Enlaza a un producto todo el histórico de ventas y complementos de un identificador '
  'de Ágora que estaba sin reconocer, y devuelve los días afectados para poder rehacer '
  'su descuento de stock. Conserva los identificadores de línea: los movimientos de '
  'almacén que los referencian siguen siendo válidos.';

revoke all on function public.vincular_ventas_huerfanas(uuid, integer, uuid) from public, anon, authenticated;

-- ── 4. El tipo de aviso ──────────────────────────────────────────────────────
-- La lista se copia de la definición VIVA en producción (no de una migración vieja):
-- insertar un tipo que no esté en el CHECK falla con 23514, y el emisor se traga el
-- error, así que el aviso se daría por enviado y nunca llegaría a la campana.
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (
  tipo = any (array[
    'info', 'alerta', 'error', 'exito', 'recordatorio', 'aviso_manual',
    'liquidacion', 'liquidacion_pagada', 'vencimiento', 'cronograma', 'comunicado',
    'encuesta', 'cambio_email_acceso',
    'gestoria_alta_enviada', 'gestoria_recordatorio', 'gestoria_contrato_subido',
    'gestoria_contrato_firmado',
    'contratacion_iniciada', 'contrato_interno_enviado', 'contrato_interno_firmado',
    'reconocimiento_medico_enviado', 'reconocimiento_medico_firmado',
    'alta_completada', 'nueva_incorporacion',
    'entrega_material_firmada', 'devolucion_material_firmada',
    'prueba_aviso', 'prueba_ultima_llamada', 'prueba_evaluacion', 'prueba_cierre',
    'solicitud_pendiente', 'solicitud_resuelta',
    'doc_pendiente', 'firma_pendiente', 'resena_google', 'modelos_aeat',
    'nominas_gestoria_subidas', 'cumpleanos',
    'producto_agora_sin_alta'
  ])
);
