-- Contador diario de correos enviados por la plataforma.
-- Motivo: el transporte SMTP es Gmail Workspace (info@balleshosteleros.com) con
-- límite gratuito de ~2.000 envíos/día para TODA la plataforma. Esta tabla cuenta
-- los envíos del día y permite avisar por email al dueño cuando se acerca al tope.
-- Tabla interna: solo el service-role accede (RLS activado SIN políticas).

create table if not exists public.email_envios_diarios (
  fecha date primary key,
  total integer not null default 0,
  alertado boolean not null default false
);

alter table public.email_envios_diarios enable row level security;
-- Sin políticas a propósito: anon/authenticated no pueden leer ni escribir.
-- El backend accede con la service-role (que salta RLS).

-- Registra un envío: incrementa el contador del día (zona Europe/Madrid) de forma
-- atómica y devuelve si toca disparar el aviso (primera vez que se cruza el umbral
-- hoy). El flag `alertado` evita repetir el aviso el mismo día.
create or replace function public.registrar_envio_email(p_umbral integer)
returns table(total integer, debe_alertar boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date := (now() at time zone 'Europe/Madrid')::date;
  v_total integer;
  v_alertado boolean;
begin
  insert into public.email_envios_diarios as e (fecha, total)
    values (v_fecha, 1)
  on conflict (fecha) do update set total = e.total + 1
  returning e.total, e.alertado into v_total, v_alertado;

  if v_total >= p_umbral and not v_alertado then
    update public.email_envios_diarios set alertado = true where fecha = v_fecha;
    return query select v_total, true;
    return;
  end if;

  return query select v_total, false;
end;
$$;

revoke all on function public.registrar_envio_email(integer) from public;
grant execute on function public.registrar_envio_email(integer) to service_role;
