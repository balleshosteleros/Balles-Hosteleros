-- ============================================================
-- 20260814180000_modelos_casillas_origen_justificante.sql
-- Las casillas de un modelo pueden venir de DOS sitios distintos, y no deben
-- confundirse NUNCA:
--
--   · 'calculado' → las calculó el motor interno a partir de facturas/nóminas.
--                   Es una PROPUESTA nuestra, revisable.
--   · 'gestoria'  → se leyeron del justificante AEAT ya presentado (PDF real).
--                   Es el DATO OFICIAL: lo que consta presentado ante Hacienda.
--
-- Guardar el origen es lo que permite que las gráficas internas se construyan
-- sobre datos reales presentados y no sobre borradores.
--
-- Se añade además la trazabilidad del justificante (CSV, nº de justificante,
-- fecha de presentación real y enlace al documento de origen en Drive), para
-- poder abrir el original y verificar cualquier cifra.
-- Idempotente.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'modelo_casillas_origen') then
    create type public.modelo_casillas_origen as enum ('calculado', 'gestoria');
  end if;
end $$;

alter table public.modelos_aeat
  add column if not exists casillas_origen public.modelo_casillas_origen not null default 'calculado',
  -- Confianza 0..1 de la lectura por IA (solo cuando casillas_origen='gestoria').
  add column if not exists casillas_confianza numeric,
  -- Código Seguro de Verificación del justificante AEAT: permite comprobar el
  -- documento en la Sede y detectar duplicados.
  add column if not exists csv_aeat text,
  add column if not exists numero_justificante text,
  -- Enlace al documento ORIGINAL (Drive u origen externo), para el acceso
  -- directo desde la ficha del modelo.
  add column if not exists documento_origen_url text,
  add column if not exists documento_origen_nombre text;

comment on column public.modelos_aeat.casillas_origen is
  'De dónde salen las casillas: calculado (motor interno) | gestoria (leídas del justificante AEAT presentado).';
comment on column public.modelos_aeat.csv_aeat is
  'Código Seguro de Verificación del justificante AEAT (comprobable en la Sede).';
comment on column public.modelos_aeat.documento_origen_url is
  'URL del documento original (p. ej. Drive) para abrirlo desde la ficha del modelo.';

-- Un mismo justificante no debe importarse dos veces en la misma empresa.
create unique index if not exists modelos_aeat_csv_unico
  on public.modelos_aeat (empresa_id, csv_aeat)
  where csv_aeat is not null;
