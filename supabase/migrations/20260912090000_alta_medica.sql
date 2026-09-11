-- ALTA MEDICA: el cierre de la baja.
--
-- Hasta ahora una baja medica se abria y no se cerraba nunca: la fecha de fin
-- era una estimacion que nadie corregia, y cuando el trabajador volvia no habia
-- forma de saberlo. El alta se comunica sobre la MISMA solicitud de baja, no en
-- una nueva: la baja y su alta son el mismo hecho.
--
-- Idempotente.

alter table public.solicitudes_personal
  -- Fecha del parte de alta. Desde este dia el trabajador ya NO esta de baja.
  add column if not exists alta_medica_fecha date,
  -- Cuando la comunico (para el historial y para saber si ya esta cerrada).
  add column if not exists alta_medica_comunicada_en timestamptz,
  -- Primer dia que le toca turno a partir del alta, calculado con SU horario.
  -- Se guarda en vez de recalcularse: el cuadrante puede cambiar despues, y lo
  -- que se comunico a RRHH y a la gestoria fue este dia, no otro.
  add column if not exists alta_medica_reincorporacion date;

comment on column public.solicitudes_personal.alta_medica_fecha is
  'Fecha del parte de alta medica. La baja cubre hasta el dia anterior.';
comment on column public.solicitudes_personal.alta_medica_comunicada_en is
  'Cuando el trabajador comunico su alta. Null = la baja sigue abierta.';
comment on column public.solicitudes_personal.alta_medica_reincorporacion is
  'Primer dia con turno a partir del alta, segun su horario. Se congela al comunicarla.';

-- Las bajas medicas abiertas: lo que busca el panel del trabajador para saber si
-- le toca comunicar el alta, y RRHH para ver quien sigue de baja.
create index if not exists idx_solicitudes_baja_medica_abierta
  on public.solicitudes_personal (empresa_id, user_id)
  where subtipo = 'baja_medica'
    and estado = 'aprobada'
    and alta_medica_comunicada_en is null;
