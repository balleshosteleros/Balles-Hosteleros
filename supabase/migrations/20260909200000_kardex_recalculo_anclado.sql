-- ============================================================
-- 20260909200000_kardex_recalculo_anclado.sql
-- El kardex se recalcula solo, y los inventarios/ajustes dejan de ser diferencias.
--
-- PRP-080 Fase 2, primera mitad. Sin esto, el "almacén abierto se recalcula solo"
-- que decidió Iván no existe: hoy no hay nada que recalcule nada.
--
-- QUÉ ESTABA MAL (verificado en producción el 2026-09-09)
--
--   1. `saldo_resultante` NO es "el saldo a esa fecha": es "el saldo vivo en el
--      instante en que se escribió la fila". `registrarMovimiento` lee
--      `stock.cantidad_actual`, le suma el movimiento y guarda ese número. Si el
--      movimiento viene con fecha atrasada (un albarán de la semana pasada, un
--      inventario de ayer, las ventas de Ágora que llegan al día siguiente), la
--      fila queda con el saldo de HOY metida en medio del histórico de entonces.
--      Ocho de las 65 filas ya estaban así.
--
--   2. Un inventario NO es un movimiento, es un ANCLA: "el día X había 12". Se
--      guardaba como la diferencia contra el saldo vivo de ese momento. Si después
--      aparece un albarán anterior, esa diferencia deja de ser válida y todo lo
--      posterior al recuento se descuadra. Igual con los ajustes ("corregir
--      existencias"), que dicen "déjalo en N", no "suma N".
--
--   3. `stock.cantidad_actual` no se puede reconstruir sumando el libro: hay
--      255 productos con existencias y ni un solo apunte (cargas anteriores al
--      kardex y el espejo de Ágora, que escribía el saldo sin dejar movimiento).
--      Un recálculo "desde cero" los pondría a 0 en cuanto tocaran movimiento.
--
-- QUÉ HACE ESTA MIGRACIÓN
--
--   · `saldo_fijado`: la columna que distingue un ancla de un movimiento. Si no es
--     NULL, esa fila DICE cuánto hay, y su cantidad/signo se deducen de la resta con
--     el saldo anterior. La rellenan inventarios, ajustes y el saldo inicial.
--
--   · `kardex_cadena()`: recorre el histórico de un producto en orden real
--     (fecha, created_at, id) y devuelve el saldo que corresponde a cada fila.
--     Las filas anteriores a un cierre de almacén se devuelven congeladas, tal como
--     están: en un período cerrado no se recalcula nada.
--
--   · `recalcular_saldos_producto()` + 3 triggers de sentencia: cualquier alta, baja
--     o cambio en `stock_movimientos` reescribe los saldos de ese producto y deja
--     `stock.cantidad_actual` cuadrado. Con `pg_advisory_xact_lock` por producto
--     (el cron de ventas y una persona pueden coincidir) y una marca de sesión
--     `app.kardex_recalculo` para que el recálculo no se llame a sí mismo.
--
--   · El RPC del albarán deja de escribir en `stock`. Lo hacía a mano con
--     "saldo vivo + cantidad", que es exactamente lo que rompe el orden cuando el
--     albarán trae fecha de otro día.
--
--   · SALDO INICIAL: para cada producto cuyas existencias no explique el libro, se
--     apunta un ancla con la foto de hoy. El stock visible no cambia ni un gramo;
--     lo que cambia es que a partir de ahora el histórico explica de dónde sale.
--
-- Idempotente. No cambia ninguna existencia.
-- ============================================================

-- ── 1. El ancla ──────────────────────────────────────────────────────────────
alter table public.stock_movimientos add column if not exists saldo_fijado numeric;

comment on column public.stock_movimientos.saldo_fijado is
  'Si no es NULL, este movimiento FIJA el saldo del producto a este valor (inventario, '
  'ajuste manual, saldo inicial) en vez de sumar o restar. El recálculo deriva '
  'cantidad/signo/tipo de la diferencia con el saldo anterior. PRP-080 Fase 2.';

-- ── 2. Stub del cierre de almacén ────────────────────────────────────────────
-- La siguiente migración (almacen_cierres) lo reemplaza por el de verdad, con la
-- misma firma. Aquí devuelve NULL = "no hay nada cerrado", para que esta migración
-- se pueda aplicar y verificar por su cuenta.
create or replace function public.almacen_cierre_vigente(p_empresa uuid)
returns timestamptz language sql stable
set search_path = public as $fn$
  select null::timestamptz;
$fn$;

-- ── 3. La cadena teórica de un producto ──────────────────────────────────────
create or replace function public.kardex_cadena(p_empresa uuid, p_producto uuid)
returns table (id uuid, fecha timestamptz, saldo numeric, cantidad numeric, signo smallint)
language plpgsql stable
set search_path = public as $fn$
declare
  r record;
  v_prev numeric := 0;
  v_corte timestamptz;
begin
  v_corte := public.almacen_cierre_vigente(p_empresa);

  for r in
    select m.id, m.fecha, m.cantidad, m.signo, m.saldo_resultante, m.saldo_fijado
      from public.stock_movimientos m
     where m.empresa_id = p_empresa and m.producto_id = p_producto
     order by m.fecha, m.created_at, m.id
  loop
    id := r.id;
    fecha := r.fecha;
    if v_corte is not null and r.fecha < v_corte then
      -- Período cerrado: intocable. Se respeta lo que hay y la cadena sigue desde ahí.
      saldo := r.saldo_resultante; cantidad := r.cantidad; signo := r.signo;
    elsif r.saldo_fijado is not null then
      -- Ancla: manda el saldo; la cantidad es la corrección que hizo falta.
      saldo := r.saldo_fijado;
      cantidad := abs(saldo - v_prev);
      signo := case when saldo < v_prev then -1 else 1 end;
    else
      saldo := v_prev + r.signo * r.cantidad; cantidad := r.cantidad; signo := r.signo;
    end if;
    v_prev := saldo;
    return next;
  end loop;
end
$fn$;

comment on function public.kardex_cadena(uuid, uuid) is
  'Saldo que corresponde a cada movimiento de un producto, en orden real. Respeta las '
  'anclas (saldo_fijado) y congela lo anterior al cierre de almacén vigente.';

create or replace function public.kardex_saldo_teorico(p_empresa uuid, p_producto uuid)
returns numeric language sql stable
set search_path = public as $fn$
  select coalesce(
    (select c.saldo from public.kardex_cadena(p_empresa, p_producto) with ordinality c
      order by c.ordinality desc limit 1), 0);
$fn$;

-- ── 4. El recálculo ──────────────────────────────────────────────────────────
create or replace function public.recalcular_saldos_producto(p_empresa uuid, p_producto uuid)
returns integer language plpgsql
set search_path = public as $fn$
declare
  v_n int := 0;
  v_saldo numeric;
  v_ultimo timestamptz;
begin
  -- El cron de ventas y una persona pueden tocar el mismo producto a la vez.
  perform pg_advisory_xact_lock(hashtext(p_empresa::text || ':' || p_producto::text));
  -- Marca de sesión: los triggers (guardia de cierre incluida) se apartan mientras
  -- recalculamos. Sin esto, reescribir los saldos se llamaría a sí mismo sin fin.
  perform set_config('app.kardex_recalculo', '1', true);

  update public.stock_movimientos m
     set saldo_resultante = c.saldo,
         cantidad = c.cantidad,
         signo = c.signo,
         tipo = case when c.signo = 1 then 'entrada' else 'salida' end,
         valor_total = case when m.coste_unitario is null then null
                            else m.coste_unitario * c.cantidad end
    from public.kardex_cadena(p_empresa, p_producto) c
   where m.id = c.id
     and (m.saldo_resultante is distinct from c.saldo
          or m.cantidad is distinct from c.cantidad
          or m.signo is distinct from c.signo);
  get diagnostics v_n = row_count;

  select c.saldo, c.fecha into v_saldo, v_ultimo
    from public.kardex_cadena(p_empresa, p_producto) with ordinality c
   order by c.ordinality desc limit 1;

  update public.stock
     set cantidad_actual = coalesce(v_saldo, 0),
         ultimo_movimiento = coalesce(v_ultimo, ultimo_movimiento)
   where empresa_id = p_empresa and producto_id = p_producto;

  if not found and v_saldo is not null then
    insert into public.stock (empresa_id, producto_id, producto_nombre, cantidad_actual, unidad, ultimo_movimiento)
    select p_empresa, p.id, p.nombre, v_saldo, p.medida, v_ultimo
      from public.productos p where p.id = p_producto;
  end if;

  perform set_config('app.kardex_recalculo', '', true);
  return v_n;
exception when others then
  perform set_config('app.kardex_recalculo', '', true);
  raise;
end
$fn$;

revoke execute on function public.recalcular_saldos_producto(uuid, uuid) from public, authenticated;

create or replace function public.stock_mov_recalcular_tg()
returns trigger language plpgsql
set search_path = public as $fn$
declare r record;
begin
  if coalesce(current_setting('app.kardex_recalculo', true), '') = '1' then
    return null;
  end if;
  if TG_OP = 'INSERT' then
    for r in select distinct empresa_id, producto_id from ins loop
      perform public.recalcular_saldos_producto(r.empresa_id, r.producto_id);
    end loop;
  elsif TG_OP = 'DELETE' then
    for r in select distinct empresa_id, producto_id from del loop
      perform public.recalcular_saldos_producto(r.empresa_id, r.producto_id);
    end loop;
  else
    for r in select empresa_id, producto_id from ins
             union select empresa_id, producto_id from del loop
      perform public.recalcular_saldos_producto(r.empresa_id, r.producto_id);
    end loop;
  end if;
  return null;
end
$fn$;

-- Un trigger por evento: Postgres no admite tablas de transición en triggers multi-evento.
drop trigger if exists trg_stock_mov_recalc_ins on public.stock_movimientos;
create trigger trg_stock_mov_recalc_ins after insert on public.stock_movimientos
  referencing new table as ins
  for each statement execute function public.stock_mov_recalcular_tg();

drop trigger if exists trg_stock_mov_recalc_upd on public.stock_movimientos;
create trigger trg_stock_mov_recalc_upd after update on public.stock_movimientos
  referencing old table as del new table as ins
  for each statement execute function public.stock_mov_recalcular_tg();

drop trigger if exists trg_stock_mov_recalc_del on public.stock_movimientos;
create trigger trg_stock_mov_recalc_del after delete on public.stock_movimientos
  referencing old table as del
  for each statement execute function public.stock_mov_recalcular_tg();

-- ── 5. El RPC del albarán deja de escribir en `stock` ─────────────────────────
CREATE OR REPLACE FUNCTION public.confirmar_albaran_transaccional(p_albaran_id uuid, p_estado_destino text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_alb albaranes%rowtype;
  v_actor uuid := auth.uid();
  v_linea jsonb;
  v_nuevas jsonb := '[]'::jsonb;
  v_prod record;
  v_mov record;
  v_dup_num text;
  v_num_norm text;
  v_base text; v_uni text; v_fmt text;
  v_equiv numeric; v_cant numeric; v_cant_stock numeric; v_precio numeric;
  v_origen uuid;
  v_aplicados int := 0; v_omitidos int := 0; v_precios int := 0;
  v_contenedoras text[] := array['caja','cajas','caj','cja','cj','cajon','cajones','box','pack','packs','bandeja','bandejas',
    'saco','sacos','garrafa','garrafas','bidon','bidones','fardo','fardos','lote','lotes','palet','pale','pales'];
begin
  if p_estado_destino not in ('Entregado', 'Confirmado') then
    raise exception 'Estado destino no válido: %', p_estado_destino;
  end if;

  -- Bloqueo del albarán (y control de empresa: security definer NO relaja el tenant).
  select * into v_alb from albaranes
   where id = p_albaran_id and empresa_id in (select empresas_del_usuario())
   for update;
  if not found then
    raise exception 'Albarán no encontrado';
  end if;

  -- Ya recibido: solo re-etiquetar (Entregado→Confirmado), sin tocar stock.
  if v_alb.estado in ('Entregado', 'Confirmado') then
    update albaranes set estado = p_estado_destino, updated_at = now() where id = p_albaran_id;
    return jsonb_build_object('ok', true, 'aplicados', 0, 'omitidos', 0, 'precios', 0, 'nota', 'ya recibido');
  end if;

  -- Documento parcial (falta al menos una página): NO se confirma. Confirmarlo
  -- sumaría stock y gasto a medias y nadie volvería a por la hoja que falta.
  if coalesce(v_alb.documento_parcial, false) then
    raise exception 'A este albarán le falta al menos una página (se guardó como incompleto%). Añade la foto de la página que falta y márcalo como completo antes de confirmar.',
      case when v_alb.paginas_esperadas is not null
           then ': ' || v_alb.paginas_esperadas || ' páginas esperadas' else '' end;
  end if;

  -- Re-check de duplicado de negocio BAJO BLOQUEO (sueltos sin override).
  if v_alb.pedido_id is null and v_alb.duplicado_override_at is null then
    v_num_norm := regexp_replace(lower(coalesce(v_alb.numero_proveedor, '')), '[^a-z0-9]', '', 'g');
    select a.numero into v_dup_num from albaranes a
     where a.empresa_id = v_alb.empresa_id and a.id <> v_alb.id
       and lower(a.proveedor_nombre) = lower(v_alb.proveedor_nombre)
       and ((v_num_norm <> '' and regexp_replace(lower(coalesce(a.numero_proveedor, '')), '[^a-z0-9]', '', 'g') = v_num_norm)
            or (v_num_norm = '' and a.fecha = v_alb.fecha))
     limit 1;
    if v_dup_num is not null then
      raise exception 'Posible duplicado del albarán %. Revísalo antes de confirmar; si es otro documento, regístralo con motivo.', v_dup_num;
    end if;
  end if;

  -- Idempotencia: revertir cualquier entrada previa de este documento (restos de
  -- confirmaciones parciales del camino antiguo) antes de rehacer.
  -- (PRP-080 F2) Ya no se toca `stock` aquí: el recálculo del kardex lo deja bien
  -- tras el delete. Escribirlo a mano pisaba el saldo encadenado.
  delete from stock_movimientos
   where empresa_id = v_alb.empresa_id and documento_tipo = 'albaran' and documento_id = v_alb.id;

  -- Recorrido de líneas: validar, resolver equivalencia, precios y stock.
  for v_linea in select * from jsonb_array_elements(coalesce(v_alb.lineas, '[]'::jsonb)) loop
    if coalesce((v_linea->>'ignorada')::boolean, false) then
      v_nuevas := v_nuevas || v_linea; v_omitidos := v_omitidos + 1; continue;
    end if;
    if coalesce(v_linea->>'productoId', '') = '' then
      raise exception 'Quedan líneas sin producto asociado. Vincula, crea o ignora cada producto antes de confirmar.';
    end if;
    v_cant := coalesce(nullif(v_linea->>'cantidad', '')::numeric, 0);
    if v_cant <= 0 then
      v_nuevas := v_nuevas || v_linea; v_omitidos := v_omitidos + 1; continue;
    end if;

    select id, nombre, medida, controla_stock into v_prod
      from productos where id = (v_linea->>'productoId')::uuid;
    if not found then
      raise exception 'La línea "%" apunta a un producto que ya no existe.', coalesce(v_linea->>'producto', '');
    end if;

    -- F3a: equivalencia → cantidad base.
    v_base := case lower(coalesce(v_prod.medida, ''))
                when 'ud' then 'ud' when 'unidades' then 'ud'
                when 'kilogramos' then 'kg' when 'litros' then 'l'
                else lower(coalesce(v_prod.medida, '')) end;
    v_uni := lower(trim(coalesce(v_linea->>'unidad', '')));
    v_uni := case when v_uni in ('ud','uds','u','un','und','unidad','unidades') then 'ud'
                  when v_uni in ('kg','kgs','kilo','kilos','kilogramo','kilogramos') then 'kg'
                  when v_uni in ('l','lt','lts','litro','litros') then 'l'
                  else v_uni end;
    v_fmt := trim(coalesce(v_linea->>'formato', ''));
    v_equiv := null;
    if v_fmt <> '' then
      select f.equivalencias into v_equiv from formatos f
       where f.empresa_id = v_alb.empresa_id and f.activa and f.tipo = 'compra'
         and f.equivalencias is not null and lower(f.nombre) = lower(v_fmt)
       limit 1;
    end if;
    if v_equiv is null and v_uni <> '' and v_uni <> v_base then
      select f.equivalencias into v_equiv from formatos f
       where f.empresa_id = v_alb.empresa_id and f.activa and f.tipo = 'compra'
         and f.equivalencias is not null and lower(f.nombre) = v_uni
       limit 1;
    end if;
    if v_equiv is null then
      if v_uni = '' or v_uni = v_base then
        v_equiv := 1;
      elsif v_uni = any(v_contenedoras) then
        raise exception 'La línea "%" viene en "%" y no hay equivalencia definida. Crea el formato de compra "%" con su equivalencia en Logística → Catálogos y vuelve a confirmar.',
          coalesce(nullif(v_linea->>'producto', ''), v_linea->>'nombreProveedor', '?'),
          coalesce(nullif(v_fmt, ''), v_uni),
          coalesce(nullif(v_fmt, ''), v_uni);
      else
        -- Unidad distinta pero no contenedora (p.ej. "kg" sobre base "ud"): se mantiene
        -- el comportamiento histórico (1:1) dejando la marca para revisarlo en Etapa C.
        v_equiv := 1;
      end if;
    end if;
    v_cant_stock := round(v_cant * v_equiv, 3);
    v_linea := v_linea || jsonb_build_object(
      'unidadStock', v_base, 'equivalenciaAplicada', v_equiv, 'cantidadStock', v_cant_stock);
    v_nuevas := v_nuevas || v_linea;

    -- Precio de compra (idempotente por producto+proveedor+fecha; respeta la regla
    -- "fecha estrictamente posterior al último precio del proveedor" saltándose la
    -- línea si no la cumple — igual de tolerante que el camino anterior).
    v_precio := coalesce(nullif(v_linea->>'precioUC', '')::numeric, 0);
    if v_precio > 0 and coalesce(trim(v_alb.proveedor_nombre), '') <> '' and v_alb.fecha is not null then
      if not exists (
           select 1 from producto_precios_compra p
            where p.producto_id = v_prod.id and p.proveedor = v_alb.proveedor_nombre
              and p.fecha_inicio = v_alb.fecha)
         and coalesce((select max(p.fecha_inicio) from producto_precios_compra p
                        where p.producto_id = v_prod.id and p.proveedor = v_alb.proveedor_nombre),
                      '1900-01-01'::date) < v_alb.fecha then
        insert into producto_precios_compra (producto_id, precio, iva, proveedor, formato, fecha_inicio, created_by)
        values (v_prod.id, v_precio,
                case when (v_linea->>'impuesto') in ('0','4','10','21') then (v_linea->>'impuesto') else null end,
                v_alb.proveedor_nombre, nullif(v_fmt, ''), v_alb.fecha, v_actor);
        v_precios := v_precios + 1;
      end if;
    end if;

    -- Stock: candado controla_stock + movimiento. (PRP-080 F2) El saldo ya NO se
    -- calcula ni se escribe aquí: `saldo_resultante` va a 0 y lo fija el recálculo
    -- del kardex (trigger), que también crea/actualiza la fila de `stock`. Antes esta
    -- función pisaba `stock` con "saldo vivo + cantidad", que es justo lo que descuadra
    -- el histórico cuando el albarán viene con fecha atrasada.
    if coalesce(v_prod.controla_stock, true) = false then
      v_omitidos := v_omitidos + 1; continue;
    end if;
    begin
      v_origen := (v_linea->>'id')::uuid;
    exception when others then
      v_origen := null; -- ids de línea no-uuid (flujos antiguos): sin guarda por origen
    end;
    insert into stock_movimientos (empresa_id, producto_id, fecha, tipo, cantidad, signo,
      saldo_resultante, referencia, documento_tipo, documento_id, origen_linea_id, created_by,
      coste_unitario, valor_total)
    values (v_alb.empresa_id, v_prod.id, coalesce(v_alb.fecha::timestamptz, now()), 'entrada',
      v_cant_stock, 1, 0, v_alb.numero, 'albaran', v_alb.id, v_origen, v_actor,
      -- Coste POR UNIDAD DE STOCK: el precio de la linea entre las unidades que trae el
      -- formato. Un precio 0 (albaran sin precios teclados) se guarda como NULL: "no se
      -- sabe" y "gratis" no son lo mismo.
      case when v_precio > 0 then v_precio / nullif(coalesce(v_equiv, 1), 0) else null end,
      case when v_precio > 0 then v_precio * v_cant else null end);
    v_aplicados := v_aplicados + 1;
  end loop;

  -- Estado + snapshot de líneas al FINAL: si algo falló antes, nada de esto ocurre.
  update albaranes
     set lineas = v_nuevas, estado = p_estado_destino,
         revision_version = revision_version + 1, updated_at = now()
   where id = p_albaran_id;

  insert into albaran_eventos (empresa_id, albaran_id, actor_id, tipo, payload)
  values (v_alb.empresa_id, v_alb.id, v_actor, 'confirmacion_transaccional',
          jsonb_build_object('estado', p_estado_destino, 'aplicados', v_aplicados,
                             'omitidos', v_omitidos, 'precios', v_precios));

  return jsonb_build_object('ok', true, 'aplicados', v_aplicados, 'omitidos', v_omitidos, 'precios', v_precios);
end
$function$;

revoke all on function public.confirmar_albaran_transaccional(uuid, text) from public;
grant execute on function public.confirmar_albaran_transaccional(uuid, text) to authenticated;

-- ── 6. Saldo inicial: que el libro explique lo que hay ───────────────────────
do $mig$
declare
  r record;
  v_teo numeric;
  v_live numeric;
  v_anclas int := 0;
begin
  -- Los inventarios y ajustes ya escritos SON anclas: su `saldo_resultante` es el
  -- valor contado o fijado (se escribieron contra el saldo vivo del momento).
  update public.stock_movimientos
     set saldo_fijado = saldo_resultante
   where documento_tipo in ('inventario', 'ajuste') and saldo_fijado is null;

  for r in select s.empresa_id, s.producto_id, coalesce(s.cantidad_actual, 0) as actual
             from public.stock s
            where coalesce(s.cantidad_actual, 0) <> 0
  loop
    v_teo := public.kardex_saldo_teorico(r.empresa_id, r.producto_id);
    v_live := r.actual;
    if abs(v_live - v_teo) >= 0.0005 then
      -- El libro no explica lo que hay. Se apunta la foto de hoy como ancla en vez de
      -- cambiar las existencias: lo que hay en la estantería es lo que hay.
      insert into public.stock_movimientos (
        empresa_id, producto_id, fecha, tipo, cantidad, signo,
        saldo_resultante, saldo_fijado, referencia, documento_tipo, motivo)
      values (r.empresa_id, r.producto_id, now(), 'entrada', 0, 1,
        v_live, v_live, 'Saldo inicial', 'ajuste',
        'Saldo inicial al activar el recálculo del kardex: estas existencias venían de '
        'antes del histórico de movimientos. No es una corrección, es la foto de partida.');
      v_anclas := v_anclas + 1;
    end if;
  end loop;

  -- Y ahora sí, encadenar todo lo que tenga movimientos.
  for r in select distinct empresa_id, producto_id from public.stock_movimientos loop
    perform public.recalcular_saldos_producto(r.empresa_id, r.producto_id);
  end loop;

  raise notice 'kardex: % anclas de saldo inicial', v_anclas;
end
$mig$;
