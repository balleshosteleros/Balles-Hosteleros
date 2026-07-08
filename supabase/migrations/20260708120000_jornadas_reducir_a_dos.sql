-- ============================================================
-- Reducir el catálogo de jornadas a solo DOS opciones canónicas:
--   • Jornada completa
--   • Jornada reducida
-- «Jornada por horas» se consolida dentro de «Jornada reducida»
-- (es una jornada parcial). Aplica a TODAS las empresas.
-- Idempotente: se puede ejecutar varias veces sin efecto adicional.
-- ============================================================

-- 1) Cascada a vacantes: las que eran «Jornada por horas» pasan a «Jornada reducida».
--    (La jornada se guarda como texto = nombre del catálogo.)
update public.vacantes
   set tipo_jornada = 'Jornada reducida'
 where lower(tipo_jornada) in ('por horas', 'jornada por horas');

-- 2) Eliminar la jornada «Jornada por horas» del catálogo de todas las empresas.
delete from public.jornadas
 where lower(nombre) in ('por horas', 'jornada por horas');
