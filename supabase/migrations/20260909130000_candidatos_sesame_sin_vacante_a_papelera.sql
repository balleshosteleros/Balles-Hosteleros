-- Reclutamiento · los contactos antiguos migrados de Sesame se van a la papelera.
--
-- Son 22 personas (19 de HABANA y 3 de BACANAL) traídas de la base de datos de
-- Sesame: solo tienen nombre, email y teléfono. No traen vacante, ni CV, ni DNI,
-- ni coinciden con ningún empleado, así que no hay manera de deducir a qué
-- puesto optaban. Sin vacante no se pintan en el pipeline y solo hacían ruido en
-- el listado de candidatos.
--
-- No se borran (la candidatura es historial): pasan a Descartado · Papelera e
-- inactivos, igual que el resto de descartes, y se pueden recuperar desde la
-- papelera si algún día vuelven. Idempotente.

UPDATE public.candidatos
SET
  estado = 'papelera',
  fase = 'descartado',
  activo = false,
  fase_actualizada_at = now()
WHERE vacante_id IS NULL
  AND promovido_at IS NULL
  AND empleado_id IS NULL
  AND notas = 'Migrado de Sesame'
  AND estado <> 'papelera';
