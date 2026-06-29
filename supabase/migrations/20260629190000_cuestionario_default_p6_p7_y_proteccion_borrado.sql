-- Cuestionario "Evaluación de actitud" — 2 preguntas nuevas (p6, p7) + blindaje
-- contra el borrado de cuestionarios ya respondidos por candidatos.
--
-- Contexto:
--   1. El seed canónico vive en src/lib/seeds/reclutamiento-cuestionario-default.ts
--      y al sembrarse a una empresa NUEVA ya incluirá p6 y p7 (futuras empresas).
--   2. Para las empresas que YA tienen el cuestionario por defecto SIN editar
--      (las 5 preguntas originales p1..p5), aquí añadimos p6 y p7 de forma
--      idempotente. NO tocamos ningún cuestionario que el cliente haya editado
--      (distinto nº de preguntas o ids distintos) ni los no-default.
--   3. Regla de negocio: un cuestionario que YA respondió algún candidato no se
--      puede editar (ya estaba en la action) NI borrar. El candidato conserva
--      para siempre el cuestionario que rellenó (snapshot verbatim en
--      candidato_cuestionario_respuestas.preguntas_snapshot). Para cambiarlo hay
--      que duplicar/crear uno nuevo y reasignarlo en las vacantes.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Añadir p6 y p7 a los cuestionarios POR DEFECTO no editados.
--    Solo afecta a filas es_default cuyas preguntas sean exactamente
--    [p1,p2,p3,p4,p5] (mismos ids, mismo tamaño). Idempotente: si ya tienen
--    p6/p7 (size != 5) no entran en el WHERE.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.reclutamiento_plantillas_cuestionario
SET preguntas = preguntas || jsonb_build_array(
  jsonb_build_object(
    'id', 'p6',
    'titulo', 'En tu etapa más joven, cuando estudiabas (si fue tu caso), ¿cómo combinaste estudios y trabajo?',
    'tipo', 'eleccion_multiple',
    'obligatoria', true,
    'opciones', jsonb_build_array(
      jsonb_build_object('id','p6o1','texto','Preferí centrarme primero en estudiar y, una vez terminé, empecé a trabajar.','correcta',false),
      jsonb_build_object('id','p6o2','texto','En algún periodo compaginé los estudios y el trabajo a la vez.','correcta',true),
      jsonb_build_object('id','p6o3','texto','Me dediqué principalmente a una cosa cada vez, según el momento.','correcta',false)
    )
  ),
  jsonb_build_object(
    'id', 'p7',
    'titulo', '¿Cómo valoras la continuidad y el compromiso a largo plazo en un puesto de trabajo?',
    'tipo', 'eleccion_multiple',
    'obligatoria', true,
    'opciones', jsonb_build_array(
      jsonb_build_object('id','p7o1','texto','Me gusta implicarme y crecer dentro del mismo proyecto durante el mayor tiempo posible.','correcta',true),
      jsonb_build_object('id','p7o2','texto','Lo valoro, aunque también me gusta cambiar de entorno cada cierto tiempo.','correcta',false),
      jsonb_build_object('id','p7o3','texto','Prefiero no comprometerme demasiado y mantener mis opciones abiertas.','correcta',false)
    )
  )
),
updated_at = now()
WHERE es_default = true
  AND jsonb_typeof(preguntas) = 'array'
  AND jsonb_array_length(preguntas) = 5
  AND (
    SELECT array_agg(elem->>'id' ORDER BY ord)
    FROM jsonb_array_elements(preguntas) WITH ORDINALITY AS t(elem, ord)
  ) = ARRAY['p1','p2','p3','p4','p5'];

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Blindaje en BD: impedir el DELETE de un cuestionario que ya respondió
--    algún candidato. Defensa en profundidad (la action ya lo bloquea, pero
--    así también cubre cualquier acceso directo / service role).
--    El histórico del candidato no se pierde nunca: la FK es ON DELETE SET NULL
--    y guarda preguntas_snapshot; este trigger solo evita borrar la plantilla
--    para que siga visible y reutilizable.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.impedir_borrado_cuestionario_respondido()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.candidato_cuestionario_respuestas r
    WHERE r.cuestionario_plantilla_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar un cuestionario que ya han respondido candidatos. Duplícalo para crear una versión nueva.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_borrado_cuestionario_respondido
  ON public.reclutamiento_plantillas_cuestionario;
CREATE TRIGGER trg_impedir_borrado_cuestionario_respondido
  BEFORE DELETE ON public.reclutamiento_plantillas_cuestionario
  FOR EACH ROW
  EXECUTE FUNCTION public.impedir_borrado_cuestionario_respondido();

COMMENT ON FUNCTION public.impedir_borrado_cuestionario_respondido() IS
  'Impide borrar plantillas de cuestionario ya respondidas por candidatos; el candidato conserva su snapshot verbatim. Para cambiarlas hay que duplicar/crear una nueva.';
