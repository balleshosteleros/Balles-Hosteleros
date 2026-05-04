// Validadores para los datos personales del empleado.
// Pensados para feedback inmediato en el formulario y como segunda barrera
// en el server action. Son puros, sin dependencias.

const DNI_LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";

export type TipoDocumento = "DNI" | "NIE" | "PASAPORTE";

export interface ValidacionResultado {
  valido: boolean;
  mensaje?: string;
}

export function detectarTipoDocumento(valor: string): TipoDocumento | null {
  const v = valor.trim().toUpperCase();
  if (/^[0-9]{8}[A-Z]$/.test(v)) return "DNI";
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(v)) return "NIE";
  if (/^[A-Z0-9]{6,12}$/.test(v)) return "PASAPORTE";
  return null;
}

export function validarDni(valor: string): ValidacionResultado {
  const v = valor.trim().toUpperCase();
  if (!/^[0-9]{8}[A-Z]$/.test(v)) {
    return { valido: false, mensaje: "Formato DNI inválido (8 dígitos + letra)" };
  }
  const numero = parseInt(v.slice(0, 8), 10);
  const letraEsperada = DNI_LETRAS[numero % 23];
  if (letraEsperada !== v[8]) {
    return { valido: false, mensaje: `Letra incorrecta — debería ser ${letraEsperada}` };
  }
  return { valido: true };
}

export function validarNie(valor: string): ValidacionResultado {
  const v = valor.trim().toUpperCase();
  if (!/^[XYZ][0-9]{7}[A-Z]$/.test(v)) {
    return { valido: false, mensaje: "Formato NIE inválido (X/Y/Z + 7 dígitos + letra)" };
  }
  const prefijoNum = { X: "0", Y: "1", Z: "2" }[v[0] as "X" | "Y" | "Z"];
  const numero = parseInt(prefijoNum + v.slice(1, 8), 10);
  const letraEsperada = DNI_LETRAS[numero % 23];
  if (letraEsperada !== v[8]) {
    return { valido: false, mensaje: `Letra incorrecta — debería ser ${letraEsperada}` };
  }
  return { valido: true };
}

export function validarDocumento(tipo: TipoDocumento, valor: string): ValidacionResultado {
  if (tipo === "DNI") return validarDni(valor);
  if (tipo === "NIE") return validarNie(valor);
  // Pasaporte: aceptar formato general; la verificación oficial la hace RRHH al revisar el documento.
  if (!/^[A-Z0-9]{6,12}$/.test(valor.trim().toUpperCase())) {
    return { valido: false, mensaje: "Formato de pasaporte inválido (6-12 caracteres alfanuméricos)" };
  }
  return { valido: true };
}

// Validación de IBAN según norma ISO 13616 (mod 97 == 1).
// Rechazamos IBAN que no empiecen por ES porque nóminas españolas exigen
// cuenta nacional para descuentos/seguros sociales. Si en el futuro hay
// trabajadores con cuenta UE, este check se relaja.
export function validarIban(valor: string): ValidacionResultado {
  const v = valor.replace(/\s+/g, "").toUpperCase();
  if (!/^ES[0-9]{22}$/.test(v)) {
    return { valido: false, mensaje: "El IBAN debe empezar por ES y tener 24 caracteres" };
  }
  const reordenado = v.slice(4) + v.slice(0, 4);
  const numerico = reordenado
    .split("")
    .map((c) => (/[0-9]/.test(c) ? c : (c.charCodeAt(0) - 55).toString()))
    .join("");
  // Calcular mod 97 en bloques para evitar overflow
  let resto = 0;
  for (let i = 0; i < numerico.length; i += 7) {
    const bloque = resto.toString() + numerico.substring(i, i + 7);
    resto = parseInt(bloque, 10) % 97;
  }
  if (resto !== 1) {
    return { valido: false, mensaje: "Dígito de control IBAN incorrecto" };
  }
  return { valido: true };
}

export function formatearIban(valor: string): string {
  const limpio = valor.replace(/\s+/g, "").toUpperCase();
  return limpio.replace(/(.{4})/g, "$1 ").trim();
}

// Comparador titular ↔ nombre+apellidos del perfil. Quitamos tildes,
// signos y orden para detectar coincidencia razonable. Devuelve un
// "score" entre 0 y 1 — la UI marca aviso si baja de 0.5.
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function compararTitular(titular: string, nombreCompleto: string): number {
  const a = normalizar(titular);
  const b = normalizar(nombreCompleto);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const tokensA = new Set(a.split(" "));
  const tokensB = new Set(b.split(" "));
  let comunes = 0;
  tokensA.forEach((t) => {
    if (tokensB.has(t)) comunes += 1;
  });
  const total = Math.max(tokensA.size, tokensB.size);
  return total === 0 ? 0 : comunes / total;
}
