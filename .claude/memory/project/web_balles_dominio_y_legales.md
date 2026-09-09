# Web de BALLES: el dominio, la copia vieja y las tres políticas

Estado a 10-09-2026.

## La web vieja de GoHighLevel ya NO existe en el dominio

`balleshosteleros.com` ya no sirve la web antigua. Responde desde Vercel,
apuntado (en `paginas_web_dominios`, VERIFICADO) a la página **"Web principal"**
de la empresa BALLES. Todas las direcciones de la web vieja (`/home`, `/pro`,
`/vip`, `/sistemas`, `/covermanager`, `/joombo-sistemas`, `/agora`, `/sesame`,
`/gohighlevel`, `/b2com-sistemas`, `/banktrack-365136`, `/revolut-453894`)
devuelven **404**.

**Consecuencia práctica: esas páginas ya no se pueden clonar.** El clonador se
las trae, pero lo que guarda es la página de error: quedan filas con el nombre
`404: This page could not be found.` y ~337 KB de HTML. Si se vuelve a lanzar
`scripts/clonar-web.mjs` contra ese dominio, **comprobar el `nombre` guardado
antes de dar por buena la copia** — el script imprime `✓` igual.

La web nueva está montada **con bloques**, no copiada: `/software` y
`/el-master`, más las tres páginas legales.

## ⚠️ Una página publicada con copia tapa a la web nueva en su ruta

`replicasComoRutas()` (en `next.config.ts`) crea un rewrite para toda página
`PUBLICADA` que conserve `html_replica`. Ese rewrite **gana** sobre el render
normal por bloques.

"Web principal" tiene **cero bloques** y solo la copia vieja, así que la portada
del dominio es hoy la copia, y tapa a la portada nueva. Mientras no haya portada
montada con bloques, **no quitarle la copia**: el dominio se quedaría con `/`
vacío.

Para que una página deje de servir la copia y pase a servir sus bloques hay que
poner a `null` `html_replica` (y `replica_origen_url`, `replica_capturada_at`,
`replica_assets`). Es lo que se hizo con las tres legales.

## Las tres políticas legales

Generadas con el generador del software (`services/textos-legales.ts`), las
mismas que HABANA y BACANAL, y sirviendo ya en el dominio. Ocupaban esos slugs
copias de la web vieja; se sustituyeron y se les limpió `html_replica`.

Los colores salen de Ajustes → Imagen de marca, vía `empresas_web_publica`
(ver [[colores_siempre_de_imagen_de_marca]]).

## Datos de BALLES que faltaban en Ajustes (y por qué importan)

- `correoGerencia` estaba vacío → las políticas salían con
  `[PENDIENTE DE COMPLETAR EN AJUSTES]` en el correo de derechos RGPD.
  Decisión de Iván (09-09-2026): **`balleshosteleros@gmail.com`**.
- `color_secundario` y `color_texto` estaban a `null` (solo había el primario
  `#2563EB`) → sin ellos las páginas públicas caen a los colores por defecto del
  código, que es el fallo que ya le pasó a HABANA. Puestos `#1D4ED8` y
  `#FFFFFF`, en la línea azul del isotipo.
- **`direccionFiscal` / `direccionLocal` llevan SOLO la calle.** Tenían metida la
  dirección entera ("C/ Arte Plateresco, 3, 28905 Getafe (Madrid), España") y en
  las legales salía duplicada, porque `domicilioCompleto()` añade CP, ciudad,
  provincia y país por su cuenta. HABANA y BACANAL guardan solo la calle: ese es
  el criterio.

## Defecto pendiente, común a las tres empresas

El sanitizador (`services/sanitize-html.ts`) no permite `table`/`tr`/`td`, y la
política de privacidad genera una tabla de finalidades y bases jurídicas. El
texto sobrevive pero **sin separación**: sale "Gestionar tu reserva y prestarte
el servicioEjecución de un contrato (art. 6.1.b RGPD)". Pasa igual en BALLES,
HABANA y BACANAL. Arreglarlo obliga a tocar el sanitizador y a regenerar las
nueve páginas.

Aparte: los textos hablan de reservas, comensales y alergias. En un restaurante
encaja; en BALLES (sociedad gestora) no del todo.
