-- Combinaciones de mesas de BACANAL (Restaurante Bacanal).
-- Criterios: misma zona, mesas contiguas, solo lineas rectas (fila o columna),
-- nunca formas en L. Maximo = suma de los maximos; minimo = lo que cabria con
-- una mesa menos, +1. Mismos criterios ya aplicados en HABANA.
--
-- Excepcion TERRAZA EXTERIOR: al unir mesas se pierden sitios en las juntas,
-- asi que la capacidad no es la suma. Escala de dos en dos:
--   2 mesas -> 5-6 | 3 mesas -> 7-8 | 4 mesas -> 9-10
--
-- SUPER VIP: las tres juntas 8-12 (por encima de sus 8 plazas nominales,
-- se anaden sillas al unirlas).
-- VIP: solo se unen V1+V2 y V3+V4 (6-8); las cuatro juntas 12-16.
-- REDONDAS: R1+R2 arranca en 8.
-- CRISTALERA: las cuatro juntas 8-10.
-- CUADRADO: 2 mesas -> 3-4 | 3 mesas -> 6-8 | 4 mesas -> 8-10 | 5 mesas -> 11-12.
-- La de 5 incluye C1, que no esta en la fila (excepcion a "solo lineas rectas").
-- ALTAS: unir dos mesas exige minimo 6 comensales. Ademas son dos bloques
-- independientes: A1-A2-A3 y A4-A5-A6 no se mezclan entre si.
-- A6 (Altas) va siempre sola: no se combina con ninguna. Capacidad 3-5.
-- A7+A8 (Altas) no existe: esas dos mesas no se pueden unir fisicamente.
--
-- ORDEN DEL CODIGO: las mesas van siempre en orden numerico ascendente
-- (A1+A2, TE6+TE10), nunca por posicion en el plano.
--
-- Idempotente: no inserta una combinacion cuyo codigo ya exista en el local.


with datos(codigo, zona_nombre, cap_min, cap_max, mesas) as (
  values
('A1+A2', 'Altas', 6, 8, ARRAY['A1','A2']::text[]),
('A2+A3', 'Altas', 6, 8, ARRAY['A2','A3']::text[]),
('A4+A5', 'Altas', 6, 10, ARRAY['A4','A5']::text[]),
('A1+A2+A3', 'Altas', 9, 12, ARRAY['A1','A2','A3']::text[]),
('CR1+CR2', 'Cristalera', 3, 4, ARRAY['CR1','CR2']::text[]),
('CR1+CR3', 'Cristalera', 3, 4, ARRAY['CR1','CR3']::text[]),
('CR2+CR4', 'Cristalera', 3, 4, ARRAY['CR2','CR4']::text[]),
('CR3+CR4', 'Cristalera', 3, 4, ARRAY['CR3','CR4']::text[]),
('CR1+CR2+CR3+CR4', 'Cristalera', 8, 10, ARRAY['CR1','CR2','CR3','CR4']::text[]),
('C1+C2', 'Cuadrado', 3, 4, ARRAY['C1','C2']::text[]),
('C2+C3', 'Cuadrado', 3, 4, ARRAY['C2','C3']::text[]),
('C3+C4', 'Cuadrado', 3, 4, ARRAY['C3','C4']::text[]),
('C4+C5', 'Cuadrado', 3, 4, ARRAY['C4','C5']::text[]),
('C2+C3+C4', 'Cuadrado', 6, 8, ARRAY['C2','C3','C4']::text[]),
('C3+C4+C5', 'Cuadrado', 6, 8, ARRAY['C3','C4','C5']::text[]),
('C2+C3+C4+C5', 'Cuadrado', 8, 10, ARRAY['C2','C3','C4','C5']::text[]),
('C1+C2+C3+C4+C5', 'Cuadrado', 11, 12, ARRAY['C1','C2','C3','C4','C5']::text[]),
('R1+R2', 'Redondas', 8, 12, ARRAY['R1','R2']::text[]),
('SV1+SV2', 'Super VIP', 3, 5, ARRAY['SV1','SV2']::text[]),
('SV2+SV3', 'Super VIP', 3, 5, ARRAY['SV2','SV3']::text[]),
('SV1+SV2+SV3', 'Super VIP', 8, 12, ARRAY['SV1','SV2','SV3']::text[]),
('TI1+TI2', 'Terraza Interior', 5, 8, ARRAY['TI1','TI2']::text[]),
('TI1+TI3', 'Terraza Interior', 5, 8, ARRAY['TI1','TI3']::text[]),
('TI2+TI4', 'Terraza Interior', 5, 8, ARRAY['TI2','TI4']::text[]),
('TI3+TI4', 'Terraza Interior', 5, 8, ARRAY['TI3','TI4']::text[]),
('TI3+TI5', 'Terraza Interior', 5, 8, ARRAY['TI3','TI5']::text[]),
('TI4+TI6', 'Terraza Interior', 3, 6, ARRAY['TI4','TI6']::text[]),
('TI5+TI6', 'Terraza Interior', 3, 6, ARRAY['TI5','TI6']::text[]),
('TI1+TI3+TI5', 'Terraza Interior', 9, 12, ARRAY['TI1','TI3','TI5']::text[]),
('TI2+TI4+TI6', 'Terraza Interior', 7, 10, ARRAY['TI2','TI4','TI6']::text[]),
('TE1+TE2', 'Terraza Exterior', 5, 6, ARRAY['TE1','TE2']::text[]),
('TE10+TE11', 'Terraza Exterior', 5, 6, ARRAY['TE10','TE11']::text[]),
('TE6+TE10', 'Terraza Exterior', 5, 6, ARRAY['TE6','TE10']::text[]),
('TE11+TE12', 'Terraza Exterior', 5, 6, ARRAY['TE11','TE12']::text[]),
('TE7+TE11', 'Terraza Exterior', 5, 6, ARRAY['TE7','TE11']::text[]),
('TE8+TE12', 'Terraza Exterior', 5, 6, ARRAY['TE8','TE12']::text[]),
('TE13+TE14', 'Terraza Exterior', 5, 6, ARRAY['TE13','TE14']::text[]),
('TE9+TE13', 'Terraza Exterior', 5, 6, ARRAY['TE9','TE13']::text[]),
('TE10+TE14', 'Terraza Exterior', 5, 6, ARRAY['TE10','TE14']::text[]),
('TE14+TE15', 'Terraza Exterior', 5, 6, ARRAY['TE14','TE15']::text[]),
('TE11+TE15', 'Terraza Exterior', 5, 6, ARRAY['TE11','TE15']::text[]),
('TE15+TE16', 'Terraza Exterior', 5, 6, ARRAY['TE15','TE16']::text[]),
('TE12+TE16', 'Terraza Exterior', 5, 6, ARRAY['TE12','TE16']::text[]),
('TE2+TE3', 'Terraza Exterior', 5, 6, ARRAY['TE2','TE3']::text[]),
('TE3+TE4', 'Terraza Exterior', 5, 6, ARRAY['TE3','TE4']::text[]),
('TE1+TE5', 'Terraza Exterior', 5, 6, ARRAY['TE1','TE5']::text[]),
('TE5+TE6', 'Terraza Exterior', 5, 6, ARRAY['TE5','TE6']::text[]),
('TE2+TE6', 'Terraza Exterior', 5, 6, ARRAY['TE2','TE6']::text[]),
('TE6+TE7', 'Terraza Exterior', 5, 6, ARRAY['TE6','TE7']::text[]),
('TE3+TE7', 'Terraza Exterior', 5, 6, ARRAY['TE3','TE7']::text[]),
('TE7+TE8', 'Terraza Exterior', 5, 6, ARRAY['TE7','TE8']::text[]),
('TE4+TE8', 'Terraza Exterior', 5, 6, ARRAY['TE4','TE8']::text[]),
('TE9+TE10', 'Terraza Exterior', 5, 6, ARRAY['TE9','TE10']::text[]),
('TE5+TE9', 'Terraza Exterior', 5, 6, ARRAY['TE5','TE9']::text[]),
('TE1+TE2+TE3', 'Terraza Exterior', 7, 8, ARRAY['TE1','TE2','TE3']::text[]),
('TE10+TE11+TE12', 'Terraza Exterior', 7, 8, ARRAY['TE10','TE11','TE12']::text[]),
('TE2+TE6+TE10', 'Terraza Exterior', 7, 8, ARRAY['TE2','TE6','TE10']::text[]),
('TE3+TE7+TE11', 'Terraza Exterior', 7, 8, ARRAY['TE3','TE7','TE11']::text[]),
('TE4+TE8+TE12', 'Terraza Exterior', 7, 8, ARRAY['TE4','TE8','TE12']::text[]),
('TE13+TE14+TE15', 'Terraza Exterior', 7, 8, ARRAY['TE13','TE14','TE15']::text[]),
('TE5+TE9+TE13', 'Terraza Exterior', 7, 8, ARRAY['TE5','TE9','TE13']::text[]),
('TE6+TE10+TE14', 'Terraza Exterior', 7, 8, ARRAY['TE6','TE10','TE14']::text[]),
('TE14+TE15+TE16', 'Terraza Exterior', 7, 8, ARRAY['TE14','TE15','TE16']::text[]),
('TE7+TE11+TE15', 'Terraza Exterior', 7, 8, ARRAY['TE7','TE11','TE15']::text[]),
('TE8+TE12+TE16', 'Terraza Exterior', 7, 8, ARRAY['TE8','TE12','TE16']::text[]),
('TE2+TE3+TE4', 'Terraza Exterior', 7, 8, ARRAY['TE2','TE3','TE4']::text[]),
('TE5+TE6+TE7', 'Terraza Exterior', 7, 8, ARRAY['TE5','TE6','TE7']::text[]),
('TE6+TE7+TE8', 'Terraza Exterior', 7, 8, ARRAY['TE6','TE7','TE8']::text[]),
('TE9+TE10+TE11', 'Terraza Exterior', 7, 8, ARRAY['TE9','TE10','TE11']::text[]),
('TE1+TE5+TE9', 'Terraza Exterior', 7, 8, ARRAY['TE1','TE5','TE9']::text[]),
('TE1+TE2+TE3+TE4', 'Terraza Exterior', 9, 10, ARRAY['TE1','TE2','TE3','TE4']::text[]),
('TE13+TE14+TE15+TE16', 'Terraza Exterior', 9, 10, ARRAY['TE13','TE14','TE15','TE16']::text[]),
('TE1+TE5+TE9+TE13', 'Terraza Exterior', 9, 10, ARRAY['TE1','TE5','TE9','TE13']::text[]),
('TE2+TE6+TE10+TE14', 'Terraza Exterior', 9, 10, ARRAY['TE2','TE6','TE10','TE14']::text[]),
('TE3+TE7+TE11+TE15', 'Terraza Exterior', 9, 10, ARRAY['TE3','TE7','TE11','TE15']::text[]),
('TE4+TE8+TE12+TE16', 'Terraza Exterior', 9, 10, ARRAY['TE4','TE8','TE12','TE16']::text[]),
('TE5+TE6+TE7+TE8', 'Terraza Exterior', 9, 10, ARRAY['TE5','TE6','TE7','TE8']::text[]),
('TE9+TE10+TE11+TE12', 'Terraza Exterior', 9, 10, ARRAY['TE9','TE10','TE11','TE12']::text[]),
('V1+V2', 'VIP', 6, 8, ARRAY['V1','V2']::text[]),
('V3+V4', 'VIP', 6, 8, ARRAY['V3','V4']::text[]),
('V1+V2+V3+V4', 'VIP', 12, 16, ARRAY['V1','V2','V3','V4']::text[])
),
zona_ref as (
  select z.id, z.nombre from zonas z where z.local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a'
),
nueva as (
  insert into mesa_combinaciones (local_id, codigo, capacidad_auto, capacidad_min, capacidad_max, zona_id, activa)
  select 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a', d.codigo, false, d.cap_min, d.cap_max, zr.id, true
  from datos d join zona_ref zr on zr.nombre = d.zona_nombre
  where not exists (
    select 1 from mesa_combinaciones mc
    where mc.local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a'
      and mc.codigo = d.codigo
  )
  returning id, codigo
)
insert into mesa_combinacion_componentes (combinacion_id, mesa_id, orden)
select n.id, m.id, arr.orden
from nueva n
join datos d on d.codigo = n.codigo
cross join lateral unnest(d.mesas) with ordinality as arr(cod, orden)
join mesas m on m.codigo = arr.cod and m.local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a';

-- A6 va sola: su capacidad propia pasa a 3-5.
update mesas set capacidad_min = 3, capacidad_max = 5, updated_at = now()
where local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a'
  and codigo = 'A6'
  and (capacidad_min, capacidad_max) is distinct from (3, 5);
