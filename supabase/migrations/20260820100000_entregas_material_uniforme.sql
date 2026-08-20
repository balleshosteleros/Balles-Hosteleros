-- ============================================================
-- ENTREGAS DE MATERIAL Y UNIFORME
--
-- RRHH registra lo que entrega a un trabajador (uniforme o material),
-- el trabajador lo firma como recibido y queda en su ficha.
--
-- Tres piezas:
--   1) entregas_tipos_material  -> catálogo por empresa (las "palabras clave"
--      que cada empresa se crea: Camiseta, Chaquetilla, Llaves, Taquilla...).
--      Cada tipo dice si es UNIFORME o MATERIAL y si lleva talla.
--   2) entregas_material        -> la entrega (cabecera): a quién, cuándo,
--      quién la hizo, nota libre a mano, estado y firma asociada.
--   3) entregas_material_items  -> qué se entregó en esa entrega: tipo,
--      cantidad, talla, y si se ha devuelto (offboarding).
--
-- Igual que `tipos_contrato` / `jornadas`, la línea guarda el NOMBRE del tipo
-- además del id: así el histórico no se reescribe si luego se borra el tipo.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Catálogo de tipos (configurable por empresa)
-- ------------------------------------------------------------
create table if not exists public.entregas_tipos_material (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  -- 'uniforme' = ropa que viste el trabajador; 'material' = todo lo demás
  -- (llaves, taquilla, EPI, dispositivos...).
  categoria text not null default 'material' check (categoria in ('uniforme', 'material')),
  -- Si es true, al entregarlo se pide talla (camiseta, pantalón, calzado...).
  requiere_talla boolean not null default false,
  -- Si es true, al salir el trabajador tiene que devolverlo (llaves, taquilla).
  -- Si es false, se lo queda (camiseta de trabajo ya usada, por ejemplo).
  requiere_devolucion boolean not null default false,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists entregas_tipos_material_empresa_nombre_uk
  on public.entregas_tipos_material (empresa_id, lower(nombre));
create index if not exists entregas_tipos_material_empresa_idx
  on public.entregas_tipos_material (empresa_id, categoria, orden);

comment on table public.entregas_tipos_material is
  'Catálogo por empresa de lo que se puede entregar a un trabajador. Se configura en RRHH.';
comment on column public.entregas_tipos_material.categoria is
  'uniforme = ropa de trabajo; material = llaves, taquilla, EPI, dispositivos.';
comment on column public.entregas_tipos_material.requiere_devolucion is
  'true = en el offboarding hay que confirmar que lo ha devuelto.';

alter table public.entregas_tipos_material enable row level security;

drop policy if exists entregas_tipos_material_select on public.entregas_tipos_material;
create policy entregas_tipos_material_select on public.entregas_tipos_material for select
  using (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists entregas_tipos_material_insert on public.entregas_tipos_material;
create policy entregas_tipos_material_insert on public.entregas_tipos_material for insert
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists entregas_tipos_material_update on public.entregas_tipos_material;
create policy entregas_tipos_material_update on public.entregas_tipos_material for update
  using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists entregas_tipos_material_delete on public.entregas_tipos_material;
create policy entregas_tipos_material_delete on public.entregas_tipos_material for delete
  using (empresa_id in (select public.empresas_del_usuario()));

-- ------------------------------------------------------------
-- 2) La entrega (cabecera)
-- ------------------------------------------------------------
create table if not exists public.entregas_material (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fecha date not null default current_date,
  -- Texto libre que RRHH escribe a mano debajo de la entrega.
  nota text,
  -- pendiente_firma = enviada al trabajador; firmada = ya la reconoció;
  -- rechazada = dijo que no la recibió así.
  estado text not null default 'pendiente_firma'
    check (estado in ('borrador', 'pendiente_firma', 'firmada', 'rechazada')),
  -- Enlace al documento del sistema de firma (acta de entrega).
  firma_id uuid references public.firmas_documentos(id) on delete set null,
  firmada_en timestamptz,
  entregado_por uuid references auth.users(id) on delete set null,
  entregado_por_nombre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entregas_material_empleado_idx
  on public.entregas_material (empleado_id, fecha desc);
create index if not exists entregas_material_empresa_idx
  on public.entregas_material (empresa_id, estado);

comment on table public.entregas_material is
  'Entrega de uniforme/material a un trabajador. Se firma y queda en su ficha.';
comment on column public.entregas_material.nota is
  'Texto libre a mano que RRHH añade debajo de la entrega.';
comment on column public.entregas_material.entregado_por_nombre is
  'Nombre congelado de quien entregó, para que el histórico no dependa del usuario.';

alter table public.entregas_material enable row level security;

-- El trabajador ve SUS entregas; RRHH ve las de su empresa.
drop policy if exists entregas_material_select on public.entregas_material;
create policy entregas_material_select on public.entregas_material for select
  using (
    empresa_id in (select public.empresas_del_usuario())
    or empleado_id in (select id from public.empleados where user_id = auth.uid())
  );
drop policy if exists entregas_material_insert on public.entregas_material;
create policy entregas_material_insert on public.entregas_material for insert
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists entregas_material_update on public.entregas_material;
create policy entregas_material_update on public.entregas_material for update
  using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists entregas_material_delete on public.entregas_material;
create policy entregas_material_delete on public.entregas_material for delete
  using (empresa_id in (select public.empresas_del_usuario()));

-- ------------------------------------------------------------
-- 3) Las líneas de la entrega
-- ------------------------------------------------------------
create table if not exists public.entregas_material_items (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references public.entregas_material(id) on delete cascade,
  -- Se guarda el id (para saber si aún existe el tipo) Y el nombre y categoría
  -- congelados (para que el acta firmada siga diciendo lo mismo dentro de 3 años).
  tipo_id uuid references public.entregas_tipos_material(id) on delete set null,
  tipo_nombre text not null,
  categoria text not null default 'material' check (categoria in ('uniforme', 'material')),
  cantidad integer not null default 1 check (cantidad > 0),
  talla text,
  requiere_devolucion boolean not null default false,
  -- Offboarding: cuándo se confirmó la devolución y quién la confirmó.
  devuelto_en timestamptz,
  devuelto_por uuid references auth.users(id) on delete set null,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists entregas_material_items_entrega_idx
  on public.entregas_material_items (entrega_id, orden);

comment on column public.entregas_material_items.tipo_nombre is
  'Nombre congelado del tipo: el acta firmada no puede cambiar si luego se borra el tipo.';
comment on column public.entregas_material_items.devuelto_en is
  'Se rellena en el offboarding cuando RRHH confirma que lo ha devuelto.';

alter table public.entregas_material_items enable row level security;

-- Los items heredan la visibilidad de su entrega.
drop policy if exists entregas_material_items_select on public.entregas_material_items;
create policy entregas_material_items_select on public.entregas_material_items for select
  using (
    entrega_id in (
      select id from public.entregas_material
      where empresa_id in (select public.empresas_del_usuario())
         or empleado_id in (select id from public.empleados where user_id = auth.uid())
    )
  );
drop policy if exists entregas_material_items_insert on public.entregas_material_items;
create policy entregas_material_items_insert on public.entregas_material_items for insert
  with check (
    entrega_id in (
      select id from public.entregas_material
      where empresa_id in (select public.empresas_del_usuario())
    )
  );
drop policy if exists entregas_material_items_update on public.entregas_material_items;
create policy entregas_material_items_update on public.entregas_material_items for update
  using (
    entrega_id in (
      select id from public.entregas_material
      where empresa_id in (select public.empresas_del_usuario())
    )
  )
  with check (
    entrega_id in (
      select id from public.entregas_material
      where empresa_id in (select public.empresas_del_usuario())
    )
  );
drop policy if exists entregas_material_items_delete on public.entregas_material_items;
create policy entregas_material_items_delete on public.entregas_material_items for delete
  using (
    entrega_id in (
      select id from public.entregas_material
      where empresa_id in (select public.empresas_del_usuario())
    )
  );

-- ------------------------------------------------------------
-- 4) Carpeta "entregas" en los documentos del empleado
--    (para que el acta firmada aparezca en su portal)
-- ------------------------------------------------------------
alter table public.documentos_empleado
  drop constraint if exists documentos_empleado_categoria_check;
alter table public.documentos_empleado
  add constraint documentos_empleado_categoria_check
  check (categoria in (
    'nominas', 'contratos', 'justificantes', 'registros-jornada', 'sanciones', 'entregas'
  ));

-- ------------------------------------------------------------
-- 5) Seed de tipos canónicos en TODAS las empresas (idempotente)
-- ------------------------------------------------------------
insert into public.entregas_tipos_material
  (empresa_id, nombre, categoria, requiere_talla, requiere_devolucion, orden)
select e.id, c.nombre, c.categoria, c.requiere_talla, c.requiere_devolucion, c.orden
from public.empresas e
cross join (values
  -- Uniforme
  ('Camiseta',                    'uniforme', true,  false, 1),
  ('Camisa',                      'uniforme', true,  false, 2),
  ('Pantalón',                    'uniforme', true,  false, 3),
  ('Chaquetilla de cocina',       'uniforme', true,  false, 4),
  ('Delantal',                    'uniforme', false, false, 5),
  ('Mandil',                      'uniforme', false, false, 6),
  ('Gorro',                       'uniforme', false, false, 7),
  ('Calzado antideslizante',      'uniforme', true,  false, 8),
  -- Material
  ('Calzado de seguridad',        'material', true,  false, 20),
  ('Guantes',                     'material', true,  false, 21),
  ('Llaves del local',            'material', false, true,  22),
  ('Taquilla',                    'material', false, true,  23),
  ('Tarjeta de acceso',           'material', false, true,  24),
  ('Teléfono móvil',              'material', false, true,  25),
  ('Otros',                       'material', false, false, 99)
) as c(nombre, categoria, requiere_talla, requiere_devolucion, orden)
where not exists (
  select 1 from public.entregas_tipos_material x
  where x.empresa_id = e.id and lower(x.nombre) = lower(c.nombre)
);
