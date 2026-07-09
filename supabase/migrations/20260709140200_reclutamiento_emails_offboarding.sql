-- Crea las 5 plantillas de email de la fase Offboarding (+ Ex-empleados) en cada
-- empresa que no las tenga (aditivo por nombre) y enlaza cada estado de
-- offboarding/ex_empleado a su plantilla de email por defecto. Nacen INACTIVAS
-- (activa=false): informan según el estado pero no se envían hasta que el usuario
-- las active y revise. Idempotente.

-- 1) Biblioteca de emails (una fila por empresa × plantilla que falte).
INSERT INTO public.reclutamiento_email_plantillas (empresa_id, nombre, asunto, cuerpo, activa, destino)
SELECT e.id, v.nombre, v.asunto, v.cuerpo, false, 'candidato'
FROM public.empresas e
CROSS JOIN (VALUES
  ('Preaviso',
   'Comunicación de preaviso — {{empresa_nombre}}',
   E'Hola {{candidato_nombre}},\n\nTe confirmamos que hemos registrado el preaviso de finalización de tu relación laboral con {{empresa_nombre}}. Queremos acompañarte en esta última etapa para que la salida se realice de forma ordenada y sin contratiempos para ninguna de las partes.\n\nEn los próximos días te iremos informando de los siguientes pasos: la tramitación de tu baja, la devolución del material y accesos que tengas asignados, y la preparación de tu liquidación y finiquito.\n\nSi tienes cualquier duda durante este proceso, puedes escribirnos a {{email_rrhh}} y te ayudaremos con gusto.\n\nGracias por tu trabajo durante este tiempo.\n\nUn saludo,\n{{empresa_nombre}}'),
  ('Baja contrato',
   'Tramitación de tu baja — {{empresa_nombre}}',
   E'Hola {{candidato_nombre}},\n\nTe informamos de que hemos iniciado la tramitación de la baja de tu contrato en {{empresa_nombre}}. Estamos gestionando con la gestoría toda la documentación necesaria para que tu baja quede registrada correctamente ante la Seguridad Social.\n\nEn cuanto el proceso esté completado, te haremos llegar la documentación que corresponda. Si necesitas algún justificante o tienes cualquier consulta, escríbenos a {{email_rrhh}}.\n\nUn saludo,\n{{empresa_nombre}}'),
  ('Entregas',
   'Devolución de material y accesos — {{empresa_nombre}}',
   E'Hola {{candidato_nombre}},\n\nAntes de completar tu salida de {{empresa_nombre}}, necesitamos que nos devuelvas el material y los accesos que tengas asignados (uniforme, llaves, tarjetas, dispositivos, taquilla y cualquier otro elemento propiedad de la empresa).\n\nTe indicaremos cómo y cuándo hacer la entrega para que sea lo más cómodo posible. Una vez recibido todo, podremos cerrar tu proceso de salida y avanzar con tu finiquito.\n\nSi tienes cualquier duda sobre qué debes devolver, escríbenos a {{email_rrhh}}.\n\nGracias por tu colaboración.\n\nUn saludo,\n{{empresa_nombre}}'),
  ('Finiquito',
   'Liquidación y finiquito — {{empresa_nombre}}',
   E'Hola {{candidato_nombre}},\n\nTu liquidación y finiquito ya están preparados. En este documento se recogen las cantidades que te corresponden a la finalización de tu relación laboral con {{empresa_nombre}} (salario pendiente, parte proporcional de pagas y vacaciones no disfrutadas, según corresponda).\n\nTe haremos llegar la documentación para que puedas revisarla con calma y, si estás conforme, firmarla. Antes de firmar, revisa que todos los importes son correctos; si algo no te cuadra, escríbenos a {{email_rrhh}} y lo revisamos juntos.\n\nGracias por tu dedicación durante todo este tiempo.\n\nUn saludo,\n{{empresa_nombre}}'),
  ('Ex-empleados',
   'Gracias por tu trabajo — {{empresa_nombre}}',
   E'Hola {{candidato_nombre}},\n\nDamos por finalizada oficialmente tu relación laboral con {{empresa_nombre}}. Queremos agradecerte de corazón tu dedicación, tu esfuerzo y todo lo que has aportado durante tu etapa con nosotros.\n\nLas puertas quedan abiertas: nos encantará volver a coincidir contigo en el futuro, ya sea de nuevo en el equipo o en cualquier otro camino que emprendas. Si en algún momento necesitas una referencia laboral o cualquier documentación, no dudes en escribirnos a {{email_rrhh}}.\n\nTe deseamos lo mejor en tu futuro personal y profesional.\n\nUn fuerte abrazo,\n{{empresa_nombre}}')
) AS v(nombre, asunto, cuerpo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reclutamiento_email_plantillas p
  WHERE p.empresa_id = e.id AND p.nombre = v.nombre
);

-- 2) Enlaza email_plantilla_id (por nombre) en cada estado de offboarding/ex_empleado
--    de las plantillas de estado, sin pisar los que ya lo tengan.
WITH mapa(key, nombre) AS (
  VALUES
    ('preaviso','Preaviso'),
    ('baja_contrato','Baja contrato'),
    ('entregas','Entregas'),
    ('finiquito','Finiquito'),
    ('ex_empleado','Ex-empleados')
)
UPDATE public.reclutamiento_plantillas_estado p
SET estados = (
  SELECT jsonb_agg(
    CASE
      WHEN m.key IS NOT NULL AND ep.id IS NOT NULL AND (e->>'email_plantilla_id') IS NULL
      THEN e || jsonb_build_object('email_plantilla_id', ep.id::text)
      ELSE e
    END
    ORDER BY (e->>'orden')::int
  )
  FROM jsonb_array_elements(p.estados) e
  LEFT JOIN mapa m ON m.key = e->>'key'
  LEFT JOIN public.reclutamiento_email_plantillas ep
    ON ep.empresa_id = p.empresa_id AND ep.nombre = m.nombre
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(p.estados) e
  JOIN mapa m ON m.key = e->>'key'
  WHERE (e->>'email_plantilla_id') IS NULL
);
