-- El color de un turno se deriva SIEMPRE del color de su departamento
-- (departamentos.color). La columna rrhh_turnos.color era legacy y la app ya no
-- la escribe ni la lee; se retira para evitar configuraciones contradictorias.
ALTER TABLE public.rrhh_turnos DROP COLUMN IF EXISTS color;
