-- Los escaneos de QR se apuntan en el dia del restaurante, no en el dia UTC.
--
-- Antes la fecha la ponia `current_date`, que en Postgres es UTC. Un cliente que
-- escanea la carta a la 01:00 de un sabado en Madrid quedaba apuntado en el
-- viernes: la grafica partia cada noche por la mitad y el sabado salia corto.
-- En invierno solo fallaba la hora entre 00:00 y 01:00; en verano, entre 00:00 y
-- 02:00.
--
-- Ahora la fecha la calcula la zona horaria de la empresa
-- (`empresas.config_operativa->>'zonaHoraria'`), igual que la reconfirmacion de
-- reservas y que las visitas de las paginas web.
--
-- Se mantiene el tercer parametro `p_fecha` por compatibilidad, pero ya se
-- ignora: quien llama no tiene que saber en que huso vive cada restaurante.
--
-- Idempotente: se puede volver a aplicar sin romper nada.

create or replace function public.qr_registrar_escaneo(
  p_qr_id uuid,
  p_dispositivo text default 'otro',
  p_fecha date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_zona    text;
  v_fecha   date;
  v_disp    text;
begin
  select empresa_id into v_empresa from public.qr_codigos where id = p_qr_id;
  if v_empresa is null then
    return;
  end if;

  select nullif(trim(coalesce(config_operativa->>'zonaHoraria', '')), '')
    into v_zona
    from public.empresas
   where id = v_empresa;

  -- Una zona escrita a mano y mal ("Madrid" en vez de "Europe/Madrid") tumbaria
  -- el registro entero. Antes de perder el escaneo, se cae a Madrid.
  begin
    v_fecha := (now() at time zone coalesce(v_zona, 'Europe/Madrid'))::date;
  exception when others then
    v_fecha := (now() at time zone 'Europe/Madrid')::date;
  end;

  v_disp := case when p_dispositivo in ('movil', 'tablet', 'escritorio') then p_dispositivo else 'otro' end;

  update public.qr_codigos
     set escaneos = escaneos + 1,
         ultimo_escaneo_at = now()
   where id = p_qr_id;

  insert into public.qr_escaneos (qr_id, empresa_id, fecha, dispositivo, total)
  values (p_qr_id, v_empresa, v_fecha, v_disp, 1)
  on conflict (qr_id, fecha, dispositivo)
  do update set total = public.qr_escaneos.total + 1;
end;
$$;

revoke all on function public.qr_registrar_escaneo(uuid, text, date) from public;
grant execute on function public.qr_registrar_escaneo(uuid, text, date) to service_role;
