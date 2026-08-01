-- Unifica los topes de tamaño de TODOS los buckets. Ninguno queda "sin límite"
-- (evita que un archivo enorme llene la cuota de almacenamiento por accidente).
--
-- Topes por tipo:
--   50 MB  → documentos / justificantes / fotos de gestión / informes / assets web.
--            Coincide con el límite del código (MAX_DOCUMENTO_MB en @/shared/lib/documentos).
--   10 MB  → imágenes sueltas (avatar, logos de app, fotos de carta/inspección/cata).
--   500 MB → vídeo (grabaciones de cronogramas, material de formación).
--   (5 MB en cvs-candidatos y empresa-logos se conservan tal cual: no se tocan aquí.)
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

-- 10 MB — imágenes sueltas
UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id IN (
  'avatars',
  'app-logos',
  'carta-fotos',
  'inspeccion-imagenes',
  'nuevas-recetas-fotos-cata'
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
