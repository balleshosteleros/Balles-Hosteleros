-- Las paginas web cuentan sus visitas, igual que los QR cuentan sus escaneos.
--
-- Hasta ahora una pagina publicada no dejaba rastro: solo se sabia de alguien
-- cuando rellenaba un formulario (`leads_web`), que es una minoria diminuta de
-- quien entra. No habia forma de responder "cuanta gente entro en la web esta
-- semana".
--
-- Se copia la forma de `qr_escaneos` a proposito: mismo agregado por dia y tipo
-- de aparato, mismas columnas, misma politica. Asi las dos graficas (QR y web)
-- salen del mismo molde y se leen igual.
--
-- NO se guarda IP ni identificador de persona. Interesa "cuanta gente entra en
-- la carta los sabados", no quien entra.
--
-- Idempotente: se puede volver a aplicar sin romper nada.

-- 1. Visitas por dia ────────────────────────────────────────────────────────
create table if not exists public.paginas_web_visitas (
  id          uuid primary key default gen_random_uuid(),
  pagina_id   uuid not null references public.paginas_web(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  fecha       date not null,
  dispositivo text not null default 'otro',
  total       bigint not null default 0,

  constraint paginas_web_visitas_unq unique (pagina_id, fecha, dispositivo),
  constraint paginas_web_visitas_dispositivo_chk
    check (dispositivo in ('movil', 'tablet', 'escritorio', 'otro'))
);

comment on table public.paginas_web_visitas is
  'Visitas de cada pagina publica agregadas por dia y tipo de aparato. La fecha es el dia LOCAL de la empresa, no el dia UTC. Sin IP ni identificador de persona.';

create index if not exists idx_paginas_web_visitas_empresa_fecha
  on public.paginas_web_visitas (empresa_id, fecha desc);

create index if not exists idx_paginas_web_visitas_pagina_fecha
  on public.paginas_web_visitas (pagina_id, fecha desc);

-- 2. Contador rapido en la propia pagina ────────────────────────────────────
-- Para pintar el total en el listado sin sumar toda la tabla.
alter table public.paginas_web
  add column if not exists visitas bigint not null default 0;

alter table public.paginas_web
  add column if not exists ultima_visita_at timestamptz;

comment on column public.paginas_web.visitas is
  'Total historico de visitas. Contador rapido; el desglose por dia esta en paginas_web_visitas.';

-- 3. RLS ────────────────────────────────────────────────────────────────────
alter table public.paginas_web_visitas enable row level security;

-- Solo lectura desde el navegador, y solo de las empresas del usuario. Los
-- INSERT los hace el servidor con la service-role, igual que en los QR: quien
-- visita la web es un anonimo sin cuenta en el sistema.
drop policy if exists "paginas_web_visitas_select" on public.paginas_web_visitas;
create policy "paginas_web_visitas_select" on public.paginas_web_visitas
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

-- 4. Registro de visita ─────────────────────────────────────────────────────
-- `security definer` porque quien visita es un cliente anonimo. Suma en el
-- contador rapido y en el desglose diario de una vez.
--
-- La fecha NO se pasa desde fuera: la calcula aqui la zona horaria de la
-- empresa. Si se dejara en `current_date` (UTC), una visita de las 01:00 de un
-- sabado en Madrid caeria en el viernes y la grafica mentiria cada noche.
create or replace function public.paginas_web_registrar_visita(
  p_pagina_id uuid,
  p_dispositivo text default 'otro'
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
  select empresa_id into v_empresa
    from public.paginas_web
   where id = p_pagina_id;

  if v_empresa is null then
    return;
  end if;

  select nullif(trim(coalesce(config_operativa->>'zonaHoraria', '')), '')
    into v_zona
    from public.empresas
   where id = v_empresa;

  -- Una zona escrita a mano y mal ("Madrid" en vez de "Europe/Madrid") tumbaria
  -- el registro entero. Antes de perder la visita, se cae a Madrid.
  begin
    v_fecha := (now() at time zone coalesce(v_zona, 'Europe/Madrid'))::date;
  exception when others then
    v_fecha := (now() at time zone 'Europe/Madrid')::date;
  end;

  v_disp := case
    when p_dispositivo in ('movil', 'tablet', 'escritorio') then p_dispositivo
    else 'otro'
  end;

  update public.paginas_web
     set visitas = visitas + 1,
         ultima_visita_at = now()
   where id = p_pagina_id;

  insert into public.paginas_web_visitas (pagina_id, empresa_id, fecha, dispositivo, total)
  values (p_pagina_id, v_empresa, v_fecha, v_disp, 1)
  on conflict (pagina_id, fecha, dispositivo)
  do update set total = public.paginas_web_visitas.total + 1;
end;
$$;

revoke all on function public.paginas_web_registrar_visita(uuid, text) from public;
grant execute on function public.paginas_web_registrar_visita(uuid, text) to service_role;
