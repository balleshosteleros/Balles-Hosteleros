-- Tercera y última pasada del canal de entrada: los que escribieron por WhatsApp.
--
-- Después de deducirlo de las reservas y de las visitas migradas
-- (`20260912100000`), quedaban fichas sin canal que no tienen ni una cosa ni la
-- otra. Entre ellas, las que traen `nombre_whatsapp`: ese campo guarda el
-- nombre del perfil tal y como aparece en el móvil del restaurante, y solo lo
-- tiene quien nos ha escrito por ahí. Es prueba suficiente del canal.
--
-- No se toca el resto de las que siguen en blanco (las que solo tienen correo o
-- solo teléfono): de esas no hay nada que demuestre por dónde entraron, y NULL
-- sigue queriendo decir "no se sabe".
--
-- Idempotente: solo actúa sobre `origen IS NULL`.

UPDATE public.clientes_sala
SET origen = 'WHATSAPP',
    updated_at = now()
WHERE origen IS NULL
  AND nombre_whatsapp IS NOT NULL;
