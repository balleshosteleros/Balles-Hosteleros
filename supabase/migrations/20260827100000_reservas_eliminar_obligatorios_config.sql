-- Elimina de la configuración de reservas los dos flags de campos obligatorios.
--
-- Nacieron por error en el engranaje del módulo (Sala → Reservas →
-- Configuración). Su sitio es Ajustes → Departamentos → Sala → Reservas, que es
-- la barrera de seguridad superior, y allí ya se marcan con el checklist normal
-- de campos obligatorios (tabla `empresa_reglas_submodulo`).
--
-- Ninguna de las dos columnas guarda datos: estaban a false en todas las
-- empresas y ya no las lee ningún punto del código —ni el formulario interno de
-- sala, ni el portal público, ni las validaciones de servidor.
--
-- Idempotente: se puede reejecutar sin romper nada.

ALTER TABLE public.empresa_reservas_config
  DROP COLUMN IF EXISTS obligatorio_email,
  DROP COLUMN IF EXISTS obligatorio_telefono;
