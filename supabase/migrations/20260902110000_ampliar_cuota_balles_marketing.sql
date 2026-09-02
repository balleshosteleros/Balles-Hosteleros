-- Ampliar la cuota de almacenamiento de BALLES para la migración de Marketing.
--
-- El histórico de Marketing que venía de Drive (vídeo y foto en bruto) no cabe
-- en los 500 GB por defecto. Se sube el techo de esta empresa a 3 TB para que
-- la migración entre entera; la limpieza de material sobrante se hará después,
-- ya con los archivos dentro del software.
update public.empresas
   set storage_limit_bytes = 3 * 1024::bigint ^ 4
 where nombre = 'BALLES'
   and storage_limit_bytes < 3 * 1024::bigint ^ 4;
