-- Candidato activo/inactivo. Un candidato inactivo se conserva íntegro en BD y
-- sigue visible en el listado de Candidatos, pero NO aparece en el pipeline
-- (kanban) de su vacante, para no generar ruido visual. Idempotente.
alter table public.candidatos add column if not exists activo boolean not null default true;
