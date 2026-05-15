-- =====================================================================
-- tipos_ausencia: alineación con modelo Sesame
--   + limite_dias   (int, null = sin límite)
--   + conteo_dias   ('naturales' | 'laborables')
--   + remunerada    (bool)
-- Borra el seed previo (7 filas) y deja sólo:
--   - Baja médica       → remunerada=true,  sin límite, conteo naturales
--   - Ausencia justificada → remunerada=false, sin límite, conteo naturales
-- =====================================================================

ALTER TABLE public.tipos_ausencia
  ADD COLUMN IF NOT EXISTS limite_dias  integer,
  ADD COLUMN IF NOT EXISTS conteo_dias  text NOT NULL DEFAULT 'naturales',
  ADD COLUMN IF NOT EXISTS remunerada   boolean NOT NULL DEFAULT false;

ALTER TABLE public.tipos_ausencia
  DROP CONSTRAINT IF EXISTS tipos_ausencia_conteo_dias_check;
ALTER TABLE public.tipos_ausencia
  ADD CONSTRAINT tipos_ausencia_conteo_dias_check
  CHECK (conteo_dias IN ('naturales', 'laborables'));

ALTER TABLE public.tipos_ausencia
  DROP CONSTRAINT IF EXISTS tipos_ausencia_limite_dias_check;
ALTER TABLE public.tipos_ausencia
  ADD CONSTRAINT tipos_ausencia_limite_dias_check
  CHECK (limite_dias IS NULL OR limite_dias > 0);

-- Limpiar seed previo (7 filas creadas en migración 085) en TODAS las empresas
DELETE FROM public.tipos_ausencia;

-- Re-seed: sólo las 2 ausencias que pide el negocio
INSERT INTO public.tipos_ausencia
  (empresa_id, nombre, descripcion, categoria, color,
   requiere_aprobacion, requiere_justificante, descuenta_jornada, refleja_calendario,
   limite_dias, conteo_dias, remunerada,
   orden, activo)
SELECT e.id, v.nombre, v.descripcion, v.categoria, v.color,
       v.req_aprob, v.req_just, v.desc_jor, v.ref_cal,
       v.limite, v.conteo, v.rem,
       v.orden, true
FROM public.empresas e
CROSS JOIN (VALUES
  ('Baja médica',          'Baja por enfermedad o accidente',   'Permiso', 'bg-rose-500',
   false, true,  false, true,
   NULL::integer, 'naturales', true,
   1),
  ('Ausencia justificada', 'Ausencia con justificación válida', 'Permiso', 'bg-amber-500',
   true,  true,  true,  true,
   NULL::integer, 'naturales', false,
   2)
) AS v(nombre, descripcion, categoria, color,
       req_aprob, req_just, desc_jor, ref_cal,
       limite, conteo, rem,
       orden)
ON CONFLICT (empresa_id, lower(nombre)) DO NOTHING;
