-- Consolidación tras colisión de implementaciones paralelas de "jornadas en vacantes".
-- Modelo único resultante: catálogo `jornadas` (gestionado en Ajustes → RRHH) +
-- `vacantes.tipo_jornada` (texto, elegido del catálogo). Se retira el modelo
-- paralelo huérfano (multi-local `vacante_locales` + catálogo `rrhh_tipos_jornada`),
-- que dejó de usarse al quitar los locales de reclutamiento.
-- Idempotente. Aplicada vía MCP el 2026-06-21.

-- 1) Volcar la jornada asignada (FK backfill previo) al texto que muestra la UI.
update public.vacantes v
set tipo_jornada = j.nombre
from public.jornadas j
where v.jornada_id = j.id;

-- 1b) Normalizar valores heredados en minúscula al nombre canónico del catálogo
--     (p.ej. 'completa' → 'Completa') para vacantes sin jornada_id.
update public.vacantes v
set tipo_jornada = j.nombre
from public.jornadas j
where v.empresa_id = j.empresa_id
  and lower(v.tipo_jornada) = lower(j.nombre)
  and v.tipo_jornada <> j.nombre;

-- 2) Retirar tablas huérfanas (nada las lee tras quitar locales de reclutamiento).
drop table if exists public.vacante_locales cascade;
drop table if exists public.rrhh_tipos_jornada cascade;

-- 3) Retirar columnas no usadas en vacantes (locales fuera; jornada vive en texto).
alter table public.vacantes drop column if exists local_id;
alter table public.vacantes drop column if exists jornada_id;
