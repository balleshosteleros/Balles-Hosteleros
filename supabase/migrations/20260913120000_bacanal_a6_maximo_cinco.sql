-- Mesa A6 de BACANAL: caben 5 personas como mucho, no 6.
--
-- Ya se habia dejado en 3-5 al montar las combinaciones (migracion
-- 20260821200000), pero la ficha de la mesa volvio a quedar en 4-6 y el plano
-- ofrecia una plaza que no existe. Aqui se baja SOLO el tope: el minimo se
-- respeta tal y como este puesto en cada momento.
--
-- Idempotente: si ya esta en 5 (o menos), no toca nada.
update mesas
set capacidad_max = 5,
    capacidad_min = least(capacidad_min, 5),
    updated_at = now()
where codigo = 'A6'
  and local_id = 'dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a'
  and capacidad_max > 5;
