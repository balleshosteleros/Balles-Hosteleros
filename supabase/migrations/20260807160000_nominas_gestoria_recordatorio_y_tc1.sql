-- RECORDATORIO a la gestoría + cierre del enlace + TC1 por el enlace público.
--
-- 1) Recordatorio: se define como DÍAS DESPUÉS del aviso principal (no una fecha
--    fija), así sigue al aviso aunque se cambie su día. Solo se manda si NO se
--    han recibido las nóminas de ese periodo.
-- 2) El enlace de subida se CIERRA al recibir las nóminas: era multi-uso e
--    indefinido dentro de su vigencia, y cualquiera con la URL podía volver a
--    volcar nóminas del mismo mes después de haberlas entregado.
-- 3) `token_plano`: el recordatorio reenvía EL MISMO enlace, y de un hash no se
--    recupera la URL. Riesgo acotado: la tabla solo es accesible desde servidor,
--    el enlace únicamente permite SUBIR nóminas de un mes (no leer datos),
--    caduca y se cierra al usarse.
--
-- Idempotente: re-ejecutable sin error.

alter table public.empresas
  add column if not exists nominas_gestoria_recordatorio_activo boolean not null default true,
  add column if not exists nominas_gestoria_recordatorio_dias integer not null default 4,
  add column if not exists nominas_gestoria_recordatorio_hora integer not null default 12,
  add column if not exists nominas_gestoria_ultimo_recordatorio text;

comment on column public.empresas.nominas_gestoria_recordatorio_dias is
  'Días DESPUÉS del aviso principal en que se reclama, si aún no hay nóminas de ese periodo.';
comment on column public.empresas.nominas_gestoria_recordatorio_hora is
  'Hora local (0-23) a partir de la cual sale el recordatorio ese día. Por defecto 12:00.';
comment on column public.empresas.nominas_gestoria_ultimo_recordatorio is
  'Último periodo AAAA-MM cuyo recordatorio ya se envió (evita repetirlo).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresas_recordatorio_dias_chk') then
    alter table public.empresas add constraint empresas_recordatorio_dias_chk
      check (nominas_gestoria_recordatorio_dias between 1 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'empresas_recordatorio_hora_chk') then
    alter table public.empresas add constraint empresas_recordatorio_hora_chk
      check (nominas_gestoria_recordatorio_hora between 0 and 23);
  end if;
end $$;

alter table public.nominas_gestoria_tokens
  add column if not exists cerrado_en timestamptz,
  add column if not exists recordatorio_enviado_en timestamptz,
  add column if not exists token_plano text;

comment on column public.nominas_gestoria_tokens.cerrado_en is
  'Instante en que se recibieron las nóminas. No null = enlace cerrado: no admite más subidas.';
comment on column public.nominas_gestoria_tokens.recordatorio_enviado_en is
  'Cuándo se reclamó por segunda vez con ESTE mismo enlace.';
comment on column public.nominas_gestoria_tokens.token_plano is
  'Token en claro, solo para reenviar EL MISMO enlace en el recordatorio. La verificación sigue haciéndose contra token_hash.';

alter table public.nominas_gestoria_tokens enable row level security;
