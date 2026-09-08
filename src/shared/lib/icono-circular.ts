/**
 * Recorta un isotipo en CÍRCULO para usarlo como favicon.
 *
 * POR QUÉ HACE FALTA:
 * El navegador pinta el favicon tal cual se lo damos: no lo recorta ni lo
 * redondea. Por eso el isotipo de Balles —un cuadrado azul— salía como un
 * cuadrado azul con esquinas en pico en la pestaña y en los marcadores, al lado
 * de iconos redondos del resto de webs (Iván, 08-09-2026: "que el favicon de
 * todos los sitios salga en redondo"). Si lo queremos redondo, hay que
 * entregarlo ya redondo, con las esquinas transparentes.
 *
 * DOS CASOS, PORQUE NO TODOS LOS ISOTIPOS SON IGUALES:
 * 1. Isotipo CON fondo propio (Balles: cuadrado azul de borde a borde). Basta
 *    con recortar el círculo sobre la imagen: sale un disco azul limpio.
 * 2. Isotipo SIN fondo (BACANAL, HABANA: dibujo suelto sobre transparente).
 *    Recortarlo no cambiaría nada —no hay esquinas que quitar—, así que se le
 *    pone un disco de color detrás y el dibujo encima, centrado y con aire.
 *
 * EL COLOR DEL DISCO NO PUEDE SER CIEGAMENTE EL DE LA MARCA:
 * el isotipo de HABANA es rosa y su color de marca también (#E62E90): un disco
 * rosa con un dibujo rosa encima es un icono invisible (contraste 1,21 cuando
 * el mínimo legible es 3). Por eso se mide el contraste real entre el dibujo y
 * el color de la empresa, y si no llega se cae a blanco o negro —el que más
 * contraste dé—. Vale para cualquier empresa futura sin tocar código.
 *
 * NO TOCA EL ICONO DE iOS NI EL DEL MANIFEST: la pantalla de inicio de iPhone y
 * Android aplican SU PROPIA máscara sobre un icono cuadrado, y iOS además pinta
 * de negro lo transparente. Ahí el icono sigue siendo cuadrado con margen, como
 * manda la norma de siempre. Esto es solo para la pestaña del navegador.
 */

/** Lado del PNG que se devuelve. 256 px llega para pestaña, marcador y retina. */
const LADO = 256;

/** Parte del diámetro que ocupa un dibujo suelto dentro del disco. */
const OCUPACION_DIBUJO = 0.62;

/** Contraste mínimo para dar por legible el dibujo sobre el disco. */
const CONTRASTE_MINIMO = 3;

type RGB = [number, number, number];

/** Luminancia relativa (WCAG), para poder comparar contrastes de verdad. */
function luminancia([r, g, b]: RGB): number {
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razón de contraste WCAG entre dos colores: 1 = idénticos, 21 = negro/blanco. */
function contraste(a: RGB, b: RGB): number {
  const [l1, l2] = [luminancia(a), luminancia(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

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

/**
 * Devuelve el PNG circular, o `null` si no se ha podido generar (imagen que no
 * responde, formato raro, `sharp` que no carga en el servidor...).
 *
 * NUNCA lanza: quien llama se cae al icono original, que es lo que había antes.
 */
export async function iconoCircular(
  origen: string,
  colorMarca?: string | null,
): Promise<Buffer | null> {
  try {
    // `sharp` es un binario nativo y se importa AQUÍ DENTRO a propósito: con
    // import estático, un fallo suyo en el servidor tumbaría la ruta entera.
    const { default: sharp } = await import("sharp");

    const respuesta = await fetch(origen, { signal: AbortSignal.timeout(8000) });
    if (!respuesta.ok) return null;
    const original = Buffer.from(await respuesta.arrayBuffer());

    // ¿Trae fondo propio? Se miran las cuatro esquinas del lienzo: si están
    // pintadas, la imagen llega de borde a borde y el círculo se recorta sobre
    // ella tal cual.
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
      // Se cuadra primero (`cover`) para que un rectángulo no salga aplastado,
      // y luego el círculo se lleva las esquinas.
      const cuadrado = await sharp(original)
        .resize(LADO, LADO, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
      return await sharp(cuadrado)
        .composite([{ input: discoSvg(LADO, "#fff"), blend: "dest-in" }])
        .png()
        .toBuffer();
    }

    // Dibujo suelto: hace falta un disco detrás. El color sale de la marca,
    // salvo que el dibujo se pierda encima.
    let medio: RGB = [0, 0, 0];
    const suma = [0, 0, 0];
    let pintados = 0;
    for (let i = 0; i < an * al; i++) {
      if (data[i * ca + 3] > 180) {
        suma[0] += data[i * ca];
        suma[1] += data[i * ca + 1];
        suma[2] += data[i * ca + 2];
        pintados++;
      }
    }
    if (pintados > 0) {
      medio = [
        Math.round(suma[0] / pintados),
        Math.round(suma[1] / pintados),
        Math.round(suma[2] / pintados),
      ];
    }

    const marca = hexARgb(colorMarca);
    let fondo: RGB = marca ?? [255, 255, 255];
    if (!marca || contraste(medio, marca) < CONTRASTE_MINIMO) {
      // El color de la empresa no deja ver el dibujo (o no lo hay todavía):
      // blanco o negro, el que más lo destaque.
      fondo =
        contraste(medio, [255, 255, 255]) >= contraste(medio, [0, 0, 0])
          ? [255, 255, 255]
          : [0, 0, 0];
    }

    // `trim` quita el aire transparente que trae el archivo: así el dibujo va
    // centrado de verdad en el disco y no descolocado por un margen desigual
    // (el isotipo de BACANAL ocupaba 59% de ancho y 81% de alto).
    const dibujo = await sharp(original)
      .trim({ threshold: 10 })
      .resize(Math.round(LADO * OCUPACION_DIBUJO), Math.round(LADO * OCUPACION_DIBUJO), {
        fit: "inside",
        withoutEnlargement: false,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const hex = `rgb(${fondo[0]},${fondo[1]},${fondo[2]})`;
    return await sharp(discoSvg(LADO, hex))
      .composite([{ input: dibujo, gravity: "centre" }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

export const LADO_ICONO = LADO;
