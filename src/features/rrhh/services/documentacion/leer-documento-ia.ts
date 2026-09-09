import "server-only";

/**
 * Lectura por IA (visión) de la documentación identificativa de una persona.
 *
 * La IA **propone**, nunca decide: quien sube el documento revisa lo detectado y
 * lo confirma antes de que se guarde nada. Si el modelo no lee el dato con
 * seguridad devuelve `valor: null` y el formulario pide teclearlo.
 *
 * Vive aquí, y no dentro de una ruta, porque lo usan DOS entradas distintas con
 * los mismos prompts:
 *  - `/api/documentacion/extraer` — el candidato, sin sesión, con su token.
 *  - `analizarDocumentoPropio` (primer acceso) — el empleado, ya con sesión.
 * Tener los prompts duplicados llevaría a que uno se afinara y el otro no.
 */

import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import {
  calcularEdad,
  EDAD_MINIMA_LABORAL,
  normalizarDniNie,
  normalizarIban,
  normalizarSeguridadSocial,
} from "@/features/rrhh/lib/documentacion-validacion";

/** Qué dato se busca: dni_nie = anverso · dni_reverso = domicilio · iban/ss = número. */
export type CampoDocumento = "dni_nie" | "dni_reverso" | "iban" | "ss";

/** Tope del ANÁLISIS por IA, no de la subida (que admite hasta 50 MB). Son los
 *  10 MB que el modelo lee de forma fiable. */
export const MAX_IA_BYTES = 10 * 1024 * 1024;

/** Gemini lee imágenes Y PDF. Lo que no esté aquí se guarda igual, pero sin leer. */
export const TIPOS_IA = new Set([
  "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "application/pdf",
]);

const PROMPTS: Record<CampoDocumento, string> = {
  dni_nie:
    "Esta imagen debe ser un DNI español o una tarjeta de NIE (documento de identidad de extranjero en España). " +
    "Extrae el número del documento (DNI: 8 dígitos + letra; NIE: letra X/Y/Z + 7 dígitos + letra), " +
    "la fecha de nacimiento del titular y su domicilio/dirección postal si aparece. " +
    "MUY IMPORTANTE sobre la fecha de nacimiento: estos documentos muestran VARIAS fechas juntas y es " +
    "fácil confundirlas. Devuelve ÚNICAMENTE la que aparece bajo la etiqueta 'FECHA DE NACIMIENTO' " +
    "(o 'DATE OF BIRTH' / 'FECHA DE NACIMENTO'). NO devuelvas la fecha de expedición ('FECHA DE EXPEDICIÓN', " +
    "'DATE OF ISSUE'), NI la fecha de caducidad o validez ('VALIDEZ', 'FECHA DE CADUCIDAD', 'DATE OF EXPIRY'), " +
    "NI la fecha que acompaña al número de soporte. Si NO puedes identificar con seguridad cuál es la fecha " +
    "de nacimiento porque la etiqueta no se lee, devuelve la fecha de nacimiento VACÍA en lugar de adivinar. " +
    "Responde SOLO con un JSON: {\"valor\":\"<numero o vacío>\",\"fecha_nacimiento\":\"<AAAA-MM-DD o vacío>\",\"direccion\":\"<domicilio completo o vacío>\"}. " +
    "La fecha SIEMPRE en formato AAAA-MM-DD (año-mes-día). La dirección tal cual aparece. Sin texto adicional.",
  dni_reverso:
    "Esta imagen es el REVERSO de un DNI español o de una tarjeta de NIE. En el reverso figura el DOMICILIO/dirección postal del titular. " +
    "Extrae el domicilio completo (calle, número, código postal y localidad) tal cual aparece. " +
    "Responde SOLO con un JSON: {\"direccion\":\"<domicilio completo o vacío>\"}. Sin texto adicional.",
  iban:
    "Esta imagen muestra datos bancarios de una persona. Extrae el IBAN (empieza por dos letras de país, p.ej. ES, seguidas de 22 caracteres) " +
    "y, si aparecen, el NOMBRE COMPLETO del titular y su DNI/NIE. " +
    "Responde SOLO con un JSON: {\"valor\":\"<iban o vacío>\",\"titular_nombre\":\"<nombre o vacío>\",\"titular_dni\":\"<dni/nie o vacío>\"}. Sin texto adicional.",
  ss:
    "Esta imagen muestra un documento de la Seguridad Social de una persona. Extrae el número de afiliación (11 o 12 dígitos) " +
    "y, si aparecen, el NOMBRE COMPLETO del titular y su DNI/NIE. " +
    "Responde SOLO con un JSON: {\"valor\":\"<numero o vacío>\",\"titular_nombre\":\"<nombre o vacío>\",\"titular_dni\":\"<dni/nie o vacío>\"}. Sin texto adicional.",
};

const RESPUESTA_SCHEMA = {
  type: "object",
  properties: {
    valor: {
      type: "string",
      description: "El número detectado, o cadena vacía si no se puede leer con seguridad.",
    },
    fecha_nacimiento: {
      type: "string",
      description: "Fecha de nacimiento en formato AAAA-MM-DD (solo DNI/NIE/pasaporte), o cadena vacía.",
    },
    direccion: {
      type: "string",
      description: "Domicilio/dirección postal del titular si aparece (solo DNI/NIE), o cadena vacía.",
    },
    titular_nombre: {
      type: "string",
      description: "Nombre completo del titular que figura en el documento (IBAN/SS), o cadena vacía.",
    },
    titular_dni: {
      type: "string",
      description: "DNI/NIE del titular que figura en el documento (IBAN/SS), o cadena vacía.",
    },
  },
  required: ["valor"],
} as const;

export interface LecturaDocumento {
  valor: string | null;
  fecha_nacimiento: string | null;
  direccion: string | null;
  titular_dni: string | null;
  titular_nombre: string | null;
  menor_de_edad: boolean;
  edad: number | null;
  /** Por qué no se leyó nada: el formulario lo usa para pedir teclearlo a mano. */
  motivo?: "no_soportado" | "ia_no_configurada" | "ia_fallo";
}

/** Vacío o "null" del modelo → null de verdad. */
function limpiarValor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const limpio = v.trim();
  if (!limpio || limpio.toLowerCase() === "null") return null;
  return limpio;
}

const VACIA: LecturaDocumento = {
  valor: null, fecha_nacimiento: null, direccion: null,
  titular_dni: null, titular_nombre: null, menor_de_edad: false, edad: null,
};

/**
 * Lee un documento y devuelve lo que la IA propone. Nunca lanza: si algo falla
 * devuelve la lectura vacía con el motivo, porque un fallo del modelo no puede
 * impedir que la persona siga y escriba el dato a mano.
 */
export async function leerDocumentoConIA(
  campo: CampoDocumento,
  mimeType: string,
  buffer: Buffer,
): Promise<LecturaDocumento> {
  if (!TIPOS_IA.has(mimeType)) return { ...VACIA, motivo: "no_soportado" };
  if (buffer.byteLength > MAX_IA_BYTES) return { ...VACIA, motivo: "no_soportado" };

  let valor: string | null = null;
  let fechaNacimiento: string | null = null;
  let direccion: string | null = null;
  let titularDni: string | null = null;
  let titularNombre: string | null = null;
  let menorDeEdad = false;
  let edadTitular: number | null = null;

  try {
    const { data } = await geminiJSON<{
      valor?: string; fecha_nacimiento?: string; direccion?: string;
      titular_dni?: string; titular_nombre?: string;
    }>(PROMPTS[campo], {
      responseSchema: RESPUESTA_SCHEMA as never,
      temperature: 0,
      attachments: [{ mimeType, base64: buffer.toString("base64") }],
    });

    valor = limpiarValor(data.valor);

    if (campo === "dni_nie") {
      const f = typeof data.fecha_nacimiento === "string" ? data.fecha_nacimiento.trim() : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
        const d = new Date(`${f}T00:00:00Z`);
        if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) {
          fechaNacimiento = f;
          // Si el documento acredita que no alcanza la edad mínima legal, se
          // informa para que el formulario lo rechace y no avance.
          const edad = calcularEdad(f);
          if (edad !== null && edad < EDAD_MINIMA_LABORAL) {
            edadTitular = edad;
            menorDeEdad = true;
          }
        }
      }
    }

    if (campo === "dni_nie" || campo === "dni_reverso") {
      const dir = typeof data.direccion === "string" ? data.direccion.trim() : "";
      if (dir.length >= 3 && dir.length <= 200) direccion = dir;
    }

    if (campo === "iban" || campo === "ss") {
      titularDni = limpiarValor(data.titular_dni);
      if (titularDni) titularDni = normalizarDniNie(titularDni);
      titularNombre = limpiarValor(data.titular_nombre);
    }
  } catch (e) {
    if (e instanceof GeminiKeyMissingError) return { ...VACIA, motivo: "ia_no_configurada" };
    console.error("[leer-documento-ia] gemini:", e);
    return { ...VACIA, motivo: "ia_fallo" };
  }

  // Mismo formato con el que se validará al guardar.
  if (valor) {
    if (campo === "dni_nie") valor = normalizarDniNie(valor);
    else if (campo === "iban") valor = normalizarIban(valor);
    else if (campo === "ss") valor = normalizarSeguridadSocial(valor);
  }

  return {
    valor,
    fecha_nacimiento: fechaNacimiento,
    direccion,
    titular_dni: titularDni,
    titular_nombre: titularNombre,
    menor_de_edad: menorDeEdad,
    edad: edadTitular,
  };
}
