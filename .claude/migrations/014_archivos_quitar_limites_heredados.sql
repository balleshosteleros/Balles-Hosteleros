-- PRP-079 (corrección) — Quitar los límites heredados de `documentos`.
-- Aplicada en producción el 2026-08-27. Idempotente.
--
-- La tabla venía del gestor documental de Dirección (unos pocos PDF pequeños
-- en Supabase Storage) y arrastraba límites que hacían fallar TODA subida a la
-- herramienta Archivos con un "error desconocido":
--
--   · documentos_tamano_max      → 2 MB por archivo. Cualquier foto de móvil
--                                  ya lo supera.
--   · documentos_mime_whitelist  → lista cerrada de tipos, sin NINGÚN vídeo.
--   · documentos_check_quotas    → trigger con 4 topes: 50 documentos por
--                                  carpeta, 50 por empresa, 8 MB por empresa
--                                  y 800 MB en TODO el sistema.
--
-- Decisión de Iván (27-ago-2026): en Archivos cabe cualquier tipo de documento
-- y del peso que haga falta; el único tope es la cuota contratada por la
-- empresa (500 GB en R2), que ya se comprueba en el servidor
-- (`presignSubida` contra `storage_usage_por_empresa`) ANTES de firmar cada
-- subida. Ese es el sitio correcto: allí se avisa con un mensaje claro en vez
-- de reventar la inserción.

alter table public.documentos
  drop constraint if exists documentos_tamano_max;

alter table public.documentos
  drop constraint if exists documentos_mime_whitelist;

drop trigger if exists documentos_check_quotas on public.documentos;
drop function if exists public.tg_documentos_check_quotas();
