-- Cuestionario "Evaluación de actitud" — 3 preguntas nuevas (p8, p9, p10).
--
-- Indicadores de actitud laboral añadidos:
--   p8  = honestidad/integridad ante un error propio.
--   p9  = iniciativa / proactividad cuando queda trabajo alrededor.
--   p10 = disponibilidad y flexibilidad ante picos y cambios de horario.
--
-- El seed canónico (src/lib/seeds/reclutamiento-cuestionario-default.ts) ya
-- incluye p8..p10, así que las empresas NUEVAS las reciben al sembrarse.
-- Aquí parcheamos las empresas que YA tienen el cuestionario por defecto SIN
-- editar (exactamente p1..p7 tras la tanda anterior). NO tocamos cuestionarios
-- editados por el cliente (otro nº de preguntas u otros ids) ni los no-default.
-- Idempotente: si ya tienen p8..p10 (size != 7) no entran en el WHERE.

UPDATE public.reclutamiento_plantillas_cuestionario
SET preguntas = preguntas || jsonb_build_array(
  jsonb_build_object(
    'id', 'p8',
    'titulo', 'Si cometes un error en tu trabajo y nadie se ha dado cuenta, ¿qué sueles hacer?',
    'tipo', 'eleccion_multiple',
    'obligatoria', true,
    'opciones', jsonb_build_array(
      jsonb_build_object('id','p8o1','texto','Espero a ver si pasa desapercibido y, si nadie lo nota, no le doy más importancia.','correcta',false),
      jsonb_build_object('id','p8o2','texto','Lo comento y trato de corregirlo cuanto antes, aunque suponga reconocer el fallo.','correcta',true),
      jsonb_build_object('id','p8o3','texto','Lo arreglo por mi cuenta sin decir nada para no preocupar a nadie.','correcta',false)
    )
  ),
  jsonb_build_object(
    'id', 'p9',
    'titulo', 'Cuando terminas tus tareas y ves que aún queda trabajo pendiente a tu alrededor, ¿cómo actúas?',
    'tipo', 'eleccion_multiple',
    'obligatoria', true,
    'opciones', jsonb_build_array(
      jsonb_build_object('id','p9o1','texto','Si nadie me pide ayuda, aprovecho para descansar hasta que me asignen algo.','correcta',false),
      jsonb_build_object('id','p9o2','texto','Me ofrezco y echo una mano en lo que haga falta sin que me lo tengan que pedir.','correcta',true),
      jsonb_build_object('id','p9o3','texto','Espero a que mi responsable me diga exactamente qué hacer a continuación.','correcta',false)
    )
  ),
  jsonb_build_object(
    'id', 'p10',
    'titulo', 'En momentos de mucha actividad (fines de semana, picos o imprevistos), ¿cómo encajas los cambios de horario o refuerzos?',
    'tipo', 'eleccion_multiple',
    'obligatoria', true,
    'opciones', jsonb_build_array(
      jsonb_build_object('id','p10o1','texto','Entiendo que forman parte del trabajo y me adapto con buena disposición.','correcta',true),
      jsonb_build_object('id','p10o2','texto','Los acepto puntualmente, pero prefiero que no se conviertan en algo habitual.','correcta',false),
      jsonb_build_object('id','p10o3','texto','Procuro ceñirme a mi horario y solo cambio si no me queda otra opción.','correcta',false)
    )
  )
),
updated_at = now()
WHERE es_default = true
  AND jsonb_typeof(preguntas) = 'array'
  AND jsonb_array_length(preguntas) = 7
  AND (
    SELECT array_agg(elem->>'id' ORDER BY ord)
    FROM jsonb_array_elements(preguntas) WITH ORDINALITY AS t(elem, ord)
  ) = ARRAY['p1','p2','p3','p4','p5','p6','p7'];
