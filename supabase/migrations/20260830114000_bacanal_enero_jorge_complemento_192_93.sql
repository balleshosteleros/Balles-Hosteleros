-- BACANAL enero 2026: Jorge (Belda Garrigós) tenía mal el complemento.
--
-- Se aplica el criterio del TOTAL verde del Excel "REGISTRO DE PAGOS 2026":
-- el complemento es el TOTAL verde menos las horas extras, que van aparte.
--   380,43 (TOTAL verde) − 187,50 (horas extras) = 192,93
--
-- Lo que había cargado (468,75) era la columna PROPINA naranja, que es otra cosa.
--
-- Solo enero de BACANAL. El resto de meses y empleados no se toca.
-- Idempotente: reejecutarla vuelve a dejar los mismos importes.

do $$
declare
  v_emp uuid;
begin
  select id into v_emp from public.empresas where nombre = 'BACANAL';
  if v_emp is null then raise notice 'Empresa BACANAL no encontrada: nada que hacer'; return; end if;

  alter table public.rrhh_pagos disable trigger user;

  update public.rrhh_pagos p
     set complemento = 192.93,
         total = round((
           coalesce(p.nomina,0) + 192.93
           + coalesce(p.horas_extras,0) + coalesce(p.bonus,0) + coalesce(p.ajuste,0)
         )::numeric, 2)
   where p.empresa_id = v_emp
     and p.periodo = '2026-01'
     and p.empleado_nombre = 'Jorge Belda Garrigós';

  alter table public.rrhh_pagos enable trigger user;
end $$;
