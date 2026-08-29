-- ia_uso_log: `empresa_id` pasa a ser OPCIONAL.
--
-- Por qué: sobre esta tabla se apoya el tope de gasto mensual de IA
-- (`lib/ia/presupuesto.ts`). El gasto es GLOBAL —hay una única cuenta de Google
-- para las tres sociedades—, así que el contador suma todo el consumo, venga de
-- donde venga. Y hay llamadas que no pertenecen a ninguna empresa concreta:
--   · procesos de fondo (un OCR lanzado por cron, sin usuario ni empresa activa),
--   · las marcas internas con las que el sistema recuerda que ya avisó este mes.
--
-- Con la columna obligatoria, esas filas fallaban con "null value in column
-- empresa_id violates not-null constraint" y el registro se perdía en silencio:
-- el contador se quedaba en 0 €, el tope no saltaba nunca y el freno de gasto
-- era decorativo. Detectado probando el flujo real, no leyendo el esquema.
--
-- No se borra ni se modifica ningún dato. La clave foránea a `empresas` sigue
-- intacta: si se rellena, tiene que ser una empresa que exista.

alter table public.ia_uso_log
  alter column empresa_id drop not null;

comment on column public.ia_uso_log.empresa_id is
  'Empresa a la que se imputa el consumo. Vacío en llamadas de sistema (procesos de fondo y marcas internas de aviso): el tope de gasto es global, no por empresa.';
