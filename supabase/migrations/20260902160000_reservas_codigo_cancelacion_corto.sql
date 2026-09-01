-- PRP-083 (Fase 3) — Código corto de cancelación, para que el enlace quepa en
-- un SMS.
--
-- El enlace con el token UUID ocupa 76 caracteres y deja los avisos por encima
-- de los 160 de un SMS, que es donde el precio se dobla. Con un código de 8
-- caracteres el enlace baja a ~44 y el mensaje cabe en uno solo.
--
-- No sustituye a `cancelacion_token`: los correos siguen usándolo y ambos
-- llevan a la misma pantalla. Este es el atajo para los canales que pagan por
-- carácter.
--
-- 8 caracteres de un alfabeto de 32 son ~10^12 combinaciones: adivinar uno a
-- base de probar no es viable, y además la pantalla solo permite cancelar, no
-- ver datos ajenos.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS cancelacion_codigo TEXT;

-- Único donde existe. Parcial porque las reservas viejas no lo tienen y no hay
-- por qué rellenarlas: solo se genera cuando hace falta enviar un mensaje.
CREATE UNIQUE INDEX IF NOT EXISTS reservas_cancelacion_codigo_uidx
  ON public.reservas (cancelacion_codigo)
  WHERE cancelacion_codigo IS NOT NULL;

COMMENT ON COLUMN public.reservas.cancelacion_codigo IS
  'Código corto para el enlace de cancelar en SMS y WhatsApp. Equivale a cancelacion_token.';

-- Genera el código la primera vez que se pide y lo devuelve. Si ya existe, lo
-- devuelve tal cual: el enlace de una reserva no puede cambiar entre un aviso
-- y el siguiente, o el cliente se encontraría un enlace muerto.
CREATE OR REPLACE FUNCTION public.codigo_cancelacion_reserva(p_reserva_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_codigo TEXT;
  v_intento INT := 0;
BEGIN
  SELECT cancelacion_codigo INTO v_codigo
    FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;

  IF v_codigo IS NOT NULL THEN
    RETURN v_codigo;
  END IF;

  -- Alfabeto sin 0/O ni 1/I/L: quien teclee el código a mano no puede
  -- equivocarse entre caracteres que se parecen.
  LOOP
    v_intento := v_intento + 1;
    v_codigo := (
      SELECT string_agg(
        substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ',
               (floor(random() * 31) + 1)::int, 1), '')
        FROM generate_series(1, 8)
    );

    BEGIN
      UPDATE public.reservas
         SET cancelacion_codigo = v_codigo
       WHERE id = p_reserva_id;
      RETURN v_codigo;
    EXCEPTION WHEN unique_violation THEN
      -- Colisión: se vuelve a intentar. Con 10^12 combinaciones no debería
      -- pasar nunca, pero si pasara no se puede devolver un código de otro.
      IF v_intento >= 5 THEN
        RAISE EXCEPTION 'NO_SE_PUDO_GENERAR_CODIGO' USING ERRCODE = 'P0001';
      END IF;
    END;
  END LOOP;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.codigo_cancelacion_reserva(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.codigo_cancelacion_reserva(UUID) TO service_role;
