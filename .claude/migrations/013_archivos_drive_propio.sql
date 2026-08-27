-- PRP-079 — Archivos: el Drive propio del software (fotos y vídeos).
-- Aplicada en producción el 2026-08-27. Idempotente.
--
-- Amplía carpetas_documentos/documentos en vez de crear tablas nuevas:
-- `documentos` estaba VACÍA (0 filas) y `carpetas_documentos` solo tenía 6
-- carpetas sin uso, así que no hay contenido que migrar y evitamos quedarnos
-- con dos sistemas de carpetas conviviendo.

-- ── CARPETAS ────────────────────────────────────────────────────────────
alter table public.carpetas_documentos
  add column if not exists departamento text,
  add column if not exists es_raiz boolean not null default false;

create unique index if not exists carpetas_documentos_raiz_uk
  on public.carpetas_documentos (empresa_id, departamento)
  where es_raiz;

create unique index if not exists carpetas_documentos_nombre_uk
  on public.carpetas_documentos (empresa_id, parent_id, lower(nombre))
  where parent_id is not null;

create index if not exists carpetas_documentos_parent_idx
  on public.carpetas_documentos (empresa_id, parent_id);

-- ── ARCHIVOS ────────────────────────────────────────────────────────────
-- `storage_path` era NOT NULL para Supabase Storage; ahora el almacén es R2
-- (`r2_key`). Se relaja para que convivan los dos orígenes.
alter table public.documentos
  alter column storage_path drop not null;

alter table public.documentos
  add column if not exists departamento    text,
  add column if not exists r2_key          text,
  add column if not exists miniatura_key   text,
  add column if not exists ancho           int,
  add column if not exists alto            int,
  add column if not exists duracion_seg    int,
  add column if not exists subido_por      uuid;

create unique index if not exists documentos_r2_key_uk
  on public.documentos (r2_key)
  where r2_key is not null;

create index if not exists documentos_carpeta_idx
  on public.documentos (empresa_id, carpeta_id);

create index if not exists documentos_departamento_idx
  on public.documentos (empresa_id, departamento);

alter table public.documentos
  drop constraint if exists documentos_almacen_chk;
alter table public.documentos
  add constraint documentos_almacen_chk
  check (storage_path is not null or r2_key is not null);

-- ── CARPETA RAÍZ POR DEPARTAMENTO ───────────────────────────────────────
-- Los 11 departamentos coinciden con MODULOS_DEPARTAMENTO de
-- src/features/auth/lib/permisos.ts (fuente única de verdad de permisos).
--
-- `departamento` guarda la clave CANÓNICA (bh_canon) y `nombre` el texto
-- legible. Es obligatorio: `bh_departamentos_usuario` devuelve los
-- departamentos ya pasados por `bh_canon` ("RECURSOS HUMANOS" → "RRHH",
-- "LOGÍSTICA" → "LOGISTICA"). Guardando el nombre largo, la comparación
-- fallaba y RRHH no veía su propia carpeta.
create or replace function public.crear_carpetas_raiz_empresa(p_empresa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  foreach v_nombre in array array[
    'DIRECCIÓN','SALA','COCINA','GERENCIA','CALIDAD','RECURSOS HUMANOS',
    'MARKETING','LOGÍSTICA','CONTABILIDAD','GESTORÍA','JURÍDICO'
  ] loop
    insert into public.carpetas_documentos (empresa_id, nombre, parent_id, departamento, es_raiz)
    values (p_empresa_id, v_nombre, null, public.bh_canon(v_nombre), true)
    on conflict do nothing;
  end loop;
end;
$$;

do $$
declare r record;
begin
  for r in select id from public.empresas loop
    perform public.crear_carpetas_raiz_empresa(r.id);
  end loop;
end $$;

-- Realineado defensivo por si alguna carpeta quedó con el nombre largo.
update public.carpetas_documentos
   set departamento = public.bh_canon(nombre)
 where es_raiz
   and departamento is distinct from public.bh_canon(nombre);

update public.carpetas_documentos c
   set departamento = p.departamento
  from public.carpetas_documentos p
 where c.parent_id = p.id
   and c.departamento is distinct from p.departamento;

create or replace function public.trg_crear_carpetas_raiz_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crear_carpetas_raiz_empresa(new.id);
  return new;
end;
$$;

drop trigger if exists empresas_crear_carpetas_raiz on public.empresas;
create trigger empresas_crear_carpetas_raiz
  after insert on public.empresas
  for each row execute function public.trg_crear_carpetas_raiz_empresa();
