-- push_subscriptions: una fila por APARATO, no una por renovación.
--
-- Problema: el navegador renueva su suscripción por su cuenta (actualizaciones,
-- limpiezas de datos) y en cada renovación genera un `endpoint` NUEVO. Como el
-- guardado hacía upsert por endpoint, nunca casaba con la fila anterior y creaba
-- otra, dejando la vieja viva para siempre. Resultado real observado: 6 filas
-- para 2 aparatos (un iPhone con 4 y un Mac con 2).
--
-- Efecto de cara al usuario: la pantalla de Ajustes → Usuarios enseñaba VERDE
-- apoyándose en filas caducadas que ya no reciben nada — justo el fallo silencioso
-- que esa pantalla debía detectar.
--
-- Solución: el navegador genera un identificador propio y estable (device_id,
-- guardado en su localStorage) que sobrevive a las renovaciones. El user_agent NO
-- sirve para esto: el mismo iPhone aparecía con Safari 26.5 y 26.5.2, así que al
-- actualizar el móvil se contaría como aparato nuevo.

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS device_id text;

-- Un aparato solo puede tener una suscripción viva por usuario. Índice parcial:
-- las filas antiguas sin device_id (previas a esta migración) no se ven afectadas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_user_device
  ON public.push_subscriptions (user_id, device_id)
  WHERE device_id IS NOT NULL;

-- Limpieza de los duplicados ya existentes: deja viva SOLO la suscripción más
-- reciente de cada (usuario + navegador) y retira las anteriores. No se borran
-- filas: se marcan como deshabilitadas, que es lo que ya hace el servidor cuando
-- un envío rebota, y así queda el rastro.
-- Se agrupa por tipo de aparato (móvil/escritorio), NO por user_agent: el mismo
-- iPhone figura con Safari 26.5 y 26.5.2, así que agrupar por UA dejaría vivas
-- dos filas del mismo móvil.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY
             user_id,
             (user_agent ~* 'iPhone|iPad|iPod|Android|Mobile|Windows Phone')
           ORDER BY created_at DESC
         ) AS rn
  FROM public.push_subscriptions
  WHERE enabled = true
)
UPDATE public.push_subscriptions ps
SET enabled = false
FROM ranked r
WHERE ps.id = r.id
  AND r.rn > 1;

COMMENT ON COLUMN public.push_subscriptions.device_id IS
  'Identificador estable del navegador (localStorage). Une las renovaciones de suscripción de un mismo aparato, que cambian de endpoint.';
