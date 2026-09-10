-- Carta digital: "AGOTADO" marcado por cocina durante el servicio.
--
-- POR QUÉ NO SE REUTILIZA `oculto`:
-- `oculto` es una pausa editorial ("en agosto no lo hacemos"): el plato
-- desaparece de la carta. Agotarse es otra cosa: el plato SIGUE en la carta,
-- en gris y con el rótulo "Agotado", para que el comensal sepa que existe y
-- que hoy se ha acabado —y no se lo pida al camarero—. Mezclarlos obligaría a
-- adivinar por el motivo cuál de las dos cosas quiso decir cocina.
--
-- POR QUÉ UNA FECHA Y NO UN BOOLEANO:
-- Un interruptor suelto se queda encendido. Guardando el DÍA DE SERVICIO en
-- que se marcó, el plato vuelve solo cuando arranca el día siguiente (corte a
-- las 06:00: la madrugada es el mismo servicio) sin que nadie tenga que
-- acordarse de apagarlo ni hacer falta un proceso nocturno que lo limpie.

alter table public.carta_items
  add column if not exists agotado_dia date,
  add column if not exists agotado_por uuid references public.usuarios(id) on delete set null,
  add column if not exists agotado_at timestamptz;

comment on column public.carta_items.agotado_dia is
  'Dia de servicio (corte 06:00, zona de la empresa) en que cocina marco el plato como agotado. El plato sale "Agotado" solo si coincide con el dia de servicio actual; al dia siguiente vuelve solo. NULL = disponible.';
comment on column public.carta_items.agotado_por is
  'Quien marco el agotado. Para saber a quien preguntar cuando un plato aparece caido.';
comment on column public.carta_items.agotado_at is
  'Instante exacto del marcado (UTC).';

-- La carta publica pregunta "que hay agotado hoy" por empresa: sin indice eso
-- es un recorrido de toda la tabla en cada carga de carta.
create index if not exists carta_items_agotado_idx
  on public.carta_items (empresa_id, agotado_dia)
  where agotado_dia is not null;
