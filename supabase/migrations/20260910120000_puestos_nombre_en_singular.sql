-- Los PUESTOS se nombran en SINGULAR: un puesto es el trabajo de UNA persona.
--
-- El catálogo guardaba «CAMAREROS 1», «CAMAREROS 2» y «CACHIMBEROS», y ese
-- nombre se pinta tal cual allí donde se habla de una persona concreta: ficha
-- del empleado, cuadrante, fichajes, nóminas, gestoría, contratos y PDFs. Salía
-- «Javier Casarrubios · CAMAREROS 1», que en plural no se sostiene. En las
-- ofertas de empleo pasaba lo mismo: la vacante se titulaba «CAMAREROS».
--
-- Se renombra el catálogo a singular y se arrastra el cambio a TODAS las copias
-- de texto del nombre del puesto (el empleado, sus puestos, sus condiciones,
-- promociones, contrataciones, bajas, vacantes, cursos de formación y la
-- plantilla de cuestionario que lleva el nombre del puesto).
--
-- El NÚMERO de plaza se conserva («CAMARERO 1», «CAMARERO 2»): son puestos
-- distintos con sus propias condiciones. La oferta de empleo ya lo quita al
-- publicarse, así que la vacante queda en «CAMARERO».
--
-- Multi-tenant: se aplica a todas las empresas, actuales y futuras (el seed
-- canónico también pasa a singular). Idempotente: solo toca lo que sigue en
-- plural, pasarla dos veces no cambia nada.

BEGIN;

DO $$
DECLARE
  destino text[];
  palabra text[];
BEGIN
  -- Cada sitio donde vive una COPIA del nombre del puesto.
  FOREACH destino SLICE 1 IN ARRAY ARRAY[
    ARRAY['puestos',              'nombre'],
    ARRAY['empleados',            'puesto'],
    ARRAY['empleado_puestos',     'puesto_nombre'],
    ARRAY['empleado_condiciones', 'puesto_nombre'],
    ARRAY['empleado_promociones', 'puesto_origen_nombre'],
    ARRAY['empleado_promociones', 'puesto_destino_nombre'],
    ARRAY['contrataciones',       'puesto'],
    ARRAY['gestoria_bajas',       'puesto'],
    ARRAY['vacantes',             'puesto_snapshot'],
    ARRAY['vacantes',             'titulo'],
    ARRAY['formacion_cursos',     'titulo'],
    ARRAY['soporte_conocimiento', 'puesto']
  ]
  LOOP
    CONTINUE WHEN to_regclass('public.' || destino[1]) IS NULL;

    FOREACH palabra SLICE 1 IN ARRAY ARRAY[
      ARRAY['CAMAREROS',   'CAMARERO'],
      ARRAY['CACHIMBEROS', 'CACHIMBERO']
    ]
    LOOP
      -- El nombre entero, o el nombre seguido del número de plaza.
      EXECUTE format(
        'UPDATE public.%I SET %I = %L || substr(%I, %s) WHERE %I = %L OR %I LIKE %L',
        destino[1], destino[2], palabra[2], destino[2], length(palabra[1]) + 1,
        destino[2], palabra[1],
        destino[2], palabra[1] || ' %'
      );
    END LOOP;
  END LOOP;
END $$;

-- La plantilla de cuestionario lleva el nombre del puesto dentro del título
-- («Evaluación inicial — Camareros»), en minúsculas y no al principio.
UPDATE public.cuestionario_plantillas
   SET nombre = regexp_replace(nombre, 'Camareros', 'Camarero', 'g')
 WHERE nombre LIKE '%Camareros%';

UPDATE public.cuestionario_plantillas
   SET nombre = regexp_replace(nombre, 'Cachimberos', 'Cachimbero', 'g')
 WHERE nombre LIKE '%Cachimberos%';

-- El organigrama pinta las mismas cajas de puesto: si el catálogo va en
-- singular, la caja también («JEFE DE SALA», «COCINERO» ya lo estaban).
UPDATE public.organigramas
   SET nodes = (
     SELECT jsonb_agg(
       CASE
         WHEN n->>'label' = 'CAMAREROS'   THEN jsonb_set(n, '{label}', '"CAMARERO"')
         WHEN n->>'label' = 'CACHIMBEROS' THEN jsonb_set(n, '{label}', '"CACHIMBERO"')
         ELSE n
       END ORDER BY ord)
     FROM jsonb_array_elements(nodes) WITH ORDINALITY AS t(n, ord)
   )
 WHERE nodes::text ~ 'CAMAREROS|CACHIMBEROS';

COMMIT;
