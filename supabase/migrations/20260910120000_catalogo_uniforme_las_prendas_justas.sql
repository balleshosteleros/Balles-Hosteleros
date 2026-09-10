-- ============================================================
-- 20260910120000_catalogo_uniforme_las_prendas_justas.sql
-- El catálogo de entregas se queda con lo que se usa de verdad.
--
-- El catálogo nació con una lista genérica de hostelería (camisetas, pantalones,
-- delantales, guantes, taquillas, tarjetas de acceso…) que en HABANA y BACANAL
-- no se entrega a nadie. Un desplegable con quince opciones de las que sirven
-- seis hace que se elija mal, y ensucia el almacén con piezas que nunca van a
-- tener saldo.
--
-- Decisión de Iván (10-09-2026): **las prendas justas**. Se quedan las nueve que
-- se entregan hoy y se borra el resto.
--
-- QUÉ PIDE TALLA Y QUÉ NO
--   La ropa que se fabrica por tallas la pide (camisas, chaquetilla, americana).
--   El gorro y el mandil son talla única: preguntarla obligaría a inventarse un
--   dato. Y lo electrónico no tiene talla, evidentemente: móvil, ordenador y
--   llaves entran sin ella.
--
-- SEGURO POR CONSTRUCCIÓN: solo borra tipos que no ha usado NADIE. Si un tipo
-- tiene aunque sea una entrega o un movimiento de almacén, se queda — borrarlo
-- dejaría un acta firmada o una línea del libro apuntando al vacío.
--
-- Idempotente: se puede aplicar dos veces sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Fuera lo que no se entrega y nadie ha usado
-- ------------------------------------------------------------
delete from public.entregas_tipos_material t
where lower(t.nombre) in (
  'camisa',                 -- sustituida por las dos de manga
  'camiseta',
  'pantalón', 'pantalon',
  'delantal',
  'calzado antideslizante',
  'calzado de seguridad',
  'guantes',
  'taquilla',
  'tarjeta de acceso',
  'otros'
)
and not exists (
  select 1 from public.entregas_material_items i where i.tipo_id = t.id
)
and not exists (
  select 1 from public.material_movimientos m where m.tipo_id = t.id
);

-- ------------------------------------------------------------
-- 2) Las nueve que se quedan, iguales en TODAS las empresas
-- ------------------------------------------------------------
-- Se insertan las que falten (una empresa nueva parte de aquí) y se corrigen
-- categoría, talla y orden de las que ya estaban.
insert into public.entregas_tipos_material
  (empresa_id, nombre, categoria, requiere_talla, requiere_devolucion, activo, orden)
select e.id, c.nombre, c.categoria, c.requiere_talla, true, true, c.orden
from public.empresas e
cross join (values
  -- Ropa por tallas
  ('Camisa manga corta',    'uniforme', true,   1),
  ('Camisa manga larga',    'uniforme', true,   2),
  ('Chaquetilla de cocina', 'uniforme', true,   3),
  ('Americana',             'uniforme', true,   4),
  -- Ropa de talla única
  ('Gorro',                 'uniforme', false,  5),
  ('Mandil',                'uniforme', false,  6),
  -- Material y electrónica: sin talla
  ('Llaves del local',      'material', false, 20),
  ('Teléfono móvil',        'material', false, 21),
  ('Ordenador',             'material', false, 22)
) as c(nombre, categoria, requiere_talla, orden)
where not exists (
  select 1 from public.entregas_tipos_material x
  where x.empresa_id = e.id and lower(x.nombre) = lower(c.nombre)
);

update public.entregas_tipos_material t
set categoria = c.categoria,
    requiere_talla = c.requiere_talla,
    requiere_devolucion = true,
    activo = true,
    orden = c.orden,
    updated_at = now()
from (values
  ('Camisa manga corta',    'uniforme', true,   1),
  ('Camisa manga larga',    'uniforme', true,   2),
  ('Chaquetilla de cocina', 'uniforme', true,   3),
  ('Americana',             'uniforme', true,   4),
  ('Gorro',                 'uniforme', false,  5),
  ('Mandil',                'uniforme', false,  6),
  ('Llaves del local',      'material', false, 20),
  ('Teléfono móvil',        'material', false, 21),
  ('Ordenador',             'material', false, 22)
) as c(nombre, categoria, requiere_talla, orden)
where lower(t.nombre) = lower(c.nombre)
  and (
    t.categoria is distinct from c.categoria
    or t.requiere_talla is distinct from c.requiere_talla
    or t.requiere_devolucion is distinct from true
    or t.activo is distinct from true
    or t.orden is distinct from c.orden
  );

comment on column public.entregas_tipos_material.requiere_talla is
  'true solo en la ropa que se fabrica por tallas. Gorro y mandil son talla única; el material electrónico no tiene talla.';
