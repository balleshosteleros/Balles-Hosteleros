-- ============================================================
-- 20260513170000_etiquetas_tabs_completo.sql
-- Sistema completo de etiquetas con tabs:
--   - Columna tipo (CATEGORIA|ALERTA|INGRESO|DEPARTAMENTO|EMPLEADO|
--     INFORME|ESTADISTICA|PATRIMONIO)
--   - Reglas de color: categoría hereda paleta libre por (empresa, tipo);
--     sub-etiqueta hereda color + tipo del padre; cambio de color en
--     categoría se cascadea a hijos.
--   - Función seed_etiquetas_categorias_default + trigger AFTER INSERT
--     en empresas → cada nueva empresa recibe el árbol completo de tabs.
--   - Backfill para todas las empresas existentes.
-- ============================================================

alter table public.etiquetas
  add column if not exists tipo text not null default 'CATEGORIA';

alter table public.etiquetas drop constraint if exists etiquetas_tipo_check;
alter table public.etiquetas add constraint etiquetas_tipo_check
  check (tipo in ('CATEGORIA','ALERTA','INGRESO','DEPARTAMENTO','EMPLEADO','INFORME','ESTADISTICA','PATRIMONIO'));

drop index if exists public.etiquetas_empresa_parent_nombre_uniq;
create unique index if not exists etiquetas_empresa_tipo_parent_nombre_uniq
  on public.etiquetas(empresa_id, tipo, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));

create index if not exists idx_etiquetas_empresa_tipo
  on public.etiquetas(empresa_id, tipo, orden);

create or replace function public.pick_next_etiqueta_color(p_empresa_id uuid, p_tipo text default 'CATEGORIA')
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_palette text[] := array[
    '#16a34a','#0891b2','#10b981','#ca8a04','#d97706',
    '#ea580c','#db2777','#6366f1','#a855f7','#0d9488',
    '#dc2626','#3b82f6','#8b5cf6','#84cc16','#f59e0b',
    '#ef4444','#14b8a6','#06b6d4','#22c55e','#f43f5e'
  ];
  v_color text;
  v_used text[];
begin
  select coalesce(array_agg(distinct color), array[]::text[])
    into v_used
  from public.etiquetas
  where empresa_id = p_empresa_id and tipo = p_tipo
    and parent_id is null and color is not null;

  foreach v_color in array v_palette loop
    if not (v_color = any(v_used)) then return v_color; end if;
  end loop;

  return v_palette[1 + floor(random() * array_length(v_palette, 1))::int];
end;
$$;

create or replace function public.etiquetas_enforce_color()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_parent_color text;
  v_parent_tipo text;
begin
  if new.parent_id is null then
    if new.color is null or new.color = '' then
      new.color := public.pick_next_etiqueta_color(new.empresa_id, coalesce(new.tipo, 'CATEGORIA'));
    end if;
  else
    select color, tipo into v_parent_color, v_parent_tipo
    from public.etiquetas where id = new.parent_id;
    new.color := coalesce(v_parent_color, new.color);
    new.tipo := coalesce(v_parent_tipo, new.tipo);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_etiquetas_enforce_color on public.etiquetas;
create trigger trg_etiquetas_enforce_color
before insert or update of parent_id, color, tipo on public.etiquetas
for each row execute function public.etiquetas_enforce_color();

create or replace function public.etiquetas_cascade_color_to_children()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.parent_id is null and (old.color is distinct from new.color) then
    update public.etiquetas set color = new.color
     where parent_id = new.id and color is distinct from new.color;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_etiquetas_cascade_color on public.etiquetas;
create trigger trg_etiquetas_cascade_color
after update of color on public.etiquetas
for each row execute function public.etiquetas_cascade_color_to_children();

-- ============================================================
-- seed_etiquetas_categorias_default(empresa_id)
-- Siembra el árbol completo de todos los tabs. Idempotente.
-- ============================================================
create or replace function public.seed_etiquetas_categorias_default(p_empresa_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent uuid;
  v_cat record;
  v_hijo record;
  v_flat record;
begin
  for v_cat in
    select * from (values
      ('CATEGORIA','Agora',                '💵',  0,  '#16a34a'),
      ('CATEGORIA','Generales',            '📦',  1,  '#0891b2'),
      ('CATEGORIA','Personal',             '👔',  2,  '#10b981'),
      ('CATEGORIA','Producto',             '🥑',  3,  '#ca8a04'),
      ('CATEGORIA','Acuerdos Proveedores', '🗂️',  4,  '#d97706'),
      ('CATEGORIA','Marketing',            '🎆',  5,  '#ea580c'),
      ('CATEGORIA','Tributos',             '📝',  6,  '#db2777'),
      ('CATEGORIA','Inversiones',          '💰',  7,  '#6366f1'),
      ('CATEGORIA','Préstamos',            '🏦',  8,  '#a855f7'),
      ('CATEGORIA','Dividendos',           '✅',  9,  '#0d9488'),
      ('CATEGORIA','Otros',                '❌',  10, '#dc2626'),
      ('INGRESO','Ingreso Efectivo',       '💰',  0,  '#a855f7'),
      ('DEPARTAMENTO','Area Operativa',    '⚙️',  0,  '#0891b2'),
      ('DEPARTAMENTO','Area Administrativa','💻', 1,  '#ea580c')
    ) as t(tipo, nombre, emoji, orden, color)
  loop
    insert into public.etiquetas (empresa_id, nombre, parent_id, emoji, orden, color, tipo, activa)
    values (p_empresa_id, v_cat.nombre, null, v_cat.emoji, v_cat.orden, v_cat.color, v_cat.tipo, true)
    on conflict (empresa_id, tipo, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre))
    do nothing;
  end loop;

  for v_hijo in
    select * from (values
      ('CATEGORIA','Agora','Cobros',0),('CATEGORIA','Agora','Pagos',1),
      ('CATEGORIA','Generales','Servicios',0),('CATEGORIA','Generales','Seguro',1),
      ('CATEGORIA','Generales','Suscripciones',2),('CATEGORIA','Generales','Suministros',3),
      ('CATEGORIA','Generales','Alquileres',4),('CATEGORIA','Generales','Software',5),
      ('CATEGORIA','Generales','Bancos',6),('CATEGORIA','Generales','Amazon',7),
      ('CATEGORIA','Generales','Menaje',8),('CATEGORIA','Generales','Uniformes',9),
      ('CATEGORIA','Generales','Materiales Mantenimiento',10),('CATEGORIA','Generales','Descuadre',11),
      ('CATEGORIA','Generales','Otros',12),
      ('CATEGORIA','Personal','Nominas',0),('CATEGORIA','Personal','Seguros sociales',1),
      ('CATEGORIA','Personal','IRPF',2),('CATEGORIA','Personal','Horas Extras',3),
      ('CATEGORIA','Personal','Descuento',4),('CATEGORIA','Personal','Vacaciones',5),
      ('CATEGORIA','Personal','Propinas',6),
      ('CATEGORIA','Producto','Barra',0),('CATEGORIA','Producto','Cocina',1),
      ('CATEGORIA','Marketing','Publicidad',0),('CATEGORIA','Marketing','Filmaker',1),
      ('CATEGORIA','Marketing','Community',2),('CATEGORIA','Marketing','Imprenta',3),
      ('CATEGORIA','Marketing','Suscripciones',4),('CATEGORIA','Marketing','Servicios',5),
      ('CATEGORIA','Tributos','IVA',0),('CATEGORIA','Tributos','Tasas',1),
      ('CATEGORIA','Tributos','Sanciones',2),('CATEGORIA','Tributos','Autonomo',3),
      ('CATEGORIA','Tributos','Impuesto de Sociedades',4),
      ('CATEGORIA','Inversiones','Reinversión',0),('CATEGORIA','Inversiones','Inversion Inicial',1),
      ('CATEGORIA','Préstamos','Balles Hosteleros',0),('CATEGORIA','Préstamos','Ivan',1),
      ('CATEGORIA','Préstamos','Bacanal',2),
      ('CATEGORIA','Dividendos','Dividendos 2025',0),('CATEGORIA','Dividendos','Dividendos 2026',1),
      ('CATEGORIA','Otros','Ignorar',0),('CATEGORIA','Otros','Movimientos entre cuentas',1),
      ('CATEGORIA','Otros','Fianza',2),('CATEGORIA','Otros','Facturas Externas',3),
      ('CATEGORIA','Otros','Aportacion Socio',4),
      ('INGRESO','Ingreso Efectivo','Ingreso Efectivo Años Anteriores',0),
      ('INGRESO','Ingreso Efectivo','Ingreso Efectivo 1T 2025',1),
      ('INGRESO','Ingreso Efectivo','Ingreso Efectivo 2T 2025',2),
      ('INGRESO','Ingreso Efectivo','Ingreso Efectivo 3T 2025',3),
      ('INGRESO','Ingreso Efectivo','Ingreso Efectivo 4T 2025',4),
      ('INGRESO','Ingreso Efectivo','Ingreso Efectivo 1T 2026',5),
      ('INGRESO','Ingreso Efectivo','Ingreso Efectivo 2T 2026',6),
      ('INGRESO','Ingreso Efectivo','Ingreso Efectivo 3T 2026',7),
      ('INGRESO','Ingreso Efectivo','Ingreso Efectivo 4T 2026',8),
      ('DEPARTAMENTO','Area Operativa','Seguridad',0),
      ('DEPARTAMENTO','Area Operativa','Jefe de sala',1),
      ('DEPARTAMENTO','Area Operativa','Camarero',2),
      ('DEPARTAMENTO','Area Operativa','Limpieza',3),
      ('DEPARTAMENTO','Area Operativa','Artistas',4),
      ('DEPARTAMENTO','Area Operativa','Hoostes',5),
      ('DEPARTAMENTO','Area Operativa','Jefe de cocina',6),
      ('DEPARTAMENTO','Area Operativa','Mantenimiento',7),
      ('DEPARTAMENTO','Area Operativa','Cachimbero',8),
      ('DEPARTAMENTO','Area Administrativa','Marketing',0),
      ('DEPARTAMENTO','Area Administrativa','Dirección',1),
      ('DEPARTAMENTO','Area Administrativa','Contabilidad',2),
      ('DEPARTAMENTO','Area Administrativa','Calidad',3),
      ('DEPARTAMENTO','Area Administrativa','Recursos Humanos',4),
      ('DEPARTAMENTO','Area Administrativa','Gerente',5)
    ) as t(tipo, parent_nombre, nombre, orden)
  loop
    select id into v_parent
    from public.etiquetas
    where empresa_id = p_empresa_id and tipo = v_hijo.tipo
      and parent_id is null and lower(nombre) = lower(v_hijo.parent_nombre)
    limit 1;
    if v_parent is null then continue; end if;
    insert into public.etiquetas (empresa_id, nombre, parent_id, emoji, orden, color, tipo, activa)
    values (p_empresa_id, v_hijo.nombre, v_parent, null, v_hijo.orden, '#6366f1', v_hijo.tipo, true)
    on conflict (empresa_id, tipo, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre))
    do nothing;
  end loop;

  for v_flat in
    select * from (values
      ('ALERTA','Embargo',         '⚠️', 0, '#dc2626'),
      ('ALERTA','Factura',         '⚠️', 1, '#dc2626'),
      ('ALERTA','Revisión',        '⚠️', 2, '#dc2626'),
      ('ALERTA','Nómina',          '⚠️', 3, '#dc2626'),
      ('ALERTA','Devolución',      '⚠️', 4, '#dc2626'),
      ('ALERTA','Revision Tarjeta','⚠️', 5, '#dc2626'),
      ('ALERTA','Pago',            '⚠️', 6, '#dc2626'),
      ('ALERTA','Cobro',           '⚠️', 7, '#dc2626'),
      ('INFORME','Cancelaciones',   '❌', 0, '#dc2626'),
      ('INFORME','Descuentos',      '🧩', 1, '#0891b2'),
      ('INFORME','Inventario',      '🔍', 2, '#ef4444'),
      ('INFORME','Menu Ingenering', '📝', 3, '#ea580c'),
      ('ESTADISTICA','Lunes',     '📊', 0, '#a855f7'),
      ('ESTADISTICA','Martes',    '📊', 1, '#a855f7'),
      ('ESTADISTICA','Miércoles', '📊', 2, '#a855f7'),
      ('ESTADISTICA','Jueves',    '📊', 3, '#a855f7'),
      ('ESTADISTICA','Viernes',   '📊', 4, '#a855f7'),
      ('ESTADISTICA','Sábado',    '📊', 5, '#a855f7'),
      ('ESTADISTICA','Domingo',   '📊', 6, '#a855f7'),
      ('PATRIMONIO','Decoración',     '💰', 0,  '#16a34a'),
      ('PATRIMONIO','Diseño',         '💰', 1,  '#ea580c'),
      ('PATRIMONIO','Impuestos',      '💰', 2,  '#3b82f6'),
      ('PATRIMONIO','Reformas',       '💰', 3,  '#6366f1'),
      ('PATRIMONIO','Intereses',      '💰', 4,  '#ca8a04'),
      ('PATRIMONIO','Mobiliario',     '💰', 5,  '#0891b2'),
      ('PATRIMONIO','Saneamientos',   '💰', 6,  '#a855f7'),
      ('PATRIMONIO','Traspaso',       '💰', 7,  '#8b5cf6'),
      ('PATRIMONIO','Insonorización', '💰', 8,  '#f59e0b'),
      ('PATRIMONIO','Licencias',      '💰', 9,  '#dc2626'),
      ('PATRIMONIO','Maquinaria',     '💰', 10, '#db2777'),
      ('PATRIMONIO','Menaje',         '💰', 11, '#ef4444'),
      ('PATRIMONIO','Otros',          '💰', 12, '#3b82f6'),
      ('PATRIMONIO','Papeleria',      '💰', 13, '#22c55e'),
      ('PATRIMONIO','Marketing',      '💰', 14, '#9ca3af'),
      ('PATRIMONIO','Recibos',        '💰', 15, '#b91c1c'),
      ('PATRIMONIO','Multas',         '💰', 16, '#7c3aed'),
      ('PATRIMONIO','Materia Prima',  '💰', 17, '#f59e0b'),
      ('EMPLEADO','Estefania Chidi',        '👤', 0,  '#0891b2'),
      ('EMPLEADO','Alejandro Mojica',       '👤', 1,  '#16a34a'),
      ('EMPLEADO','Iván Ballesteros',       '👤', 2,  '#dc2626'),
      ('EMPLEADO','James Nosa',             '👤', 3,  '#ca8a04'),
      ('EMPLEADO','Alberto Cielicka',       '👤', 4,  '#0d9488'),
      ('EMPLEADO','Ana Marroqui',           '👤', 5,  '#ea580c'),
      ('EMPLEADO','Carina de la Cruz',      '👤', 6,  '#16a34a'),
      ('EMPLEADO','Cristian Junior',        '👤', 7,  '#b91c1c'),
      ('EMPLEADO','Daniel Cubo',            '👤', 8,  '#a855f7'),
      ('EMPLEADO','David Zaballos',         '👤', 9,  '#ea580c'),
      ('EMPLEADO','Dik Rivera',             '👤', 10, '#10b981'),
      ('EMPLEADO','Javier Casarrubios',     '👤', 11, '#db2777'),
      ('EMPLEADO','Sara Morant',            '👤', 12, '#ea580c'),
      ('EMPLEADO','Andrea Przybylinska',    '👤', 13, '#6366f1'),
      ('EMPLEADO','Karolina',               '👤', 14, '#6366f1'),
      ('EMPLEADO','Manuel Tostado',         '👤', 15, '#db2777'),
      ('EMPLEADO','Adrián',                 '👤', 16, '#9ca3af'),
      ('EMPLEADO','Rodrigo',                '👤', 17, '#db2777'),
      ('EMPLEADO','Sofia Terron',           '👤', 18, '#a855f7'),
      ('EMPLEADO','Karen',                  '👤', 19, '#6366f1'),
      ('EMPLEADO','Theo Weiss',             '👤', 20, '#0d9488'),
      ('EMPLEADO','África Ureña Moreno',    '👤', 21, '#ea580c'),
      ('EMPLEADO','Cristina Ruiz',          '👤', 22, '#db2777'),
      ('EMPLEADO','Daniel Cantalejo',       '👤', 23, '#16a34a'),
      ('EMPLEADO','M Paula Fernandez Vargas','👤',24, '#d97706'),
      ('EMPLEADO','Javier Mora',            '👤', 25, '#a855f7')
    ) as t(tipo, nombre, emoji, orden, color)
  loop
    insert into public.etiquetas (empresa_id, nombre, parent_id, emoji, orden, color, tipo, activa)
    values (p_empresa_id, v_flat.nombre, null, v_flat.emoji, v_flat.orden, v_flat.color, v_flat.tipo, true)
    on conflict (empresa_id, tipo, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre))
    do nothing;
  end loop;
end;
$$;

create or replace function public.empresas_seed_etiquetas_default()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_etiquetas_categorias_default(new.id);
  return new;
end;
$$;

drop trigger if exists trg_empresas_seed_etiquetas on public.empresas;
create trigger trg_empresas_seed_etiquetas
after insert on public.empresas
for each row execute function public.empresas_seed_etiquetas_default();

-- Backfill: para todas las empresas existentes
do $$
declare v_emp record;
begin
  for v_emp in select id from public.empresas loop
    perform public.seed_etiquetas_categorias_default(v_emp.id);
  end loop;
end;
$$;
