-- ============================================================================
-- Punto de partida IGUAL para toda empresa
-- ----------------------------------------------------------------------------
-- Cada empresa tenía configuraciones que a las otras les faltaban, en
-- direcciones distintas: BACANAL tenía cierres de caja y HABANA no; ninguna
-- tenía alarmas de cocina, proveedores ni mensajería. Cuando falta la fila, el
-- software cae a valores escritos en el código — invisibles desde la pantalla
-- de Ajustes, y por tanto imposibles de auditar o corregir.
--
-- Ya pasó con los fichajes (ver 20260904200000): sin fila, HABANA aplicaba 15
-- minutos de cortesía inventados en vez de los 5 reales, y su cierre automático
-- de jornada no se ejecutaba nunca.
--
-- Regla: la configuración es un dato de la EMPRESA. Vive en la BD, y toda
-- empresa la tiene desde el minuto uno.
-- ============================================================================

-- 1) Crear la fila que falte, con los valores por defecto de cada tabla.
insert into public.cierres_config (empresa_id, modo, dia_semana, dias_bloqueo)
select e.id, 'fijo', 3, 3
from public.empresas e
left join public.cierres_config c on c.empresa_id = e.id
where c.empresa_id is null;

insert into public.cocina_alarmas_config (empresa_id)
select e.id from public.empresas e
left join public.cocina_alarmas_config c on c.empresa_id = e.id
where c.empresa_id is null;

insert into public.proveedores_config (empresa_id)
select e.id from public.empresas e
left join public.proveedores_config c on c.empresa_id = e.id
where c.empresa_id is null;

insert into public.empresa_mensajeria_config (empresa_id)
select e.id from public.empresas e
left join public.empresa_mensajeria_config c on c.empresa_id = e.id
where c.empresa_id is null;

-- 2) Toda empresa nueva nace con estas configuraciones.
--    Se amplía el trigger que ya creaba la de fichajes.
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

  insert into public.cierres_config (empresa_id, modo, dia_semana, dias_bloqueo)
  values (new.id, 'fijo', 3, 3)
  on conflict (empresa_id) do nothing;

  insert into public.cocina_alarmas_config (empresa_id) values (new.id)
  on conflict (empresa_id) do nothing;

  insert into public.proveedores_config (empresa_id) values (new.id)
  on conflict (empresa_id) do nothing;

  insert into public.empresa_mensajeria_config (empresa_id) values (new.id)
  on conflict (empresa_id) do nothing;

  return new;
end;
$$;

comment on function public.crear_fichajes_config_empresa() is
  'Siembra la configuración base de una empresa nueva. Los catálogos y pilares '
  '(departamentos, roles, puestos) los siembra seedEmpresaDefaults en código.';
