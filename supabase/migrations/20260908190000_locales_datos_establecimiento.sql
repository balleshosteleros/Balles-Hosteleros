-- Qué es cada local y bajo qué reglas trabaja su plantilla.
--
-- Estos cuatro datos estaban puestos en la empresa, y ahí no valen: una
-- sociedad puede tener dos locales con CCC distinto (el CCC es del CENTRO de
-- trabajo, no de la sociedad), y si los locales están en provincias distintas
-- también cambia el convenio, porque el de hostelería es provincial. El tipo
-- y la clase son de la licencia de cada local. Por eso viven aquí.
--
-- Todo opcional: los locales que ya existen no se rompen, y el formulario
-- pide los valores cuando se crea o se edita un local.

alter table public.locales
  add column if not exists ccc                 text,
  add column if not exists tipo_establecimiento text,
  add column if not exists clase_restaurante    text,
  add column if not exists convenio             text;

comment on column public.locales.ccc is
  'Código de Cuenta de Cotización del centro en la Seguridad Social. Va en cada alta de trabajador.';
comment on column public.locales.tipo_establecimiento is
  'Restaurante, bar, cafetería… lo que es el local a efectos de licencia.';
comment on column public.locales.clase_restaurante is
  'Categoría por tenedores. "No aplica" en locales que no son restaurante.';
comment on column public.locales.convenio is
  'Convenio colectivo de hostelería que rige a la plantilla. Es provincial.';

-- Datos conocidos de los locales en marcha. Solo se rellena lo que está
-- vacío, para no pisar lo que alguien haya corregido a mano después.
--
-- El CCC se deja a propósito sin rellenar: es un número real de la Seguridad
-- Social y no se puede deducir del nombre ni de la dirección. Inventarlo
-- metería un dato falso en el alta que se manda a la gestoría.
update public.locales l
set tipo_establecimiento = coalesce(l.tipo_establecimiento, 'Restaurante'),
    convenio             = coalesce(l.convenio, 'Hostelería de Madrid')
from public.empresas e
where e.id = l.empresa_id
  and e.nombre = 'BACANAL';

-- HABANA es coctelería: no se clasifica por tenedores.
update public.locales l
set tipo_establecimiento = coalesce(l.tipo_establecimiento, 'Coctelería'),
    clase_restaurante    = coalesce(l.clase_restaurante, 'No aplica'),
    convenio             = coalesce(l.convenio, 'Hostelería de Madrid')
from public.empresas e
where e.id = l.empresa_id
  and e.nombre = 'HABANA';
