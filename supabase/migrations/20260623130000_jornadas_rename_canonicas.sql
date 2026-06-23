-- ============================================================
-- Renombrar las 3 jornadas canónicas a su nombre definitivo
-- y propagar el cambio a TODAS las vacantes (texto en vacantes.tipo_jornada).
--   Completa       -> Jornada completa
--   Media jornada  -> Jornada reducida
--   Por horas      -> Jornada por horas
-- ============================================================

-- 1) Catálogo
update public.jornadas set nombre = 'Jornada completa', updated_at = now()
  where lower(nombre) in ('completa', 'jornada completa');
update public.jornadas set nombre = 'Jornada reducida', updated_at = now()
  where lower(nombre) in ('media jornada', 'reducida', 'jornada reducida');
update public.jornadas set nombre = 'Jornada por horas', updated_at = now()
  where lower(nombre) in ('por horas', 'jornada por horas');

-- 2) Cascada a vacantes (la jornada se guarda como texto = nombre del catálogo)
update public.vacantes set tipo_jornada = 'Jornada completa'
  where lower(tipo_jornada) in ('completa', 'jornada completa');
update public.vacantes set tipo_jornada = 'Jornada reducida'
  where lower(tipo_jornada) in ('media jornada', 'reducida', 'jornada reducida');
update public.vacantes set tipo_jornada = 'Jornada por horas'
  where lower(tipo_jornada) in ('por horas', 'jornada por horas');
