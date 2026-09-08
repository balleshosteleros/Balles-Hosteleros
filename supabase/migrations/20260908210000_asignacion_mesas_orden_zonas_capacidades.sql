-- Asignación automática de mesa: orden de llenado de las zonas y capacidades
-- reales de sala, dictadas por Iván el 08-09-2026.
--
-- Idempotente: son UPDATE/DELETE por clave natural y un INSERT protegido por
-- NOT EXISTS, así que se puede volver a pasar sin efectos raros.

-- 1. ORDEN DE LLENADO DE ZONAS.
--    A igual capacidad, la asignación entra antes en la zona con menor `orden`.
--    Se arrastra en Configuración → Reservas → Estructura.
update zonas z set orden = v.orden
from (values
  ('Cuadrado', 1), ('Cristalera', 2), ('Altas', 3), ('Redondas', 4),
  ('Super VIP', 5), ('VIP', 6), ('Terraza Interior', 7), ('Terraza Exterior', 8),
  ('Barra', 9)
) as v(nombre, orden)
where z.local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a'  -- Restaurante Bacanal
  and z.nombre = v.nombre;

update zonas z set orden = v.orden
from (values
  ('Cuadrados', 1), ('VIP', 2), ('Altas', 3), ('Barra', 4), ('Redondas', 5),
  ('Terraza Interior', 6), ('Terraza Exterior', 7)
) as v(nombre, orden)
where z.local_id = '9d1ab861-475f-4008-ba8e-4ef0928b4ac6'  -- Coctelería Habana
  and z.nombre = v.nombre;

-- 2. CAPACIDADES REALES.
--    A7 de BACANAL es de 4 a 6.
update mesas set capacidad_min = 4, capacidad_max = 6
where local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a' and codigo = 'A7';

--    Redondas y Altas se pueden dar sueltas a una pareja (A7 queda fuera: es de
--    4 en adelante por decisión expresa).
update mesas m set capacidad_min = 2
from zonas z
where z.id = m.zona_id
  and upper(z.nombre) in ('REDONDAS', 'ALTAS')
  and m.capacidad_max >= 2
  and m.capacidad_min <> 2
  and not (m.codigo = 'A7' and m.local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a');

--    C3 y C4 también admiten pareja.
update mesas set capacidad_min = 2
where codigo in ('C3', 'C4') and capacidad_max >= 2 and capacidad_min <> 2;

-- 3. La barra de BACANAL no se reserva: bloqueo permanente, todos los turnos.
--    (En HABANA la barra SÍ se reserva y no se toca.)
insert into empresa_reservas_bloqueos
  (empresa_id, local_id, modo_vigencia, turno, zona_ids, mesa_ids, motivo)
select 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47',
       'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a',
       'siempre', 'AMBOS', '{}'::uuid[], array[m.id], 'Barra: no se reserva'
from mesas m
join zonas z on z.id = m.zona_id
where m.local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a'
  and m.codigo = 'B1' and upper(z.nombre) = 'BARRA'
  and not exists (
    select 1 from empresa_reservas_bloqueos b
    where b.local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a'
      and b.motivo = 'Barra: no se reserva'
  );

-- 4. HABANA tenía un orden manual para 2 comensales (A1, A2) que mandaba a las
--    parejas a una mesa de hasta 4. Fuera: manda la capacidad ajustada.
delete from plano_orden_asignacion
where comensales = 2
  and plano_id in (
    select id from planos where local_id = '9d1ab861-475f-4008-ba8e-4ef0928b4ac6'
  );
