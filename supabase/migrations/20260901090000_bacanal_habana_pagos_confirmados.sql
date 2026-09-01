-- BACANAL y HABANA: todos los pagos quedan pagados y confirmados.
--
-- Todo el histórico está liquidado, así que se cierra el circuito de
-- confirmación para que en la app cada empleado vea su liquidación como
-- aceptada y no le salga el pop-up pendiente.
--
-- Se escribe directo en la tabla (no por la acción de la app) para NO disparar
-- los correos ni las notificaciones de "tienes una liquidación pendiente": son
-- pagos viejos ya abonados. Por eso también se desactivan los triggers.
--
-- `coalesce` conserva las fechas que ya hubiera: reejecutarla no repisa nada.
-- Idempotente.

do $$
declare
  v_ids uuid[];
  v_now timestamptz := now();
begin
  select array_agg(id) into v_ids from public.empresas where nombre in ('BACANAL','HABANA');
  if v_ids is null then raise notice 'Empresas no encontradas: nada que hacer'; return; end if;

  alter table public.rrhh_pagos disable trigger user;

  update public.rrhh_pagos p
     set confirmacion_enviada_at  = coalesce(p.confirmacion_enviada_at, v_now),
         confirmacion_aceptada_at = coalesce(p.confirmacion_aceptada_at, v_now),
         pagado    = true,
         pagado_at = coalesce(p.pagado_at, v_now)
   where p.empresa_id = any(v_ids);

  alter table public.rrhh_pagos enable trigger user;
end $$;
