-- La fecha de la visita de las valoraciones de CoverManager, a su campo.
--
-- Al migrar Cover, la fecha de la RESERVA se guardó en `fecha_sesion`, que es
-- el campo de "cuándo gestionó calidad esta reseña". Dos cosas distintas en el
-- mismo sitio: en la ficha se leía "Fecha de gestión: 29/08" para una reseña
-- que no había gestionado nadie, y la "Fecha de la visita" salía vacía en las
-- 2.611.
--
-- Que ahí está la fecha de la reserva no es una suposición:
--   · en las 2.611 esa fecha es SIEMPRE anterior a la de la valoración, de
--     media 1,48 días — Cover mandaba su encuesta al día siguiente de comer;
--   · 2.285 de ellas (el 87 %) caen exactamente en un día en que ese cliente
--     tenía una reserva registrada.
--
-- Así las dos plataformas quedan comparables: `fecha_registro` es el día que el
-- cliente vino, venga de Cover (su reserva) o de Go High Level (cuando escaneó
-- el QR en la mesa). `fecha_sesion` vuelve a significar solo lo suyo, y se deja
-- vacía: estas reseñas nunca se gestionaron desde aquí.
--
-- Idempotente: solo toca las que aún no tienen fecha de visita.

UPDATE public.resenas
SET fecha_registro = fecha_sesion,
    fecha_sesion = NULL
WHERE plataforma = 'cover_manager'
  AND fecha_registro IS NULL
  AND fecha_sesion IS NOT NULL;
