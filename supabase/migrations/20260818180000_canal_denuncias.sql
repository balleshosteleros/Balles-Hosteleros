-- ═══════════════════════════════════════════════════════════════════════════
-- CANAL INTERNO DE DENUNCIAS Y QUEJAS
--
-- Canal ÚNICO y oficial: no existen quejas válidas por correo, llamada ni de
-- palabra. Todo entra por aquí y lo revisa siempre RRHH, de modo que queda
-- trazado desde el primer momento.
--
-- Por qué tabla propia y no `solicitudes_personal`:
--   esa tabla la puede leer CUALQUIER empleado de la empresa (política
--   `solicitudes_personal_read`). Sirve para vacaciones o permisos, pero con
--   una denuncia de acoso significaría que la persona denunciada podría leer
--   el relato entero. Aquí el acceso se restringe a quien tiene permiso de
--   ver el módulo RECURSOS HUMANOS.
--
-- Dos modalidades, con efectos jurídicos distintos:
--   NOMINAL  — consta quién la presenta. Permite dar audiencia a ambas partes
--              y, por tanto, permite sancionar.
--   ANÓNIMA  — sin vínculo con el autor. Al no poder practicarse contradicción
--              (la persona denunciada no puede defenderse frente a alguien sin
--              identidad), NO puede fundamentar una sanción. Vale como señal
--              de alerta y como estadística.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Quién puede leer las denuncias ────────────────────────────────────────
-- Mismo patrón que `rol_tiene_candado_accesos`: mira los permisos reales del
-- rol. Aquí basta con tener acceso al módulo RECURSOS HUMANOS.

CREATE OR REPLACE FUNCTION public.rol_puede_ver_denuncias(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from usuarios u
    join empresa_roles r on r.id = u.rol_id
    where u.user_id = uid
      and (
        r.es_admin_plataforma
        or exists (
          select 1
          from jsonb_array_elements(coalesce(r.permisos, '[]'::jsonb)) p
          where (p->>'ver')::boolean
            and translate(upper(p->>'modulo'), 'ÁÉÍÓÚÜÑ', 'AEIOUUN')
                = 'RECURSOS HUMANOS'
        )
      )
  );
$function$;

-- ─── Tabla ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.denuncias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- 'nominal' | 'anonima'
  modalidad text NOT NULL,

  -- NULL en las anónimas: no hay ningún vínculo con quien la presentó.
  -- En las nominales guarda al autor para poder darle audiencia.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  denunciante_nombre text,

  -- Código que se entrega al denunciante anónimo para seguir el caso sin
  -- revelar su identidad. Se guarda el HASH, nunca el código en claro: quien
  -- lea la tabla no puede deducirlo ni suplantar al denunciante.
  seguimiento_hash text,

  categoria text NOT NULL,
  asunto text NOT NULL,
  relato text NOT NULL,
  fecha_hechos date,
  lugar text,
  personas_implicadas text,
  testigos text,

  estado text NOT NULL DEFAULT 'recibida',
  -- Respuesta de RRHH visible para el denunciante (también el anónimo, vía código).
  respuesta text,
  notas_internas text,

  revisado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revisado_at timestamptz,
  cerrado_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.denuncias
    ADD CONSTRAINT denuncias_modalidad_chk
    CHECK (modalidad IN ('nominal', 'anonima'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.denuncias
    ADD CONSTRAINT denuncias_estado_chk
    CHECK (estado IN ('recibida', 'en_investigacion', 'informacion_solicitada',
                      'resuelta', 'archivada'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.denuncias
    ADD CONSTRAINT denuncias_categoria_chk
    CHECK (categoria IN ('acoso_sexual', 'acoso_razon_sexo', 'acoso_laboral',
                         'discriminacion', 'seguridad_salud', 'irregularidad',
                         'trato_cliente', 'queja_general', 'otro'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Una anónima NO puede llevar identidad; una nominal SÍ debe llevarla.
-- Esto impide que un fallo de código desanonimice una denuncia.
DO $$
BEGIN
  ALTER TABLE public.denuncias
    ADD CONSTRAINT denuncias_anonimato_chk
    CHECK (
      (modalidad = 'anonima' AND user_id IS NULL AND denunciante_nombre IS NULL)
      OR
      (modalidad = 'nominal' AND user_id IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS denuncias_empresa_idx
  ON public.denuncias (empresa_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS denuncias_seguimiento_uq
  ON public.denuncias (seguimiento_hash)
  WHERE seguimiento_hash IS NOT NULL;

-- ─── Historial de actuaciones ──────────────────────────────────────────────
-- Deja constancia de cada paso: es la prueba de que se tramitó con diligencia.

CREATE TABLE IF NOT EXISTS public.denuncias_actuaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,
  detalle text,
  realizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS denuncias_actuaciones_idx
  ON public.denuncias_actuaciones (denuncia_id, fecha DESC);

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;

-- Presentar: cualquier empleado de la empresa. Si es nominal debe ir a su
-- nombre; si es anónima, sin identidad (lo garantiza además el CHECK).
DROP POLICY IF EXISTS denuncias_insert ON public.denuncias;
CREATE POLICY denuncias_insert
  ON public.denuncias FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT empresas_del_usuario())
    AND (
      (modalidad = 'nominal' AND user_id = (SELECT auth.uid()))
      OR modalidad = 'anonima'
    )
  );

-- Leer: SOLO quien tiene acceso al módulo de RRHH, o el propio denunciante
-- si la presentó a su nombre. El resto de la plantilla no ve nada.
-- Las anónimas se consultan por código, mediante función SECURITY DEFINER.
DROP POLICY IF EXISTS denuncias_read ON public.denuncias;
CREATE POLICY denuncias_read
  ON public.denuncias FOR SELECT
  USING (
    empresa_id IN (SELECT empresas_del_usuario())
    AND (
      rol_puede_ver_denuncias((SELECT auth.uid()))
      OR (modalidad = 'nominal' AND user_id = (SELECT auth.uid()))
    )
  );

-- Tramitar: solo RRHH.
DROP POLICY IF EXISTS denuncias_update ON public.denuncias;
CREATE POLICY denuncias_update
  ON public.denuncias FOR UPDATE
  USING (
    empresa_id IN (SELECT empresas_del_usuario())
    AND rol_puede_ver_denuncias((SELECT auth.uid()))
  )
  WITH CHECK (
    empresa_id IN (SELECT empresas_del_usuario())
    AND rol_puede_ver_denuncias((SELECT auth.uid()))
  );

-- Nadie borra una denuncia: se archiva. No se define política de DELETE,
-- así que con RLS activo queda prohibido para todos los clientes.

ALTER TABLE public.denuncias_actuaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS denuncias_actuaciones_read ON public.denuncias_actuaciones;
CREATE POLICY denuncias_actuaciones_read
  ON public.denuncias_actuaciones FOR SELECT
  USING (
    empresa_id IN (SELECT empresas_del_usuario())
    AND rol_puede_ver_denuncias((SELECT auth.uid()))
  );
DROP POLICY IF EXISTS denuncias_actuaciones_write ON public.denuncias_actuaciones;
CREATE POLICY denuncias_actuaciones_write
  ON public.denuncias_actuaciones FOR ALL
  USING (
    empresa_id IN (SELECT empresas_del_usuario())
    AND rol_puede_ver_denuncias((SELECT auth.uid()))
  )
  WITH CHECK (
    empresa_id IN (SELECT empresas_del_usuario())
    AND rol_puede_ver_denuncias((SELECT auth.uid()))
  );

-- ─── Consulta anónima por código ───────────────────────────────────────────
-- El denunciante anónimo introduce su código y ve el estado y la respuesta,
-- sin revelar quién es y sin poder leer las notas internas ni otras denuncias.

CREATE OR REPLACE FUNCTION public.consultar_denuncia_por_codigo(p_hash text)
RETURNS TABLE (
  id uuid,
  categoria text,
  asunto text,
  estado text,
  respuesta text,
  created_at timestamptz,
  revisado_at timestamptz,
  cerrado_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select d.id, d.categoria, d.asunto, d.estado, d.respuesta,
         d.created_at, d.revisado_at, d.cerrado_at
  from denuncias d
  where d.seguimiento_hash = p_hash
    and d.modalidad = 'anonima';
$function$;

REVOKE ALL ON FUNCTION public.consultar_denuncia_por_codigo(text) FROM public;
GRANT EXECUTE ON FUNCTION public.consultar_denuncia_por_codigo(text) TO authenticated;
