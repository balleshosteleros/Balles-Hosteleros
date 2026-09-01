/**
 * PRP-079 — Guardar y compartir archivos desde el MÓVIL.
 *
 * El problema que resuelve este módulo (reportado 01-sep-2026):
 *
 *  · "Guardar imagen" desde el iPhone no llegaba a la galería.
 *  · Compartir por WhatsApp fallaba justo al enviar.
 *
 * Las dos cosas tenían la MISMA causa: se compartía un ENLACE, no el archivo.
 *
 * Un enlace a `/api/archivos/ver` es una URL privada, con sesión y firmada:
 * WhatsApp no puede abrirla desde sus servidores, así que el envío moría; y
 * iOS, ante una URL, ofrece "Guardar en Archivos", nunca "Guardar imagen" en
 * Fotos. Por eso en Google Drive sí funciona y aquí no: Drive comparte el
 * BINARIO del archivo, no su dirección.
 *
 * La solución es descargar el archivo al teléfono y entregárselo al sistema
 * como un `File` de verdad, vía `navigator.share({ files })`. Entonces iOS
 * enseña la hoja nativa completa —con "Guardar imagen", que sí va a Fotos— y
 * WhatsApp recibe el archivo y lo envía.
 */

/** Descarga el archivo del servidor y lo convierte en un `File` para el sistema. */
async function descargarComoFile(
  id: string,
  nombre: string,
  mime: string,
): Promise<File> {
  // `descargar=1` va por el proxy same-origin: manda la cookie de sesión y
  // devuelve el binario. La URL firmada de R2 no sirve aquí porque el objetivo
  // es tener los BYTES en el teléfono, no una dirección que abrir.
  const res = await fetch(`/api/archivos/ver?id=${id}&descargar=1`);
  if (!res.ok) throw new Error("No se pudo descargar el archivo");

  const blob = await res.blob();
  // El tipo lo pone la base de datos: algunos navegadores devuelven un
  // `Content-Type` genérico y iOS necesita el real para saber que es una foto
  // y ofrecer "Guardar imagen".
  return new File([blob], nombre, { type: mime || blob.type });
}

/** ¿El navegador sabe compartir archivos? (iOS y Android modernos, sí.) */
export function puedeCompartirArchivos(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  // `canShare` con un fichero de prueba es la única comprobación fiable:
  // hay navegadores con `share` que solo aceptan texto y URL.
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({
      files: [new File([new Blob([""])], "p.txt", { type: "text/plain" })],
    });
  } catch {
    return false;
  }
}

export type ResultadoCompartir = "compartido" | "cancelado" | "no-soportado";

/**
 * Abre la hoja nativa del sistema con el ARCHIVO dentro.
 *
 * Devuelve "no-soportado" si el navegador no sabe compartir ficheros, para que
 * quien llama caiga en la descarga clásica del escritorio.
 */
export async function compartirArchivo(
  id: string,
  nombre: string,
  mime: string,
): Promise<ResultadoCompartir> {
  if (!puedeCompartirArchivos()) return "no-soportado";

  const file = await descargarComoFile(id, nombre, mime);

  // Se vuelve a preguntar con el archivo REAL: el tamaño o el tipo pueden
  // hacer que el sistema lo rechace aunque acepte compartir en general.
  if (!navigator.canShare?.({ files: [file] })) return "no-soportado";

  try {
    // Solo `files`. Añadir `title` o `text` hace que WhatsApp y otras apps
    // traten el envío como un mensaje de texto CON adjunto, y algunas se
    // quedan con el texto y descartan la imagen.
    await navigator.share({ files: [file] });
    return "compartido";
  } catch (err) {
    // Cerrar la hoja nativa lanza AbortError. Es una acción del usuario, no un
    // error: quien llama no debe enseñar ningún aviso rojo.
    if (err instanceof DOMException && err.name === "AbortError") return "cancelado";
    throw err;
  }
}

/**
 * Descarga clásica de escritorio: un enlace temporal con `download`.
 *
 * Se hace sobre un blob en memoria y no apuntando directamente a la API para
 * que el nombre del archivo lo ponga el navegador desde aquí, sin depender de
 * cómo interprete cada uno la cabecera `Content-Disposition`.
 */
export async function descargarArchivo(
  id: string,
  nombre: string,
  mime: string,
): Promise<void> {
  const file = await descargarComoFile(id, nombre, mime);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera con margen: revocar en el mismo tick cancela la descarga en
  // algunos navegadores antes de que llegue a empezar.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
