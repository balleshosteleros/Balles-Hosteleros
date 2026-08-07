-- PRP-076 · Fase 1 — Deshacer del asistente de web por chat.
--
-- Guarda la versión ANTERIOR de los bloques justo antes de que el asistente IA
-- aplique un retoque de textos, para poder revertirlo con un botón.
--
-- Solo cubre la última intervención (no es un historial): el objetivo es que
-- un cambio mal entendido nunca deje al usuario atrapado.
--
-- Idempotente.

alter table public.paginas_web
  add column if not exists bloques_previos jsonb;

comment on column public.paginas_web.bloques_previos is
  'PRP-076: copia de `bloques` previa al último cambio del asistente IA. NULL = nada que deshacer.';
