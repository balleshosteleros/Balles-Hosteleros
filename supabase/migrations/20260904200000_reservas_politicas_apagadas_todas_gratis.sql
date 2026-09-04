-- Reservas · Toda reserva se puede hacer GRATIS
--
-- Se apagan las políticas de cancelación y de garantía en TODAS las empresas y
-- se vacían sus condiciones (comensales, días, fechas, turnos, horas, zonas y
-- mesas), volviendo al modo 'reserva'.
--
-- Motivo: BACANAL tenía la política de cancelación activa desde 4 comensales en
-- los turnos de comida y cena, cobrando por comensal, lo que impedía reservar
-- gratis a partir de 4 personas. Ahora se puede reservar sin coste a cualquier
-- hora, cualquier día y en cualquier zona.
--
-- Los importes por defecto se dejan como están: con la política apagada no se
-- cobra nada, y sirven de punto de partida si algún día se vuelve a activar.

update public.empresa_reservas_config
set cancelacion_activa        = false,
    cancelacion_desde_pax     = 0,
    cancelacion_dias_semana   = '{}',
    cancelacion_fechas        = '{}',
    cancelacion_turnos        = '{}',
    cancelacion_hora_desde    = null,
    cancelacion_hora_hasta    = null,
    cancelacion_grupo_zona_ids = '{}',
    cancelacion_mesa_ids      = '{}',
    cancelacion_modo          = 'reserva',
    garantia_activa           = false,
    garantia_desde_pax        = 0,
    garantia_dias_semana      = '{}',
    garantia_fechas           = '{}',
    garantia_turnos           = '{}',
    garantia_hora_desde       = null,
    garantia_hora_hasta       = null,
    garantia_grupo_zona_ids   = '{}',
    garantia_mesa_ids         = '{}',
    garantia_modo             = 'reserva'
where cancelacion_activa
   or garantia_activa
   or cancelacion_desde_pax <> 0
   or garantia_desde_pax <> 0
   or cancelacion_dias_semana <> '{}'
   or cancelacion_fechas <> '{}'
   or cancelacion_turnos <> '{}'
   or cancelacion_grupo_zona_ids <> '{}'
   or cancelacion_mesa_ids <> '{}'
   or cancelacion_hora_desde is not null
   or cancelacion_hora_hasta is not null
   or garantia_dias_semana <> '{}'
   or garantia_fechas <> '{}'
   or garantia_turnos <> '{}'
   or garantia_grupo_zona_ids <> '{}'
   or garantia_mesa_ids <> '{}'
   or garantia_hora_desde is not null
   or garantia_hora_hasta is not null;
