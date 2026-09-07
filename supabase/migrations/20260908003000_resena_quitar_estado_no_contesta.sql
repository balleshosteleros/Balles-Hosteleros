-- "No contesta" deja de existir como columna del tablero.
--
-- Ya no queda ninguna (se borraron las 11.458 en `20260908002000`), y el
-- catálogo de la app tampoco la ofrece. Quitarla del CHECK cierra la puerta:
-- ni una importación ni un arrastre pueden volver a crear una valoración que
-- no valora nada.
--
-- El razonamiento, de Iván: quien no responde al WhatsApp está en la misma
-- situación que el cliente que reservó por Cover y no contestó a la encuesta —
-- y de esos no hay ninguna ficha. Lo que sí queda registrado es que se le
-- PIDIÓ opinión, y eso vive en los envíos de petición de valoración.
--
-- Se queda "nuevo_comensal": ese es el que acaba de venir y a quien todavía no
-- se le ha preguntado. Es la cola de trabajo de calidad, no un silencio.
--
-- Idempotente.

ALTER TABLE public.resenas
  DROP CONSTRAINT IF EXISTS resenas_estado_check;

ALTER TABLE public.resenas
  ADD CONSTRAINT resenas_estado_check
  CHECK (estado IN ('nuevo_comensal', 'excelente', 'regular', 'malo'));
