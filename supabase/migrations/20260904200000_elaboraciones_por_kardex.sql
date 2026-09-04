-- ============================================================
-- 20260904200000_elaboraciones_por_kardex.sql
-- Las elaboraciones pasan por el kardex, y mueren las dos RPC que las hacían mal.
--
-- QUÉ ESTABA ROTO (verificado en producción el 2026-09-04):
--   1. `confirmar_elaboracion` lee `productos.unidad`, columna **renombrada a `medida`
--      en junio** → la función FALLA al confirmar cualquier elaboración. Nadie lo notó
--      porque el módulo no se ha usado nunca (0 elaboraciones registradas).
--   2. Escribe `stock.cantidad_actual` **directamente, saltándose el kardex**: sin
--      movimiento, sin rastro, sin coste, sin poder auditar de dónde salió el saldo.
--   3. **Solo SUMA el producto elaborado y no descuenta sus ingredientes.** Fabrica
--      kilos de la nada: cada confirmación habría inflado el almacén.
--   4. Ninguna de las dos estaba versionada en este repo: vivían solo en producción.
--      Esta migración es, además, su acta de defunción.
--
-- La lógica se reescribe en TypeScript (`services/elaboracion-kardex.ts`) para compartir
-- el álgebra de consumo con el descuento por ventas: dos copias divergirían en semanas.
--
-- Una elaboración confirmada pasa a generar N SALIDAS (sus ingredientes, en proporción a
-- lo que el cocinero dice haber producido) + 1 ENTRADA (el producto elaborado), todas con
-- `documento_tipo = 'elaboracion'` para que se puedan revertir en bloque.
-- Idempotente.
-- ============================================================

-- El CHECK del kardex no contemplaba las elaboraciones.
alter table public.stock_movimientos
  drop constraint if exists stock_movimientos_documento_tipo_check;

alter table public.stock_movimientos
  add constraint stock_movimientos_documento_tipo_check
  check (documento_tipo in ('albaran','pos_ticket','inventario','merma','ajuste','elaboracion'));

-- Fuera las dos funciones rotas. No hay datos que migrar: 0 elaboraciones registradas.
drop function if exists public.confirmar_elaboracion(uuid);
drop function if exists public.revertir_elaboracion(uuid);
