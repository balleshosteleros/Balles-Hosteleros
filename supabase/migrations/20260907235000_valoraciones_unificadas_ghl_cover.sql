-- Todas las valoraciones en la misma escala y con la vía real por la que
-- llegaron.
--
-- Hasta ahora convivían tres formas de decir lo mismo:
--   · Google y CoverManager puntúan de 1 a 5 estrellas.
--   · Go High Level no puntuaba: clasificaba en Excelente / Regular / Malo.
-- Con la mitad de las valoraciones sin nota, cualquier media del restaurante se
-- calculaba solo sobre las de Cover y Google, y las 17.642 de GHL no pesaban
-- nada. Decisión de Iván (07-09-2026): Excelente = 5, Regular = 3, Malo = 1.
--
-- Esa nota es una EQUIVALENCIA, no algo que el cliente teclease: quien dijo
-- "excelente" por WhatsApp no eligió cinco estrellas. Se asume a propósito para
-- poder sumar todo en un mismo indicador; el `origen` de cada fila deja dicho
-- de dónde salió, así que siempre se puede separar.
--
-- SIN NOTA, a propósito:
--   · `no_contesta` (11.458): no es una valoración. Es que no se le pudo
--     preguntar. Poner un 0 o un 1 sería contar como mala opinión un silencio.
--   · `nuevo_comensal` (436): todavía no se le ha preguntado.
--   Ambos siguen en el tablero de Calidad, que es su sitio —dicen a quién falta
--   por llamar—, pero no cuentan como valoración del cliente.
--
-- EL ORIGEN pasa a decir la VÍA por la que el cliente llegó a valorar:
--   · lo de CoverManager era la encuesta que salía de su reserva → 'reserva'
--   · lo de GHL se recogió escribiéndole por WhatsApp → 'whatsapp'
-- Hay 442 clientes con valoración en las dos. No se fusionan ni se borra
-- ninguna: reservó por Cover Y además escaneó el WhatsApp, así que entró por
-- las dos vías y cada registro conserva la suya. Solo 2 de esos pares comparten
-- fecha exacta; el resto son visitas distintas.
--
-- Idempotente.

-- 1) Nota equivalente para lo que vino de GHL.
UPDATE public.resenas
SET rating = CASE estado
      WHEN 'excelente' THEN 5
      WHEN 'regular'   THEN 3
      WHEN 'malo'      THEN 1
    END
WHERE plataforma = 'go_high_level'
  AND estado IN ('excelente', 'regular', 'malo')
  AND rating IS DISTINCT FROM CASE estado
      WHEN 'excelente' THEN 5
      WHEN 'regular'   THEN 3
      WHEN 'malo'      THEN 1
    END;

-- 2) Fecha de la valoración: el día en que calidad habló con el cliente y, si
--    no consta, el de su visita. Sin esto la ficha del cliente las ordena y las
--    pinta sin fecha, como si no se supiera cuándo opinó.
UPDATE public.resenas
SET "fecha_reseña" = COALESCE(fecha_sesion, fecha_registro)::timestamptz
WHERE plataforma = 'go_high_level'
  AND "fecha_reseña" IS NULL
  AND COALESCE(fecha_sesion, fecha_registro) IS NOT NULL;

-- 3) La vía real de las de CoverManager: la encuesta llegaba por su reserva.
UPDATE public.resenas
SET origen = 'reserva'
WHERE plataforma = 'cover_manager'
  AND origen <> 'reserva';
