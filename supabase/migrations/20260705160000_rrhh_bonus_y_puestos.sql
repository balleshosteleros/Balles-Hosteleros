-- Bonus de empresa como datos REALES + vínculo bidireccional bonus↔puestos.
--
-- Hasta ahora los bonus vivían en memoria (mock en src/features/rrhh/data/bonus.ts)
-- y los puestos son filas reales (public.puestos). Para poder ligar un bonus a los
-- puestos a los que aplica (y que el cambio se vea en AMBOS sitios), los bonus pasan
-- a ser filas reales y el vínculo vive en una tabla puente única: rrhh_bonus_puestos.
--
--   rrhh_bonus            -> definición del bonus (una fila por bonus, por empresa)
--   rrhh_bonus_puestos    -> N:M bonus↔puesto (FUENTE ÚNICA del vínculo)
--
-- El apartado "¿A qué puestos aplica?" (en Bonus) y el apartado "Bonus" (en Puesto)
-- leen/escriben esta misma tabla puente, por eso siempre están sincronizados.
--
-- Idempotente: re-ejecutable sin error.

-- ─── 1) Tabla de bonus ──────────────────────────────────────────
create table if not exists public.rrhh_bonus (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  nombre           text not null default '',
  tipo             text not null default '',
  descripcion      text not null default '',
  objetivo         text not null default '',
  explicacion      text not null default '',
  estado           text not null default 'borrador',   -- activo | inactivo | borrador | archivado
  periodicidad     text not null default 'trimestral',  -- mensual | trimestral | semestral | anual | puntual
  -- destinatarios: texto libre + estructura {tipo, ids} para el filtro por roles/deptos
  destinatarios_texto text not null default '',
  destinatarios    jsonb not null default '{"tipo":"todos","ids":[]}'::jsonb,
  tablas           jsonb not null default '[]'::jsonb,  -- TablaTramos[]
  reglas           jsonb not null default '[]'::jsonb,  -- ReglaBonus[]
  forma_pago       text not null default '',
  premio           text not null default '',
  icono            text not null default 'Gift',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists rrhh_bonus_empresa_idx on public.rrhh_bonus (empresa_id);

comment on table public.rrhh_bonus is 'Programas de bonus/comisiones por empresa. Antes eran mock en memoria.';

-- ─── 2) Tabla puente bonus↔puestos (FUENTE ÚNICA del vínculo) ────
create table if not exists public.rrhh_bonus_puestos (
  bonus_id   uuid not null references public.rrhh_bonus(id) on delete cascade,
  puesto_id  uuid not null references public.puestos(id)     on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bonus_id, puesto_id)
);

create index if not exists rrhh_bonus_puestos_puesto_idx on public.rrhh_bonus_puestos (puesto_id);

comment on table public.rrhh_bonus_puestos is 'A qué puestos aplica cada bonus. Fuente única del vínculo bidireccional bonus↔puesto.';

-- ─── 3) updated_at automático en rrhh_bonus ─────────────────────
create or replace function public.rrhh_bonus_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists rrhh_bonus_touch on public.rrhh_bonus;
create trigger rrhh_bonus_touch
  before update on public.rrhh_bonus
  for each row execute function public.rrhh_bonus_touch_updated_at();

-- ─── 4) RLS (por empresa del usuario) ───────────────────────────
alter table public.rrhh_bonus         enable row level security;
alter table public.rrhh_bonus_puestos enable row level security;

drop policy if exists rrhh_bonus_select on public.rrhh_bonus;
create policy rrhh_bonus_select on public.rrhh_bonus for select
  using (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists rrhh_bonus_insert on public.rrhh_bonus;
create policy rrhh_bonus_insert on public.rrhh_bonus for insert
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists rrhh_bonus_update on public.rrhh_bonus;
create policy rrhh_bonus_update on public.rrhh_bonus for update
  using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));
drop policy if exists rrhh_bonus_delete on public.rrhh_bonus;
create policy rrhh_bonus_delete on public.rrhh_bonus for delete
  using (empresa_id in (select public.empresas_del_usuario()));

-- La tabla puente hereda la seguridad a través del bonus (mismo empresa_id).
drop policy if exists rrhh_bonus_puestos_select on public.rrhh_bonus_puestos;
create policy rrhh_bonus_puestos_select on public.rrhh_bonus_puestos for select
  using (bonus_id in (select id from public.rrhh_bonus
                      where empresa_id in (select public.empresas_del_usuario())));
drop policy if exists rrhh_bonus_puestos_insert on public.rrhh_bonus_puestos;
create policy rrhh_bonus_puestos_insert on public.rrhh_bonus_puestos for insert
  with check (bonus_id in (select id from public.rrhh_bonus
                           where empresa_id in (select public.empresas_del_usuario()))
              and puesto_id in (select id from public.puestos
                                where empresa_id in (select public.empresas_del_usuario())));
drop policy if exists rrhh_bonus_puestos_delete on public.rrhh_bonus_puestos;
create policy rrhh_bonus_puestos_delete on public.rrhh_bonus_puestos for delete
  using (bonus_id in (select id from public.rrhh_bonus
                      where empresa_id in (select public.empresas_del_usuario())));

-- ─── 5) Seed de los bonus existentes (HABANA y BACANAL) ─────────
-- Idempotente por (empresa_id, nombre). NO se re-siembra si ya existe ese nombre.

-- HABANA
insert into public.rrhh_bonus
  (empresa_id, nombre, tipo, descripcion, objetivo, explicacion, estado, periodicidad,
   destinatarios_texto, destinatarios, tablas, reglas, forma_pago, premio, icono)
select e.id, v.nombre, v.tipo, v.descripcion, v.objetivo, v.explicacion, v.estado, v.periodicidad,
       v.destinatarios_texto, v.destinatarios::jsonb, v.tablas::jsonb, v.reglas::jsonb, v.forma_pago, v.premio, v.icono
from public.empresas e
cross join (values
  ('BALANCE','Financiero',
   'Bonus basado en el resultado del balance trimestral de la empresa.',
   'Motivar al equipo a mejorar la diferencia entre facturación y gastos.',
   'Se calcula con la diferencia entre la facturación total y los gastos totales del trimestre. El resultado final del balance determina el tramo de comisión aplicable. Se liquida trimestralmente a trimestre vencido.',
   'activo','trimestral','Gerente y Encargados',
   '{"tipo":"roles","ids":["GERENTE","ENCARGADOS"]}',
   '[{"id":"t1","titulo":"Comisiones por resultado de balance","descripcion":"Tramos de comisión según el resultado positivo del balance trimestral.","tramos":[{"id":"tr1","condicion":"+15.000 €","comision":"300 €","observaciones":"Resultado mínimo"},{"id":"tr2","condicion":"+20.000 €","comision":"400 €","observaciones":""},{"id":"tr3","condicion":"+25.000 €","comision":"500 €","observaciones":""},{"id":"tr4","condicion":"+30.000 €","comision":"600 €","observaciones":"Resultado óptimo"}]}]',
   '[{"id":"r1","titulo":"Cálculo trimestral","descripcion":"El balance se calcula por trimestre natural (Q1, Q2, Q3, Q4)."},{"id":"r2","titulo":"Desfase de liquidación","descripcion":"Se paga a trimestre vencido por necesidad de cálculo y cierre contable."}]',
   'Se liquida trimestralmente a trimestre vencido. Existe un desfase temporal necesario para el cierre y cálculo del balance.','','TrendingUp'),
  ('INVENTARIOS','Operativo',
   'Bonus basado en el control del inventario mensual de barra y cocina.',
   'Premiar el buen control del stock y reducir mermas.',
   'Se calcula a través del inventario mensual, dividido en barra y cocina. Se relacionan las entradas (albaranes) con las salidas (ventas) para generar un valor de almacén. El bonus premia la eficiencia en la gestión del stock.',
   'activo','trimestral','Encargados, Jefe de Cocina y Gerente',
   '{"tipo":"roles","ids":["ENCARGADOS","JEFE DE COCINA","GERENTE"]}',
   '[{"id":"t2","titulo":"Comisiones Encargados / Jefe de Cocina","descripcion":"Tramos aplicables al encargado de barra o jefe de cocina según su área.","tramos":[{"id":"tr5","condicion":"Desviación < 3%","comision":"150 €","observaciones":"Excelente control"},{"id":"tr6","condicion":"Desviación 3-5%","comision":"100 €","observaciones":"Buen control"},{"id":"tr7","condicion":"Desviación 5-8%","comision":"50 €","observaciones":"Aceptable"},{"id":"tr8","condicion":"Desviación > 8%","comision":"0 €","observaciones":"Sin bonus"}]},{"id":"t3","titulo":"Comisiones Gerente","descripcion":"Tramos aplicables al gerente sobre el inventario global.","tramos":[{"id":"tr9","condicion":"Desviación global < 4%","comision":"200 €","observaciones":""},{"id":"tr10","condicion":"Desviación global 4-6%","comision":"100 €","observaciones":""},{"id":"tr11","condicion":"Desviación global > 6%","comision":"0 €","observaciones":""}]}]',
   '[{"id":"r3","titulo":"División barra/cocina","descripcion":"El inventario se calcula de forma separada para barra y cocina."},{"id":"r4","titulo":"Base de cálculo","descripcion":"Se comparan entradas por albaranes con salidas por ventas para obtener la desviación."}]',
   'Se liquida trimestralmente junto al resto de bonus.','','Package'),
  ('INSPECCIÓN','Calidad',
   'Bonus basado en la nota obtenida en inspecciones internas de calidad.',
   'Mantener los estándares de servicio, producto, ventas y limpieza.',
   'Se basa en cuestionarios realizados por inspectores internos. Se valoran aspectos como servicio al cliente, calidad del producto, técnicas de venta y limpieza del local. Se obtiene una nota final de 1 a 10 y el bonus depende de esa nota.',
   'activo','trimestral','Todo el equipo',
   '{"tipo":"todos","ids":[]}',
   '[{"id":"t4","titulo":"Comisiones por nota de inspección","descripcion":"Tramos según la nota final obtenida en la inspección.","tramos":[{"id":"tr12","condicion":"1 a 7","comision":"0 €","observaciones":"No alcanza el mínimo"},{"id":"tr13","condicion":"7 a 8","comision":"20 €","observaciones":""},{"id":"tr14","condicion":"8 a 9","comision":"35 €","observaciones":""},{"id":"tr15","condicion":"9 a 10","comision":"50 €","observaciones":"Excelencia"}]}]',
   '[{"id":"r5","titulo":"Inspecciones sorpresa","descripcion":"Las inspecciones se realizan sin previo aviso para garantizar resultados reales."},{"id":"r6","titulo":"Áreas evaluadas","descripcion":"Servicio, producto, ventas, limpieza y cumplimiento del manual operativo."}]',
   'Se liquida trimestralmente.','','ClipboardCheck'),
  ('BIENESTAR','Reconocimiento',
   'Premio al empleado con mejor nota en los cuestionarios del Manual Operativo.',
   'Fomentar el conocimiento del manual y premiar la excelencia individual.',
   'Se premia al empleado que obtenga la mejor nota en los cuestionarios del Manual Operativo. El premio consiste en un regalo aleatorio relacionado con salud y bienestar. En caso de empate, gana el empleado con mayor antigüedad en la empresa.',
   'activo','trimestral','Todo el equipo',
   '{"tipo":"todos","ids":[]}',
   '[]',
   '[{"id":"r7","titulo":"Criterio de desempate","descripcion":"En caso de empate, gana el empleado con mayor antigüedad en la empresa."},{"id":"r8","titulo":"Tipo de premio","descripcion":"Regalo aleatorio relacionado con salud y bienestar (ej: sesión spa, suscripción gimnasio, etc.)."}]',
   'Se entrega el premio tras la evaluación trimestral.','Regalo aleatorio de salud y bienestar (valor aprox. 50-100 €)','Heart'),
  ('PROPINAS','Variable',
   'Reparto de propinas de clientes entre el equipo.',
   'Bonificar al equipo mediante las propinas recibidas de los clientes.',
   'Las propinas de clientes se recogen y se reparten mensualmente en proporción a las horas trabajadas de cada empleado. El reparto lo gestiona el gerente del establecimiento.',
   'activo','mensual','Todo el equipo',
   '{"tipo":"todos","ids":[]}',
   '[]',
   '[{"id":"r9","titulo":"Proporcionalidad","descripcion":"El reparto se realiza en proporción a las horas trabajadas en el periodo."},{"id":"r10","titulo":"Responsable del reparto","descripcion":"El gerente es el encargado de gestionar y repartir las propinas."}]',
   'Se reparten mensualmente. No dependen del ciclo trimestral del resto de bonus.','','Coins')
) as v(nombre, tipo, descripcion, objetivo, explicacion, estado, periodicidad,
       destinatarios_texto, destinatarios, tablas, reglas, forma_pago, premio, icono)
where e.slug = 'habana'
  and not exists (select 1 from public.rrhh_bonus b where b.empresa_id = e.id and b.nombre = v.nombre);

-- BACANAL
insert into public.rrhh_bonus
  (empresa_id, nombre, tipo, descripcion, objetivo, explicacion, estado, periodicidad,
   destinatarios_texto, destinatarios, tablas, reglas, forma_pago, premio, icono)
select e.id, v.nombre, v.tipo, v.descripcion, v.objetivo, v.explicacion, v.estado, v.periodicidad,
       v.destinatarios_texto, v.destinatarios::jsonb, v.tablas::jsonb, v.reglas::jsonb, v.forma_pago, v.premio, v.icono
from public.empresas e
cross join (values
  ('BALANCE','Financiero',
   'Bonus basado en el resultado del balance trimestral.',
   'Incentivar la eficiencia financiera del establecimiento.',
   'Se calcula con la diferencia entre facturación y gastos del trimestre.',
   'activo','trimestral','Gerente',
   '{"tipo":"roles","ids":["GERENTE"]}',
   '[{"id":"t5","titulo":"Comisiones por balance","descripcion":"","tramos":[{"id":"tr16","condicion":"+10.000 €","comision":"200 €","observaciones":""},{"id":"tr17","condicion":"+15.000 €","comision":"350 €","observaciones":""},{"id":"tr18","condicion":"+20.000 €","comision":"500 €","observaciones":""}]}]',
   '[{"id":"r11","titulo":"Trimestral","descripcion":"Cálculo y pago trimestral a vencido."}]',
   'Trimestral a vencido.','','TrendingUp'),
  ('INSPECCIÓN','Calidad',
   'Bonus por nota de inspecciones internas.',
   'Garantizar estándares de calidad.',
   'Nota de inspección de 1 a 10 determina el bonus.',
   'activo','trimestral','Todo el equipo',
   '{"tipo":"todos","ids":[]}',
   '[{"id":"t6","titulo":"Comisiones por inspección","descripcion":"","tramos":[{"id":"tr19","condicion":"1 a 7","comision":"0 €","observaciones":""},{"id":"tr20","condicion":"7 a 8","comision":"15 €","observaciones":""},{"id":"tr21","condicion":"8 a 9","comision":"30 €","observaciones":""},{"id":"tr22","condicion":"9 a 10","comision":"45 €","observaciones":""}]}]',
   '[]',
   'Trimestral.','','ClipboardCheck'),
  ('PROPINAS','Variable',
   'Reparto mensual de propinas por horas trabajadas.',
   'Bonificación directa del cliente al equipo.',
   'Reparto proporcional a horas trabajadas, gestionado por el gerente.',
   'activo','mensual','Todo el equipo',
   '{"tipo":"todos","ids":[]}',
   '[]','[]',
   'Mensual.','','Coins')
) as v(nombre, tipo, descripcion, objetivo, explicacion, estado, periodicidad,
       destinatarios_texto, destinatarios, tablas, reglas, forma_pago, premio, icono)
where e.slug = 'bacanal'
  and not exists (select 1 from public.rrhh_bonus b where b.empresa_id = e.id and b.nombre = v.nombre);
