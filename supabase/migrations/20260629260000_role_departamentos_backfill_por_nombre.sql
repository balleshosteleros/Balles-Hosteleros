-- ============================================================
-- 20260629260000_role_departamentos_backfill_por_nombre.sql
--
-- FUENTE ÚNICA de visibilidad por departamento: empresa_role_departamentos.
-- "Ves los departamentos que te da tu ROL, y ya está." Si mañana cambias la
-- asignación del rol, cambia lo que ve el usuario al instante.
--
-- En este proyecto cada rol se llama igual que su departamento. La migración 097
-- creó la tabla puente pero su backfill solo copiaba empresa_roles.departamento_id,
-- que estaba casi siempre vacío → la tabla quedó vacía y nadie veía nada salvo
-- Dirección. Esta migración la rellena por CONVENCIÓN DE NOMBRE: cada rol ↔ el
-- departamento del mismo nombre (misma empresa, sin distinguir mayúsculas/acentos).
--
-- Idempotente: ON CONFLICT DO NOTHING. No borra asignaciones existentes — solo
-- añade las que falten. A partir de aquí, los departamentos de cada rol se
-- gestionan desde Ajustes (esta tabla), no por el nombre del rol.
-- ============================================================

INSERT INTO public.empresa_role_departamentos (rol_id, departamento_id)
SELECT er.id, d.id
FROM public.empresa_roles er
JOIN public.departamentos d
  ON d.empresa_id = er.empresa_id
 AND lower(translate(d.nombre,  'áéíóúÁÉÍÓÚ', 'aeiouaeiou'))
   = lower(translate(er.nombre, 'áéíóúÁÉÍÓÚ', 'aeiouaeiou'))
ON CONFLICT DO NOTHING;
