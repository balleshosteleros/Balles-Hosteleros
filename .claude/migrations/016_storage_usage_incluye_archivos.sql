-- PRP-079 (corrección) — La cuota por empresa no contaba los Archivos.
-- Aplicada en producción el 2026-08-27. Idempotente (create or replace).
--
-- `storage_usage_por_empresa` sumaba solo grabaciones de pantalla y cámaras.
-- Con la herramienta Archivos guardando fotos, vídeos y documentos en el MISMO
-- bucket de R2, esos bytes quedaban fuera:
--
--   · En Ajustes el total salía MENOR que el desglose ("3,7 MB en total" con
--     "Archivos: 5,3 MB"), que es imposible.
--   · Peor: `presignSubida` valida la cuota contra esta vista, así que se podía
--     superar el límite contratado sin que nada avisara.
--
-- Se añade `documentos` (solo lo que vive en R2: `r2_key not null`; lo antiguo
-- de Supabase Storage no ocupa cuota de R2).
create or replace view public.storage_usage_por_empresa as
 SELECT e.id AS empresa_id,
    e.nombre AS empresa_nombre,
    (COALESCE(r.bytes, 0::numeric)
     + COALESCE(c.bytes, 0::numeric)
     + COALESCE(d.bytes, 0::numeric))::bigint AS bytes_used,
    e.storage_limit_bytes AS bytes_limit,
    (COALESCE(r.files, 0::bigint)
     + COALESCE(c.files, 0::bigint)
     + COALESCE(d.files, 0::bigint))::integer AS files_count
   FROM empresas e
     LEFT JOIN ( SELECT recordings.empresa_id,
            sum(recordings.file_size) AS bytes,
            count(recordings.id) AS files
           FROM recordings
          GROUP BY recordings.empresa_id) r ON r.empresa_id = e.id
     LEFT JOIN ( SELECT camara_grabaciones.empresa_id,
            sum(camara_grabaciones.file_size) AS bytes,
            count(camara_grabaciones.id) AS files
           FROM camara_grabaciones
          GROUP BY camara_grabaciones.empresa_id) c ON c.empresa_id = e.id
     LEFT JOIN ( SELECT documentos.empresa_id,
            sum(documentos.tamano_bytes) AS bytes,
            count(documentos.id) AS files
           FROM documentos
          WHERE documentos.r2_key IS NOT NULL
          GROUP BY documentos.empresa_id) d ON d.empresa_id = e.id;
