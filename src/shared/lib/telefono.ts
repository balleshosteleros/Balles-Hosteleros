/**
 * Enlaces de telefono y WhatsApp.
 *
 * Estaba repetido en cinco sitios (agenda, candidatos y las tres vistas de
 * inspectores), cada uno con su propia version, y no coincidian: la de
 * inspectores daba por movil cualquier numero que empezara por 9, asi que un
 * fijo de Madrid ofrecia un WhatsApp que no existe.
 */

/**
 * Numero listo para wa.me: solo digitos y con prefijo de pais.
 *
 * Devuelve null cuando el numero no puede tener WhatsApp, y ahi el boton no
 * debe pintarse: los fijos (8/9) y los cortos de emergencia (112, 091) no
 * tienen cuenta, y ofrecer el enlace solo lleva a un chat vacio.
 *
 * Un numero escrito con prefijo internacional (+33..., 0034...) se acepta tal
 * cual: si alguien se molesto en poner el prefijo, es que es un movil de fuera.
 */
export function whatsappNumero(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const traePrefijoPais = /^\s*(\+|00)/.test(telefono);

  // Se prueba primero el numero entero: los que se escriben con espacios
  // ("+34 662 600 507") se romperian en trozos de 3 digitos y ningun trozo
  // pareceria un movil. Despues, cada parte por separado: varios contactos
  // traen dos numeros en el mismo campo ("914842079 - 678843998") y ahi hay
  // que quedarse con el movil.
  for (const parte of [telefono, ...telefono.split(/[^\d+]+/)]) {
    let d = parte.replace(/[^\d]/g, "");
    if (!d) continue;
    if (d.startsWith("00")) d = d.slice(2);
    if (/^[67]\d{8}$/.test(d)) return `34${d}`;
    if (/^34[67]\d{8}$/.test(d)) return d;
  }

  if (traePrefijoPais) {
    let d = telefono.replace(/[^\d]/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    // Un movil nacional ya se habria capturado arriba; aqui solo queda el
    // extranjero, que necesita prefijo de pais para ser marcable.
    if (d.length >= 10 && !d.startsWith("34")) return d;
  }
  return null;
}

/** URL de WhatsApp, o null si a ese numero no se le puede escribir. */
export function whatsappHref(telefono: string | null | undefined, texto?: string): string | null {
  const n = whatsappNumero(telefono);
  if (!n) return null;
  return texto ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : `https://wa.me/${n}`;
}

/** URL para llamar. Vale para cualquier numero, fijos y cortos incluidos. */
export function telefonoHref(telefono: string | null | undefined): string | null {
  if (!telefono?.trim()) return null;
  return `tel:${telefono.trim()}`;
}
