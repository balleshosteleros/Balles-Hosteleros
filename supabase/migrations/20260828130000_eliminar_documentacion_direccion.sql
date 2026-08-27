-- ============================================================
-- Eliminar los restos del submódulo Dirección → Documentación
--
-- El submódulo se ha borrado del código: toda la documentación vive
-- ahora en Archivos. Quedan en la BD piezas que solo servían a aquel
-- submódulo y que nunca llegaron a usarse:
--
--  1. El trigger + la función que sembraban CONTRATOS / FISCALIDAD /
--     ANTIGUOS en cada empresa nueva. Archivos crea sus propias raíces
--     por departamento (es_raiz = true), así que estas carpetas nacían
--     ya invisibles: `listCarpetas()` filtra por `es_raiz`.
--  2. Las 6 carpetas semilla que ese trigger dejó (2 empresas × 3),
--     todas vacías: 0 documentos y 0 subcarpetas.
--  3. Las policies del bucket de Storage `documentacion`, que tenía
--     0 objetos. El bucket en sí se borró con la Storage API: Supabase
--     prohíbe el DELETE directo sobre storage.buckets
--     (storage.protect_delete → 42501).
--
-- NO se tocan las tablas `documentos` ni `carpetas_documentos`: nacieron
-- para Dirección pero hoy son la base de Archivos.
--
-- Comprobado antes de escribir esta migración:
--   documentos                          → 0 filas
--   storage.objects (documentacion)     → 0 objetos
--   carpetas con departamento IS NULL   → 6, todas sin docs ni hijas
--
-- Idempotente: se puede aplicar más de una vez sin efecto adicional.
-- ============================================================

-- ── 1. Dejar de sembrar carpetas del submódulo eliminado ────
DROP TRIGGER  IF EXISTS empresas_seed_carpetas_documentos ON public.empresas;
DROP FUNCTION IF EXISTS public.tg_seed_carpetas_documentos();
DROP FUNCTION IF EXISTS public.seed_carpetas_documentos_default(uuid);

-- ── 2. Borrar las carpetas semilla huérfanas ────────────────
-- Se acota con triple guarda (sin departamento, sin documentos y sin
-- subcarpetas) para no rozar nada de Archivos aunque algo hubiera
-- cambiado entre la comprobación y la ejecución.
DELETE FROM public.carpetas_documentos c
WHERE c.departamento IS NULL
  AND c.es_raiz IS NOT TRUE
  AND c.parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.documentos d          WHERE d.carpeta_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.carpetas_documentos h WHERE h.parent_id  = c.id);

-- ── 3. Políticas de Storage del bucket eliminado ────────────
-- OJO: `doc_candidatos_read` NO se toca, es del bucket
-- `documentacion-candidatos` (Reclutamiento), que sigue en uso.
DROP POLICY IF EXISTS "documentacion_read"   ON storage.objects;
DROP POLICY IF EXISTS "documentacion_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentacion_update" ON storage.objects;
DROP POLICY IF EXISTS "documentacion_delete" ON storage.objects;
