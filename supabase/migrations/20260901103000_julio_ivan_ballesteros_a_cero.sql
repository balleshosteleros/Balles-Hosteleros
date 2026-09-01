-- Julio 2026: Iván Ballesteros va a CERO en las dos empresas.
--
-- La hoja JULIO del Excel le apunta 1.250,00 € en BACANAL y en HABANA, pero ese
-- dato está mal: en julio no cobró. No hay nómina suya en el PDF de la gestoría.
--
-- Se deja la fila existiendo pero con todos los importes a 0,00 € (no se borra),
-- para que el mes siga mostrándole en la lista con total cero.
--
-- En HABANA no había fila de julio: se crea a cero copiando su empleado_id de
-- junio, para que salga igual que en BACANAL.
--
-- Escritura directa con los triggers desactivados: no debe disparar avisos.
-- Idempotente: el ON CONFLICT deja los mismos ceros si se reejecuta.

do $$
declare
  v_bac uuid; v_hab uuid; v_now timestamptz := now();
begin
  select id into v_bac from public.empresas where nombre='BACANAL';
  select id into v_hab from public.empresas where nombre='HABANA';
  if v_bac is null or v_hab is null then raise notice 'Empresas no encontradas: nada que hacer'; return; end if;

  alter table public.rrhh_pagos disable trigger user;

  -- BACANAL: la fila ya existe (cargada con el mes de julio) -> a cero.
  update public.rrhh_pagos
     set nomina=0, complemento=0, horas_extras=0, bonus=0, ajuste=0,
         ss_empleado=0, ss_empresa=0, irpf=0, total=0
   where empresa_id=v_bac and periodo='2026-07' and empleado_nombre='Iván Ballesteros';

  -- HABANA: no había fila de julio -> se crea a cero.
  insert into public.rrhh_pagos (
    empresa_id, empleado_id, empleado_nombre, periodo, fijo,
    nomina, horas_reales, horas_trabajadas, complemento, ajuste, horas_extras, bonus,
    ss_empleado, ss_empresa, irpf, total,
    pagado, pagado_at, confirmacion_enviada_at, confirmacion_aceptada_at
  )
  select v_hab, p.empleado_id, p.empleado_nombre, '2026-07', p.fijo,
         0,0,0,0,0,0,0, 0,0,0, 0,
         true, v_now, v_now, v_now
    from public.rrhh_pagos p
   where p.empresa_id = v_hab and p.periodo = '2026-06'
     and p.empleado_nombre = 'Iván Ballesteros'
  on conflict (empresa_id, empleado_id, periodo) do update
     set nomina=0, complemento=0, horas_extras=0, bonus=0, ajuste=0,
         ss_empleado=0, ss_empresa=0, irpf=0, total=0;

  alter table public.rrhh_pagos enable trigger user;
end $$;
