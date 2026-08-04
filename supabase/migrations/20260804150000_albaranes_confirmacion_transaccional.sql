-- ============================================================
-- 20260804150000_albaranes_confirmacion_transaccional.sql
-- PRP-073 Etapa B (F3a + F4): cantidades por formato y confirmación atómica.
--
-- Problema que mata: hoy `updateAlbaranEstado` cambia el estado y DESPUÉS
-- aplica stock ("éxito con aviso" si falla → albarán Confirmado sin stock), y
-- las entradas suman `cantidad` del documento tal cual (3 cajas → 3 al kardex,
-- no 72). Esta función hace TODO en una transacción con el albarán bloqueado:
--   validar → resolver equivalencias (F3a) → precios → movimientos + saldo →
--   estado → evento. Cualquier fallo = rollback completo, sigue en Revisión.
--
-- Equivalencias (F3a): cantidadStock = cantidad × equivalencia, donde la
-- equivalencia sale de `formatos` (tipo compra, por nombre del formato o de la
-- unidad de la línea) o es 1 si la unidad ya es la base del producto. Una
-- unidad CONTENEDORA (caja, pack, saco...) sin equivalencia definida BLOQUEA
-- con instrucciones (crear el formato de compra con su equivalencia). El
-- snapshot (unidadStock, equivalenciaAplicada, cantidadStock) queda en la línea.
--
-- Columnas de guardado parcial (F4): revision_version (optimista),
-- revision_guardada_at/por. La UI de autosave llega en la Etapa C (F5).
-- Idempotente.
-- ============================================================

alter table public.albaranes add column if not exists revision_version integer not null default 0;
alter table public.albaranes add column if not exists revision_guardada_at timestamptz;
alter table public.albaranes add column if not exists revision_guardada_por uuid;

create or replace function public.confirmar_albaran_transaccional(
  p_albaran_id uuid,
  p_estado_destino text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  v_saldo numeric;
  v_origen uuid;
  v_aplicados int := 0; v_omitidos int := 0; v_precios int := 0;
  v_contenedoras text[] := array['caja','cajas','cja','cj','pack','packs','bandeja','bandejas',
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
  for v_mov in
    select id, producto_id, cantidad, signo from stock_movimientos
     where empresa_id = v_alb.empresa_id and documento_tipo = 'albaran' and documento_id = v_alb.id
  loop
    update stock set cantidad_actual = coalesce(cantidad_actual, 0) - v_mov.signo * v_mov.cantidad,
                     ultimo_movimiento = now()
     where empresa_id = v_alb.empresa_id and producto_id = v_mov.producto_id;
  end loop;
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

    -- Stock: candado controla_stock + movimiento + saldo materializado, con la fila bloqueada.
    if coalesce(v_prod.controla_stock, true) = false then
      v_omitidos := v_omitidos + 1; continue;
    end if;
    select coalesce(cantidad_actual, 0) into v_saldo from stock
     where empresa_id = v_alb.empresa_id and producto_id = v_prod.id for update;
    if not found then
      v_saldo := 0;
      insert into stock (empresa_id, producto_id, producto_nombre, cantidad_actual, unidad, ultimo_movimiento)
      values (v_alb.empresa_id, v_prod.id, v_prod.nombre, 0, v_prod.medida, now());
    end if;
    begin
      v_origen := (v_linea->>'id')::uuid;
    exception when others then
      v_origen := null; -- ids de línea no-uuid (flujos antiguos): sin guarda por origen
    end;
    insert into stock_movimientos (empresa_id, producto_id, fecha, tipo, cantidad, signo,
      saldo_resultante, referencia, documento_tipo, documento_id, origen_linea_id, created_by)
    values (v_alb.empresa_id, v_prod.id, coalesce(v_alb.fecha::timestamptz, now()), 'entrada',
      v_cant_stock, 1, v_saldo + v_cant_stock, v_alb.numero, 'albaran', v_alb.id, v_origen, v_actor);
    update stock set cantidad_actual = v_saldo + v_cant_stock, ultimo_movimiento = now()
     where empresa_id = v_alb.empresa_id and producto_id = v_prod.id;
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
$$;

revoke all on function public.confirmar_albaran_transaccional(uuid, text) from public;
grant execute on function public.confirmar_albaran_transaccional(uuid, text) to authenticated;
