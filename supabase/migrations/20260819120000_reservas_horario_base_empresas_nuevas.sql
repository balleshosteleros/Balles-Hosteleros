-- Horario base para empresas NUEVAS.
--
-- Antes, `empresa_reservas_config` nacía con los horarios a NULL. El motor
-- entonces aplicaba unos valores por defecto escondidos en el código (comida
-- 13:00–16:00, cena 20:00–02:00) que NO se veían en ninguna pantalla: el
-- restaurante creía tener sus horarios y en realidad estaba aceptando reservas
-- en horas que no eran las suyas.
--
-- Con esto, toda empresa nueva arranca con un horario base VISIBLE y editable,
-- y el cliente solo tiene que AJUSTARLO, no configurarlo de cero.
--
-- Idempotente: los DEFAULT se pueden reaplicar y el backfill solo toca filas
-- que siguen sin horario.

-- 1) Horario base para las filas que se creen a partir de ahora.
alter table public.empresa_reservas_config
  alter column general_inicio_comida set default '13:00',
  alter column general_fin_comida    set default '16:00',
  alter column general_inicio_cena   set default '20:00',
  alter column general_fin_cena      set default '00:00';

-- 2) Empresas ya existentes que nunca configuraron horario: se les deja el
--    mismo horario base para que deje de ser invisible. No se toca a quien ya
--    lo tenga puesto.
update public.empresa_reservas_config
   set general_inicio_comida = coalesce(general_inicio_comida, '13:00'),
       general_fin_comida    = coalesce(general_fin_comida,    '16:00'),
       general_inicio_cena   = coalesce(general_inicio_cena,   '20:00'),
       general_fin_cena      = coalesce(general_fin_cena,      '00:00'),
       updated_at            = now()
 where general_inicio_comida is null
    or general_fin_comida    is null
    or general_inicio_cena   is null
    or general_fin_cena      is null;

comment on column public.empresa_reservas_config.general_inicio_comida is
  'Apertura de comida. Trae un horario base al crear la empresa; el cliente lo ajusta en Sala → Reservas.';
