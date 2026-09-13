/**
 * Iconos de marca de cualquier empresa, generados al vuelo desde su isotipo.
 *
 * Salen DOS piezas del mismo dibujo, porque van a sitios distintos:
 *
 * - `iconoCircular` → la PESTAÑA del navegador y los marcadores. El navegador
 *   pinta el favicon tal cual: no lo recorta ni lo redondea. Por eso el isotipo
 *   de Balles —un cuadrado azul— salía con las esquinas en pico al lado de los
 *   iconos redondos del resto de webs (Iván, 08-09-2026: "que el favicon de
 *   todos los sitios salga en redondo"). Si lo queremos redondo, hay que
 *   entregarlo ya redondo, con las esquinas transparentes.
 *
 * - `iconoCuadrado` → el icono de APP: la pantalla de inicio del iPhone
 *   (`apple-touch-icon`) y el manifest. Ahí el sistema aplica SU PROPIA máscara
 *   y el icono tiene que llegar CUADRADO y de borde a borde. Un icono redondo
 *   llega como un disco metido en un cuadrado, y iOS rellena lo transparente de
 *   blanco: es lo que le pasaba a la web de Balles (círculo azul flotando en un
 *   cuadro blanco) y a la de BACANAL (calavera dorada sobre blanco, cuando su
 *   favicon es negro). Este es el mismo dibujo que el favicon, pero SIN recorte
 *   circular: el fondo llega hasta el borde.
 *
 * DOS CASOS, PORQUE NO TODOS LOS ISOTIPOS SON IGUALES:
 * 1. Isotipo CON fondo propio (Balles: cuadrado azul de borde a borde). Se usa
 *    tal cual; el círculo, cuando toca, se lleva las esquinas.
 * 2. Isotipo SIN fondo (BACANAL, HABANA: dibujo suelto sobre transparente). Se
 *    le pone un fondo NEGRO detrás y el dibujo encima, centrado y con aire.
 *
 * EL COLOR DEL DIBUJO NO PUEDE SER CIEGAMENTE EL DE LA MARCA:
 * el isotipo de HABANA es rosa y su color de marca también (#E62E90): un fondo
 * rosa con un dibujo rosa encima es un icono invisible (contraste 1,21 cuando
 * el mínimo legible es 3). Por eso se mide si el dibujo se ve sobre el negro y
 * sólo se repinta cuando hace falta. Vale para cualquier empresa futura sin
 * tocar código.
 */

/** Lado del favicon. 256 px llega para pestaña, marcador y retina. */
const LADO = 256;

/** Lado del icono de app. iOS pide 180; 512 va sobrado y sirve al manifest. */
const LADO_APP = 512;

/** Parte del lienzo que ocupa un dibujo suelto dentro del favicon redondo. */
const OCUPACION_DIBUJO = 0.62;

/**
 * Lo mismo en el icono de app. Es mayor porque aquí el lienzo es cuadrado y no
 * un círculo inscrito: con 0,62 el dibujo se quedaba pequeño y perdido.
 */
const OCUPACION_DIBUJO_APP = 0.72;

/**
 * El isotipo de Balles es un degradado CON RUIDO, y un PNG de 24 bits con ruido
 * no comprime: el icono de app se iba a 725 KB para un dibujo de 512 px. Con
 * paleta indexada baja a la décima parte y a este tamaño no se distingue.
 */
const COMPRESION = { compressionLevel: 9, palette: true } as const;

type RGB = [number, number, number];

/** `#RRGGBB` → RGB. Devuelve `null` si no es un hex válido. */
export function hexARgb(hex: string | null | undefined): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Máscara circular del tamaño pedido: blanco dentro, transparente fuera. */
function discoSvg(lado: number, relleno: string): Buffer {
  const r = lado / 2;
  return Buffer.from(
    `<svg width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">` +
      `<circle cx="${r}" cy="${r}" r="${r}" fill="${relleno}"/></svg>`,
  );
}

/** Lienzo cuadrado de un color, para el icono de app. */
function lienzoSvg(lado: number, relleno: string): Buffer {
  return Buffer.from(
    `<svg width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">` +
      `<rect width="${lado}" height="${lado}" fill="${relleno}"/></svg>`,
  );
}

/**
 * Genera el icono, redondo o cuadrado según `circular`.
 *
 * Devuelve `null` si no se ha podido generar (imagen que no responde, formato
 * raro, `sharp` que no carga en el servidor...). NUNCA lanza: quien llama se
 * cae al icono original, que es lo que había antes.
 */
async function componerIcono(
  origen: string,
  colorMarca: string | null | undefined,
  circular: boolean,
): Promise<Buffer | null> {
  try {
    // `sharp` es un binario nativo y se importa AQUÍ DENTRO a propósito: con
    // import estático, un fallo suyo en el servidor tumbaría la ruta entera.
    const { default: sharp } = await import("sharp");

    const lado = circular ? LADO : LADO_APP;
    const ocupacion = circular ? OCUPACION_DIBUJO : OCUPACION_DIBUJO_APP;

    const respuesta = await fetch(origen, { signal: AbortSignal.timeout(8000) });
    if (!respuesta.ok) return null;
    const original = Buffer.from(await respuesta.arrayBuffer());

    // ¿Trae fondo propio? Se miran las cuatro esquinas del lienzo: si están
    // pintadas, la imagen llega de borde a borde y se usa tal cual.
    const { data, info } = await sharp(original)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: an, height: al, channels: ca } = info;
    const alfa = (x: number, y: number) => data[(y * an + x) * ca + 3];
    const conFondo =
      alfa(1, 1) > 200 &&
      alfa(an - 2, 1) > 200 &&
      alfa(1, al - 2) > 200 &&
      alfa(an - 2, al - 2) > 200;

    if (conFondo) {
      // Se cuadra primero (`cover`) para que un rectángulo no salga aplastado.
      const cuadrado = await sharp(original)
        .resize(lado, lado, { fit: "cover", position: "centre" })
        .png(COMPRESION)
        .toBuffer();
      if (!circular) return cuadrado;
      return await sharp(cuadrado)
        .composite([{ input: discoSvg(lado, "#fff"), blend: "dest-in" }])
        .png(COMPRESION)
        .toBuffer();
    }

    // Dibujo suelto: va sobre fondo NEGRO, repintado con el color de la marca
    // sólo si en negro no se vería. `trim` quita el aire transparente que trae
    // el archivo: así el dibujo va centrado de verdad y no descolocado por un
    // margen desigual (el isotipo de BACANAL ocupaba 59% de ancho y 81% de alto).
    const ladoDibujo = Math.round(lado * ocupacion);
    const silueta = await sharp(original)
      .trim({ threshold: 10 })
      .resize(ladoDibujo, ladoDibujo, {
        fit: "inside",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // ¿Se ve el dibujo tal cual sobre el negro? Se mira lo claro que es de
    // media. El isotipo de BACANAL en negro no se vería y hay que repintarlo;
    // el mismo dibujo en su dorado oficial se ve perfecto y se deja INTACTO,
    // con su degradado, que un dorado plano lo empobrece.
    const pixeles = Buffer.from(silueta.data);
    const canales = silueta.info.channels;
    let claridad = 0;
    let pintados = 0;
    for (let i = 0; i < pixeles.length; i += canales) {
      if (pixeles[i + 3] > 180) {
        claridad += (pixeles[i] + pixeles[i + 1] + pixeles[i + 2]) / 3;
        pintados++;
      }
    }
    const seVeSobreNegro = pintados > 0 && claridad / pintados > 90;

    if (!seVeSobreNegro) {
      // Se conserva la SILUETA (el canal alfa) y se tira el color de origen: el
      // dibujo sale entero del color de la marca. Blanco si la empresa todavía
      // no tiene color guardado, que negro sobre negro no se vería.
      const tinta = hexARgb(colorMarca) ?? [255, 255, 255];
      for (let i = 0; i < pixeles.length; i += canales) {
        pixeles[i] = tinta[0];
        pixeles[i + 1] = tinta[1];
        pixeles[i + 2] = tinta[2];
      }
    }

    const dibujo = await sharp(pixeles, {
      raw: { width: silueta.info.width, height: silueta.info.height, channels: 4 },
    })
      .png()
      .toBuffer();

    const fondo = circular ? discoSvg(lado, "#000") : lienzoSvg(lado, "#000");
    return await sharp(fondo)
      .composite([{ input: dibujo, gravity: "centre" }])
      .png(COMPRESION)
      .toBuffer();
  } catch (e) {
    // Quien llama se cae al icono sin recortar, así que el fallo no rompe nada
    // visible... y por eso mismo hay que dejarlo escrito: la primera vez esto
    // salió cuadrado en producción y bien en local (`sharp` sin declarar como
    // paquete externo) sin una sola línea en los registros que lo delatara.
    console.error("[favicon] no se pudo generar el icono de marca:", e);
    return null;
  }
}

/** Favicon REDONDO para la pestaña del navegador y los marcadores. */
export async function iconoCircular(
  origen: string,
  colorMarca?: string | null,
): Promise<Buffer | null> {
  return componerIcono(origen, colorMarca, true);
}

/**
 * Icono de APP (pantalla de inicio del móvil): mismo dibujo, CUADRADO y de
 * borde a borde, que la máscara la pone el sistema.
 */
export async function iconoCuadrado(
  origen: string,
  colorMarca?: string | null,
): Promise<Buffer | null> {
  return componerIcono(origen, colorMarca, false);
}

export const LADO_ICONO = LADO;
export const LADO_ICONO_APP = LADO_APP;
