-- ════════════════════════════════════════════════════════════════════════
-- Datos fiscales correctos de BACANAL y HABANA + limpieza de correos vacíos
-- ────────────────────────────────────────────────────────────────────────
-- Estos datos viven dentro del jsonb `empresas.datos_generales` (mismo objeto
-- que lee el formulario de Ajustes → Imagen de Marca / Configuración).
-- El merge `||` preserva el resto de claves (logos, correos por depto, etc.).
-- Idempotente: re-ejecutar deja exactamente el mismo estado.
-- ════════════════════════════════════════════════════════════════════════

-- BACANAL SYSTEM S.L. — B09654955 — C/ Leganés 51, Local 2, Fuenlabrada
UPDATE empresas
SET datos_generales = datos_generales || jsonb_build_object(
  'cif',               'B09654955',
  'razonSocial',       'BACANAL SYSTEM S.L.',
  'codigoPostal',      '28945',
  'provincia',         'Madrid',
  'ciudad',            'Fuenlabrada',
  'direccionLocal',    'C/ Leganés, 51 - Local 2',
  'direccionFiscal',   'C/ Leganés, 51 - Local 2',
  'telefonoPrincipal', '91 999 41 40',
  'correoDireccion',   'direccion.grupobacanal@gmail.com'
)
WHERE id = 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47';

-- HABANA SYSTEM S.L. — B88599592 — C/ Leganés 51, Local 3, Fuenlabrada
UPDATE empresas
SET datos_generales = datos_generales || jsonb_build_object(
  'cif',               'B88599592',
  'razonSocial',       'HABANA SYSTEM S.L.',
  'codigoPostal',      '28945',
  'provincia',         'Madrid',
  'ciudad',            'Fuenlabrada',
  'direccionLocal',    'C/ Leganés, 51 - Local 3',
  'direccionFiscal',   'C/ Leganés, 51 - Local 3',
  'telefonoPrincipal', '91 999 31 10',
  'correoDireccion',   'direccion.grupohabana@gmail.com'
)
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Limpieza de correos inexistentes en TODAS las empresas
-- (general / reservas / administración / incidencias no existen → se vacían)
UPDATE empresas
SET datos_generales = datos_generales || jsonb_build_object(
  'correoGeneral',     '',
  'correoReservas',    '',
  'correoAdmin',       '',
  'correoIncidencias', ''
);
