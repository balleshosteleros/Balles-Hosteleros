-- ============================================================
-- 20260813150000_cierres_gastos_tipo_lista_cerrada.sql
-- Tipo de gasto de cierres: LISTA CERRADA también en la base de datos.
-- Antes era texto libre y la UI dejaba escribir cualquier cosa encima
-- de la sugerencia (salían categorías inventadas). La UI ya es un
-- desplegable cerrado; esto es el cinturón de seguridad por detrás,
-- para que nada pueda colar una categoría nueva.
-- Idempotente.
-- ============================================================

-- Limpieza defensiva: espacios sobrantes en lo ya grabado.
update public.cierres_gastos
   set tipo = btrim(tipo)
 where tipo <> btrim(tipo);

-- Sólo se admiten las categorías del desplegable. Se permite ''
-- porque la columna tiene default '' y hay filas informativas antiguas.
alter table public.cierres_gastos
  drop constraint if exists cierres_gastos_tipo_chk;

alter table public.cierres_gastos
  add constraint cierres_gastos_tipo_chk
  check (tipo in (
    '', 'Proveedores', 'Personal', 'Suministros', 'Mantenimiento',
    'Impuestos', 'Alquiler', 'Limpieza', 'Marketing', 'Otros'
  ));
