-- 087_roles_nombre_igual_departamento.sql
--
-- Renombra los roles para que su nombre coincida exactamente con el del
-- departamento responsable. Multi-tenant: aplica a todas las empresas
-- existentes y deja una función + trigger para que cualquier empresa nueva
-- nazca con los 11 roles ya sembrados.
--
-- Mapping:
--   DIRECTOR              → DIRECCIÓN          (rol con acceso a los 12 módulos)
--   RESPONSABLE RRHH      → RECURSOS HUMANOS
--   JEFE DE LOGÍSTICA     → LOGÍSTICA
--   JEFE DE COCINA        → COCINA
--   JEFE DE SALA          → SALA
--   GERENTE               → GERENCIA
--   CONTABLE              → CONTABILIDAD
--   GESTOR                → GESTORÍA
--   ABOGADO               → JURÍDICO
--   RESPONSABLE MARKETING → MARKETING
--   RESPONSABLE CALIDAD   → CALIDAD

BEGIN;

-- 1) Renombrar empresa_roles.nombre (sin tocar permisos)
UPDATE empresa_roles SET nombre = 'DIRECCIÓN'         WHERE nombre = 'DIRECTOR';
UPDATE empresa_roles SET nombre = 'RECURSOS HUMANOS'  WHERE nombre = 'RESPONSABLE RRHH';
UPDATE empresa_roles SET nombre = 'LOGÍSTICA'         WHERE nombre = 'JEFE DE LOGÍSTICA';
UPDATE empresa_roles SET nombre = 'COCINA'            WHERE nombre = 'JEFE DE COCINA';
UPDATE empresa_roles SET nombre = 'SALA'              WHERE nombre = 'JEFE DE SALA';
UPDATE empresa_roles SET nombre = 'GERENCIA'          WHERE nombre = 'GERENTE';
UPDATE empresa_roles SET nombre = 'CONTABILIDAD'      WHERE nombre = 'CONTABLE';
UPDATE empresa_roles SET nombre = 'GESTORÍA'          WHERE nombre = 'GESTOR';
UPDATE empresa_roles SET nombre = 'JURÍDICO'          WHERE nombre = 'ABOGADO';
UPDATE empresa_roles SET nombre = 'MARKETING'         WHERE nombre = 'RESPONSABLE MARKETING';
UPDATE empresa_roles SET nombre = 'CALIDAD'           WHERE nombre = 'RESPONSABLE CALIDAD';

-- 2) Renombrar profiles.rol_label (mismo mapping)
UPDATE profiles SET rol_label = 'DIRECCIÓN'         WHERE rol_label = 'DIRECTOR';
UPDATE profiles SET rol_label = 'RECURSOS HUMANOS'  WHERE rol_label = 'RESPONSABLE RRHH';
UPDATE profiles SET rol_label = 'LOGÍSTICA'         WHERE rol_label = 'JEFE DE LOGÍSTICA';
UPDATE profiles SET rol_label = 'COCINA'            WHERE rol_label = 'JEFE DE COCINA';
UPDATE profiles SET rol_label = 'SALA'              WHERE rol_label = 'JEFE DE SALA';
UPDATE profiles SET rol_label = 'GERENCIA'          WHERE rol_label = 'GERENTE';
UPDATE profiles SET rol_label = 'CONTABILIDAD'      WHERE rol_label = 'CONTABLE';
UPDATE profiles SET rol_label = 'GESTORÍA'          WHERE rol_label = 'GESTOR';
UPDATE profiles SET rol_label = 'JURÍDICO'          WHERE rol_label = 'ABOGADO';
UPDATE profiles SET rol_label = 'MARKETING'         WHERE rol_label = 'RESPONSABLE MARKETING';
UPDATE profiles SET rol_label = 'CALIDAD'           WHERE rol_label = 'RESPONSABLE CALIDAD';

-- 3) Función seed_default_roles_for_empresa(uuid)
--    Inserta los 11 roles canónicos para la empresa indicada. Idempotente:
--    si ya existe un rol con ese nombre para esa empresa, lo deja como está.
--    "DIRECCIÓN" recibe acceso completo a los 12 módulos (rol del director).
--    El resto recibe acceso únicamente a su propio módulo.
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
    (target_empresa, 'DIRECCIÓN',        'Dirección general — acceso completo',           full_permisos),
    (target_empresa, 'RECURSOS HUMANOS', 'Gestión de personal y nóminas',                  jsonb_build_array(jsonb_build_object('modulo','RECURSOS HUMANOS','ver',true,'editar',true))),
    (target_empresa, 'LOGÍSTICA',        'Proveedores, productos e inventario',            jsonb_build_array(jsonb_build_object('modulo','LOGÍSTICA','ver',true,'editar',true))),
    (target_empresa, 'COCINA',           'Escandallos y producción',                       jsonb_build_array(jsonb_build_object('modulo','COCINA','ver',true,'editar',true))),
    (target_empresa, 'SALA',             'Servicio y atención en sala',                    jsonb_build_array(jsonb_build_object('modulo','SALA','ver',true,'editar',true))),
    (target_empresa, 'GERENCIA',         'Supervisión general y cuadros de mando',         jsonb_build_array(jsonb_build_object('modulo','GERENCIA','ver',true,'editar',true))),
    (target_empresa, 'CONTABILIDAD',     'Facturas, operaciones y tesorería',              jsonb_build_array(jsonb_build_object('modulo','CONTABILIDAD','ver',true,'editar',true))),
    (target_empresa, 'GESTORÍA',         'Gestión documental y fiscal',                    jsonb_build_array(jsonb_build_object('modulo','GESTORÍA','ver',true,'editar',true))),
    (target_empresa, 'JURÍDICO',         'Procesos legales y normativa',                   jsonb_build_array(jsonb_build_object('modulo','JURÍDICO','ver',true,'editar',true))),
    (target_empresa, 'MARKETING',        'Comunicación, campañas y reservas',              jsonb_build_array(jsonb_build_object('modulo','MARKETING','ver',true,'editar',true))),
    (target_empresa, 'CALIDAD',          'Control de calidad y APPCC',                     jsonb_build_array(jsonb_build_object('modulo','CALIDAD','ver',true,'editar',true)))
  ON CONFLICT DO NOTHING;
END;
$$;

-- 4) Sembrado retroactivo: cualquier empresa que aún no tenga roles
DO $$
DECLARE
  emp record;
BEGIN
  FOR emp IN
    SELECT e.id
    FROM empresas e
    LEFT JOIN empresa_roles er ON er.empresa_id = e.id
    WHERE er.id IS NULL
    GROUP BY e.id
  LOOP
    PERFORM seed_default_roles_for_empresa(emp.id);
  END LOOP;
END;
$$;

-- 5) Trigger: cualquier empresa nueva nace con los 11 roles
CREATE OR REPLACE FUNCTION trg_seed_default_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_default_roles_for_empresa(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresas_seed_default_roles ON empresas;
CREATE TRIGGER empresas_seed_default_roles
AFTER INSERT ON empresas
FOR EACH ROW
EXECUTE FUNCTION trg_seed_default_roles();

COMMIT;
