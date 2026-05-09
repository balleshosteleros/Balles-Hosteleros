-- ============================================================
-- empleados_demo.sql
-- Seed con 18 empleados (10 HABANA + 8 BACANAL) que antes vivían
-- como mocks en src/features/rrhh/data/rrhh.ts. Ahora viven en BD
-- y respetan toda la lógica:
--   • estado = 'Activo' + fecha_baja = NULL  (constraint empleados_estado_check)
--   • puesto = texto descriptivo (CAMARERO, DIRECTORA, RRPP, etc.)
--   • departamento_id = FK al departamento real más próximo
--
-- Idempotente: cada INSERT comprueba con WHERE NOT EXISTS por
-- (empresa_id, email_empresa) — se puede ejecutar varias veces sin
-- crear duplicados.
-- ============================================================

-- ─── HABANA (00000000-0000-0000-0000-000000000001) ─────────────
insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Carlos', 'Martínez López', '612 345 678', 'carlos.martinez@habana.es', 'carlosml@gmail.com', 'CACHIMBERO',
       (select id from public.departamentos where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='carlos.martinez@habana.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'María', 'García Fernández', '623 456 789', 'maria.garcia@habana.es', 'mariagarcia@hotmail.com', 'JEFE DE SALA',
       (select id from public.departamentos where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='maria.garcia@habana.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Alejandro', 'Ruiz Torres', '634 567 890', 'alejandro.ruiz@habana.es', 'aleruiz@gmail.com', 'ARTISTA / DJ',
       (select id from public.departamentos where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='alejandro.ruiz@habana.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Laura', 'Sánchez Moreno', '645 678 901', 'laura.sanchez@habana.es', 'laurasm@gmail.com', 'DIRECTORA',
       (select id from public.departamentos where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='DIRECCIÓN'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='laura.sanchez@habana.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Pedro', 'Ruiz Navarro', '656 789 012', 'pedro.ruiz@habana.es', 'pedroruiz@yahoo.es', 'GERENTE',
       (select id from public.departamentos where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='GERENCIA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='pedro.ruiz@habana.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Ana', 'López Díaz', '667 890 123', 'ana.lopez@habana.es', 'analopez@gmail.com', 'CAMARERA',
       (select id from public.departamentos where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='ana.lopez@habana.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Javier', 'Fernández Castro', '678 901 234', 'javier.fernandez@habana.es', 'javierfc@gmail.com', 'MANTENIMIENTO',
       null,
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='javier.fernandez@habana.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Sofía', 'Martín Herrero', '689 012 345', 'sofia.martin@habana.es', 'sofiamh@hotmail.com', 'RRPP',
       (select id from public.departamentos where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='MARKETING'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='sofia.martin@habana.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Diego', 'Romero Blanco', null, 'diego.romero@habana.es', null, 'CACHIMBERO',
       (select id from public.departamentos where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='diego.romero@habana.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Elena', 'Vega Prieto', '601 234 567', 'elena.vega@habana.es', 'elenavp@gmail.com', 'CAMARERA',
       (select id from public.departamentos where empresa_id='00000000-0000-0000-0000-000000000001' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='00000000-0000-0000-0000-000000000001' and email_empresa='elena.vega@habana.es');

-- ─── BACANAL (fe2ea3c4-aa28-41ce-a135-bf196ab5dc47) ─────────────
insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'::uuid, 'Andrés', 'Jiménez Ramos', '611 111 222', 'andres.jimenez@bacanal.es', 'andresj@gmail.com', 'DIRECTOR',
       (select id from public.departamentos where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and nombre='DIRECCIÓN'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and email_empresa='andres.jimenez@bacanal.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'::uuid, 'Lucía', 'Pérez Ortega', '622 222 333', 'lucia.perez@bacanal.es', 'luciap@hotmail.com', 'JEFE DE SALA',
       (select id from public.departamentos where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and email_empresa='lucia.perez@bacanal.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'::uuid, 'Miguel', 'Santos Gil', '633 333 444', 'miguel.santos@bacanal.es', 'miguels@gmail.com', 'CAMARERO',
       (select id from public.departamentos where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and email_empresa='miguel.santos@bacanal.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'::uuid, 'Carmen', 'Morales Reyes', '644 444 555', 'carmen.morales@bacanal.es', 'carmenm@yahoo.es', 'ARTISTA / DJ',
       (select id from public.departamentos where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and email_empresa='carmen.morales@bacanal.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'::uuid, 'Raúl', 'Herrera Muñoz', '655 555 666', 'raul.herrera@bacanal.es', 'raulh@gmail.com', 'COCINERO',
       (select id from public.departamentos where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and nombre='COCINA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and email_empresa='raul.herrera@bacanal.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'::uuid, 'Isabel', 'Domínguez Lara', '666 666 777', 'isabel.dominguez@bacanal.es', 'isabeldom@gmail.com', 'ADMINISTRATIVA',
       (select id from public.departamentos where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and nombre='CONTABILIDAD'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and email_empresa='isabel.dominguez@bacanal.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'::uuid, 'Pablo', 'Crespo Vargas', '677 777 888', 'pablo.crespo@bacanal.es', null, 'CACHIMBERO',
       (select id from public.departamentos where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and nombre='SALA'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and email_empresa='pablo.crespo@bacanal.es');

insert into public.empleados (empresa_id, nombre, apellidos, telefono, email_empresa, email_personal, puesto, departamento_id, estado, fecha_alta)
select 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'::uuid, 'Marta', 'Iglesias Peña', '688 888 999', 'marta.iglesias@bacanal.es', 'martaip@gmail.com', 'RRPP',
       (select id from public.departamentos where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and nombre='MARKETING'),
       'Activo', current_date
where not exists (select 1 from public.empleados where empresa_id='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' and email_empresa='marta.iglesias@bacanal.es');
