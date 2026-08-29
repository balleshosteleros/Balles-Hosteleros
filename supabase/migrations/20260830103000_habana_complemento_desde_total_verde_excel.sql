-- HABANA: el `complemento` pasa a ser el TOTAL VERDE del Excel de propinas.
--
-- En el Excel "REGISTRO DE PAGOS 2026", la columna verde TOTAL es lo que el
-- trabajador cobra de propina (coincide con la fila "PROPINAS" del pie). Lo que
-- se había importado era la columna PROPINA (naranja), que es otra cosa.
--
-- El TOTAL verde ya lleva dentro descuento, horas extras y bonus, así que se
-- DESCOMPONE: complemento = TOTAL_verde − horas_extras − bonus − ajuste, y cada
-- concepto se queda en su columna. Así el desglose que ve el empleado conserva
-- sus extras y su bonus por separado, y la suma final coincide con el Excel.
-- Los ajustes van en negativo; extras y bonus en positivo.
--
-- Empleados sin fila en el Excel de ese mes: no se tocan.
-- Solo HABANA. BACANAL queda pendiente de sus datos.
--
-- Idempotente: reejecutarla vuelve a dejar los mismos importes.

do $$
declare
  v_emp uuid;
  v_datos text[][] := array[
    ['2026-01','Sofia Terrón','100.00'],
    ['2026-01','Iván Ballesteros','1500.00'],
    ['2026-01','Karen Johanna Aguilar','650.37'],
    ['2026-01','Andrea Przybylinska','162.38'],
    ['2026-01','Daniel Cantalejo','500.26'],
    ['2026-01','Adrian Paz','184.42'],
    ['2026-01','Alberto Cielicka','210.00'],
    ['2026-01','Javier Casarrubios Muñoz','257.35'],
    ['2026-01','Alejandro Mojica','370.00'],
    ['2026-02','Sofia Terrón','100.00'],
    ['2026-02','Iván Ballesteros','1500.00'],
    ['2026-02','Andrea Przybylinska','127.80'],
    ['2026-02','Daniel Cantalejo','374.26'],
    ['2026-02','Adrian Paz','129.55'],
    ['2026-02','Karen Johanna Aguilar','455.25'],
    ['2026-02','Alberto Cielicka','120.00'],
    ['2026-02','Javier Casarrubios Muñoz','313.40'],
    ['2026-02','Alejandro Mojica','350.00'],
    ['2026-03','Sofia Terrón','100.00'],
    ['2026-03','Iván Ballesteros','1250.00'],
    ['2026-03','Karen Johanna Aguilar','456.26'],
    ['2026-03','Andrea Przybylinska','4.65'],
    ['2026-03','Daniel Cantalejo','194.26'],
    ['2026-03','Adrian Paz','20.86'],
    ['2026-03','Alberto Cielicka','220.00'],
    ['2026-03','Javier Casarrubios Muñoz','416.56'],
    ['2026-03','Alejandro Mojica','270.00'],
    ['2026-03','Javier Mora','0.00'],
    ['2026-04','Sofia Terrón','100.00'],
    ['2026-04','Iván Ballesteros','1250.00'],
    ['2026-04','Javier Mora','0.00'],
    ['2026-04','Alejandro Mojica','600.00'],
    ['2026-04','Karen Johanna Aguilar','599.03'],
    ['2026-04','Javier Casarrubios Muñoz','481.40'],
    ['2026-04','Andrea Przybylinska','135.56'],
    ['2026-04','Daniel Cantalejo','104.26'],
    ['2026-04','Adrian Paz','103.55'],
    ['2026-04','Alberto Cielicka','120.00'],
    ['2026-05','Javier Mora','0.00'],
    ['2026-05','Sofia Terrón','100.00'],
    ['2026-05','Iván Ballesteros','1250.00'],
    ['2026-05','Karen Johanna Aguilar','378.19'],
    ['2026-05','Andrea Przybylinska','110.77'],
    ['2026-05','Daniel Cantalejo','270.00'],
    ['2026-05','Adrian Paz','45.12'],
    ['2026-05','Javier Casarrubios Muñoz','525.95'],
    ['2026-05','Alberto Cielicka','150.00'],
    ['2026-05','Alejandro Mojica','218.87'],
    ['2026-06','Javier Mora','0.00'],
    ['2026-06','Karen Johanna Aguilar','173.68'],
    ['2026-06','Andrea Przybylinska','0.00'],
    ['2026-06','Daniel Cantalejo','224.00'],
    ['2026-06','Javier Casarrubios Muñoz','400.95'],
    ['2026-06','Alejandro Mojica','688.86'],
    ['2026-06','Mireya Tejedor Magariño','353.76'],
    ['2026-06','Diego Rodrigo Castillo Cesar','22.61'],
    ['2026-06','Maria Paula Fernandez Vargas','241.24'],
    ['2026-07','Karen Johanna Aguilar','30.55'],
    ['2026-07','Alejandro Mojica','218.86'],
    ['2026-07','Javier Casarrubios Muñoz','361.33'],
    ['2026-07','Daniel Cantalejo','314.00'],
    ['2026-07','Maria Paula Fernandez Vargas','171.33'],
    ['2026-07','Diego Rodrigo Castillo Cesar','132.64'],
    ['2026-07','Mireya Tejedor Magariño','368.41']
  ];
  i int;
  v_periodo text;
  v_nombre text;
  v_verde numeric;
begin
  select id into v_emp from public.empresas where nombre = 'HABANA';
  if v_emp is null then raise notice 'Empresa HABANA no encontrada: nada que hacer'; return; end if;

  alter table public.rrhh_pagos disable trigger user;

  for i in 1 .. array_length(v_datos, 1) loop
    v_periodo := v_datos[i][1];
    v_nombre  := v_datos[i][2];
    v_verde   := v_datos[i][3]::numeric;

    update public.rrhh_pagos p
       set complemento = greatest(
             round((v_verde
                    - coalesce(p.horas_extras,0)
                    - coalesce(p.bonus,0)
                    - coalesce(p.ajuste,0))::numeric, 2), 0),
           total = round((
             coalesce(p.nomina,0)
             + greatest(round((v_verde - coalesce(p.horas_extras,0)
                               - coalesce(p.bonus,0) - coalesce(p.ajuste,0))::numeric,2), 0)
             + coalesce(p.horas_extras,0) + coalesce(p.bonus,0) + coalesce(p.ajuste,0)
           )::numeric, 2)
     where p.empresa_id = v_emp
       and p.periodo = v_periodo
       and p.empleado_nombre = v_nombre;
  end loop;

  alter table public.rrhh_pagos enable trigger user;
end $$;
