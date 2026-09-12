-- Cierra las bajas medicas ANTIGUAS que nunca tuvieron alta.
--
-- Las bajas migradas de Sesame entraron aprobadas y sin alta, porque el alta
-- medica no existia todavia en el sistema. Con el circuito nuevo, una baja sin
-- alta cuenta como ABIERTA: al trabajador no le dejaria fichar y solo podria
-- pedir el alta de una baja que termino hace meses.
--
-- Se cierran las que ya pasaron, con el dia siguiente a su ultimo dia como fecha
-- de alta, que es lo que de verdad ocurrio. NO se tocan las que siguen en curso
-- (fecha_fin de hoy en adelante): esas siguen su camino normal.
--
-- Idempotente: solo alcanza filas que aun no tienen alta comunicada.
update public.solicitudes_personal
set alta_medica_fecha = fecha_fin + 1,
    alta_medica_comunicada_en = coalesce(revisado_at, created_at),
    alta_medica_reincorporacion = fecha_fin + 1
where subtipo = 'baja_medica'
  and estado = 'aprobada'
  and alta_medica_comunicada_en is null
  and fecha_fin is not null
  and fecha_fin < current_date;
