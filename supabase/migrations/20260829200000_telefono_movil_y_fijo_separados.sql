-- Movil y fijo separados: el boton de WhatsApp deja de adivinarse.
--
-- Antes habia un solo campo de telefono y el boton de WhatsApp se deducia
-- mirando si el numero empezaba por 6 o 7. Funcionaba, pero adivinar no es
-- saber: un movil extranjero se quedaba fuera y un fijo mal escrito podia
-- colarse. Ahora el dato manda: lo que este en movil lleva WhatsApp, lo que
-- este en fijo solo llama.
--
-- En proveedores NO se crean columnas: ya existian `telefono_secundario` y
-- `telefono_comercial` sin usar (0 de 67 rellenas), asi que el fijo va al
-- secundario en vez de anadir una columna mas.
--
-- El reparto respeta lo que ya habia escrito: varios proveedores traian los
-- dos numeros juntos en el mismo campo ("914842079 - 678843998"), y esos se
-- separan cada uno a su sitio.

-- ── 1. Agenda: columna para el fijo ──────────────────────────────────────────
ALTER TABLE public.contactos_agenda
  ADD COLUMN IF NOT EXISTS telefono_fijo text;

COMMENT ON COLUMN public.contactos_agenda.telefono IS
  'Movil. Lleva boton de llamar y de WhatsApp.';
COMMENT ON COLUMN public.contactos_agenda.telefono_fijo IS
  'Fijo (o cualquier numero sin WhatsApp: 112, 091...). Solo boton de llamar.';

-- ── 2. Proveedores: principal = movil, secundario = fijo ─────────────────────
WITH p AS (
  SELECT id,
    (SELECT m[1] FROM regexp_matches(
       regexp_replace(COALESCE(telefono_principal,''),'[^0-9/;,\- ]','','g'),
       '(?:^|[^0-9])(?:34)?([67][0-9]{8})(?:[^0-9]|$)') AS m LIMIT 1) AS movil,
    (SELECT m[1] FROM regexp_matches(
       regexp_replace(COALESCE(telefono_principal,''),'[^0-9/;,\- ]','','g'),
       '(?:^|[^0-9])(?:34)?([89][0-9]{8})(?:[^0-9]|$)') AS m LIMIT 1) AS fijo
  FROM public.proveedores
)
UPDATE public.proveedores pr
SET telefono_principal  = p.movil,
    telefono_secundario = COALESCE(NULLIF(pr.telefono_secundario,''), p.fijo)
FROM p
WHERE pr.id = p.id
  AND (p.movil IS NOT NULL OR p.fijo IS NOT NULL)
  -- Solo cuando hay algo que separar: si el principal ya era un movil limpio
  -- y no hay fijo, se deja como esta.
  AND (p.fijo IS NOT NULL OR pr.telefono_principal <> p.movil);

-- Principal que resulto ser un fijo (sin movil ninguno): baja al secundario.
UPDATE public.proveedores
SET telefono_secundario = COALESCE(NULLIF(telefono_secundario,''), telefono_principal),
    telefono_principal  = NULL
WHERE regexp_replace(COALESCE(telefono_principal,''),'[^0-9]','','g') ~ '^(34)?[89][0-9]{8}$';

COMMENT ON COLUMN public.proveedores.telefono_principal IS
  'Movil de contacto. Lleva boton de llamar y de WhatsApp.';
COMMENT ON COLUMN public.proveedores.telefono_secundario IS
  'Fijo del almacen / centralita. Solo boton de llamar.';

-- ── 3. Agenda: repartir lo que ya habia ──────────────────────────────────────
WITH c AS (
  SELECT id,
    (SELECT m[1] FROM regexp_matches(
       regexp_replace(COALESCE(telefono,''),'[^0-9/;,\- ]','','g'),
       '(?:^|[^0-9])(?:34)?([67][0-9]{8})(?:[^0-9]|$)') AS m LIMIT 1) AS movil,
    (SELECT m[1] FROM regexp_matches(
       regexp_replace(COALESCE(telefono,''),'[^0-9/;,\- ]','','g'),
       '(?:^|[^0-9])(?:34)?([89][0-9]{8})(?:[^0-9]|$)') AS m LIMIT 1) AS fijo
  FROM public.contactos_agenda
)
UPDATE public.contactos_agenda ca
SET telefono      = c.movil,
    telefono_fijo = COALESCE(NULLIF(ca.telefono_fijo,''), c.fijo)
FROM c
WHERE ca.id = c.id
  AND (c.movil IS NOT NULL OR c.fijo IS NOT NULL);

-- Sin movil pero con fijo: el numero se va entero a la columna del fijo.
UPDATE public.contactos_agenda
SET telefono_fijo = COALESCE(NULLIF(telefono_fijo,''), telefono),
    telefono      = NULL
WHERE telefono IS NOT NULL
  AND regexp_replace(telefono,'[^0-9]','','g') ~ '^(34)?[89][0-9]{8}$';

-- Los cortos de emergencia (112, 091, 080...) tampoco tienen WhatsApp:
-- van al campo de fijo, que es el que solo ofrece llamar.
UPDATE public.contactos_agenda
SET telefono_fijo = COALESCE(NULLIF(telefono_fijo,''), telefono),
    telefono      = NULL
WHERE categoria = 'emergencias' AND telefono IS NOT NULL;
