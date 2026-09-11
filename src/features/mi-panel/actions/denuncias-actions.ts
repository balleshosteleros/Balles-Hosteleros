"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { friendlyError } from "@/shared/lib/friendly-errors";

export type ModalidadDenuncia = "nominal" | "anonima";

export type CategoriaDenuncia =
  | "acoso_laboral"
  | "discriminacion"
  | "seguridad_salud"
  | "irregularidad"
  | "trato_cliente"
  | "queja_general"
  | "otro";

export type EstadoDenuncia =
  | "recibida"
  | "en_investigacion"
  | "informacion_solicitada"
  | "resuelta"
  | "archivada";

export interface DenunciaRow {
  id: string;
  modalidad: ModalidadDenuncia;
  denunciante_nombre: string | null;
  categoria: CategoriaDenuncia;
  asunto: string;
  relato: string;
  fecha_hechos: string | null;
  lugar: string | null;
  personas_implicadas: string | null;
  testigos: string | null;
  estado: EstadoDenuncia;
  respuesta: string | null;
  notas_internas: string | null;
  revisado_at: string | null;
  cerrado_at: string | null;
  created_at: string;
}

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empresaId = user ? await getEmpresaActivaForUser(supabase, user.id) : null;
  return { supabase, user, empresaId };
}

export interface PresentarDenunciaInput {
  modalidad: ModalidadDenuncia;
  categoria: CategoriaDenuncia;
  asunto: string;
  relato: string;
  fecha_hechos?: string | null;
  lugar?: string | null;
  personas_implicadas?: string | null;
  testigos?: string | null;
}

/**
 * Presenta una denuncia por el canal interno.
 *
 * La anónima se inserta con el cliente admin y sin `user_id`: su fila —la que
 * lee RRHH— no lleva identidad. Quién la puso se guarda aparte, en
 * `denuncias_autor_anonimo`, que solo puede leer su propio autor: así la ve en
 * su lista de quejas sin que la empresa sepa de quién es.
 */
export async function presentarDenuncia(
  input: PresentarDenunciaInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };
    if (!input.asunto.trim()) return { ok: false, error: "El asunto es obligatorio" };
    if (!input.relato.trim()) return { ok: false, error: "Hay que describir los hechos" };

    const comun = {
      empresa_id: empresaId,
      categoria: input.categoria,
      asunto: input.asunto.trim(),
      relato: input.relato.trim(),
      fecha_hechos: input.fecha_hechos || null,
      lugar: input.lugar?.trim() || null,
      personas_implicadas: input.personas_implicadas?.trim() || null,
      testigos: input.testigos?.trim() || null,
      estado: "recibida" as const,
    };

    if (input.modalidad === "anonima") {
      // Cliente admin: la fila no se asocia a la sesión de quien la presenta.
      const admin = createAdminClient();
      const { data: creada, error } = await admin
        .from("denuncias")
        .insert({
          ...comun,
          modalidad: "anonima",
          user_id: null,
          denunciante_nombre: null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // El vínculo con su autor, en la tabla que solo él puede leer. Si esto
      // fallara la queja ya está presentada y RRHH la tramita igual; lo único
      // que pierde el trabajador es verla en su lista, así que no se rompe el
      // envío por ello, pero queda constancia en el log.
      const { error: errAutor } = await admin
        .from("denuncias_autor_anonimo")
        .insert({
          denuncia_id: creada.id,
          user_id: user.id,
          empresa_id: empresaId,
        });
      if (errAutor) {
        console.error("[denuncias] vínculo de la anónima con su autor:", errAutor);
      }
      return { ok: true };
    }

    const { data: perfil } = await supabase
      .from("usuarios")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error } = await supabase.from("denuncias").insert({
      ...comun,
      modalidad: "nominal",
      user_id: user.id,
      denunciante_nombre: (perfil?.full_name as string) ?? null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[denuncias] presentarDenuncia:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Una queja tal como la ve quien la presentó. No lleva las notas internas de
 * RRHH: de la tramitación solo le corresponde la respuesta.
 */
export interface MiDenuncia {
  id: string;
  modalidad: ModalidadDenuncia;
  categoria: CategoriaDenuncia;
  asunto: string;
  estado: EstadoDenuncia;
  respuesta: string | null;
  created_at: string;
}

const COLUMNAS_MI_DENUNCIA = "id, modalidad, categoria, asunto, estado, respuesta, created_at";

/**
 * Todas las quejas del empleado: las que puso a su nombre y también las
 * anónimas, que reconoce por su `modalidad`. Las anónimas no se localizan por
 * `user_id` —su fila no lo lleva— sino por `denuncias_autor_anonimo`.
 */
export async function listMisDenuncias(): Promise<{ ok: boolean; data: MiDenuncia[]; error?: string }> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return { ok: true, data: [] };

    const { data: nominales, error } = await supabase
      .from("denuncias")
      .select(COLUMNAS_MI_DENUNCIA)
      .eq("empresa_id", empresaId)
      .eq("modalidad", "nominal")
      .eq("user_id", user.id);
    if (error) throw error;

    const { data: enlaces, error: errEnlaces } = await supabase
      .from("denuncias_autor_anonimo")
      .select("denuncia_id")
      .eq("empresa_id", empresaId)
      .eq("user_id", user.id);
    if (errEnlaces) throw errEnlaces;

    const ids = (enlaces ?? []).map((e) => e.denuncia_id as string);
    let anonimas: unknown[] = [];
    if (ids.length > 0) {
      const { data, error: errAnon } = await supabase
        .from("denuncias")
        .select(COLUMNAS_MI_DENUNCIA)
        .in("id", ids);
      if (errAnon) throw errAnon;
      anonimas = data ?? [];
    }

    // La última que presentó, arriba.
    const data = [...(nominales ?? []), ...anonimas] as MiDenuncia[];
    data.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { ok: true, data };
  } catch (err) {
    console.error("[denuncias] listMisDenuncias:", err);
    return { ok: false, data: [], error: friendlyError(err, "listMisDenuncias") };
  }
}

// ─── Bandeja de RRHH ────────────────────────────────────────────────────────

/** Todas las denuncias de la empresa. La RLS ya restringe esto a RRHH. */
export async function listDenunciasRRHH(): Promise<{ ok: boolean; data: DenunciaRow[]; error?: string }> {
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("denuncias")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as DenunciaRow[] };
  } catch (err) {
    console.error("[denuncias] listDenunciasRRHH:", err);
    return { ok: false, data: [], error: friendlyError(err, "listDenunciasRRHH") };
  }
}

/** ¿El usuario actual puede acceder a la bandeja de denuncias? */
export async function puedeVerDenuncias(): Promise<boolean> {
  try {
    const { supabase, user } = await ctx();
    if (!user) return false;
    const { data, error } = await supabase.rpc("rol_puede_ver_denuncias", { uid: user.id });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("[denuncias] puedeVerDenuncias:", err);
    return false;
  }
}

export async function actualizarDenuncia(
  id: string,
  patch: { estado?: EstadoDenuncia; respuesta?: string | null; notas_internas?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };

    const upd: Record<string, unknown> = {
      ...patch,
      revisado_por: user.id,
      revisado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (patch.estado === "resuelta" || patch.estado === "archivada") {
      upd.cerrado_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("denuncias")
      .update(upd)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    if (patch.estado) {
      await supabase.from("denuncias_actuaciones").insert({
        denuncia_id: id,
        empresa_id: empresaId,
        tipo: `estado:${patch.estado}`,
        detalle: patch.respuesta ?? null,
        realizado_por: user.id,
      });
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[denuncias] actualizarDenuncia:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Integración en la lista de Solicitudes ─────────────────────────────────
// Las denuncias son un tipo más de solicitud para quien las gestiona, aunque
// sus datos vivan aparte por confidencialidad. Estas funciones las adaptan a la
// forma de una fila de `solicitudes_personal` para poder listarlas mezcladas.

export interface DenunciaComoSolicitud {
  id: string;
  empresaId: string;
  userId: string;
  empleadoNombre: string;
  tipo: "queja";
  subtipo: "denuncia";
  fechaInicio: string;
  fechaFin: string | null;
  horas: number | null;
  motivo: string;
  estado: "pendiente" | "aprobada" | "rechazada" | "anulada";
  createdAt: string;
  puedoValidar: boolean;
  /**
   * Las denuncias no registran revisor: su gestión es confidencial y sigue su
   * propio ciclo (resuelta/archivada). Van a null para encajar en la forma
   * común de una solicitud.
   */
  revisadoPor: string | null;
  revisadoAt: string | null;
}

/** Estado de la denuncia traducido al de una solicitud. */
function estadoComoSolicitud(estado: EstadoDenuncia): DenunciaComoSolicitud["estado"] {
  if (estado === "resuelta") return "aprobada";
  if (estado === "archivada") return "rechazada";
  return "pendiente";
}

/**
 * Denuncias en forma de solicitud, para mezclarlas en la lista de RRHH.
 * Devuelve vacío si el usuario no tiene acceso: la confidencialidad se mantiene.
 */
export async function listDenunciasComoSolicitudes(
  soloPendientes: boolean,
): Promise<{ ok: boolean; data: DenunciaComoSolicitud[]; error?: string }> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return { ok: true, data: [] };

    const { data: permitido } = await supabase.rpc("rol_puede_ver_denuncias", { uid: user.id });
    if (permitido !== true) return { ok: true, data: [] };

    let query = supabase
      .from("denuncias")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (soloPendientes) {
      query = query.not("estado", "in", "(resuelta,archivada)");
    }
    const { data, error } = await query;
    if (error) throw error;

    return {
      ok: true,
      data: ((data ?? []) as DenunciaRow[]).map((d) => ({
        id: d.id,
        empresaId: empresaId,
        userId: "",
        // En las anónimas no hay nombre que mostrar: es el propósito del canal.
        empleadoNombre:
          d.modalidad === "anonima" ? "Anónima" : d.denunciante_nombre ?? "Sin nombre",
        tipo: "queja" as const,
        subtipo: "denuncia" as const,
        fechaInicio: d.fecha_hechos ?? d.created_at.slice(0, 10),
        fechaFin: null,
        horas: null,
        motivo: d.asunto,
        estado: estadoComoSolicitud(d.estado),
        createdAt: d.created_at,
        puedoValidar: true,
        revisadoPor: null,
        revisadoAt: null,
      })),
    };
  } catch (err) {
    console.error("[denuncias] listDenunciasComoSolicitudes:", err);
    return { ok: false, data: [], error: friendlyError(err, "listDenunciasComoSolicitudes") };
  }
}

/** Aprobar = resuelta. Denegar = archivada. Con la nota como respuesta. */
export async function resolverDenunciaDesdeSolicitudes(
  id: string,
  aprobar: boolean,
  notas?: string,
): Promise<{ ok: boolean; error?: string }> {
  return actualizarDenuncia(id, {
    estado: aprobar ? "resuelta" : "archivada",
    respuesta: notas?.trim() || null,
  });
}
