/**
 * Validación de teléfono y email para fichas de cliente.
 *
 * La migración de CoverManager (sept. 2026) sacó a la luz decenas de fichas
 * inservibles: teléfonos `00000`, `666`, `1111111`, `32456789` y nombres tipo
 * "XXELAS XELAS". Entraron porque el formulario solo pedía 5 caracteres, así
 * que valía cualquier cosa. Un cliente con un teléfono falso no se puede
 * localizar cuando llama, y encima ensucia la búsqueda por número.
 *
 * Aquí vive el criterio único. Úsalo en TODA alta o edición de cliente.
 */

/** Teléfono en solo dígitos, sin prefijo español ni separadores. */
export function normalizarTelefono(valor: string | null | undefined): string {
  const d = (valor ?? "").replace(/\D/g, "");
  if (/^0034\d{9}$/.test(d)) return d.slice(4);
  if (/^34\d{9}$/.test(d)) return d.slice(2);
  return d;
}

/**
 * Números que no identifican a nadie: todo el mismo dígito (`00000`,
 * `666666`), escaleras (`123456789`, `987654321`) y los clásicos de teclado.
 */
function esRelleno(d: string): boolean {
  if (/^(\d)\1+$/.test(d)) return true;
  const asc = "0123456789012345678901234567890";
  const desc = "9876543210987654321098765432109";
  return asc.includes(d) || desc.includes(d);
}

export type ResultadoValidacion = { ok: true } | { ok: false; error: string };

/**
 * Un teléfono vale si es un móvil o fijo español de 9 dígitos (6/7/8/9), o un
 * internacional con prefijo de país. Todo lo demás se rechaza al guardar.
 *
 * @param obligatorio Si es false, un valor vacío se acepta (hay fichas
 *   legítimas sin teléfono; lo que no se acepta es un teléfono INVENTADO).
 */
export function validarTelefono(
  valor: string | null | undefined,
  obligatorio = true,
): ResultadoValidacion {
  const bruto = (valor ?? "").trim();
  if (!bruto) {
    return obligatorio ? { ok: false, error: "Escribe un teléfono." } : { ok: true };
  }

  const internacional = /^\s*(\+|00)/.test(bruto) && !/^\s*(\+34|0034)/.test(bruto);
  const d = normalizarTelefono(bruto);

  if (esRelleno(d)) {
    return { ok: false, error: "Ese teléfono no es válido. Escribe uno real." };
  }
  if (internacional) {
    // Fuera de España la longitud varía por país: se comprueba que sea
    // marcable, no el formato exacto de cada uno.
    return d.length >= 8 && d.length <= 15
      ? { ok: true }
      : { ok: false, error: "Ese teléfono no es válido. Revisa el número." };
  }
  if (d.length !== 9) {
    return {
      ok: false,
      error:
        d.length < 9
          ? "El teléfono está incompleto: son 9 cifras."
          : "El teléfono tiene cifras de más: son 9.",
    };
  }
  if (!/^[6-9]/.test(d)) {
    return { ok: false, error: "Un teléfono español empieza por 6, 7, 8 o 9." };
  }
  return { ok: true };
}

/** Dominios que la gente teclea para salir del paso en un formulario. */
const DOMINIOS_FALSOS = new Set([
  "test.com", "test.es", "example.com", "ejemplo.com", "asd.com",
  "aaa.com", "nose.com", "no.com", "sinemail.com", "email.com",
  "mail.com", "correo.com", "prueba.com", "xxx.com", "a.com",
]);

/**
 * Un email vale si tiene forma real y no usa un dominio de relleno. No se
 * comprueba que exista de verdad: eso solo lo diría enviar un correo.
 */
export function validarEmail(
  valor: string | null | undefined,
  obligatorio = true,
): ResultadoValidacion {
  const e = (valor ?? "").trim().toLowerCase();
  if (!e) {
    return obligatorio ? { ok: false, error: "Escribe un correo." } : { ok: true };
  }
  // Deliberadamente sencillo: lo raro pero válido (subdominios, guiones)
  // pasa, y lo que se rechaza es lo que claramente no es un correo.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) {
    return { ok: false, error: "Ese correo no es válido." };
  }
  const dominio = e.slice(e.lastIndexOf("@") + 1);
  if (DOMINIOS_FALSOS.has(dominio)) {
    return { ok: false, error: "Ese correo no es válido. Escribe uno real." };
  }
  const usuario = e.slice(0, e.indexOf("@"));
  if (/^(.)\1+$/.test(usuario) && usuario.length > 2) {
    return { ok: false, error: "Ese correo no es válido. Escribe uno real." };
  }
  return { ok: true };
}

/**
 * Nombres de relleno: "XXXX", "AAA", "asdf". No se filtra por lista de
 * nombres propios, que dejaría fuera a personas reales con nombres poco
 * comunes; solo se corta lo que no es un nombre en absoluto.
 */
export function validarNombre(valor: string | null | undefined): ResultadoValidacion {
  const n = (valor ?? "").trim();
  if (n.length < 2) return { ok: false, error: "Escribe el nombre." };
  // Solo letras: "..." o "--" no son un nombre por mucho que midan.
  const limpio = n.replace(/[^\p{L}]/gu, "").toLowerCase();
  if (limpio.length < 2) return { ok: false, error: "Escribe un nombre real." };
  if (/^(.)\1+$/.test(limpio)) {
    return { ok: false, error: "Escribe un nombre real." };
  }
  // Sin vocales solo se rechaza a partir de 4 letras: hay apellidos reales
  // cortos que no las llevan ("Ng"), pero "xxxx" no es un nombre.
  if (limpio.length >= 4 && !/[aeiouáéíóúüy]/i.test(limpio)) {
    return { ok: false, error: "Escribe un nombre real." };
  }
  // Tecleo de teclado corrido: asdf, qwerty, zxcv.
  if (/asdf|qwer|zxcv|hjkl|wasd/.test(limpio)) {
    return { ok: false, error: "Escribe un nombre real." };
  }
  // Misma letra 3+ veces seguidas ("HHHUY", "XXELAS"). En español no ocurre;
  // la doble sí (Emma, Anna), por eso el corte está en tres.
  if (/(.)\1{2,}/.test(limpio)) {
    return { ok: false, error: "Escribe un nombre real." };
  }
  return { ok: true };
}
