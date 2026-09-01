-- BACANAL julio 2026: el mes no existía en el sistema (0 filas).
--
-- Se crean las 14 filas cruzando dos fuentes:
--   · Nóminas (líquido, SS empleado, SS empresa, IRPF) → PDF "NOMINAS BACANAL",
--     12 páginas, una por trabajador, del 1 al 31 de julio de 2026.
--   · Complemento → hoja JULIO del Excel "REGISTRO DE PAGOS 2026", con el mismo
--     criterio del resto de meses: complemento = TOTAL verde − horas extras.
--     Los ajustes van en negativo y las extras y el bonus en positivo.
--
-- Casos particulares de este mes:
--   · Javier Mora: el PDF trae finiquito (86,66) + nómina (200,00). Igual que en
--     junio se carga una sola fila por persona; el Excel apunta 200,00, que es lo
--     que se usa.
--   · Ruth y Jorge: propina 0 en el Excel (su nómina supera lo pagado en mano),
--     así que van con complemento 0.
--   · Yesmeri: descuento de −90,00 como ajuste negativo y 45,00 de horas extras.
--   · Eduardo: los 150,00 de la columna DESCUENTO son positivos → ajuste +150,00.
--
-- Todo julio está liquidado, así que las filas nacen pagadas y confirmadas.
-- Escritura directa con los triggers desactivados para no dispararle a nadie
-- avisos de "liquidación pendiente" por un mes ya abonado.
--
-- Comprobación: la suma de nóminas da 10.077,80 €, igual que el TOTAL del Excel.
-- Idempotente: el ON CONFLICT evita duplicar si el mes ya estuviera cargado.

do $$
declare
  v_emp uuid; v_now timestamptz := now();
begin
  select id into v_emp from public.empresas where nombre='BACANAL';
  if v_emp is null then raise notice 'BACANAL no encontrada: nada que hacer'; return; end if;

  alter table public.rrhh_pagos disable trigger user;

  insert into public.rrhh_pagos (
    empresa_id, empleado_id, empleado_nombre, periodo, fijo,
    nomina, horas_reales, horas_trabajadas, complemento, ajuste, horas_extras, bonus,
    ss_empleado, ss_empresa, irpf, total,
    pagado, pagado_at, confirmacion_enviada_at, confirmacion_aceptada_at
  )
  select v_emp, d.empleado_id, d.nombre, '2026-07', d.fijo,
         d.nomina, d.hr, d.ht, d.compl, d.ajuste, d.extras, 0,
         d.ss_e, d.ss_p, d.irpf,
         round((d.nomina + d.compl + d.ajuste + d.extras)::numeric, 2),
         true, v_now, v_now, v_now
  from (values
    ('3d8725dd-358c-4cc4-88bf-98449ba4678a'::uuid,'Javier Mora',                   true,  200.00, 0.0, 0.0,   0.00,    0.00,  0.00, 19.93, 98.57,  0.00),
    ('65d193e2-28dc-43f4-b93a-4be069632c39'::uuid,'Sofia Terrón',                  true,    0.00, 0.0, 0.0, 100.00,    0.00,  0.00,  0.00,  0.00,  0.00),
    ('e2dff389-b0b5-435e-8b7f-77da71a64265'::uuid,'Iván Ballesteros',              true, 1250.00, 0.0, 0.0,   0.00,    0.00,  0.00,  0.00,  0.00,  0.00),
    ('f0a34db6-b267-403e-8fe0-dcfb7ae40912'::uuid,'Alejandro Mojica',              false, 731.14,80.0,80.0, 218.86,    0.00,  0.00, 53.98,266.96, 45.26),
    ('e076bb97-27cc-4517-9b80-5e1f314169e6'::uuid,'Borja Garrido',                 false,1509.98,189.0,189.0,390.02,   0.00,  0.00,107.39,531.13, 34.69),
    ('dc466218-782d-4401-badc-b2c25c443ee1'::uuid,'Marcos David Vasile',           false, 681.30,85.0,85.0,  43.70,    0.00,  0.00, 51.31,253.78, 20.02),
    ('ea55f352-e2d9-4373-806f-0a658a14ea73'::uuid,'Farid Aghmir',                  false,1451.16,180.0,180.0,348.84,   0.00,  0.00,107.39,531.13, 93.51),
    ('050e3c4c-0b43-46ef-ba9d-f6a2d0db44f6'::uuid,'Ezequiel Falcone',              false,1310.51,180.0,180.0,189.49,   0.00,  0.00, 93.76,463.82, 38.37),
    ('5f488f33-2eee-4c5b-8dd3-5a603a929839'::uuid,'Ruth González Lorenzo',         false, 277.78, 0.0, 0.0,   0.00,    0.00,  0.00, 19.32, 95.51,  0.00),
    ('a5feeae4-aaa3-4b21-bcf3-7a5337d5d994'::uuid,'Jorge Belda Garrigós',          false, 279.42, 0.0, 0.0,   0.00,    0.00,  0.00, 19.43, 96.07,  0.00),
    ('89afce1b-4ee5-4168-b517-4ab9affb08d1'::uuid,'Albero Cieliczka',              false,   0.00, 6.0, 6.0, 120.00,    0.00,  0.00,  0.00,  0.00,  0.00),
    ('4253c611-77a2-4034-afa8-1984a6b38731'::uuid,'David Kenny Zapata Bernardo',   false,1451.16,153.0,153.0, 48.84,   0.00,  0.00,107.39,531.13, 93.51),
    ('25eb0314-2f4b-4fd6-bfb4-7cfa63dda120'::uuid,'Yesmeri Maria Peralta Martinez',false, 598.06,97.5,93.0, 151.94,  -90.00, 45.00, 50.75,251.05, 14.25),
    ('a3b3d76f-658b-41e1-a1c5-e14c8c842428'::uuid,'Eduardo Charro Correa',         false, 337.29,109.0,94.0,392.71,  150.00,  0.00, 25.65,126.89,  9.92)
  ) as d(empleado_id, nombre, fijo, nomina, hr, ht, compl, ajuste, extras, ss_e, ss_p, irpf)
  on conflict (empresa_id, empleado_id, periodo) do nothing;

  alter table public.rrhh_pagos enable trigger user;
end $$;
