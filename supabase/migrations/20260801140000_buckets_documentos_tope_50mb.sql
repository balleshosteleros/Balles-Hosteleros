-- Unifica los topes de tamaño de TODOS los buckets. Ninguno queda "sin límite"
-- (evita que un archivo enorme llene la cuota de almacenamiento por accidente).
--
-- Solo 3 niveles, para no tener muchos valores distintos:
--   50 MB  → documentos / justificantes / fotos de gestión / informes / assets web.
--            Coincide con el límite del código (MAX_DOCUMENTO_MB en @/shared/lib/documentos).
--   10 MB  → imágenes sueltas y ficheros ligeros: avatar, logos (app y empresa),
--            fotos de carta/inspección/cata, y CV de candidatos (MAX_IMAGEN_MB).
--   500 MB → vídeo (grabaciones de cronogramas, material de formación).
--
-- Idempotente: fija valores exactos con guarda IS DISTINCT FROM; re-ejecutar no cambia nada.

-- 50 MB — documentos / justificantes / fotos de gestión / informes / web
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id IN (
  'cierres-documentos',
  'rrhh-nominas',
  'modelos-aeat-pdf',
  'logistica-facturas',
  'logistica-albaranes',
  'contratos-gestoria',
  'firmas',
  'juridico-documentos',
  'chat-archivos',
  'empleados-docs',
  'bajas-medicas',
  'documentacion',
  'documentacion-candidatos',
  'estudios-apertura-fotos',
  'gerencia-informes',
  'paginas-web-assets'
)
AND file_size_limit IS DISTINCT FROM 52428800;

-- 10 MB — imágenes sueltas y ficheros ligeros (incluye logos de empresa y CV)
UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id IN (
  'avatars',
  'app-logos',
  'empresa-logos',
  'carta-fotos',
  'inspeccion-imagenes',
  'nuevas-recetas-fotos-cata',
  'cvs-candidatos'
)
AND file_size_limit IS DISTINCT FROM 10485760;

-- 500 MB — vídeo
UPDATE storage.buckets
SET file_size_limit = 524288000
WHERE id IN (
  'cronogramas-videos',
  'formacion-docs'
)
AND file_size_limit IS DISTINCT FROM 524288000;
