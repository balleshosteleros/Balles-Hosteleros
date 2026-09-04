-- ============================================================================
-- Toda empresa TIENE configuración de fichajes (Ajustes RRHH → Fichajes)
-- ----------------------------------------------------------------------------
-- HABANA y BALLES no tenían fila en `empresa_fichajes_config`. Consecuencias
-- reales (04-sep-2026):
--
--   • El cron de auto-salida filtra por `auto_salida_activa = true`, así que a
--     esas empresas NO las miraba: ninguna jornada se cerraba sola. Un gerente
--     se dejó el fichaje abierto 13,5 h y, mientras tanto, el sistema creía que
--     seguía trabajando y no le dejaba fichar de nuevo.
--   • Sin fila, el código caía a un margen de cortesía de 15 min escrito en el
--     propio código, cuando la cortesía pactada en la empresa es de 5. Se coló
--     una entrada a las 09:10 en un turno que empezaba a las 09:00.
--
-- La configuración es un dato de la EMPRESA: vive en la BD, no en el código.
-- Esta migración crea la fila que falte y deja un trigger para que cada empresa
-- nueva nazca ya configurada.
-- ============================================================================

-- 1) Las que faltan, con los valores por defecto de la tabla.
insert into public.empresa_fichajes_config (empresa_id)
select e.id
from public.empresas e
left join public.empresa_fichajes_config c on c.empresa_id = e.id
where c.empresa_id is null;

-- 2) Cortesía real pactada: 5 minutos antes y después.
update public.empresa_fichajes_config
set margen_antes_min = 5, margen_despues_min = 5
where margen_antes_min <> 5 or margen_despues_min <> 5;

-- 3) Cierre automático de jornada activo en todas: si alguien olvida fichar la
--    salida, se cierra a la hora prevista de su turno en vez de quedar abierto.
update public.empresa_fichajes_config
set auto_salida_activa = true
where auto_salida_activa = false;

-- 4) Toda empresa nueva nace con su configuración.
create or replace function public.crear_fichajes_config_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.empresa_fichajes_config (
    empresa_id, margen_antes_min, margen_despues_min, auto_salida_activa
  )
  values (new.id, 5, 5, true)
  on conflict (empresa_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_crear_fichajes_config_empresa on public.empresas;
create trigger trg_crear_fichajes_config_empresa
  after insert on public.empresas
  for each row execute function public.crear_fichajes_config_empresa();
