-- Qué departamentos pueden devolver dinero cobrado a un cliente.
--
-- No va en Roles: devolver no es "ver una pantalla", es sacar dinero de la
-- cuenta del restaurante, y quien puede hacerlo se decide por DEPARTAMENTO en
-- la configuración de Reservas.
--
-- Se guardan NOMBRES, no identificadores: los departamentos se llaman igual en
-- todas las empresas y así la configuración no se rompe al montar una nueva.
--
-- De fábrica, solo DIRECCIÓN.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

ALTER TABLE public.empresa_reservas_config
  ADD COLUMN IF NOT EXISTS devolucion_departamentos TEXT[] NOT NULL DEFAULT ARRAY['DIRECCIÓN']::TEXT[];

COMMENT ON COLUMN public.empresa_reservas_config.devolucion_departamentos IS
  'Departamentos autorizados a devolver cobros a clientes. Vacío = nadie puede devolver.';
