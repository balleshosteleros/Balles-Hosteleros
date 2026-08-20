-- ============================================================
-- Entregas: una entrega = UNA unidad, y la devolución se FIRMA
-- ============================================================
--
-- Dos cambios de fondo sobre el modelo inicial:
--
-- 1) UNA COSA POR ENTREGA, SIN CANTIDAD. Antes una entrega podía llevar varias
--    líneas ("camiseta + llaves + taquilla") y cada línea una cantidad. Eso hacía
--    ambiguo el acta: si el trabajador devuelve las llaves pero no la camiseta,
--    ¿qué dice el documento que firmó? Ahora cada unidad física es su propia
--    entrega, con su propia acta. Tres camisetas son tres entregas.
--    Se conserva la tabla de líneas (una fila por entrega) en vez de aplanarla
--    para no reescribir lo ya grabado ni perder el nombre congelado del tipo.
--
-- 2) LA DEVOLUCIÓN DEJA DE SER UNA CASILLA. Antes RRHH marcaba "devuelto" y la
--    empresa se daba a sí misma por buena la devolución. Ahora el trabajador
--    firma un acta de devolución igual que firmó la de entrega, así que hay
--    constancia por ambas partes de que las llaves volvieron.
--
-- Idempotente: se puede aplicar dos veces sin romper nada.

-- ------------------------------------------------------------
-- 1) Fuera la cantidad: siempre es 1
-- ------------------------------------------------------------
-- Por si hubiera cantidades > 1 grabadas antes de este cambio, cada unidad se
-- convierte en su propia entrega (clonando la cabecera) en vez de perderse.
do $$
declare
  fila record;
  nueva_entrega uuid;
  i integer;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entregas_material_items'
      and column_name = 'cantidad'
  ) then
    for fila in
      select i.id as item_id, i.entrega_id, i.cantidad, e.*
      from public.entregas_material_items i
      join public.entregas_material e on e.id = i.entrega_id
      where i.cantidad > 1
    loop
      for i in 2..fila.cantidad loop
        insert into public.entregas_material
          (empresa_id, empleado_id, fecha, nota, estado, entregado_por, entregado_por_nombre)
        values
          (fila.empresa_id, fila.empleado_id, fila.fecha, fila.nota, fila.estado,
           fila.entregado_por, fila.entregado_por_nombre)
        returning id into nueva_entrega;

        insert into public.entregas_material_items
          (entrega_id, tipo_id, tipo_nombre, categoria, talla, requiere_devolucion)
        select nueva_entrega, tipo_id, tipo_nombre, categoria, talla, requiere_devolucion
        from public.entregas_material_items
        where id = fila.item_id;
      end loop;
    end loop;
  end if;
end $$;

alter table public.entregas_material_items
  drop column if exists cantidad;

-- ------------------------------------------------------------
-- 2) Una sola línea por entrega, garantizado por la base de datos
-- ------------------------------------------------------------
-- Si quedara alguna entrega multilínea de antes, sus líneas extra se separan en
-- entregas propias para poder crear el índice único sin borrar nada.
-- Se ordena por `created_at` (no por `orden`, que se elimina al final de este
-- bloque): la primera línea se queda en su entrega y las demás se separan.
do $$
declare
  fila record;
  nueva_entrega uuid;
begin
  for fila in
    select i.id as item_id, e.*
    from public.entregas_material_items i
    join public.entregas_material e on e.id = i.entrega_id
    where i.id <> (
      select i2.id
      from public.entregas_material_items i2
      where i2.entrega_id = i.entrega_id
      order by i2.created_at, i2.id
      limit 1
    )
  loop
    insert into public.entregas_material
      (empresa_id, empleado_id, fecha, nota, estado, entregado_por, entregado_por_nombre)
    values
      (fila.empresa_id, fila.empleado_id, fila.fecha, fila.nota, fila.estado,
       fila.entregado_por, fila.entregado_por_nombre)
    returning id into nueva_entrega;

    update public.entregas_material_items
      set entrega_id = nueva_entrega
      where id = fila.item_id;
  end loop;
end $$;

create unique index if not exists entregas_material_items_una_por_entrega
  on public.entregas_material_items (entrega_id);

-- `orden` ordenaba las líneas dentro de una entrega. Ya no hay varias.
alter table public.entregas_material_items
  drop column if exists orden;

comment on index public.entregas_material_items_una_por_entrega is
  'Una entrega = una unidad. Tres camisetas son tres entregas, cada una con su acta firmada.';

-- ------------------------------------------------------------
-- 3) Ciclo de devolución con firma
-- ------------------------------------------------------------
-- La devolución es un segundo documento firmado por el trabajador, con su propio
-- estado. `devuelto_en` ya existía en los items; aquí vive el proceso.
alter table public.entregas_material
  add column if not exists devolucion_estado text
    not null default 'no_procede'
    check (devolucion_estado in ('no_procede', 'pendiente_firma', 'devuelta', 'rechazada')),
  add column if not exists devolucion_firma_id uuid
    references public.firmas_documentos(id) on delete set null,
  add column if not exists devolucion_solicitada_en timestamptz,
  add column if not exists devuelta_en timestamptz;

comment on column public.entregas_material.devolucion_estado is
  'no_procede = no hay que devolverlo o aún no se ha pedido. pendiente_firma = se le ha enviado el acta de devolución. devuelta = la ha firmado.';
comment on column public.entregas_material.devolucion_firma_id is
  'Acta de devolución en firmas_documentos. La de entrega vive en firma_id.';

create index if not exists entregas_material_devolucion_idx
  on public.entregas_material (empresa_id, devolucion_estado);
