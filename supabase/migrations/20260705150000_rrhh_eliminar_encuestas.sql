-- Elimina por completo el submódulo de Encuestas de RRHH.
-- El código que consumía estos objetos ya fue retirado; aquí se limpian los
-- objetos huérfanos en BD. Idempotente: se puede reejecutar sin error.

-- 1) Tabla de respuestas (FK -> encuestas). Se borra primero por dependencia.
drop table if exists public.encuesta_respuestas cascade;

-- 2) Tabla principal de encuestas (arrastra políticas e índices asociados).
drop table if exists public.encuestas cascade;

-- 3) Toggle de notificación de encuestas en empresas (ya sin uso).
alter table public.empresas
  drop column if exists notif_encuestas_activo;
