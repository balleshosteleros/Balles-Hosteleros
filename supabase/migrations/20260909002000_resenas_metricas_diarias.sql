-- Foto diaria de la reputación pública de cada local.
--
-- POR QUÉ:
-- Google solo devuelve 5 reseñas por consulta (de ahí que solo tengamos ~50
-- guardadas de las casi 5.000 reales), así que contar filas de `resenas` NO
-- dice cuántas reseñas tiene el local ni cuántas entran cada día. Lo que sí da
-- Google, y es exacto, es el CONTADOR TOTAL de la ficha y su nota media.
--
-- Guardando esa foto cada día se obtiene lo único que se puede medir de verdad:
-- cuántas reseñas nuevas entran por jornada. Sin este histórico, cualquier
-- afirmación sobre "cuántas reseñas nos trae el circuito de valoraciones" es
-- una correlación sin línea base — es decir, no vale nada.
--
-- ⚠️ NO permite atribución individual: Google no dice quién escribió cada
-- reseña ni por dónde entró. Esto mide el AGREGADO (ritmo antes/después), que
-- es lo máximo defendible.

create table if not exists public.resenas_metricas_diarias (
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  -- Día en la zona horaria de la empresa, no del servidor.
  fecha        date not null,
  plataforma   text not null default 'google',
  -- Contador total de la ficha. Es el dato que hace útil a esta tabla.
  total_resenas integer,
  -- Nota media publicada (0-5, con un decimal).
  nota_media   numeric(2,1),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (empresa_id, fecha, plataforma)
);

comment on table public.resenas_metricas_diarias is
  'Foto diaria del total de reseñas y la nota media de la ficha pública de cada local. Línea base para medir el efecto de las campañas de reseñas.';

create index if not exists idx_resenas_metricas_empresa_fecha
  on public.resenas_metricas_diarias (empresa_id, fecha desc);

alter table public.resenas_metricas_diarias enable row level security;

-- Lectura para quien tenga acceso a la empresa; la escritura la hace el cron
-- con service-role, que se salta la RLS.
drop policy if exists resenas_metricas_select on public.resenas_metricas_diarias;
create policy resenas_metricas_select
  on public.resenas_metricas_diarias
  for select
  using (empresa_id in (select public.empresas_del_usuario()));
