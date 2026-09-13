-- Ocho columnas fuera de `resenas`. Medido antes de tocar nada.
--
-- La tabla tenía 39 columnas para 8.422 valoraciones, y el problema no era el
-- número: era que dos campos medían lo mismo y ninguno mandaba.
--
-- `estado` — el veredicto (Excelente / Regular / Malo) pasa a CALCULARSE de la
--   nota en `features/calidad/lib/veredicto.ts`. Convivía con las estrellas y
--   podían decir cosas distintas: en el tablero salía un 4 en la columna
--   Excelente y otro 4 en Regular. Comprobado contra las 8.422: el cálculo
--   coincide con la columna en 8.400, y en los 22 restantes la columna está
--   EQUIVOCADA — 17 son valoraciones con un área suspendida (comida 2, el resto
--   cincos) que dormían en la columna verde sin que nadie llamara a esa gente, y
--   5 son de Google con un 4 limpio marcadas a mano como Regular. La regla nueva
--   lo arregla: un área por debajo de 3 impide el Excelente.
--
-- `plataforma` — era `origen` escrito dos veces. Cruzadas las 8.422 coinciden
--   una a una, sin una sola excepción: Go High Level siempre es WhatsApp (5.748)
--   y CoverManager siempre es Reservas (2.611). Además es un campo que muere:
--   las 10 valoraciones que ya nacen aquí tienen origen y no tienen plataforma,
--   porque ya no hay programa externo del que venir.
--
-- `posicion` — el orden de la tarjeta DENTRO de su columna del kanban, para que
--   al arrastrarla se quedara donde la soltaras. A CERO en las 8.422: ni cuando
--   había kanban llegó a usarse. Nació sin función.
--
-- `email` — 58 de 8.422, y el correo del cliente vive en su ficha.
-- `reserva_id` — 9 de 8.422, y ni una línea de código lo leía.
-- `autor_avatar` — la foto de Google, 53 de 8.422. La inicial en un círculo se
--   lee igual y es lo que usa el resto del programa.
-- `creado_por` — nunca se escribió: 0 de 8.422.
-- `respondida` — un tercer campo para saber si una reseña ya tiene respuesta,
--   junto a `respuesta_publicada_at` y `respuesta_propietario`. A cero.
--
-- LO QUE NO SE TOCA, aunque esté vacío: `coge_telefono`, `estado_gestion`,
-- `observaciones_closer` y `gestionada_por`. No sobran: están esperando las 573
-- gestiones del Excel de calidad, que es lo siguiente. Y `rating_bebida`,
-- `rating_musica` y `rating_espectaculo` tampoco: son de esta semana y tienen su
-- interruptor por empresa en `empresa_reservas_config`.
--
-- Sin vistas ni funciones que dependan de esta tabla: comprobado antes de
-- ejecutar.
--
-- Idempotente.

ALTER TABLE public.resenas
  DROP COLUMN IF EXISTS estado,
  DROP COLUMN IF EXISTS plataforma,
  DROP COLUMN IF EXISTS posicion,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS reserva_id,
  DROP COLUMN IF EXISTS autor_avatar,
  DROP COLUMN IF EXISTS creado_por,
  DROP COLUMN IF EXISTS respondida;
