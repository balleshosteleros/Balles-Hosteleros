-- ============================================================
-- 20260906230000_rrhh_nominas_bucket_100mb.sql
--
-- El bucket de nóminas sube a 100 MB (el resto de documentos sigue en 50).
--
-- POR QUÉ: el PDF de un mes de nóminas lleva ~1 página por trabajador y la
-- gestoría lo entrega de una vez. Con plantillas grandes, 50 MB se queda corto
-- y obligaría a partir el envío, que es justo lo que se quiso evitar cuando el
-- tope pasó de 25 a 50 MB.
--
-- Solo se toca ESTE bucket: `MAX_DOCUMENTO_MB` (50) lo comparten 72 sitios de
-- la app —justificantes, albaranes, contratos, modelos fiscales…— y ahí 50 MB
-- sigue siendo un tope sano. Las nóminas tienen su propio límite
-- (`MAX_NOMINAS_MB`) precisamente por ser un caso distinto.
--
-- El peso NO limita la lectura por IA: el archivo se parte en páginas y cada
-- una se manda por separado (`extraer-nominas.ts`). El límite real de la
-- lectura son las páginas (MAX_PAGINAS = 200, ~200 trabajadores).
--
-- Idempotente.
-- ============================================================

update storage.buckets
   set file_size_limit = 104857600  -- 100 MB
 where id = 'rrhh-nominas';
