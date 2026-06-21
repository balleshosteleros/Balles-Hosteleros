-- URL personalizable del portal de empleo, independiente del slug global.
-- El slug global (empresas.slug) se usa como FK en accesos_apps, organigramas
-- y empresa_logos; por eso el portal de empleo necesita su PROPIO identificador
-- editable, igual que la carta digital ya tiene carta_slug.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS empleo_slug TEXT;

-- Backfill: arrancamos desde el slug actual (= nombre comercial en minúsculas),
-- así las URLs /empleo/<slug> existentes siguen resolviendo sin cambios.
UPDATE public.empresas
  SET empleo_slug = slug
  WHERE empleo_slug IS NULL AND slug IS NOT NULL;

-- Único entre empresas (ignorando NULL) para que dos empresas nunca compartan
-- la misma URL de empleo.
CREATE UNIQUE INDEX IF NOT EXISTS empresas_empleo_slug_unique
  ON public.empresas (lower(empleo_slug))
  WHERE empleo_slug IS NOT NULL;

COMMENT ON COLUMN public.empresas.empleo_slug IS
  'URL personalizable del portal de empleo (/empleo/<empleo_slug>). Independiente de slug (que es FK lógica en accesos_apps/organigramas/logos). Editable desde RRHH → Reclutamiento → Portal de empleo.';
