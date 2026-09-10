"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";
import {
  MAX_IMAGEN_MB, MAX_IMAGEN_BYTES,
  MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES,
} from "@/shared/lib/documentos";
import { leerDocumentoConIA } from "@/features/rrhh/services/documentacion/leer-documento-ia";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export interface PerfilCompletoInput {
  // Solo lectura: vienen de su ficha y no se reescriben desde aquí.
  dni_nie?: string | null;
  fecha_nacimiento?: string | null;
  iban?: string | null;
  numero_ss?: string | null;
  telefono?: string | null;
  avatar_url?: string | null;
  dni_archivo_url?: string | null;

  // Lo que este asistente pide a los empleados ANTIGUOS. Quien entra hoy por
  // reclutamiento ya lo aportó allí y no llega a ver el asistente.
  direccion?: string | null;
  tipo_documento?: string | null;
  genero?: string | null;
  nacionalidad?: string | null;
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
  if (!p.genero?.trim()) return "Elige el género";
  if (!p.estado_civil?.trim()) return "Elige el estado civil";
  if (!p.direccion?.trim()) return "La dirección es obligatoria";

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

  // Se escribe SOLO lo que este asistente pide. Todo lo que llega del proceso de
  // selección —DNI, IBAN, SS, dirección, fecha de nacimiento, teléfono, género,
  // foto y copia del DNI— NO se toca: mandarlo desde aquí lo borraría de la ficha.
  const { error } = await supabase
    .from("empleados")
    .update({
      nacionalidad: input.nacionalidad?.trim() || null,
      direccion: input.direccion?.trim() || null,
      tipo_documento: input.tipo_documento?.trim() || null,
      genero: input.genero?.trim() || null,
      contacto_emergencia_nombre: normalizarNombre(input.contacto_emergencia_nombre),
      contacto_emergencia_telefono: input.contacto_emergencia_telefono.trim(),
      contacto_emergencia_relacion: input.contacto_emergencia_relacion.trim(),
      talla_uniforme: input.talla_uniforme ?? null,
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

/* ------------------------------------------------------------------ *
 * Documentación identificativa que sube el propio empleado
 * ------------------------------------------------------------------ */

/** Los tres que solo puede aportar él, y la columna donde vive cada ruta.
 *  El de la Seguridad Social NO está: lo genera RRHH del recorte de su nómina. */
const DOCS_PROPIOS = {
  dni_anverso: { columna: "doc_dni_anverso_path", campoIA: "dni_nie" },
  dni_reverso: { columna: "doc_dni_reverso_path", campoIA: "dni_reverso" },
  iban: { columna: "doc_iban_path", campoIA: "iban" },
} as const;

export type TipoDocPropio = keyof typeof DOCS_PROPIOS;

const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf",
};

/**
 * Guarda el documento en su sitio definitivo y lo lee con IA.
 *
 * El archivo se guarda ANTES de leerlo: si la IA falla o no lee nada, el
 * documento ya está a salvo en la ficha y solo queda teclear el dato. Al revés
 * —leer primero y guardar al confirmar— un fallo del modelo dejaría a la persona
 * sin haber entregado nada.
 *
 * Multiempresa: quien trabaja en las dos sociedades tiene una ficha por empresa
 * y el almacén está separado por empresa (una no puede abrir los archivos de la
 * otra). Por eso el mismo documento se copia a la carpeta de CADA una: si solo
 * se dejara en una, su ficha de la otra seguiría saliendo sin documentación.
 *
 * La IA solo PROPONE. Lo que devuelve va a la pantalla para que la persona lo
 * revise; no se escribe en su ficha hasta que ella lo confirma.
 */
export async function subirYLeerDocumentoPropio(input: {
  tipo: TipoDocPropio;
  file: File;
}) {
  const { supabase, user } = await getCtx();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const doc = DOCS_PROPIOS[input.tipo];
  if (!doc) return { ok: false as const, error: "Tipo de documento no válido" };

  if (!input.file || input.file.size === 0) {
    return { ok: false as const, error: "No se ha recibido ningún archivo" };
  }
  if (input.file.size > MAX_DOCUMENTO_BYTES) {
    return { ok: false as const, error: `El archivo supera ${MAX_DOCUMENTO_MB} MB` };
  }
  // La extensión sale del TIPO real, no del nombre que manda el navegador: ese
  // nombre es texto libre y acabaría dentro de la ruta.
  const ext = EXT_POR_MIME[input.file.type];
  if (!ext) {
    return { ok: false as const, error: "Formato no admitido. Sube una foto (JPG, PNG) o un PDF." };
  }

  // Las fichas salen del usuario AUTENTICADO, nunca de lo que mande el cliente:
  // así nadie puede escribir en la carpeta de otro.
  const { data: fichas } = await supabase
    .from("empleados")
    .select("id, empresa_id, doc_dni_anverso_path, doc_dni_reverso_path, doc_iban_path")
    .eq("user_id", user.id);
  if (!fichas || fichas.length === 0) {
    return { ok: false as const, error: "No se encontró tu ficha de empleado" };
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const admin = createAdminClient();

  // ⛔ MISMA NORMA QUE CON LOS DATOS: lo entregado no se reemplaza desde aquí…
  //
  // La subida hace `upsert`, así que sin esta guarda un segundo envío machacaría
  // el documento bueno — y con él la prueba de lo que RRHH comprobó en su día
  // (que el titular del certificado bancario es esa persona, por ejemplo).
  //
  // …CON UNA VENTANA DE CORRECCIÓN. La foto se guarda nada más elegirla, antes
  // de leerla, así que la borrosa, la torcida o la cara equivocada quedan dentro.
  // Con dieciocho personas fotografiando su DNI con el móvil eso pasa seguro, y
  // sin margen para repetir cada una de esas veces acaba en una llamada a RRHH.
  // Se permite rehacerlo durante la hora siguiente a haberlo subido; pasada esa
  // hora el documento se considera entregado y solo lo cambia RRHH.
  //
  // La ventana se mide con la fecha del ARCHIVO en el almacén, no con nada que
  // mande el navegador: el cliente no puede alargarse el plazo.
  // Fichas a las que les FALTA este documento. Aquí está la clave: quien trabaja
  // en las dos sociedades puede tenerlo en una y no en la otra, y a ese hay que
  // dejarle entregarlo.
  //
  // Mirarlo con `some` («¿lo tiene en alguna?») rompía el circuito entero: el
  // asistente le pedía el DNI porque le faltaba en HABANA y la subida se lo
  // rechazaba porque lo tenía en BACANAL. Le pedíamos un documento y acto
  // seguido le decíamos que ya lo teníamos. Le pasó a Iván el 10-sep-2026 al
  // probarlo, y le habría pasado a todo el que tenga ficha en las dos empresas.
  const sinDoc = fichas.filter((f) => !(f as Record<string, unknown>)[doc.columna]);

  // Solo se escribe donde falta. Las fichas que ya lo tienen no se tocan: esa es
  // la norma de no pisar lo entregado.
  let destino = sinDoc;

  if (sinDoc.length === 0) {
    // Ya consta en TODAS sus fichas. Aquí sí cabe únicamente la ventana de
    // corrección, para poder rehacer una foto que salió mal.
    const ficha = fichas[0];
    const { data: objetos } = await admin.storage
      .from("empleados-docs")
      .list(`${ficha.empresa_id}/${ficha.id}`, { search: input.tipo });

    const previo = (objetos ?? []).find((o) => o.name.startsWith(`${input.tipo}.`));
    const subidoEn = previo?.updated_at ?? previo?.created_at ?? null;
    const dentroDeVentana =
      subidoEn !== null && Date.now() - new Date(subidoEn).getTime() < 60 * 60 * 1000;

    if (!dentroDeVentana) {
      return {
        ok: false as const,
        error: "Ese documento ya lo tenemos. Si necesitas cambiarlo, avisa a RRHH.",
      };
    }
    destino = fichas;
  }

  // Una copia en cada empresa que la necesite, en la MISMA ruta que usa la
  // subida manual de RRHH: `{empresa_id}/{empleado_id}/{tipo}.{ext}`.
  for (const ficha of destino) {
    const path = `${ficha.empresa_id}/${ficha.id}/${input.tipo}.${ext}`;
    const { error: errSubida } = await admin.storage
      .from("empleados-docs")
      .upload(path, buffer, { contentType: input.file.type, upsert: true });
    if (errSubida) return { ok: false as const, error: errSubida.message };

    const { error: errFicha } = await admin
      .from("empleados")
      .update({ [doc.columna]: path, updated_at: new Date().toISOString() })
      .eq("id", ficha.id);
    if (errFicha) return { ok: false as const, error: errFicha.message };
  }

  const lectura = await leerDocumentoConIA(doc.campoIA, input.file.type, buffer);

  // ⛔ AQUÍ NO SE REVALIDA. Al subir el ÚLTIMO documento, revalidar el layout
  // hacía que el guard se recalculara en ese mismo instante, viera que ya no
  // falta nada y echara a la persona del asistente a media faena: pantalla en
  // blanco y, al recargar, «This page couldn't load». Y encima antes de que
  // pudiera pulsar «Finalizar», con lo que los datos leídos se perdían.
  //
  // El árbol se refresca al terminar, en `confirmarDatosDocumentacion`, que es
  // cuando la persona ya ha aprobado sus datos y toca salir del asistente.
  return { ok: true as const, lectura };
}

/**
 * Guarda los datos que la persona ha REVISADO Y APROBADO tras leerlos la IA.
 *
 * ⛔ SOLO RELLENA HUECOS. Nunca pisa un dato que ya esté en la ficha.
 *
 * Este formulario lo abre el propio trabajador sin que nadie lo supervise. Si
 * pudiera reescribir lo que ya hay, bastaría un error de tecleo —o mala fe— para
 * cambiar el IBAN por el que se le paga la nómina, machacando un certificado
 * bancario que RRHH ya había comprobado a mano contra el titular del documento.
 * Lo mismo con el DNI, que es lo que la gestoría usa para el contrato.
 *
 * Así que la regla es: campo vacío → se rellena; campo con algo → se ignora en
 * silencio, aunque venga distinto. La comprobación va AQUÍ y no solo en la
 * pantalla: esto es una server action alcanzable desde el navegador, y lo que
 * bloquee un input deshabilitado no cuenta.
 *
 * Para corregir un dato ya grabado está RRHH, que es quien puede contrastarlo
 * con el documento antes de tocarlo.
 */
export async function confirmarDatosDocumentacion(input: {
  dni_nie?: string | null;
  fecha_nacimiento?: string | null;
  direccion?: string | null;
  iban?: string | null;
}) {
  const { supabase, user } = await getCtx();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: fichas } = await supabase
    .from("empleados")
    .select("id, dni_nie, fecha_nacimiento, direccion, iban, iban_verificado")
    .eq("user_id", user.id);
  if (!fichas || fichas.length === 0) {
    return { ok: false, error: "No se encontró tu ficha de empleado" };
  }

  const vacio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
  // Basta que UNA ficha ya tenga el dato para no tocarlo en ninguna: sus fichas
  // son la misma persona y deben acabar iguales.
  const yaTiene = (campo: "dni_nie" | "fecha_nacimiento" | "direccion" | "iban") =>
    fichas.some((f) => !vacio((f as Record<string, unknown>)[campo]));
  const ibanBlindado = fichas.some((f) => Boolean(f.iban_verificado)) || yaTiene("iban");

  const patch: Record<string, unknown> = {};
  const ignorados: string[] = [];

  if (input.dni_nie?.trim()) {
    if (yaTiene("dni_nie")) ignorados.push("dni_nie");
    else patch.dni_nie = input.dni_nie.trim().toUpperCase();
  }
  if (input.iban?.trim()) {
    // El IBAN lleva candado extra: si está verificado no se toca ni estando vacío
    // en alguna de sus fichas — ese dato salió de un certificado comprobado.
    if (ibanBlindado) ignorados.push("iban");
    else patch.iban = input.iban.replace(/\s/g, "").toUpperCase();
  }
  if (input.direccion?.trim()) {
    if (yaTiene("direccion")) ignorados.push("direccion");
    else patch.direccion = input.direccion.trim();
  }
  if (input.fecha_nacimiento && /^\d{4}-\d{2}-\d{2}$/.test(input.fecha_nacimiento)) {
    if (yaTiene("fecha_nacimiento")) ignorados.push("fecha_nacimiento");
    else patch.fecha_nacimiento = input.fecha_nacimiento;
  }

  if (ignorados.length > 0) {
    // Queda en el log: si alguien intenta cambiar su IBAN por aquí, se ve.
    console.warn(
      `[primer-acceso] datos ya grabados, no se sobrescriben (user ${user.id}): ${ignorados.join(", ")}`,
    );
  }

  if (Object.keys(patch).length === 0) return { ok: true, ignorados };

  const { error } = await createAdminClient()
    .from("empleados")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .in("id", fichas.map((f) => f.id as string));

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, ignorados };
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
