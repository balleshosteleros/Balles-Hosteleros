-- ============================================================================
-- Pagos de RRHH: todo lo de agosto 2026 hacia atrás queda marcado como PAGADO
--
-- POR QUÉ: los meses cerrados ya se abonaron de verdad, pero en pantalla seguían
-- saliendo con el botón "Pagar" en gris. El botón exige que el trabajador acepte
-- antes su liquidación (empresas.notif_liquidaciones_requiere_aprobacion = true)
-- y a estas 22 líneas nunca se les llegó a enviar, así que no había forma de
-- marcarlas desde la aplicación. Enero–julio ya se regularizaron así el 01-09.
--
-- QUÉ TOCA: sólo `pagado` y `pagado_at`. Ningún importe. No dispara el correo ni
-- el aviso de "liquidación pagada": son meses viejos y avisar hoy sólo confunde
-- (mismo criterio que la publicación de nóminas del 11-09-2026).
--
-- Septiembre 2026 en adelante NO se toca: ese mes sigue su circuito normal.
-- Idempotente: al repetirla no queda nada pendiente que marcar.
-- ============================================================================

do $$
declare
  v_marcados integer;
  v_pendientes integer;
begin
  update public.rrhh_pagos
     set pagado    = true,
         pagado_at = coalesce(pagado_at, now())
   where periodo  <= '2026-08'
     and pagado    = false;

  get diagnostics v_marcados = row_count;

  select count(*) into v_pendientes
    from public.rrhh_pagos
   where periodo <= '2026-08'
     and pagado   = false;

  if v_pendientes <> 0 then
    raise exception 'Quedan % pagos sin marcar hasta 2026-08', v_pendientes;
  end if;

  raise notice 'rrhh_pagos: % líneas marcadas como pagadas (hasta 2026-08)', v_marcados;
end $$;
