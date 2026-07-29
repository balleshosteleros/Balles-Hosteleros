-- Estado "Revisión" de albaranes (asistente de albaranes por foto, decisión Iván 29-jul)
-- + versionado de columnas que existían en prod sin migración .sql (deuda detectada en la
-- auditoría del 29-jul: producto_precios_compra.proveedor/.formato y albaranes.numero_proveedor).
--
-- Contexto: la migración 20260627210000_estados_documentos_simplificados.sql fijó
-- albaranes_estado_check en ('Pendiente','Entregado','Confirmado'). El asistente necesita
-- un 4º estado "Revisión": el albarán subido por foto se GUARDA con líneas sin producto
-- asociado, NO suma stock, y solo al aprobarse línea a línea pasa a 'Confirmado' (donde
-- sí entra stock). Sin este cambio, createAlbaran({estado:'Revisión'}) viola el CHECK.
--
-- Idempotente: se puede re-ejecutar sin efecto.

-- 1) CHECK de estado con 'Revisión'
ALTER TABLE public.albaranes DROP CONSTRAINT IF EXISTS albaranes_estado_check;
ALTER TABLE public.albaranes ADD CONSTRAINT albaranes_estado_check
  CHECK (estado IN ('Pendiente', 'Revisión', 'Entregado', 'Confirmado'));

-- 2) Columnas que el código ya usa pero no estaban versionadas
ALTER TABLE public.albaranes
  ADD COLUMN IF NOT EXISTS numero_proveedor text;

-- En prod: proveedor es text NOT NULL (sin default explícito) y formato es text NULL.
-- Se replica tal cual; el DEFAULT '' solo aplica al crear la columna en un entorno limpio
-- (en prod la columna ya existe y esto es un no-op).
ALTER TABLE public.producto_precios_compra
  ADD COLUMN IF NOT EXISTS proveedor text NOT NULL DEFAULT '';
ALTER TABLE public.producto_precios_compra
  ADD COLUMN IF NOT EXISTS formato text;
