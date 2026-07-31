-- ============================================================
-- 20260731190000_cierres_documentos_multiples.sql
-- CIERRES (Gerencia): permite adjuntar VARIOS documentos por cierre/ingreso
-- (máximo 3, controlado en la aplicación) en lugar de uno solo.
--
-- Se añade una columna JSONB `documentos` que guarda un array de objetos:
--   [{ "path": "...", "name": "...", "size": 12345, "mime": "application/pdf" }, ...]
--
-- Se conservan las columnas antiguas (storage_path/file_name/size_bytes/mime_type)
-- por compatibilidad: el backend las sigue leyendo como fallback si `documentos`
-- está vacío. Este script migra el documento único existente al nuevo array.
-- Idempotente.
-- ============================================================

alter table public.cierres_semanales
  add column if not exists documentos jsonb not null default '[]'::jsonb;

-- Backfill: convertir el documento único legacy en un array de un elemento,
-- solo para filas que aún no tengan `documentos` poblado y sí tengan storage_path.
update public.cierres_semanales
set documentos = jsonb_build_array(
      jsonb_build_object(
        'path', storage_path,
        'name', coalesce(file_name, 'documento'),
        'size', coalesce(size_bytes, 0),
        'mime', mime_type
      )
    )
where storage_path is not null
  and (documentos is null or jsonb_array_length(documentos) = 0);
