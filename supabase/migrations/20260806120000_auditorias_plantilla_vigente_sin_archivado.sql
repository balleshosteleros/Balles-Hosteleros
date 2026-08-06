-- ============ Auditorías: plantilla vigente única, fuera el archivado ============
--
-- Dos cambios sobre auditoria_plantillas:
--
-- 1) DESAPARECE el archivado. No había estado intermedio útil: una plantilla o
--    sirve o no sirve. Se elimina la columna `archivada`.
--
-- 2) Aparece `es_vigente`: de todas las plantillas de una empresa SOLO UNA puede
--    estar marcada como vigente, y es la que vale para hacer una auditoría.
--
-- OJO con el nombre: en auditoria_plantilla_versiones ya existe una columna
-- `vigente`, pero significa otra cosa (qué VERSIÓN publicada manda dentro de una
-- misma plantilla: v1, v2, v3…). Por eso aquí se llama `es_vigente`: es la
-- plantilla vigente de la empresa, no la versión vigente de la plantilla.
--
-- Idempotente: se puede aplicar varias veces sin romper nada.

-- 1) Marca de plantilla vigente
alter table public.auditoria_plantillas
  add column if not exists es_vigente boolean not null default false;

-- Una sola vigente por empresa. Índice parcial: las no vigentes no compiten.
create unique index if not exists auditoria_plantilla_una_vigente_por_empresa
  on public.auditoria_plantillas (empresa_id) where es_vigente;

-- 2) Fuera el archivado.
--    Antes de soltar la columna: si alguna plantilla estaba archivada NO se
--    convierte en vigente por accidente (es_vigente nace en false, así que no
--    hay nada que limpiar); simplemente vuelve a la lista como una más.
alter table public.auditoria_plantillas
  drop column if exists archivada;
