-- ═══════════════════════════════════════════════════════════════════════════
-- LAS QUEJAS ANÓNIMAS TAMBIÉN LAS VE QUIEN LAS PRESENTÓ
--
-- Cómo queda el canal:
--   · El TRABAJADOR ve todas sus quejas en su lista, anónimas incluidas y
--     marcadas como tales, con su estado y la respuesta de RRHH.
--   · La EMPRESA ve exactamente las mismas quejas. Lo único que no ve de una
--     anónima es el NOMBRE de quien la puso.
--
-- Por qué una tabla aparte y no `denuncias.user_id`:
--   la fila de la denuncia la lee RRHH entera. Si el autor viviera en ella,
--   bastaría leer la tabla para desanonimizarla. El vínculo va en
--   `denuncias_autor_anonimo`, cuya RLS solo deja leer al propio autor: el
--   rol de RRHH no tiene ninguna política ahí y por tanto no ve ni una fila.
--   El CHECK `denuncias_anonimato_chk` sigue vigente y obliga a que la
--   denuncia anónima no lleve identidad alguna.
--
-- Se retira el CÓDIGO DE SEGUIMIENTO: era la única forma que tenía el autor
-- de seguir una anónima y obligaba a apuntar y custodiar un código. Ahora la
-- ve en su lista, así que el código sobra. No hay ninguna queja presentada
-- todavía, de modo que no se pierde ningún seguimiento en curso.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Quién presentó cada queja anónima ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.denuncias_autor_anonimo (
  denuncia_id uuid PRIMARY KEY
    REFERENCES public.denuncias(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS denuncias_autor_anonimo_user_idx
  ON public.denuncias_autor_anonimo (user_id, created_at DESC);

ALTER TABLE public.denuncias_autor_anonimo ENABLE ROW LEVEL SECURITY;

-- Leer: SOLO el propio autor, y solo sus filas. No hay política para RRHH ni
-- para nadie más, así que con RLS activo la tabla es invisible para el resto.
DROP POLICY IF EXISTS denuncias_autor_anonimo_read ON public.denuncias_autor_anonimo;
CREATE POLICY denuncias_autor_anonimo_read
  ON public.denuncias_autor_anonimo FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Sin políticas de INSERT, UPDATE ni DELETE: el vínculo lo escribe el
-- servidor al presentar la queja y después no se toca.

-- ─── El autor puede leer su propia queja anónima ───────────────────────────
-- Se amplía la política de lectura de `denuncias`. Lo único que añade es que
-- el autor vea la suya; para el resto de la plantilla no cambia nada.

DROP POLICY IF EXISTS denuncias_read ON public.denuncias;
CREATE POLICY denuncias_read
  ON public.denuncias FOR SELECT
  USING (
    empresa_id IN (SELECT empresas_del_usuario())
    AND (
      rol_puede_ver_denuncias((SELECT auth.uid()))
      OR (modalidad = 'nominal' AND user_id = (SELECT auth.uid()))
      OR EXISTS (
        SELECT 1
        FROM public.denuncias_autor_anonimo a
        WHERE a.denuncia_id = denuncias.id
          AND a.user_id = (SELECT auth.uid())
      )
    )
  );

-- ─── Fuera el código de seguimiento ────────────────────────────────────────

DROP FUNCTION IF EXISTS public.consultar_denuncia_por_codigo(text);
DROP INDEX IF EXISTS public.denuncias_seguimiento_uq;
ALTER TABLE public.denuncias DROP COLUMN IF EXISTS seguimiento_hash;
