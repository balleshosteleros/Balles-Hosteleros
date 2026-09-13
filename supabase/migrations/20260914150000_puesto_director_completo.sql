-- El puesto DIRECTOR, completo en las dos sociedades.
--
-- Las condiciones del puesto son la PLANTILLA que se copia a la ficha de quien
-- se contrate para él (`empleado_condiciones` → contrato → gestoría). Estaban a
-- 3.000 € y 40 h, y sobre todo SIN HORARIO: el campo obligatorio que faltaba.
--
--   • Horario  → el patrón DIRECTOR de cada empresa (familia, no versión: si en
--                Horarios se crea una versión nueva, el puesto sigue la vigente)
--   • Jornada, horas/semana y días libres NO se teclean: salen de ese horario
--     (5 días × 4 h = 20 h → Parcial, 2 días libres)
--   • Salario  → 1.000 € brutos/mes, 11,5385 €/h
--
-- Idempotente.

-- ─── 1. Los patrones del director dejan de ser plantilla propia del puesto ──
-- Un patrón con `puesto_id` es una plantilla legacy y queda FUERA del selector
-- de horarios del puesto. Se les quita para que sean patrones normales del
-- catálogo de Horarios, que es de donde el puesto elige (modelo vigente).
update rrhh_patrones
   set puesto_id  = null,
       updated_at = now()
 where id in ('d1000000-0000-0000-0000-000000000001',
              'd1000000-0000-0000-0000-000000000002');

-- ─── 2. Condiciones del puesto ─────────────────────────────────────────────
-- BACANAL
update puesto_salarios
   set patron_familia_id = 'd1000000-0000-0000-0000-000000000001',
       salario_bruto     = 1000,
       modo_pago         = 'MENSUAL',
       coste_hora        = round(1000 / (20 * 52 / 12.0), 4),
       jornada_contrato  = 'Parcial',
       horas_semanales   = 20,
       dias_libres       = 2,
       vacaciones        = '30 días',
       updated_at        = now()
 where puesto_id = 'e1873789-a8e8-4415-ae3c-4baebd741a81';

-- HABANA
update puesto_salarios
   set patron_familia_id = 'd1000000-0000-0000-0000-000000000002',
       salario_bruto     = 1000,
       modo_pago         = 'MENSUAL',
       coste_hora        = round(1000 / (20 * 52 / 12.0), 4),
       jornada_contrato  = 'Parcial',
       horas_semanales   = 20,
       dias_libres       = 2,
       vacaciones        = '30 días',
       updated_at        = now()
 where puesto_id = '3e09df9f-823c-4c6a-b03b-21a7bfb56e55';
