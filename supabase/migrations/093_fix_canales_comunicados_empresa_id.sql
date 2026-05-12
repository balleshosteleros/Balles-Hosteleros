-- ============================================================
-- 093_fix_canales_comunicados_empresa_id.sql
--
-- Bug crítico: canales.empresa_id y comunicados.empresa_id eran TEXT
-- y canales contenía SLUGS ('habana','bacanal') en vez de UUIDs.
-- La migración 090 introdujo RLS que comparaba slug vs UUID, dejando
-- el chat efectivamente sin acceso (0 filas).
--
-- Este fix:
-- 1. Convierte los datos de canales (slug → uuid) usando empresas.slug
-- 2. Cambia tipo de empresa_id a uuid en ambas tablas
-- 3. Añade FK a empresas(id) ON DELETE CASCADE
-- 4. Reescribe RLS usando uuid directamente (sin cast)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Migrar datos de canales: slug → uuid
-- ────────────────────────────────────────────────────────────
UPDATE public.canales c
SET empresa_id = e.id::text
FROM public.empresas e
WHERE c.empresa_id = e.slug
  AND c.empresa_id IS NOT NULL;

-- Verificar que ya no quedan slugs (esto fallará si alguno no se mapeó)
DO $$
DECLARE
  invalid_count int;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM public.canales
  WHERE empresa_id IS NOT NULL
    AND empresa_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'canales.empresa_id sigue teniendo % valores no-UUID', invalid_count;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Antes de cambiar el tipo, hay que dropear TODAS las RLS
-- que referencian empresa_id (bloquean ALTER COLUMN TYPE)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "canales_read"      ON public.canales;
DROP POLICY IF EXISTS "canales_write"     ON public.canales;
DROP POLICY IF EXISTS "comunicados_read"  ON public.comunicados;
DROP POLICY IF EXISTS "comunicados_write" ON public.comunicados;
DROP POLICY IF EXISTS "mensajes_read"     ON public.mensajes;
DROP POLICY IF EXISTS "mensajes_insert"   ON public.mensajes;

-- ────────────────────────────────────────────────────────────
-- 3. Cambiar tipo a uuid
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.canales
  ALTER COLUMN empresa_id TYPE uuid USING empresa_id::uuid;

-- comunicados está vacío, NULLIF maneja strings vacíos por si acaso
ALTER TABLE public.comunicados
  ALTER COLUMN empresa_id TYPE uuid USING NULLIF(empresa_id, '')::uuid;

-- ────────────────────────────────────────────────────────────
-- 4. Añadir FK
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.canales
  ADD CONSTRAINT canales_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.comunicados
  ADD CONSTRAINT comunicados_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────
-- 5. Recrear RLS con uuid limpio (sin cast)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "canales_read" ON public.canales FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "canales_write" ON public.canales FOR ALL TO authenticated
  USING       (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK  (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "comunicados_read" ON public.comunicados FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "comunicados_write" ON public.comunicados FOR ALL TO authenticated
  USING       (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK  (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "mensajes_read" ON public.mensajes FOR SELECT TO authenticated
  USING (canal_id IN (
    SELECT id FROM public.canales
    WHERE empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
  ));
CREATE POLICY "mensajes_insert" ON public.mensajes FOR INSERT TO authenticated
  WITH CHECK (canal_id IN (
    SELECT id FROM public.canales
    WHERE empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
  ));
