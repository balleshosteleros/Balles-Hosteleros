-- Qué se le pregunta al cliente en la encuesta de valoración, por empresa.
--
-- Motivo: no todos los restaurantes valoran lo mismo. HABANA, por ejemplo,
-- nunca ha puntuado la cocina (en CoverManager esa nota llegaba siempre a 0),
-- mientras que BACANAL sí la usa. Hasta ahora las tres preguntas se mostraban
-- siempre, cableadas en el formulario.
--
-- Se configura en Sala → Reservas → Configuración → Comunicaciones, al
-- seleccionar el correo de "Solicitud de valoración".
--
-- La nota global (rating) NO es configurable: es la que sostiene la media del
-- cliente y el desvío a Google, así que se pregunta siempre.
ALTER TABLE empresa_reservas_config
  ADD COLUMN IF NOT EXISTS valoracion_pide_cocina   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS valoracion_pide_servicio boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS valoracion_pide_ambiente boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN empresa_reservas_config.valoracion_pide_cocina   IS 'Si la encuesta de valoración pregunta por la cocina.';
COMMENT ON COLUMN empresa_reservas_config.valoracion_pide_servicio IS 'Si la encuesta de valoración pregunta por el servicio.';
COMMENT ON COLUMN empresa_reservas_config.valoracion_pide_ambiente IS 'Si la encuesta de valoración pregunta por el ambiente.';
