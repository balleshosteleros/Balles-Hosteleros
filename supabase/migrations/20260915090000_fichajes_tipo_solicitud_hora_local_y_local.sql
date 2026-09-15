-- ============================================================================
-- Fichajes nacidos de una SOLICITUD: tipo propio, hora correcta y local
-- ----------------------------------------------------------------------------
-- Tres arreglos que van juntos porque afectan a las mismas 43 filas:
--
-- 1) TIPO PROPIO. En el listado de fichajes todos salían como "Fichaje normal",
--    aunque el fichaje no lo hubiera hecho la persona sino una solicitud
--    aprobada. Se añade el tipo canónico SOL ("Fichaje por solicitud") al
--    catálogo `tipos_fichaje`, que ya estaba preparado para él: el motor de
--    fichaje habilita los tipos con `requiere_solicitud` según el subtipo
--    aprobado (EXT ← horas_extras; el resto ← dia_trabajado).
--
--    Colores de los tres, tal y como se piden: normal VERDE, por solicitud AZUL,
--    horas extras ROJO. Son la clave de paleta, no clases; siguen siendo
--    editables en RRHH → Horarios → Tipos de fichaje.
--
-- 2) HORA MAL GUARDADA. `materializarFichajeDeSolicitud` construía el instante
--    como texto sin zona ("2026-09-12T00:00:00"). Postgres lo interpreta en la
--    zona de la sesión (UTC en producción), así que las 00:00 de la solicitud se
--    guardaban como 00:00 UTC = 02:00 en Madrid. Todos los fichajes por
--    solicitud estaban desplazados +2 h (+1 h en invierno). Se recalcula el
--    instante desde la solicitud usando la zona horaria de la EMPRESA.
--
-- 3) SIN LOCAL. Estos fichajes se insertaban sin `local_id`, y por eso el
--    listado enseñaba "—" en la columna Local. Se rellena con el local del
--    empleado (`empleados.local_id`), que es de donde sale en los demás.
--
-- Idempotente: se puede volver a aplicar sin efecto.
-- ============================================================================

-- ─── 1) Catálogo: tipo SOL + colores de los tres ───────────────────────────

CREATE OR REPLACE FUNCTION public.seed_tipos_fichaje_default(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.tipos_fichaje
    (empresa_id, nombre, codigo, descripcion, computa_tiempo, orden, activo,
     color, requiere_solicitud)
  VALUES
    (p_empresa_id, 'Fichaje normal',        'NOR', 'Jornada ordinaria',
       true, 1, true, 'emerald', false),
    (p_empresa_id, 'Fichaje por solicitud', 'SOL', 'Día trabajado con solicitud aprobada',
       true, 2, true, 'blue',    true),
    (p_empresa_id, 'Fichaje horas extras',  'EXT', 'Horas trabajadas fuera de jornada',
       true, 3, true, 'red',     true)
  ON CONFLICT (empresa_id, upper(codigo)) DO NOTHING;
END;
$$;

-- Empresas existentes: que tengan las tres.
DO $$
DECLARE e RECORD;
BEGIN
  FOR e IN SELECT id FROM public.empresas LOOP
    PERFORM public.seed_tipos_fichaje_default(e.id);
  END LOOP;
END;
$$;

-- Colores pedidos. Solo se tocan los que siguen con el color de fábrica
-- anterior ('sky' el normal, 'orange' las extras): si alguien ya le ha puesto
-- otro color a mano desde Ajustes, se respeta.
UPDATE public.tipos_fichaje SET color = 'emerald'
 WHERE upper(codigo) = 'NOR' AND color = 'sky';
UPDATE public.tipos_fichaje SET color = 'red'
 WHERE upper(codigo) = 'EXT' AND color = 'orange';
UPDATE public.tipos_fichaje SET orden = 3
 WHERE upper(codigo) = 'EXT' AND orden = 2;

-- ─── 2) Fichajes por solicitud: tipo, hora e instante correctos ────────────

-- 2a bis) `fichajes.tipo` lleva un CHECK con la lista de códigos admitidos.
--         Hay que abrirle la puerta a SOL antes de escribir nada.
ALTER TABLE public.fichajes DROP CONSTRAINT IF EXISTS fichajes_tipo_check;
ALTER TABLE public.fichajes
  ADD CONSTRAINT fichajes_tipo_check
  CHECK (tipo = ANY (ARRAY['ENT','SAL','IPA','FPA','MAN','COR','VAL','NOR','SOL','EXT']));

-- 2a) Los de día trabajado pasan a SOL (las horas extras siguen en EXT).
UPDATE public.fichajes f
   SET tipo = 'SOL'
  FROM public.solicitudes_personal s
 WHERE s.id = f.solicitud_id
   AND s.subtipo = 'dia_trabajado'
   AND upper(f.tipo) = 'NOR';

-- 2b) Instante real a partir de la solicitud, en la zona de la empresa.
--     El tramo que cruza medianoche sale al día siguiente.
UPDATE public.fichajes f
   SET hora_entrada = ((f.fecha::timestamp + s.hora_inicio) AT TIME ZONE tz.zona),
       hora_salida  = ((f.fecha::timestamp
                          + CASE WHEN s.hora_fin <= s.hora_inicio
                                 THEN interval '1 day' ELSE interval '0' END
                          + s.hora_fin) AT TIME ZONE tz.zona)
  FROM public.solicitudes_personal s
  JOIN public.empresas e ON e.id = s.empresa_id
  CROSS JOIN LATERAL (
    SELECT COALESCE(NULLIF(trim(e.config_operativa->>'zonaHoraria'), ''), 'Europe/Madrid') AS zona
  ) tz
 WHERE s.id = f.solicitud_id
   AND s.hora_inicio IS NOT NULL
   AND s.hora_fin IS NOT NULL
   AND (
     f.hora_entrada IS DISTINCT FROM ((f.fecha::timestamp + s.hora_inicio) AT TIME ZONE tz.zona)
     OR f.hora_salida IS DISTINCT FROM ((f.fecha::timestamp
                          + CASE WHEN s.hora_fin <= s.hora_inicio
                                 THEN interval '1 day' ELSE interval '0' END
                          + s.hora_fin) AT TIME ZONE tz.zona)
   );

-- ─── 3) Local del empleado en los fichajes que nacieron sin él ─────────────

UPDATE public.fichajes f
   SET local_id = emp.local_id
  FROM public.empleados emp
 WHERE f.local_id IS NULL
   AND emp.user_id = f.empleado_id
   AND emp.empresa_id = f.empresa_id
   AND emp.local_id IS NOT NULL;
