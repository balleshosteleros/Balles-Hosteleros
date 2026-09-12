-- Un solo enlace de carta y horarios que se configuran desde la pantalla.
--
-- Antes habia dos: el del QR de la mesa y el de la web con `?web=1`, que
-- enseñaba tambien lo que estaba fuera de horario. Dos enlaces para la misma
-- carta solo se prestan a liarse, asi que queda uno: lo que se ve a cada hora
-- lo decide el horario de la categoria, no por donde entre el cliente.
--
-- La franja puede CRUZAR LA MEDIANOCHE. El Menu del dia se sirve de 23:30 a
-- 19:30 del dia siguiente: lo que se esconde es el hueco de 19:30 a 23:30, el
-- servicio de noche. Antes la regla comparaba desde <= ahora <= hasta y una
-- franja asi era imposible de escribir.
--
-- Y el horario deja de tocarse a mano en la base de datos: los dias, la franja,
-- el apartado y la marca de dieta especial se editan en cada categoria desde
-- Marketing -> Carta digital.
update public.carta_categorias
set dias_semana = null, hora_desde = null, hora_hasta = null, updated_at = now()
where nombre not ilike '%menú del día%' and nombre not ilike '%menu del dia%'
  and (dias_semana is not null or hora_desde is not null or hora_hasta is not null);

update public.carta_categorias
set dias_semana = null, hora_desde = '23:30', hora_hasta = '19:30', updated_at = now()
where nombre ilike '%menú del día%' or nombre ilike '%menu del dia%';
