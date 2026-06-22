-- Garantía de integridad de la nota: TODO cuestionario de vacante debe tener,
-- en cada pregunta, al menos una respuesta marcada como correcta (y ≥2 opciones
-- con texto y un título). Así la nota (aciertos/total×10) nunca queda indefinida.
--
-- Se valida con un trigger a nivel BD para que ninguna vía de inserción/edición
-- pueda guardar un cuestionario inválido (UI, import, SQL directo…).

CREATE OR REPLACE FUNCTION public.validar_cuestionario_preguntas()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  q jsonb;
  opts jsonb;
  n_opts int;
  n_correctas int;
BEGIN
  IF NEW.preguntas IS NULL OR jsonb_typeof(NEW.preguntas) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR q IN SELECT * FROM jsonb_array_elements(NEW.preguntas) LOOP
    IF COALESCE(btrim(q->>'titulo'), '') = '' THEN
      RAISE EXCEPTION 'Cada pregunta debe tener un título.';
    END IF;

    opts := q->'opciones';
    IF opts IS NULL OR jsonb_typeof(opts) <> 'array' THEN
      RAISE EXCEPTION 'Cada pregunta debe tener opciones de respuesta.';
    END IF;

    SELECT count(*) INTO n_opts
      FROM jsonb_array_elements(opts) o
      WHERE COALESCE(btrim(o->>'texto'), '') <> '';
    IF n_opts < 2 THEN
      RAISE EXCEPTION 'Cada pregunta necesita al menos 2 opciones con texto.';
    END IF;

    SELECT count(*) INTO n_correctas
      FROM jsonb_array_elements(opts) o
      WHERE (o->>'correcta')::boolean IS TRUE;
    IF n_correctas < 1 THEN
      RAISE EXCEPTION 'Cada pregunta debe tener marcada una respuesta correcta.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_cuestionario_preguntas
  ON public.reclutamiento_plantillas_cuestionario;
CREATE TRIGGER trg_validar_cuestionario_preguntas
  BEFORE INSERT OR UPDATE ON public.reclutamiento_plantillas_cuestionario
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_cuestionario_preguntas();
