-- Junio 2026: falta el pago de Iván Ballesteros en BACANAL y en HABANA.
--
-- Cobró 1.250,00 € en CADA empresa, igual que en mayo. No aparecía en el Excel
-- "REGISTRO DE PAGOS 2026", pero se le pagó igualmente, así que la fila faltaba
-- en el sistema.
--
-- Se replica la estructura de mayo de cada empresa, que NO es la misma:
--   · BACANAL → los 1.250 van en `nomina`
--   · HABANA  → los 1.250 van en `complemento`
-- En ambas el total queda en 1.250,00 € y sin SS ni IRPF, como en mayo.
--
-- Se marca pagado y confirmado (ya estaba abonado). Escritura directa con los
-- triggers desactivados para no dispararle avisos de liquidación pendiente.
--
-- Idempotente: el ON CONFLICT evita duplicar si ya existiera la fila.

do $$
declare
  v_bac uuid; v_hab uuid; v_now timestamptz := now();
begin
  select id into v_bac from public.empresas where nombre='BACANAL';
  select id into v_hab from public.empresas where nombre='HABANA';
  if v_bac is null or v_hab is null then raise notice 'Empresas no encontradas: nada que hacer'; return; end if;

  alter table public.rrhh_pagos disable trigger user;

  insert into public.rrhh_pagos (
    empresa_id, empleado_id, empleado_nombre, periodo, fijo,
    nomina, horas_reales, horas_trabajadas, complemento, ajuste, horas_extras, bonus,
    ss_empleado, ss_empresa, irpf, total,
    pagado, pagado_at, confirmacion_enviada_at, confirmacion_aceptada_at
  )
  select v_bac, p.empleado_id, p.empleado_nombre, '2026-06', p.fijo,
         1250.00, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1250.00,
         true, v_now, v_now, v_now
    from public.rrhh_pagos p
   where p.empresa_id = v_bac and p.periodo = '2026-05'
     and p.empleado_nombre = 'Iván Ballesteros'
  on conflict (empresa_id, empleado_id, periodo) do nothing;

  insert into public.rrhh_pagos (
    empresa_id, empleado_id, empleado_nombre, periodo, fijo,
    nomina, horas_reales, horas_trabajadas, complemento, ajuste, horas_extras, bonus,
    ss_empleado, ss_empresa, irpf, total,
    pagado, pagado_at, confirmacion_enviada_at, confirmacion_aceptada_at
  )
  select v_hab, p.empleado_id, p.empleado_nombre, '2026-06', p.fijo,
         0, 0, 0, 1250.00, 0, 0, 0, 0, 0, 0, 1250.00,
         true, v_now, v_now, v_now
    from public.rrhh_pagos p
   where p.empresa_id = v_hab and p.periodo = '2026-05'
     and p.empleado_nombre = 'Iván Ballesteros'
  on conflict (empresa_id, empleado_id, periodo) do nothing;

  alter table public.rrhh_pagos enable trigger user;
end $$;
