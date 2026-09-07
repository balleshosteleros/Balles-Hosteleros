-- Arregla los teléfonos que quedaron con el país escrito dos veces.
--
-- "+34 +612345678": el prefijo del selector, y detrás el número que alguien
-- pegó ya con su "+". A ese teléfono no se puede llamar ni mandarle un WhatsApp,
-- y el fallo se colaba porque el validador solo miraba que el PRIMER carácter
-- fuese un "+" y que las últimas nueve cifras cuadrasen.
--
-- La deduplicación no se rompió, porque `bh_normalize_telefono` se queda solo
-- con los dígitos; lo que estaba roto era el número que se ve y con el que se
-- llama.
--
-- Ya arreglado en el origen: `componerTelefono` deja el número en dígitos
-- pelados y quita el país repetido, `separarPrefijo` lo limpia al abrir la
-- ficha, y `validarTelefono` rechaza un segundo "+". Esto es solo el dato que
-- se guardó antes de eso.
--
-- Idempotente.

-- Se conserva el prefijo (lo que va hasta el primer espacio) y del resto se
-- dejan solo los dígitos: "+34 +612345678" → "+34 612345678". No vale un
-- `replace` del "+", que se llevaría también el bueno del principio.
UPDATE public.clientes_sala
SET telefono =
      split_part(telefono, ' ', 1)
      || ' '
      || regexp_replace(
           substr(telefono, length(split_part(telefono, ' ', 1)) + 1),
           '\D', '', 'g'
         )
WHERE telefono ~ '^\+[0-9]+\s.*\+';

-- Y de paso deja un solo espacio entre el prefijo y el número.
UPDATE public.clientes_sala
SET telefono = regexp_replace(btrim(telefono), '\s+', ' ', 'g')
WHERE telefono ~ '\s\s|^\s|\s$';
