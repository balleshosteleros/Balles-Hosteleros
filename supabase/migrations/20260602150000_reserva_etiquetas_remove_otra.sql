-- Elimina la etiqueta canónica "Otra"/"Otro" de reservas en todas las empresas.
-- Se retira del seed canónico (`src/lib/seeds/reserva-etiquetas.ts`) y se borra
-- de las empresas existentes que aún la tengan, siempre que no haya ninguna
-- reserva vinculada a ella (no se modifican datos de cliente).
DELETE FROM empresa_reserva_etiquetas e
WHERE lower(trim(e.nombre)) IN ('otra', 'otro')
  AND NOT EXISTS (
    SELECT 1 FROM reservas r WHERE r.etiqueta_id = e.id
  );
