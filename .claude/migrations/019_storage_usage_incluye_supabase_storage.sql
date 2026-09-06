-- La cuota por empresa no contaba los documentos de Supabase Storage.
--
-- La vista sumaba R2 (grabaciones, cámaras y Archivos) pero ignoraba los 21
-- buckets de Supabase Storage, que es donde vive lo que el software genera
-- solo: nóminas, contratos, albaranes, fotos de la carta, DNIs de empleados,
-- firmas, CVs... En septiembre de 2026 eso eran 1.010 ficheros y 381 MB
-- reales que en Ajustes salían como 0 bytes.
--
-- El reparto por empresa se saca de la PRIMERA carpeta de cada objeto, que es
-- como suben todos los módulos. Hay dos convenciones vivas:
--   · UUID de la empresa      → la mayoría de buckets
--   · slug de la empresa      → `chat-archivos`, `empresa-logos` y una foto
--                               suelta de `carta-fotos`
-- Se contemplan las dos. Lo que no case con ninguna empresa (por ejemplo
-- `avatars`, que se organiza por usuario) queda fuera a propósito: son bytes
-- que no pertenecen a ninguna empresa concreta y adjudicarlos sería inventar.
--
-- Idempotente: `create or replace`.
create or replace view public.storage_usage_por_empresa as
  with storage_por_empresa as (
    select e.id as empresa_id,
           sum((o.metadata->>'size')::bigint) as bytes,
           count(*)                           as files
      from storage.objects o
      join empresas e
        on split_part(o.name, '/', 1) = e.id::text
        or split_part(o.name, '/', 1) = e.slug
     where o.metadata->>'size' is not null
     group by e.id
  )
  SELECT e.id AS empresa_id,
    e.nombre AS empresa_nombre,
    (COALESCE(r.bytes, 0::numeric)
     + COALESCE(c.bytes, 0::numeric)
     + COALESCE(d.bytes, 0::numeric)
     + COALESCE(s.bytes, 0::numeric))::bigint AS bytes_used,
    e.storage_limit_bytes AS bytes_limit,
    (COALESCE(r.files, 0::bigint)
     + COALESCE(c.files, 0::bigint)
     + COALESCE(d.files, 0::bigint)
     + COALESCE(s.files, 0::bigint))::integer AS files_count
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
          GROUP BY documentos.empresa_id) d ON d.empresa_id = e.id
     LEFT JOIN storage_por_empresa s ON s.empresa_id = e.id;

-- BALLES tenía 3 TB heredados de las pruebas. Todas las empresas parten
-- iguales: 500 GB.
update empresas
   set storage_limit_bytes = 500 * 1024::bigint ^ 3
 where storage_limit_bytes <> 500 * 1024::bigint ^ 3;

-- El desglose de Ajustes solo sabía de `recordings`, así que las nóminas, los
-- albaranes o las fotos de la carta no aparecían por ningún lado aunque sí
-- contaran en el total. `storage.objects` no es accesible desde PostgREST, de
-- ahí esta función: devuelve, para una empresa, cuánto ocupa cada bucket.
--
-- SECURITY DEFINER porque lee el esquema `storage`, y con `search_path` fijado
-- para que no se pueda secuestrar la resolución de nombres. Solo la ejecuta el
-- backend con la clave de servicio.
create or replace function public.storage_desglose_por_bucket(p_empresa_id uuid)
returns table (bucket text, bytes bigint, files integer)
language sql
stable
security definer
set search_path = public, storage
as $$
  select o.bucket_id::text,
         sum((o.metadata->>'size')::bigint)::bigint,
         count(*)::integer
    from storage.objects o
    join empresas e
      on split_part(o.name, '/', 1) = e.id::text
      or split_part(o.name, '/', 1) = e.slug
   where e.id = p_empresa_id
     and o.metadata->>'size' is not null
   group by o.bucket_id
   order by 2 desc;
$$;

revoke all on function public.storage_desglose_por_bucket(uuid) from public, anon, authenticated;
grant execute on function public.storage_desglose_por_bucket(uuid) to service_role;
