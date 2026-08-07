"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";
import { esDniNieValido } from "@/features/rrhh/lib/documentacion-validacion";
import { MAX_IMAGEN_MB, MAX_IMAGEN_BYTES } from "@/shared/lib/documentos";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export interface PerfilCompletoInput {
  dni_nie: string;
  fecha_nacimiento: string;
  nacionalidad?: string | null;
  telefono: string;
  direccion: string;
  iban: string;
  numero_ss: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  contacto_emergencia_relacion: string;
  talla_uniforme?: string | null;
  alergias_medicas?: string | null;
  avatar_url?: string | null;
  dni_archivo_url?: string | null;
}

function normalizarIban(s: string): string {
  return s.toUpperCase().replace(/\s+/g, "");
}

/**
 * Validación de SERVIDOR: es la única que cuenta. Esto es una server action
 * alcanzable desde el navegador, así que lo que valide la pantalla no basta —
 * estos datos van a la gestoría y al pago de la nómina.
 */
function validarPerfil(p: PerfilCompletoInput): string | null {
  if (!p.dni_nie?.trim()) return "El DNI/NIE es obligatorio";
  const dni = p.dni_nie.toUpperCase().replace(/[\s-]/g, "");
  if (!esDniNieValido(dni)) return "El DNI/NIE no es válido (revisa el número y la letra)";

  if (!p.fecha_nacimiento) return "La fecha de nacimiento es obligatoria";
  // Fecha coherente: ni futura, ni menor de 16 (edad legal para trabajar), ni
  // absurda. Evita que un error de tecleo acabe en el alta a la gestoría.
  const nac = new Date(`${p.fecha_nacimiento}T00:00:00Z`);
  if (Number.isNaN(nac.getTime())) return "La fecha de nacimiento no es válida";
  const hoy = new Date();
  const anios = (hoy.getTime() - nac.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (anios < 16) return "La fecha de nacimiento no es válida (debes ser mayor de 16 años)";
  if (anios > 100) return "Revisa la fecha de nacimiento";

  if (!p.telefono?.trim()) return "El teléfono es obligatorio";
  const tel = p.telefono.replace(/[\s.-]/g, "");
  if (!/^(\+?\d{1,3})?\d{9,12}$/.test(tel)) return "El teléfono no tiene un formato válido";

  if (!p.direccion?.trim()) return "La dirección es obligatoria";
  if (p.direccion.trim().length < 8) return "Escribe la dirección completa (calle, número, código postal y ciudad)";

  if (!p.numero_ss?.trim()) return "El número de la Seguridad Social es obligatorio";
  // NAF español: 12 dígitos (2 provincia + 8 número + 2 control).
  const naf = p.numero_ss.replace(/[\s/.-]/g, "");
  if (!/^\d{11,12}$/.test(naf)) {
    return "El número de la Seguridad Social debe tener 12 dígitos";
  }

  if (!p.contacto_emergencia_nombre?.trim() || !p.contacto_emergencia_telefono?.trim()) {
    return "El contacto de emergencia es obligatorio (nombre + teléfono)";
  }
  const telEmg = p.contacto_emergencia_telefono.replace(/[\s.-]/g, "");
  if (!/^(\+?\d{1,3})?\d{9,12}$/.test(telEmg)) {
    return "El teléfono del contacto de emergencia no tiene un formato válido";
  }

  const ibanNorm = normalizarIban(p.iban ?? "");
  if (!ibanNorm) return "El IBAN es obligatorio";
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(ibanNorm)) {
    return "El IBAN no tiene un formato válido";
  }
  // Dígito de control (norma ISO 13616): detecta erratas al teclear la cuenta
  // donde se le va a pagar la nómina.
  if (!ibanControlValido(ibanNorm)) return "El IBAN no es correcto: revisa los dígitos";

  return null;
}

/** Validación del dígito de control del IBAN (mod-97). */
function ibanControlValido(iban: string): boolean {
  const reordenado = iban.slice(4) + iban.slice(0, 4);
  const numerico = reordenado.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  // mod 97 por trozos: el número completo excede el entero seguro de JS.
  let resto = 0;
  for (const ch of numerico) resto = (resto * 10 + Number(ch)) % 97;
  return resto === 1;
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

  const ibanNorm = normalizarIban(input.iban);
  const dniNorm = input.dni_nie.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");

  const { error } = await supabase
    .from("empleados")
    .update({
      dni_nie: dniNorm,
      fecha_nacimiento: input.fecha_nacimiento,
      nacionalidad: input.nacionalidad ?? null,
      telefono: input.telefono.trim(),
      direccion: input.direccion.trim(),
      iban: ibanNorm,
      numero_ss: input.numero_ss.trim(),
      contacto_emergencia_nombre: normalizarNombre(input.contacto_emergencia_nombre),
      contacto_emergencia_telefono: input.contacto_emergencia_telefono.trim(),
      contacto_emergencia_relacion: input.contacto_emergencia_relacion.trim(),
      talla_uniforme: input.talla_uniforme ?? null,
      alergias_medicas: input.alergias_medicas ?? null,
      avatar_url: input.avatar_url ?? undefined,
      dni_archivo_url: input.dni_archivo_url ?? undefined,
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
