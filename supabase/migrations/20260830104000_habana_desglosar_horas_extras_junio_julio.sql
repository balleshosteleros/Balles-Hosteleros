-- HABANA junio y julio: las horas extras salen del `complemento` a su columna.
--
-- Al pasar el TOTAL verde del Excel al complemento, estos dos meses se cargaron
-- con las extras DENTRO (en la BD estaban a 0, pero el Excel sí las tenía). El
-- importe final era correcto, pero el empleado no las veía desglosadas.
--
-- Se resta la extra del complemento y se pone en su columna: el TOTAL NO cambia.
-- Valores de la columna H.EXTRAS del Excel:
--   junio → Alejandro Mojica 470,00 · Maria Paula Fernandez Vargas 50,00
--   julio → Diego Rodrigo Castillo Cesar 50,00
--
-- Idempotente: solo actúa si las extras aún están a 0.

do $$
declare
  v_emp uuid;
  v_datos text[][] := array[
    ['2026-06','Alejandro Mojica','470.00'],
    ['2026-06','Maria Paula Fernandez Vargas','50.00'],
    ['2026-07','Diego Rodrigo Castillo Cesar','50.00']
  ];
  i int;
begin
  select id into v_emp from public.empresas where nombre = 'HABANA';
  if v_emp is null then raise notice 'Empresa HABANA no encontrada: nada que hacer'; return; end if;

  alter table public.rrhh_pagos disable trigger user;

  for i in 1 .. array_length(v_datos, 1) loop
    update public.rrhh_pagos p
       set horas_extras = v_datos[i][3]::numeric,
           complemento  = round((coalesce(p.complemento,0) - v_datos[i][3]::numeric)::numeric, 2)
     where p.empresa_id = v_emp
       and p.periodo = v_datos[i][1]
       and p.empleado_nombre = v_datos[i][2]
       and coalesce(p.horas_extras,0) = 0
       and coalesce(p.complemento,0) >= v_datos[i][3]::numeric;
  end loop;

  alter table public.rrhh_pagos enable trigger user;
end $$;
