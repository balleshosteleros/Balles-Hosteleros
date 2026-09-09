-- Reclutamiento · los candidatos ya contratados no salían en el pipeline.
--
-- Dos causas, ambas de DATOS antiguos (nunca hubo backfill al cambiar el modelo):
--
-- 1) CONVENCIÓN INVERTIDA. El modelo vigente es `fase` = fase principal
--    (seleccion/onboarding/offboarding/descartado) y `estado` = columna del
--    kanban. Las filas escritas con el modelo antiguo lo tienen al revés
--    (fase='empleado' + estado='nuevo', fase='papelera' + estado='descartado'…).
--    Como la vista pinta cada tarjeta por `estado`, esos candidatos aparecían en
--    la columna equivocada («Nuevo») o en ninguna (estado='descartado' no es una
--    columna válida).
--
-- 2) SIN VACANTE. Los 16 candidatos promovidos a empleado tenían
--    `vacante_id = NULL`. El pipeline agrupa por vacante, así que un candidato
--    sin vacante no se pinta en ninguna parte: eran invisibles en Reclutamiento.
--
-- Idempotente: la parte 1 solo toca filas cuya `fase` NO es una fase principal;
-- la parte 2 solo rellena `vacante_id` cuando está a NULL.

-- ── 1) fase/estado: mover el valor de columna a `estado` y derivar la fase ──
UPDATE public.candidatos
SET
  estado = fase,
  fase = CASE fase
    WHEN 'nuevo'              THEN 'seleccion'
    WHEN 'elegido'            THEN 'seleccion'
    WHEN 'entrevista'         THEN 'seleccion'
    WHEN 'documentacion'      THEN 'seleccion'
    WHEN 'en_progreso'        THEN 'seleccion'
    WHEN 'oferta'             THEN 'seleccion'
    WHEN 'formacion'          THEN 'onboarding'
    WHEN 'contratacion'       THEN 'onboarding'
    WHEN 'prueba'             THEN 'onboarding'
    WHEN 'empleado'           THEN 'onboarding'
    WHEN 'seleccionado'       THEN 'onboarding'
    WHEN 'preaviso'           THEN 'offboarding'
    WHEN 'baja_contrato'      THEN 'offboarding'
    WHEN 'entregas'           THEN 'offboarding'
    WHEN 'finiquito'          THEN 'offboarding'
    WHEN 'papelera'           THEN 'descartado'
    WHEN 'no_se_presenta'     THEN 'descartado'
    WHEN 'suspenso_formacion' THEN 'descartado'
    WHEN 'ex_empleado'        THEN 'descartado'
  END
WHERE fase NOT IN ('seleccion', 'onboarding', 'offboarding', 'descartado');

-- ── 2) vacante_id de los candidatos ya contratados ──
-- Se reconstruye desde el puesto principal de su empleado: hay una vacante por
-- puesto y empresa, así que la correspondencia es exacta.
UPDATE public.candidatos c
SET vacante_id = v.id
FROM public.empleado_puestos ep
JOIN public.vacantes v ON v.puesto_id = ep.puesto_id
WHERE c.vacante_id IS NULL
  AND c.empleado_id IS NOT NULL
  AND ep.empleado_id = c.empleado_id
  AND ep.es_principal
  AND v.empresa_id = c.empresa_id;
