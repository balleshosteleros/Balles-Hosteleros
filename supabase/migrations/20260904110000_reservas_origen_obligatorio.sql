-- Reservas: el ORIGEN es un dato obligatorio.
--
-- Toda reserva entra por un canal real (teléfono, local, web, redes, Google,
-- walk-in…). Hasta ahora `reservas.origen` era `text` nullable y sin
-- normalizar, así que convivían tres problemas:
--   1. Filas con NULL (altas antiguas desde sala, cuando no se preguntaba).
--   2. El mismo canal escrito de dos formas ("telefono" y "TELEFONO"), que en
--      el filtro de Sala aparecía como dos opciones idénticas, cada una
--      filtrando la mitad de las reservas.
--   3. La analítica de origen repartía el mismo canal en varias porciones.
--
-- Esta migración normaliza el histórico a la CLAVE canónica y cierra la puerta
-- con NOT NULL + CHECK de no-vacío. El catálogo sigue siendo ABIERTO (por la
-- columna entran las palabras clave de campaña de Marketing), así que NO se
-- añade un CHECK de valores permitidos: solo se exige que haya canal.
--
-- Idempotente: se puede volver a ejecutar sin efecto.

-- 1. Alias históricos → clave canónica. Coherente con ALIAS en
--    `src/features/sala/data/origenes.ts`: si allí se añade un alias, aquí no
--    hace falta tocar nada (esto solo limpia lo ya escrito).
UPDATE reservas SET origen = upper(trim(origen))
WHERE origen IS NOT NULL AND origen <> upper(trim(origen));

UPDATE reservas SET origen = 'WEB'
WHERE origen IN ('RESERVA_WEB', 'PORTAL_PROPIO', 'WWW', 'MOTOR_WEB', 'MOTOR WEB');

UPDATE reservas SET origen = 'WALKIN'
WHERE origen IN ('WALK_IN', 'WALK-IN', 'WALK IN');

UPDATE reservas SET origen = 'TELEFONO' WHERE origen IN ('TELÉFONO', 'TLF');
UPDATE reservas SET origen = 'INSTAGRAM' WHERE origen = 'IG';
UPDATE reservas SET origen = 'FACEBOOK' WHERE origen = 'FB';
UPDATE reservas SET origen = 'GOOGLE'
WHERE origen IN ('GOOGLE_RWG', 'RESERVE WITH GOOGLE');

-- 2. Filas sin canal. Las que llegaron por Google llevan `external_origen`, así
--    que ese caso se reconstruye con certeza. El resto son altas manuales desde
--    sala anteriores a que el origen fuese obligatorio: el canal por el que
--    entra la inmensa mayoría (y el que el alta propone por defecto) es el
--    teléfono, así que es la única reconstrucción razonable.
UPDATE reservas SET origen = 'WALKIN' WHERE origen IS NULL AND estado = 'WALK_IN';
UPDATE reservas SET origen = 'GOOGLE' WHERE origen IS NULL AND external_origen IS NOT NULL;
UPDATE reservas SET origen = 'TELEFONO' WHERE origen IS NULL OR trim(origen) = '';

-- 3. La puerta se cierra: a partir de aquí no entra ninguna reserva sin canal.
ALTER TABLE reservas ALTER COLUMN origen SET NOT NULL;

ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_origen_no_vacio_chk;
ALTER TABLE reservas ADD CONSTRAINT reservas_origen_no_vacio_chk
  CHECK (trim(origen) <> '');

COMMENT ON COLUMN reservas.origen IS
  'Canal por el que llegó la reserva. OBLIGATORIO. Clave normalizada en MAYÚSCULAS (TELEFONO, LOCAL, WEB, GOOGLE, WALKIN, INSTAGRAM…). Catálogo ABIERTO a propósito: por aquí entran también las palabras clave de los enlaces de campaña de Marketing (reserva_links.palabra_clave). Ver src/features/sala/data/origenes.ts.';
