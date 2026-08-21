-- ============================================================
-- Entregas: todo se devuelve, y lo que se estropea se da de baja
-- ============================================================
--
-- 1) TODO SE DEVUELVE. El catálogo nacía con el uniforme marcado como "no hay
--    que devolverlo" (una camiseta usada no vuelve) y solo llaves, taquilla,
--    tarjeta y móvil como devolvibles. Decisión de Iván (2026-08-21): TODO se
--    devuelve, sin excepción, para que quede reflejado siempre qué tiene el
--    trabajador y qué ha entregado al salir.
--
-- 2) MERMA. Una prenda que se rompe o se desgasta no se puede devolver, y hasta
--    ahora se quedaba como material del trabajador para siempre. Ahora se le
--    manda un acta de BAJA POR DETERIORO: la firma, la pieza deja de contar como
--    suya y queda constancia del motivo. La entrega NO desaparece de la lista:
--    el acta es un documento firmado y necesita su fila que lo explique.
--
-- Idempotente: se puede aplicar dos veces sin romper nada.

-- ------------------------------------------------------------
-- 1) Todo devolvible
-- ------------------------------------------------------------
alter table public.entregas_tipos_material
  alter column requiere_devolucion set default true;

comment on column public.entregas_tipos_material.requiere_devolucion is
  'Por defecto true: todo se devuelve. Se puede desmarcar por tipo si algún día hay material desechable.';

-- Catálogo existente de todas las empresas.
update public.entregas_tipos_material
set requiere_devolucion = true, updated_at = now()
where requiere_devolucion = false;

-- Entregas AÚN NO FIRMADAS. Las firmadas NO se tocan: el acta congela lo que el
-- trabajador aceptó, y cambiarlo después alteraría un documento ya firmado.
update public.entregas_material_items i
set requiere_devolucion = true
from public.entregas_material e
where i.entrega_id = e.id
  and e.estado <> 'firmada'
  and i.requiere_devolucion = false;

alter table public.entregas_material_items
  alter column requiere_devolucion set default true;

-- ------------------------------------------------------------
-- 2) Merma: baja por deterioro, firmada por el trabajador
-- ------------------------------------------------------------
-- Vive en `devolucion_estado` y no en una columna aparte porque es el mismo
-- desenlace: la pieza deja de estar en manos del trabajador. Cambia el motivo
-- (la devolvió / se estropeó), no el hecho.
alter table public.entregas_material
  drop constraint if exists entregas_material_devolucion_estado_check;

alter table public.entregas_material
  add constraint entregas_material_devolucion_estado_check
  check (devolucion_estado in (
    'no_procede',
    'pendiente_firma',
    'devuelta',
    'rechazada',
    -- Merma
    'merma_pendiente_firma',
    'merma'
  ));

alter table public.entregas_material
  add column if not exists merma_motivo text,
  add column if not exists merma_en timestamptz;

comment on column public.entregas_material.merma_motivo is
  'Por qué se da de baja la pieza (rotura, desgaste…). Aparece en el acta que firma el trabajador.';
comment on column public.entregas_material.merma_en is
  'Cuándo firmó el trabajador la baja por deterioro.';
