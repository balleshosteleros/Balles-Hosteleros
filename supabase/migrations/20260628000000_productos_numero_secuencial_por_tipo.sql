-- ============================================================================
-- Productos: numeración secuencial SEPARADA por tipo (compra/venta/elaboración).
--
-- Antes: `productos.numero_secuencial` usaba UN único contador por empresa, de
-- modo que los tres tipos compartían la misma secuencia y los números salían
-- entremezclados.
--
-- Ahora: cada tipo lleva su PROPIA secuencia, empezando en 1 por empresa y por
-- tipo, sin reusar huecos. El ID visible se compone con la inicial del tipo:
--   compra      → C-1, C-2, …
--   venta       → V-1, V-2, …
--   elaboracion → E-1, E-2, …
--
-- El contador vive en `numero_counters` con clave `tabla = 'productos:<tipo>'`.
-- Idempotente: se puede re-ejecutar sin efectos colaterales.
-- ============================================================================

-- 1. Desactivar temporalmente el lock de inmutabilidad para poder renumerar.
ALTER TABLE public.productos DISABLE TRIGGER trg_productos_lock_numero;

-- 2. Quitar ambos índices únicos (el antiguo por empresa y el nuevo por tipo si
--    ya existiera de una ejecución previa) para que la renumeración no choque
--    con colisiones transitorias durante el UPDATE masivo.
DROP INDEX IF EXISTS public.productos_empresa_numero_secuencial_unq;
DROP INDEX IF EXISTS public.productos_empresa_tipo_numero_secuencial_unq;

-- 3. Renumerar: 1..N por (empresa, tipo), orden estable por antigüedad.
WITH ordenados AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id, tipo
      ORDER BY created_at, id
    ) AS rn
  FROM public.productos
  WHERE empresa_id IS NOT NULL
)
UPDATE public.productos p
SET numero_secuencial = o.rn
FROM ordenados o
WHERE p.id = o.id;

-- 4. Índice único por (empresa, tipo, numero_secuencial): los números pueden
--    repetirse ENTRE tipos (C-1, V-1, E-1) pero nunca DENTRO del mismo tipo.
CREATE UNIQUE INDEX productos_empresa_tipo_numero_secuencial_unq
  ON public.productos (empresa_id, tipo, numero_secuencial);

-- 5. Reactivar el lock de inmutabilidad.
ALTER TABLE public.productos ENABLE TRIGGER trg_productos_lock_numero;

-- 6. Función de asignación específica de productos: contador por (empresa, tipo).
CREATE OR REPLACE FUNCTION public.assign_producto_numero_secuencial()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_next INT;
BEGIN
  -- Respeta un valor explícito (p. ej. importaciones que ya lo traen).
  IF NEW.numero_secuencial IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.numero_counters (tabla, empresa_id, ultimo)
  VALUES ('productos:' || NEW.tipo::text, NEW.empresa_id, 1)
  ON CONFLICT (tabla, empresa_id) DO UPDATE
    SET ultimo = public.numero_counters.ultimo + 1
  RETURNING ultimo INTO v_next;

  NEW.numero_secuencial := v_next;
  RETURN NEW;
END;
$function$;

-- Sólo la corre el trigger (paridad con el hardening de migración 094).
REVOKE EXECUTE ON FUNCTION public.assign_producto_numero_secuencial() FROM PUBLIC, anon, authenticated;

-- 7. Reemplazar el trigger de INSERT para que use la función por tipo.
DROP TRIGGER IF EXISTS trg_productos_numero_secuencial ON public.productos;
CREATE TRIGGER trg_productos_numero_secuencial
  BEFORE INSERT ON public.productos
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_producto_numero_secuencial();

-- 8. Sembrar los contadores por tipo a partir del máximo ya asignado.
--    Se elimina la entrada antigua de contador global ('productos').
DELETE FROM public.numero_counters WHERE tabla = 'productos';

INSERT INTO public.numero_counters (tabla, empresa_id, ultimo)
SELECT 'productos:' || tipo::text, empresa_id, MAX(numero_secuencial)
FROM public.productos
WHERE empresa_id IS NOT NULL
GROUP BY tipo, empresa_id
ON CONFLICT (tabla, empresa_id) DO UPDATE
  SET ultimo = GREATEST(public.numero_counters.ultimo, EXCLUDED.ultimo);
