-- PRP-074 · F2 — Mesa de incidencias de albaranes: persistencia
--
-- Hasta ahora, cuando un albarán escaneado traía una rareza (falta una página, un
-- recargo que no es mercancía, un nombre ilegible, una línea sin precio, un producto
-- que no está en catálogo), NADA de eso se guardaba: se detectaba a ojo, se apuntaba
-- en un .md y se le preguntaba al cliente por WhatsApp.
--
-- Esta tabla convierte esas anomalías en datos: qué se detectó, qué propuso el
-- sistema, qué decidió la persona, quién y cuándo. Auditable y consultable.
--
-- Decisiones de negocio que la tabla materializa (Iván, 05-ago-2026):
--   · El sistema PROPONE y el humano DECIDE — de ahí que `propuesta` y `decision`
--     sean dos columnas distintas: se guarda lo que se sugirió Y lo que se eligió.
--   · Nada queda fuera de un albarán en silencio: `motivo` es obligatorio cuando la
--     acción elegida lo exige (ignorar una línea, aceptar un descuadre).
--   · Un documento al que le falta una página se guarda MARCADO, no se bloquea ni
--     se pierde: de ahí `albaranes.documento_parcial` + `paginas_esperadas`.
--
-- Idempotente: se puede aplicar dos veces sin efecto.

-- 1. Incidencias ────────────────────────────────────────────────────────────
create table if not exists public.albaran_incidencias (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  albaran_id      uuid references public.albaranes(id) on delete cascade,
  importacion_id  uuid references public.albaran_importaciones(id) on delete set null,

  -- id de la línea dentro del jsonb `albaranes.lineas`. Null = incidencia del
  -- documento entero (falta una página, el total no cuadra, proveedor desconocido).
  linea_id        text,

  tipo            text not null,
  severidad       text not null,

  -- Lo que el sistema VIO (importes leídos, candidatos, equivalencia deducida...).
  detalle         jsonb not null default '{}'::jsonb,
  -- Lo que el sistema PROPUSO, con sus acciones ya rellenadas.
  propuesta       jsonb not null default '{}'::jsonb,

  estado          text not null default 'abierta',
  -- Lo que la persona ELIGIÓ (clave de la acción + payload aplicado).
  decision        jsonb,
  motivo          text,
  decidida_por    uuid references auth.users(id) on delete set null,
  decidida_at     timestamptz,

  created_at      timestamptz not null default now(),

  -- Catálogo CERRADO de tipos (PRP-074). Añadir uno es un cambio consciente aquí
  -- y en `detectar-incidencias.ts`, nunca un caso suelto en un documento.
  constraint albaran_incidencias_tipo_chk check (tipo in (
    -- Grupo 1 · integridad del documento
    'documento_incompleto',
    'total_descuadrado',
    'documento_ilegible',
    -- Grupo 2 · identidad
    'duplicado_exacto',
    'duplicado_negocio',
    'proveedor_desconocido',
    'datos_fiscales_discrepantes',
    -- Grupo 3 · líneas
    'producto_no_encontrado',
    'producto_ambiguo',
    'linea_de_servicio',
    'linea_sin_importe',
    'formato_sin_equivalencia',
    'precio_anomalo',
    'iva_incoherente'
  )),
  constraint albaran_incidencias_severidad_chk check (
    severidad in ('bloqueante', 'alta', 'media')
  ),
  constraint albaran_incidencias_estado_chk check (
    estado in ('abierta', 'resuelta', 'aceptada_con_motivo', 'descartada')
  ),
  -- Una incidencia cerrada tiene que decir quién y cuándo la cerró.
  constraint albaran_incidencias_decision_chk check (
    estado = 'abierta' or decidida_at is not null
  ),
  -- "Aceptada con motivo" sin motivo escrito no vale: es justo lo que la hace auditable.
  constraint albaran_incidencias_motivo_chk check (
    estado <> 'aceptada_con_motivo' or (motivo is not null and btrim(motivo) <> '')
  )
);

create index if not exists idx_albaran_inc_albaran
  on public.albaran_incidencias (albaran_id);
create index if not exists idx_albaran_inc_importacion
  on public.albaran_incidencias (importacion_id);
-- Para la bandeja "albaranes con incidencias abiertas" de cada empresa.
create index if not exists idx_albaran_inc_abiertas
  on public.albaran_incidencias (empresa_id, estado)
  where estado = 'abierta';

alter table public.albaran_incidencias enable row level security;

drop policy if exists "albaran_inc_select" on public.albaran_incidencias;
drop policy if exists "albaran_inc_insert" on public.albaran_incidencias;
drop policy if exists "albaran_inc_update" on public.albaran_incidencias;
drop policy if exists "albaran_inc_delete" on public.albaran_incidencias;

create policy "albaran_inc_select" on public.albaran_incidencias
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "albaran_inc_insert" on public.albaran_incidencias
  for insert to authenticated
  with check (empresa_id in (select empresas_del_usuario()));

create policy "albaran_inc_update" on public.albaran_incidencias
  for update to authenticated
  using (empresa_id in (select empresas_del_usuario()));

-- Sin DELETE: una incidencia resuelta es la prueba de por qué el albarán quedó
-- como quedó. Se descarta con estado='descartada', no se borra.

comment on table public.albaran_incidencias is
  'PRP-074 — anomalías detectadas al escanear un albarán, con la propuesta del sistema y la decisión humana. El sistema propone, el humano decide.';

-- 2. Documento parcial ──────────────────────────────────────────────────────
-- Para el caso "SUMA Y SIGUE": el albarán se guarda con lo que sí se pudo leer,
-- marcado, y reclama la página que falta. Ni se bloquea ni se pierde.
alter table public.albaranes
  add column if not exists documento_parcial boolean not null default false;
alter table public.albaranes
  add column if not exists paginas_esperadas int;

comment on column public.albaranes.documento_parcial is
  'PRP-074 — true si se cargó sabiendo que falta al menos una página ("SUMA Y SIGUE").';

-- 3. Alias de formato por proveedor ─────────────────────────────────────────
-- Regla de Iván: un formato es un NÚMERO y una MEDIDA (24 ud, 5 L, 3 kg), y el
-- stock es cantidad × contenido. Cada proveedor escribe su formato a su manera
-- ("CJ. 12x1L", "PACK-6", "caja de 24"): aquí se memoriza cómo lo llama CADA UNO,
-- igual que `producto_proveedor_aliases` memoriza cómo llama al producto.
create table if not exists public.producto_formato_aliases (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  proveedor_id        uuid references public.proveedores(id) on delete cascade,
  producto_id         uuid references public.productos(id) on delete cascade,

  -- El texto tal cual lo imprime el proveedor.
  alias               text not null,
  alias_normalizado   text not null,

  -- Las dos partes del formato.
  contenido           numeric not null check (contenido > 0),
  medida              text not null check (medida in ('ud', 'kg', 'l')),

  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- Un mismo texto no puede significar dos cosas para el mismo proveedor y producto.
create unique index if not exists uq_formato_alias
  on public.producto_formato_aliases (
    empresa_id,
    coalesce(proveedor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(producto_id, '00000000-0000-0000-0000-000000000000'::uuid),
    alias_normalizado
  );

alter table public.producto_formato_aliases enable row level security;

drop policy if exists "formato_alias_select" on public.producto_formato_aliases;
drop policy if exists "formato_alias_insert" on public.producto_formato_aliases;
drop policy if exists "formato_alias_update" on public.producto_formato_aliases;
drop policy if exists "formato_alias_delete" on public.producto_formato_aliases;

create policy "formato_alias_select" on public.producto_formato_aliases
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "formato_alias_insert" on public.producto_formato_aliases
  for insert to authenticated
  with check (empresa_id in (select empresas_del_usuario()));

create policy "formato_alias_update" on public.producto_formato_aliases
  for update to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "formato_alias_delete" on public.producto_formato_aliases
  for delete to authenticated
  using (empresa_id in (select empresas_del_usuario()));

comment on table public.producto_formato_aliases is
  'PRP-074 — cómo llama cada proveedor a un formato y cuánto contiene (número + medida). El stock es cantidad × contenido.';
