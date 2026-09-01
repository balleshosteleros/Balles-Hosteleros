-- BACANAL enero 2026: Alberto (Albero Cieliczka) tenía mal el complemento.
--
-- En el Excel "REGISTRO DE PAGOS 2026" la fila de ALBERTO MANTENIMIENTO da un
-- TOTAL verde de 210,00 €, pero la celda de propina del Excel está equivocada.
-- El complemento real son 150,00 €. Con las horas extras de 60,00 € que ya
-- estaban cargadas, el total queda en 210,00 € y cuadra con el TOTAL verde.
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
     set complemento = 150.00,
         total = round((
           coalesce(p.nomina,0) + 150.00
           + coalesce(p.horas_extras,0) + coalesce(p.bonus,0) + coalesce(p.ajuste,0)
         )::numeric, 2)
   where p.empresa_id = v_emp
     and p.periodo = '2026-01'
     and p.empleado_nombre = 'Albero Cieliczka';

  alter table public.rrhh_pagos enable trigger user;
end $$;
