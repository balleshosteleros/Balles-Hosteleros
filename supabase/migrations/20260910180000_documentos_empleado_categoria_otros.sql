-- Carpeta OTROS en el expediente de cada trabajador.
--
-- Todo lo que no encaja en las carpetas con nombre (nominas, contratos,
-- justificantes, registros de jornada, entregas, sanciones, bajas medicas)
-- acababa sin sitio donde guardarse, asi que se quedaba fuera del expediente.
-- Con OTROS deja de haber documentos huerfanos: si no encaja en ninguna, va aqui.
--
-- Idempotente.
alter table public.documentos_empleado drop constraint if exists documentos_empleado_categoria_check;
alter table public.documentos_empleado add constraint documentos_empleado_categoria_check
  check (categoria = any (array['nominas'::text, 'contratos'::text, 'justificantes'::text,
    'registros-jornada'::text, 'sanciones'::text, 'entregas'::text, 'bajas-medicas'::text,
    'otros'::text]));
