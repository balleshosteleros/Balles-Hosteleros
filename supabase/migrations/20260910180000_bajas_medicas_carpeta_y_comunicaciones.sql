-- Dos piezas que necesita el circuito de BAJAS MEDICAS, independientes entre si.
--
--   1. Carpeta "Bajas medicas" en los documentos del trabajador. La taxonomia de
--      carpetas es una lista CERRADA fijada en un CHECK: sin ampliarla, guardar
--      el parte del medico o el comprobante de la gestoria ahi lo rechaza la BD.
--
--   2. Historial de COMUNICACIONES por solicitud. Hoy, cuando una solicitud
--      manda un correo o un aviso, no queda rastro: nadie puede saber si a la
--      gestoria le llego, si el trabajador lo vio, o si alguien lo mando dos
--      veces. Se apunta cada salida con su via, su destinatario, cuando y quien.
--
-- Idempotente: se puede aplicar varias veces sin efecto.

-- 1. Carpeta "Bajas medicas" ────────────────────────────────────────────────
--
-- El parte que trae el trabajador del medico y el comprobante que devuelve la
-- gestoria tras tramitarla. Los dos se nombran por el primer dia de la baja, no
-- por el nombre del fichero que suba cada uno.
alter table public.documentos_empleado
  drop constraint if exists documentos_empleado_categoria_check;

alter table public.documentos_empleado
  add constraint documentos_empleado_categoria_check
  check (categoria = any (array[
    'nominas',
    'contratos',
    'justificantes',
    'registros-jornada',
    'sanciones',
    'entregas',
    'bajas-medicas'
  ]::text[]));

-- 2. Historial de comunicaciones ────────────────────────────────────────────
--
-- Generico a proposito (`ref_tabla` + `ref_id`): nace para las solicitudes, pero
-- cualquier cosa del sistema que mande un correo o un aviso puede apuntarse aqui
-- sin tocar el esquema otra vez.
create table if not exists public.comunicaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,

  -- A que se refiere: p.ej. ('solicitudes_personal', <id de la solicitud>).
  ref_tabla text not null,
  ref_id uuid not null,

  -- Por que via salio.
  via text not null check (via in ('email', 'notificacion', 'push')),

  -- Que se mando: el asunto del correo o el titulo del aviso.
  asunto text not null,

  -- A quien, en legible ("Gestoria", "Gerencia", "Laura Ortega Ruiz").
  destinatario text not null,
  -- El correo real, solo cuando via = 'email'. Para poder comprobar a donde fue.
  destino_email text,

  -- Como acabo. Un envio fallido SE GUARDA: que no salga es justo lo que hay que
  -- poder ver despues.
  estado text not null default 'enviado' check (estado in ('enviado', 'fallido')),
  error text,

  -- Quien lo mando. `automatico` = lo lanzo el sistema (un cron, una regla), y
  -- entonces `enviado_por` va vacio. El nombre se copia para que el historial
  -- siga siendo legible aunque esa persona se dé de baja.
  automatico boolean not null default false,
  enviado_por uuid references auth.users (id) on delete set null,
  enviado_por_nombre text,

  created_at timestamptz not null default now()
);

-- El acceso normal: "dame las comunicaciones de ESTA solicitud, la ultima arriba".
create index if not exists idx_comunicaciones_ref
  on public.comunicaciones (ref_tabla, ref_id, created_at desc);

create index if not exists idx_comunicaciones_empresa
  on public.comunicaciones (empresa_id, created_at desc);

alter table public.comunicaciones enable row level security;

drop policy if exists "comunicaciones_select" on public.comunicaciones;
drop policy if exists "comunicaciones_insert" on public.comunicaciones;

create policy "comunicaciones_select" on public.comunicaciones
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "comunicaciones_insert" on public.comunicaciones
  for insert to authenticated
  with check (empresa_id in (select empresas_del_usuario()));

-- Sin UPDATE ni DELETE: un historial que se puede reescribir no prueba nada.
-- Lo que salio, salio. Si un envio se repite, se apunta una linea nueva.

comment on table public.comunicaciones is
  'Historial de lo que el sistema ha mandado fuera (correo, aviso, push) por cada cosa: via, que, a quien, cuando y quien lo mando. Solo se anade; no se edita ni se borra.';
