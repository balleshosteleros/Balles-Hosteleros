-- Fix: crear una empresa nueva fallaba por un ON CONFLICT que no casa con ningún índice
--
-- PROBLEMA
-- seed_carpetas_documentos_default() (llamada por el trigger tg_seed_carpetas_documentos
-- en el INSERT de `empresas`) usaba:
--     ON CONFLICT (empresa_id, lower(nombre))
-- pero el índice único real de carpetas_documentos es:
--     (empresa_id, COALESCE(parent_id::text, ''), lower(nombre))
-- Al añadirse las subcarpetas se cambió el índice y no se actualizó la función.
-- Postgres no encuentra un índice que case con la especificación y lanza
--     42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
-- Como el trigger corre dentro de la transacción del INSERT, tumbaba el alta de empresa entera:
-- hoy NO se puede crear ninguna empresa nueva.
--
-- SOLUCIÓN
-- Alinear el ON CONFLICT con el índice real. Las carpetas semilla son de primer nivel
-- (parent_id NULL → COALESCE(...) = ''), así que se explicita la misma expresión del índice.
-- Idempotente (CREATE OR REPLACE) y sin cambios de esquema ni de datos.

CREATE OR REPLACE FUNCTION public.seed_carpetas_documentos_default(p_empresa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.carpetas_documentos (empresa_id, nombre)
  VALUES
    (p_empresa_id, 'CONTRATOS'),
    (p_empresa_id, 'FISCALIDAD'),
    (p_empresa_id, 'ANTIGUOS')
  -- Debe coincidir EXACTAMENTE con carpetas_documentos_empresa_parent_nombre_uq.
  ON CONFLICT (empresa_id, COALESCE(parent_id::text, ''), lower(nombre)) DO NOTHING;
END;
$function$;
