"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";
import { MAX_IMAGEN_MB, MAX_IMAGEN_BYTES } from "@/shared/lib/documentos";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export interface PerfilCompletoInput {
  // SOLO LECTURA: ya se pidieron en el proceso de selección (candidatura o
  // documentación) y se copian a la ficha al contratar. Se muestran para que el
  // empleado los reconozca, pero este asistente no los pide ni los reescribe.
  dni_nie?: string | null;
  fecha_nacimiento?: string | null;
  direccion?: string | null;
  iban?: string | null;
  numero_ss?: string | null;
  telefono?: string | null;
  genero?: string | null;
  avatar_url?: string | null;
  dni_archivo_url?: string | null;

  // Lo ÚNICO que este asistente pide: lo que nadie ha preguntado todavía.
  nacionalidad?: string | null;
  tipo_documento?: string | null;
  estado_civil?: string | null;
  codigo_postal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  contacto_emergencia_relacion: string;
  talla_uniforme?: string | null;
}

/**
 * Validación de SERVIDOR: es la única que cuenta. Esto es una server action
 * alcanzable desde el navegador, así que lo que valide la pantalla no basta —
 * estos datos van a la gestoría y al pago de la nómina.
 */
function validarPerfil(p: PerfilCompletoInput): string | null {
  // OJO: aquí solo se valida lo que ESTE asistente pide. El documento, el IBAN,
  // la Seguridad Social, la dirección y la fecha de nacimiento se aportaron y se
  // validaron en el proceso de selección (`/api/documentacion`), y no se vuelven
  // a pedir: exigirlos aquí bloquearía a quien no puede ya corregirlos.
  if (!p.tipo_documento?.trim()) return "Elige el tipo de documento";
  if (!p.estado_civil?.trim()) return "Elige el estado civil";

  if (!p.codigo_postal?.trim()) return "El código postal es obligatorio";
  if (!/^\d{4,10}$/.test(p.codigo_postal.replace(/\s/g, ""))) {
    return "El código postal no es válido";
  }
  if (!p.ciudad?.trim()) return "La ciudad es obligatoria";
  if (!p.provincia?.trim()) return "La provincia es obligatoria";
  if (!p.pais?.trim()) return "El país es obligatorio";

  if (!p.contacto_emergencia_nombre?.trim() || !p.contacto_emergencia_telefono?.trim()) {
    return "El contacto de emergencia es obligatorio (nombre + teléfono)";
  }
  const telEmg = p.contacto_emergencia_telefono.replace(/[\s.-]/g, "");
  if (!/^(\+?\d{1,3})?\d{9,12}$/.test(telEmg)) {
    return "El teléfono del contacto de emergencia no tiene un formato válido";
  }

  return null;
}

export async function guardarPerfilCompleto(input: PerfilCompletoInput) {
  const { supabase, user } = await getCtx();
  if (!user) return { ok: false, error: "No autenticado" };

  const err = validarPerfil(input);
  if (err) return { ok: false, error: err };

  // Un trabajador en varias empresas tiene una ficha por empresa. Los datos
  // personales (DNI, IBAN, dirección…) son de la PERSONA, así que se guardan en
  // TODAS sus fichas: si no, quedaría completo en una empresa e incompleto en la
  // otra. Antes se usaba `.maybeSingle()`, que con 2 fichas fallaba y hacía
  // imposible completar el perfil.
  const { data: fichas } = await supabase
    .from("empleados")
    .select("id, empresa_id")
    .eq("user_id", user.id);

  if (!fichas || fichas.length === 0) return { ok: false, error: "No se encontró tu ficha de empleado" };
  const empleado = fichas[0];

  // Se escribe SOLO lo que este asistente pide. Todo lo que llega del proceso de
  // selección —DNI, IBAN, SS, dirección, fecha de nacimiento, teléfono, género,
  // foto y copia del DNI— NO se toca: mandarlo desde aquí lo borraría de la ficha.
  const { error } = await supabase
    .from("empleados")
    .update({
      nacionalidad: input.nacionalidad?.trim() || null,
      contacto_emergencia_nombre: normalizarNombre(input.contacto_emergencia_nombre),
      contacto_emergencia_telefono: input.contacto_emergencia_telefono.trim(),
      contacto_emergencia_relacion: input.contacto_emergencia_relacion.trim(),
      talla_uniforme: input.talla_uniforme ?? null,
      tipo_documento: input.tipo_documento?.trim() || null,
      estado_civil: input.estado_civil?.trim() || null,
      codigo_postal: input.codigo_postal?.trim() || null,
      ciudad: input.ciudad?.trim() || null,
      provincia: input.provincia?.trim() || null,
      pais: input.pais?.trim() || null,
      perfil_completado: true,
      perfil_completado_at: new Date().toISOString(),
    })
    // A TODAS sus fichas (una por empresa), no solo a una.
    .in("id", fichas.map((f) => f.id as string));

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Tipos admitidos al subir la foto o el DNI. Se comprueba en SERVIDOR: el
 *  `accept` del formulario es solo una sugerencia del navegador. */
const TIPOS_IMAGEN_OK = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf",
]);

export async function uploadDocumentoEmpleado(input: {
  tipo: "avatar" | "dni";
  file: File;
}) {
  const { supabase, user } = await getCtx();
  if (!user) return { ok: false, error: "No autenticado" };

  // El `tipo` compone la ruta del fichero: se acota a los dos valores válidos
  // para que no pueda usarse para escribir fuera de su sitio.
  if (input.tipo !== "avatar" && input.tipo !== "dni") {
    return { ok: false, error: "Tipo de documento no válido" };
  }
  if (!input.file || input.file.size === 0) {
    return { ok: false, error: "No se ha recibido ningún archivo" };
  }
  if (input.file.size > MAX_IMAGEN_BYTES) {
    return { ok: false, error: `El archivo supera ${MAX_IMAGEN_MB} MB.` };
  }
  if (!TIPOS_IMAGEN_OK.has(input.file.type)) {
    return { ok: false, error: "Formato no admitido. Sube una imagen (JPG, PNG) o un PDF." };
  }

  // Basta una ficha cualquiera (solo se usa para componer la ruta del archivo),
  // pero con `.maybeSingle()` fallaba en quien tiene ficha en dos empresas.
  const { data: fichasDoc } = await supabase
    .from("empleados")
    .select("id, empresa_id")
    .eq("user_id", user.id)
    .limit(1);
  const empleado = fichasDoc?.[0];

  if (!empleado) return { ok: false, error: "No se encontró tu ficha de empleado" };

  // La extensión se deriva del TIPO real, no del nombre que manda el navegador:
  // ese nombre es texto libre del usuario y acabaría dentro de la ruta.
  const EXT_POR_TIPO: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf",
  };
  const ext = EXT_POR_TIPO[input.file.type] ?? "bin";
  const path = `${empleado.empresa_id}/${empleado.id}/${input.tipo}-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const { error } = await supabase.storage
    .from("empleados-docs")
    .upload(path, buffer, {
      contentType: input.file.type,
      upsert: true,
    });

  if (error) return { ok: false, error: error.message };

  const { data: signed } = await supabase.storage
    .from("empleados-docs")
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 año

  return { ok: true, path, url: signed?.signedUrl ?? null };
}
