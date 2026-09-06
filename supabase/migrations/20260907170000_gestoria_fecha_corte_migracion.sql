-- Fecha de corte de la migración: desde cuándo el software gestiona las altas.
--
-- El problema real: la pantalla Gestoría → Contrataciones marca en ROJO toda alta
-- de un empleado que no tiene token de contrato, entendiendo que «el correo a la
-- gestoría no salió». Esa deducción es correcta para las altas nacidas en el
-- software, pero FALSA para las que entraron por migración: esos trabajadores ya
-- estaban dados de alta en la Seguridad Social antes de que existiera el sistema,
-- así que nunca hubo correo que enviar. Aparecían 8 alarmas rojas imposibles de
-- resolver, con un botón de reenvío que no debía pulsarse nunca.
--
-- La empresa marca aquí el día a partir del cual gestiona las altas con el
-- software. Las altas ANTERIORES se muestran como «Migrado»: en gris, sin alarma
-- y sin botón de reenvío. Las posteriores siguen el circuito normal.
--
-- NULL (por defecto) = sin corte: comportamiento idéntico al actual, por lo que
-- ninguna empresa que no lo configure nota ningún cambio.
-- Idempotente: se puede reejecutar sin efecto.

ALTER TABLE reclutamiento_config
  ADD COLUMN IF NOT EXISTS gestoria_migracion_hasta date;

COMMENT ON COLUMN reclutamiento_config.gestoria_migracion_hasta IS
  'Día de corte de la migración: las altas con día de comienzo ANTERIOR a esta fecha se tramitaron fuera del software (el trabajador ya estaba de alta en la Seguridad Social) y se muestran como «Migrado», sin alarma ni reenvío. NULL = sin corte.';
