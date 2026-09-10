/**
 * Con quién habla el buzón (PRP-094, Fase 2).
 *
 * Funciones PURAS: sin base de datos, sin red, sin `server-only`. Aquí se
 * decide quién es «el otro» de cada correo, que es el eje de todo el panel.
 *
 * Por qué importa tanto normalizar: el ranking del 80/20 agrupa por esta
 * columna. Si el mismo proveedor entra unas veces como `Pedidos@Makro.es` y
 * otras como `pedidos+bacanal@makro.es`, sale partido en tres filas, ninguna
 * encabeza el ranking y el 80 % que se pinta es mentira.
 */

/** Una dirección extraída de una cabecera, ya lista para guardar. */
export type Contraparte = {
  /** Dirección normalizada. "" si la cabecera venía vacía o ilegible. */
  email: string;
  /** Parte de después de la arroba, en minúsculas. */
  dominio: string;
  /** Nombre visible ("Makro Pedidos"), si el correo lo traía. */
  nombre: string;
};

const VACIA: Contraparte = { email: "", dominio: "", nombre: "" };

/**
 * Normaliza una dirección para poder agruparla:
 *  - minúsculas y sin espacios
 *  - fuera la subdirección (`pedidos+bacanal@` → `pedidos@`), que es la misma
 *    persona escribiendo con una etiqueta detrás
 *
 * NO se toca el punto en la parte local: en Gmail `a.b@` y `ab@` son el mismo
 * buzón, pero en el resto del mundo no, y unificarlos fundiría direcciones de
 * personas distintas en una sola fila del ranking.
 */
export function normalizarDireccion(email: string): string {
  const limpio = email.trim().toLowerCase();
  const arroba = limpio.lastIndexOf("@");
  if (arroba <= 0) return limpio;

  const local = limpio.slice(0, arroba);
  const dominio = limpio.slice(arroba + 1);
  const sinEtiqueta = local.split("+")[0];
  return `${sinEtiqueta}@${dominio}`;
}

/**
 * Lee una cabecera `From`/`To` y devuelve la primera dirección.
 *
 * Las cabeceras vienen en cualquiera de estas formas:
 *   `Nombre Apellido <correo@dominio.com>`
 *   `"Apellido, Nombre" <correo@dominio.com>`
 *   `correo@dominio.com`
 *   `uno@a.com, dos@b.com, tres@c.com`   ← varios destinatarios
 *
 * Con varios destinatarios se queda con el PRIMERO a propósito: el correo es
 * uno solo y debe contar una vez. Si se contase uno por destinatario, un envío
 * a diez personas parecería diez veces más trabajo del que fue.
 */
export function extraerContraparte(cabecera: string | null | undefined): Contraparte {
  const bruto = (cabecera ?? "").trim();
  if (!bruto) return VACIA;

  const primera = partirPorComasFueraDeComillas(bruto)[0]?.trim() ?? "";
  if (!primera) return VACIA;

  // Forma `Nombre <correo>`: el correo va entre ángulos.
  const conAngulos = primera.match(/^(.*?)<([^>]+)>\s*$/);
  const direccionBruta = conAngulos ? conAngulos[2] : primera;
  const nombreBruto = conAngulos ? conAngulos[1] : "";

  const email = normalizarDireccion(direccionBruta);
  if (!email.includes("@")) return { ...VACIA, nombre: limpiarNombre(nombreBruto) };

  return {
    email,
    dominio: email.slice(email.lastIndexOf("@") + 1),
    nombre: limpiarNombre(nombreBruto),
  };
}

/**
 * Parte una lista de direcciones por comas, respetando las que van dentro de
 * comillas: `"Apellido, Nombre" <a@b.com>` es UNA dirección, no dos.
 */
function partirPorComasFueraDeComillas(texto: string): string[] {
  const partes: string[] = [];
  let actual = "";
  let dentroDeComillas = false;

  for (const ch of texto) {
    if (ch === '"') {
      dentroDeComillas = !dentroDeComillas;
      actual += ch;
      continue;
    }
    if (ch === "," && !dentroDeComillas) {
      partes.push(actual);
      actual = "";
      continue;
    }
    actual += ch;
  }
  if (actual.trim()) partes.push(actual);
  return partes;
}

/** Quita comillas y espacios sobrantes del nombre visible. */
function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/^"(.*)"$/, "$1").trim();
}

/**
 * ¿Es correo automático?
 *
 * NO es una categoría (el panel no clasifica: eso fue decisión expresa). Es un
 * marcador para poder apagar el ruido y que el ranking hable de personas y
 * empresas con las que de verdad se trabaja, no de boletines.
 *
 * Se detecta por tres señales, todas objetivas:
 *  - la dirección dice que no se puede contestar (`no-reply`, `noreply`…)
 *  - es un rebote del sistema de correo (`mailer-daemon`, `postmaster`)
 *  - el correo trae cabecera de baja automática (`List-Unsubscribe`), que es lo
 *    que ponen los envíos masivos y los boletines
 */
export function esAutomatico(
  email: string,
  cabeceras: Record<string, string>,
): boolean {
  const dir = email.toLowerCase();
  const local = dir.split("@")[0] ?? "";

  // El separador puede ser guion, guion bajo, punto o nada: en la vida real
  // llegan `noreply@`, `no-reply@`, `no_reply@` y `testflight_no_reply@`. Con
  // solo el guion se colaban como si fueran personas escribiendo.
  const sinRespuesta =
    /(^|[.\-_])(no[-_]?reply|do[-_]?not[-_]?reply|no[-_]?responder|noresponder)([.\-_]|$)/.test(
      local,
    );
  if (sinRespuesta) return true;

  if (/^(mailer-daemon|postmaster|bounces?|bounce-)/.test(local)) return true;

  if (cabeceras["list-unsubscribe"]) return true;

  return false;
}

/**
 * Día al que pertenece un instante, EN LA HORA DE LA EMPRESA.
 *
 * Se calcula al guardar, no al consultar, porque así el panel agrupa por una
 * columna de fecha y la medianoche que corta el día es la de la casa. Con
 * `toLocaleDateString` a secas saldría la del servidor, que en producción es
 * UTC: en verano, un correo de las 00:30 de Madrid se contaría el día anterior.
 */
export function diaEnZona(fecha: Date, tz: string): string {
  // `en-CA` da directamente aaaa-mm-dd, que es lo que espera una columna `date`.
  return fecha.toLocaleDateString("en-CA", { timeZone: tz });
}
