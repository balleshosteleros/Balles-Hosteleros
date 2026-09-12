-- ============================================================
-- La felicitación de cumpleaños respeta la baja, igual que las campañas.
--
-- El motor ya miraba el permiso de cada canal, pero no la fecha de baja. Hoy eso
-- no cambia nada —darse de baja también apaga el permiso—, pero en cuanto
-- alguien vuelva a marcar la casilla desde la ficha del cliente, esa persona
-- recibiría felicitaciones sin haberlas pedido. La baja se comprueba en el
-- origen para que no dependa de lo que haga nadie desde una pantalla.
--
-- La función devuelve ahora también las fechas de baja: el motor elige canal
-- (WhatsApp, si no SMS, si no correo) y necesita saber cuál está cerrado.
--
-- Cambia el tipo de retorno, así que hay que borrarla antes de recrearla.
-- ============================================================

drop function if exists public.clientes_sala_cumpleanos(uuid, date);

create function public.clientes_sala_cumpleanos(p_empresa_id uuid, p_fecha date)
returns table(
  id uuid, nombre text, apellidos text, email text, telefono text,
  fecha_nacimiento date,
  acepta_marketing_email boolean, acepta_marketing_sms boolean, acepta_marketing_whatsapp boolean,
  marketing_baja_email_at timestamptz,
  marketing_baja_sms_at timestamptz,
  marketing_baja_whatsapp_at timestamptz
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select c.id, c.nombre, c.apellidos, c.email, c.telefono,
         c.fecha_nacimiento,
         coalesce(c.acepta_marketing_email, false),
         coalesce(c.acepta_marketing_sms, false),
         coalesce(c.acepta_marketing_whatsapp, false),
         c.marketing_baja_email_at,
         c.marketing_baja_sms_at,
         c.marketing_baja_whatsapp_at
    from public.clientes_sala c
   where c.empresa_id = p_empresa_id
     and c.fecha_nacimiento is not null
     -- Quien se dio de baja en los TRES canales no entra: no hay por dónde
     -- escribirle, y traerlo para descartarlo después es trabajo de más en una
     -- consulta que corre cada día sobre veinte mil fichas.
     and not (
       c.marketing_baja_email_at is not null
       and c.marketing_baja_sms_at is not null
       and c.marketing_baja_whatsapp_at is not null
     )
     and (
       (extract(month from c.fecha_nacimiento) = extract(month from p_fecha)
        and extract(day   from c.fecha_nacimiento) = extract(day   from p_fecha))
       or (
         -- Los nacidos el 29 de febrero se felicitan el 28 en los años que no
         -- son bisiestos: si no, les tocaría cumpleaños cada cuatro años.
         extract(month from c.fecha_nacimiento) = 2
         and extract(day from c.fecha_nacimiento) = 29
         and extract(month from p_fecha) = 2
         and extract(day   from p_fecha) = 28
         and not (
           (extract(year from p_fecha)::int % 4 = 0 and extract(year from p_fecha)::int % 100 <> 0)
           or extract(year from p_fecha)::int % 400 = 0
         )
       )
     );
$function$;
