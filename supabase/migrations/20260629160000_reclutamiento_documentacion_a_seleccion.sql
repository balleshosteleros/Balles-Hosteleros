-- Mueve el estado «Documentación» de la fase FORMACIÓN a la fase SELECCIÓN en
-- las plantillas de estado YA EXISTENTES de cada empresa.
--
-- Hasta ahora «Documentación» vivía en Formación (ver migración
-- 20260628192000_*). Pasa a ser el último paso de Selección (después de
-- «Entrevista»), por lo que también hereda el color oficial de Selección
-- (azul). El seed canónico ya refleja la nueva fase para empresas futuras.
--
-- Idempotente: solo reescribe el item cuyo key = 'documentacion'; respeta el
-- resto de estados, sus labels, emails y personalizaciones del cliente. El
-- orden dentro del array no cambia (documentacion ya estaba tras entrevista).

DO $$
DECLARE
  pt      RECORD;
  item    jsonb;
  nuevos  jsonb;
BEGIN
  FOR pt IN
    SELECT id, estados FROM public.reclutamiento_plantillas_estado
  LOOP
    nuevos := '[]'::jsonb;
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(pt.estados, '[]'::jsonb)) LOOP
      IF item->>'key' = 'documentacion' THEN
        item := item
          || jsonb_build_object('fase', 'seleccion')
          || jsonb_build_object('color', 'hsl(220, 70%, 55%)');
      END IF;
      nuevos := nuevos || item;
    END LOOP;
    UPDATE public.reclutamiento_plantillas_estado SET estados = nuevos WHERE id = pt.id;
  END LOOP;
END $$;
