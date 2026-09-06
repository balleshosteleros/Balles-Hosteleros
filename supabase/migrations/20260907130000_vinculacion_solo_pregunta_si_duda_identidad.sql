-- Vinculación de reservas: preguntar sólo cuando puede ser OTRA persona.
--
-- La regla vieja abría un aviso ante cualquier diferencia con la ficha, y el
-- 75 % se cerraba con "dejar la ficha": el cliente había escrito "Gil" donde su
-- ficha decía "Gil Garcia". Preguntar eso no protege nada y entrena a quien
-- está en sala a pulsar sin leer, que es lo que hace peligroso el aviso que sí
-- importa.
--
-- La regla nueva (`decidirVinculacion()` en el código) sólo pregunta cuando el
-- enganche fue por TELÉFONO y el correo es otro: el móvil compartido. Un correo
-- es personal; quien lo repite es él.
--
-- Esto cierra los avisos YA pendientes que la regla nueva no habría abierto.
-- Se marcan CONSERVADA, que es lo que se habría decidido, y queda la línea en
-- la actividad del cliente para no perder con qué datos reservó.
--
-- Idempotente: sólo toca filas PENDIENTE, y al terminar ya no lo son.

DO $$
DECLARE
  r RECORD;
  v_partes text[];
  v_motivo text;
BEGIN
  FOR r IN
    SELECT id, empresa_id, cliente_id, datos_declarados, vinculacion_motivo
    FROM public.reservas
    WHERE vinculacion_estado = 'PENDIENTE'
      AND datos_declarados IS NOT NULL
      -- Se queda pendiente sólo la duda real: enganchó por teléfono y trae
      -- otro correo. Todo lo demás lo resuelve la ficha.
      AND NOT (
        coalesce(vinculacion_motivo, 'telefono') = 'telefono'
        AND datos_declarados ? 'email'
      )
  LOOP
    v_partes := ARRAY[]::text[];
    IF btrim(coalesce(r.datos_declarados->>'nombre', '') || ' ' ||
             coalesce(r.datos_declarados->>'apellidos', '')) <> '' THEN
      v_partes := array_append(
        v_partes,
        btrim(coalesce(r.datos_declarados->>'nombre', '') || ' ' ||
              coalesce(r.datos_declarados->>'apellidos', ''))
      );
    END IF;
    IF r.datos_declarados ? 'email' THEN
      v_partes := array_append(v_partes, r.datos_declarados->>'email');
    END IF;
    IF r.datos_declarados ? 'telefono' THEN
      v_partes := array_append(v_partes, r.datos_declarados->>'telefono');
    END IF;

    v_motivo := CASE WHEN r.vinculacion_motivo = 'email' THEN 'correo' ELSE 'teléfono' END;

    IF r.cliente_id IS NOT NULL AND array_length(v_partes, 1) > 0 THEN
      INSERT INTO public.cliente_historial (
        empresa_id, cliente_id, campo, valor_anterior, valor_nuevo, origen
      ) VALUES (
        r.empresa_id,
        r.cliente_id,
        'revision',
        NULL,
        'Reservó con otros datos: ' || array_to_string(v_partes, ' · ') ||
        '. Coincidió por ' || v_motivo || ', así que se conservaron los de la ficha.',
        'AUTOMATICO'
      );
    END IF;

    UPDATE public.reservas
    SET vinculacion_estado = 'CONSERVADA',
        datos_declarados = NULL
    WHERE id = r.id;
  END LOOP;
END $$;
