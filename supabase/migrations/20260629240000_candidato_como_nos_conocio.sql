-- ============================================================
-- "¿Por dónde nos has conocido?": respuesta DECLARADA por el candidato
-- en el formulario público (obligatoria en todas las vacantes).
--
-- Es un campo SEPARADO de la atribución automática por enlace
-- (`origen` / `canal_link_id` / `canal_nombre`, que infiere el canal a
-- partir del enlace ?o=<codigo>). Aquí guardamos el NOMBRE del origen del
-- catálogo `reclutamiento_origenes` que el candidato eligió a mano.
-- Texto (snapshot): si luego se borra del catálogo, la respuesta histórica
-- del candidato se conserva igualmente.
-- ============================================================

alter table public.candidatos
  add column if not exists como_nos_conocio text;

comment on column public.candidatos.como_nos_conocio is
  'Origen declarado por el candidato en el formulario público (nombre del catálogo reclutamiento_origenes, snapshot). Distinto de origen/canal_nombre (atribución automática por enlace).';
