-- ============================================================
-- 085_cronogramas_departamentos.sql
--
-- Objetivo:
--   Cronogramas operativos pasan a colgar de un DEPARTAMENTO
--   (no de un texto suelto en columna `rol`).
--
-- Nota sobre el M:N "rol ↔ departamentos":
--   YA existe vía `empresa_roles.permisos` (JSONB
--   `[{modulo, ver, editar}]`). Cada módulo coincide 1:1 con un
--   departamento, y el flag `ver=true` indica acceso. NO se crea
--   tabla puente para evitar duplicar fuente de verdad.
--
-- Estrategia (no destructiva):
--   1. Añadir `cronogramas_operativos.departamento_id` (nullable, FK).
--   2. Backfill desde el texto actual de `rol` con un mapeo determinista.
--   3. Mantener `cronogramas_operativos.rol` como legacy hasta que
--      todo el código consuma `departamento_id`.
-- ============================================================

alter table public.cronogramas_operativos
  add column if not exists departamento_id uuid
  references public.departamentos(id) on delete set null;

create index if not exists idx_cronogramas_operativos_departamento
  on public.cronogramas_operativos(departamento_id);

-- Backfill: traduce el texto actual de `rol` al departamento_id.
-- Mapeo:
--   DIRECCION       → DIRECCIÓN
--   GERENTE         → GERENCIA
--   RECURSOS HUMANOS→ RECURSOS HUMANOS
--   CALIDAD         → CALIDAD
--   CONTABILIDAD    → CONTABILIDAD
--   LOGISTICA       → LOGÍSTICA
--   MARKETING       → MARKETING
--   JEFE DE COCINA  → COCINA
--   JEFE DE SALA    → SALA
update public.cronogramas_operativos co
   set departamento_id = d.id
  from public.departamentos d
 where co.departamento_id is null
   and d.empresa_id = co.empresa_id
   and (
     (upper(co.rol) = 'DIRECCION'        and upper(d.nombre) = 'DIRECCIÓN')        or
     (upper(co.rol) = 'GERENTE'          and upper(d.nombre) = 'GERENCIA')         or
     (upper(co.rol) = 'RECURSOS HUMANOS' and upper(d.nombre) = 'RECURSOS HUMANOS') or
     (upper(co.rol) = 'CALIDAD'          and upper(d.nombre) = 'CALIDAD')          or
     (upper(co.rol) = 'CONTABILIDAD'     and upper(d.nombre) = 'CONTABILIDAD')     or
     (upper(co.rol) = 'LOGISTICA'        and upper(d.nombre) = 'LOGÍSTICA')        or
     (upper(co.rol) = 'MARKETING'        and upper(d.nombre) = 'MARKETING')        or
     (upper(co.rol) = 'JEFE DE COCINA'   and upper(d.nombre) = 'COCINA')           or
     (upper(co.rol) = 'JEFE DE SALA'     and upper(d.nombre) = 'SALA')
   );

comment on column public.cronogramas_operativos.departamento_id is
  'FK al departamento al que pertenece el cronograma. La columna `rol` (text) queda como legacy hasta que todo el código migre a esta FK.';
