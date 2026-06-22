-- Enlaces de atribución por canal del portal de empleo.
-- Mismo motor (/empleo/<slug>), varios enlaces (?o=<codigo>); cada enlace
-- etiqueta el CV con su canal concreto y con una categoría de origen.
CREATE TABLE IF NOT EXISTS public.empleo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL,
  origen_categoria text NOT NULL DEFAULT 'otros'
    CHECK (origen_categoria IN ('web','formulario','redes_sociales','recomendacion','base_datos','portal_empleo','otros')),
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS empleo_links_empresa_codigo_unique
  ON public.empleo_links (empresa_id, upper(codigo));
CREATE INDEX IF NOT EXISTS empleo_links_empresa_idx
  ON public.empleo_links (empresa_id);

ALTER TABLE public.empleo_links ENABLE ROW LEVEL SECURITY;

-- RLS multi-tenant idéntica al patrón de reserva_links.
DROP POLICY IF EXISTS empleo_links_select ON public.empleo_links;
DROP POLICY IF EXISTS empleo_links_insert ON public.empleo_links;
DROP POLICY IF EXISTS empleo_links_update ON public.empleo_links;
DROP POLICY IF EXISTS empleo_links_delete ON public.empleo_links;
CREATE POLICY empleo_links_select ON public.empleo_links
  FOR SELECT USING (empresa_id IN (SELECT empresas_del_usuario()));
CREATE POLICY empleo_links_insert ON public.empleo_links
  FOR INSERT WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()));
CREATE POLICY empleo_links_update ON public.empleo_links
  FOR UPDATE USING (empresa_id IN (SELECT empresas_del_usuario()));
CREATE POLICY empleo_links_delete ON public.empleo_links
  FOR DELETE USING (empresa_id IN (SELECT empresas_del_usuario()));

-- Atribución del canal concreto en cada candidatura.
-- canal_nombre es un snapshot (sobrevive al borrado del enlace).
ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS canal_link_id uuid REFERENCES public.empleo_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canal_nombre text;
CREATE INDEX IF NOT EXISTS candidatos_canal_link_idx
  ON public.candidatos (canal_link_id);

COMMENT ON TABLE public.empleo_links IS
  'Enlaces de atribución por canal del portal de empleo. URL: /empleo/<empleo_slug>?o=<codigo>. Cada CV que llega por un enlace hereda su origen_categoria y queda vinculado vía candidatos.canal_link_id.';
