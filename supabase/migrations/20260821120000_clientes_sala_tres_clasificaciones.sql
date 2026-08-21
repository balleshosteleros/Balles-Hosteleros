-- Clasificación de clientes de sala: solo NUEVO, REGULAR y VIP.
--
-- POR QUÉ: había cinco categorías y dos sobraban. FRECUENTE se solapaba con
-- REGULAR sin que nadie supiera dónde estaba la frontera, e INACTIVO era la
-- única que se ponía a mano, así que dependía de quién se acordara de marcarla.
--
-- Además la clasificación deja de poder fijarse a mano: se calcula siempre por
-- visitas (NUEVO 0-1 · REGULAR 2-4 · VIP 5+). `clasificacion_manual` se queda
-- en la tabla pero ya no se lee; no se borra para no perder el rastro de qué
-- fichas se habían tocado a mano.

-- 1) Los que ya eran FRECUENTE o INACTIVO se recolocan por sus visitas reales,
--    que es lo que hará el cálculo de ahora en adelante. Se hace ANTES de
--    cambiar el CHECK, o la propia UPDATE lo violaría.
UPDATE clientes_sala
SET clasificacion = CASE
      WHEN COALESCE(visitas, 0) >= 5 THEN 'VIP'
      WHEN COALESCE(visitas, 0) >= 2 THEN 'REGULAR'
      ELSE 'NUEVO'
    END,
    updated_at = now()
WHERE clasificacion IN ('FRECUENTE', 'INACTIVO');

-- 2) El CHECK deja de admitir las dos categorías retiradas.
ALTER TABLE clientes_sala
  DROP CONSTRAINT IF EXISTS clientes_sala_clasificacion_check;

ALTER TABLE clientes_sala
  ADD CONSTRAINT clientes_sala_clasificacion_check
  CHECK (clasificacion IN ('NUEVO', 'REGULAR', 'VIP'));

COMMENT ON COLUMN clientes_sala.clasificacion IS
  'Calculada por visitas: NUEVO 0-1, REGULAR 2-4, VIP 5+. No editable a mano.';

COMMENT ON COLUMN clientes_sala.clasificacion_manual IS
  'OBSOLETA: se conserva como rastro de las fichas que se fijaron a mano '
  'cuando eso era posible. El código ya no la lee.';

-- 3) Umbral de VIP a 5 visitas. Estaba en 10 porque FRECUENTE ocupaba el tramo
--    intermedio; sin ella, dejarlo en 10 dejaría a REGULAR cubriendo de 2 a 9.
UPDATE empresa_reservas_config
SET clasif_vip_min = 5
WHERE clasif_vip_min IS DISTINCT FROM 5;

-- 4) El umbral de FRECUENTE ya no tiene consumidor.
ALTER TABLE empresa_reservas_config
  DROP COLUMN IF EXISTS clasif_frecuente_min;
