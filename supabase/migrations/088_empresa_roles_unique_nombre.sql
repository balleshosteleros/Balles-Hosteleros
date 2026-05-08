-- 088_empresa_roles_unique_nombre.sql
--
-- UNIQUE en (empresa_id, nombre): garantiza idempotencia del seed de roles
-- (ON CONFLICT (empresa_id, nombre) DO NOTHING) y previene roles duplicados
-- con el mismo nombre dentro de una misma empresa.

ALTER TABLE empresa_roles
  ADD CONSTRAINT empresa_roles_empresa_nombre_unique
  UNIQUE (empresa_id, nombre);

-- Reescribimos la función de seed para que el ON CONFLICT apunte al constraint.
CREATE OR REPLACE FUNCTION seed_default_roles_for_empresa(target_empresa uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_permisos jsonb := jsonb_build_array(
    jsonb_build_object('modulo', 'DIRECCIÓN',         'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'SALA',              'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'COCINA',            'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'GERENCIA',          'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'CALIDAD',           'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'RECURSOS HUMANOS',  'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'MARKETING',         'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'LOGÍSTICA',         'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'CONTABILIDAD',      'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'GESTORÍA',          'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'JURÍDICO',          'ver', true, 'editar', true),
    jsonb_build_object('modulo', 'AJUSTES',           'ver', true, 'editar', true)
  );
BEGIN
  INSERT INTO empresa_roles (empresa_id, nombre, descripcion, permisos)
  VALUES
    (target_empresa, 'DIRECCIÓN',        'Dirección general — acceso completo',     full_permisos),
    (target_empresa, 'RECURSOS HUMANOS', 'Gestión de personal y nóminas',            jsonb_build_array(jsonb_build_object('modulo','RECURSOS HUMANOS','ver',true,'editar',true))),
    (target_empresa, 'LOGÍSTICA',        'Proveedores, productos e inventario',      jsonb_build_array(jsonb_build_object('modulo','LOGÍSTICA','ver',true,'editar',true))),
    (target_empresa, 'COCINA',           'Escandallos y producción',                 jsonb_build_array(jsonb_build_object('modulo','COCINA','ver',true,'editar',true))),
    (target_empresa, 'SALA',             'Servicio y atención en sala',              jsonb_build_array(jsonb_build_object('modulo','SALA','ver',true,'editar',true))),
    (target_empresa, 'GERENCIA',         'Supervisión general y cuadros de mando',   jsonb_build_array(jsonb_build_object('modulo','GERENCIA','ver',true,'editar',true))),
    (target_empresa, 'CONTABILIDAD',     'Facturas, operaciones y tesorería',        jsonb_build_array(jsonb_build_object('modulo','CONTABILIDAD','ver',true,'editar',true))),
    (target_empresa, 'GESTORÍA',         'Gestión documental y fiscal',              jsonb_build_array(jsonb_build_object('modulo','GESTORÍA','ver',true,'editar',true))),
    (target_empresa, 'JURÍDICO',         'Procesos legales y normativa',             jsonb_build_array(jsonb_build_object('modulo','JURÍDICO','ver',true,'editar',true))),
    (target_empresa, 'MARKETING',        'Comunicación, campañas y reservas',        jsonb_build_array(jsonb_build_object('modulo','MARKETING','ver',true,'editar',true))),
    (target_empresa, 'CALIDAD',          'Control de calidad y APPCC',               jsonb_build_array(jsonb_build_object('modulo','CALIDAD','ver',true,'editar',true)))
  ON CONFLICT (empresa_id, nombre) DO NOTHING;
END;
$$;
