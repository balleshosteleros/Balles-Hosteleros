"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { friendlyError } from "@/shared/lib/friendly-errors";
import {
  BUCKET_COMUNICADOS,
  MAX_ADJUNTOS_COMUNICADO,
  type ComunicadoAdjunto,
} from "@/features/gerencia/data/comunicados-adjuntos";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export async function listComunicados() {
  try {
    const { supabase, empresaId } = await getContext();
    // Sin empresa resuelta no se devuelve NADA. Antes se omitía el filtro, que
    // es justo lo contrario de lo que hace falta: enseñaba las de todas.
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("comunicados")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicados] listComunicados:", err);
    return { ok: false, data: [], error: friendlyError(err, "listComunicados") };
  }
}

export interface EmpleadoSelector {
  userId: string;
  nombre: string;
  apellidos: string;
  rolLabel: string | null;
  departamento: string | null;
  /** Puesto REAL (p. ej. "CANTANTE"). `rolLabel` es el nombre del departamento
   *  en este sistema, por eso para "puesto · departamento" se usa este campo. */
  puesto: string | null;
}

/**
 * `user_id` de la plantilla ACTIVA de la empresa.
 *
 * Va con la clave de servicio porque solo hace falta cruzar identificadores y
 * la RLS de `empleados` depende de quién mire: quien publica un comunicado no
 * tiene por qué poder leer las fichas de personal.
 */
async function userIdsDeLaPlantilla(empresaId: string): Promise<Set<string>> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient()
    .from("empleados")
    .select("user_id")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo");
  const ids = new Set<string>();
  for (const f of (data ?? []) as Array<{ user_id: string | null }>) {
    if (f.user_id) ids.add(f.user_id);
  }
  return ids;
}

export async function listEmpleadosParaComunicado(): Promise<{
  ok: boolean;
  data: EmpleadoSelector[];
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };
    // Vía RPC SECURITY DEFINER: resuelve el PUESTO real (empleado_puestos).
    // usuarios tiene RLS que solo deja ver el propio perfil.
    const { data, error } = await supabase.rpc("chat_empleados", { p_empresa: empresaId });
    if (error) throw error;

    // Un comunicado se dirige a EMPLEADOS, no a cualquiera que tenga acceso al
    // software. La RPC parte de los logins, así que colaba a quien no tiene
    // ficha en esta empresa —entre ellos la cuenta de pruebas de Ágora—, y esa
    // gente aparecía en la lista de destinatarios como si fuera plantilla.
    const plantilla = await userIdsDeLaPlantilla(empresaId);

    return {
      ok: true,
      data: (data ?? [])
        .filter((r: Record<string, unknown>) => !!r.user_id && plantilla.has(r.user_id as string))
        .map((r: Record<string, unknown>) => ({
          userId: r.user_id as string,
          nombre: (r.nombre as string) ?? "",
          apellidos: (r.apellidos as string) ?? "",
          rolLabel: (r.rol_label as string | null) ?? null,
          departamento: (r.departamento as string | null) ?? null,
          puesto: (r.puesto as string | null) ?? null,
        })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] listEmpleadosParaComunicado:", msg);
    return { ok: false, data: [], error: msg };
  }
}

/** Deja el nombre del archivo en algo que el almacén acepta como ruta. */
function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

/**
 * URLs de subida firmadas para que el navegador suba los adjuntos DIRECTO al
 * bucket. Si el archivo pasara por la Server Action, un PDF de más de 4,5 MB
 * fallaría siempre (límite del body en Vercel).
 *
 * Se suben a `<empresa>/_pendientes/`: el comunicado todavía no existe cuando
 * se elige el archivo. Al guardar solo viajan los metadatos.
 */
export async function crearUrlsSubidaComunicado(
  archivos: Array<{ name: string; type: string }>,
): Promise<
  { ok: true; data: Array<{ token: string; path: string }> } | { ok: false; error: string }
> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const lista = (archivos ?? []).slice(0, MAX_ADJUNTOS_COMUNICADO);
    if (lista.length === 0) return { ok: false, error: "No hay archivos que subir" };

    const salida: Array<{ token: string; path: string }> = [];
    let idx = 0;
    for (const a of lista) {
      const safe = sanitizeFilename(a.name || "documento");
      const path = `${empresaId}/_pendientes/${Date.now()}_${idx}_${safe}`;
      idx += 1;
      const { data, error } = await supabase.storage
        .from(BUCKET_COMUNICADOS)
        .createSignedUploadUrl(path);
      if (error || !data) {
        console.error("[comunicados] signedUpload:", error?.message);
        return { ok: false, error: "No se pudo preparar la subida" };
      }
      salida.push({ token: data.token, path: data.path });
    }
    return { ok: true, data: salida };
  } catch (err) {
    console.error("[comunicados] crearUrlsSubidaComunicado:", err);
    return { ok: false, error: "Error al preparar la subida" };
  }
}

/**
 * Resultado de guardar un comunicado.
 *
 * El correo se informa APARTE del guardado: el comunicado puede quedar
 * perfectamente publicado y el correo no haber salido (nadie con dirección,
 * transporte caído...). Si eso se devolviera como un simple `ok`, quien lo
 * publica se iría convencido de que la plantilla lo tiene en su bandeja.
 */
export interface ResultadoGuardarComunicado {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown> | null;
  /** Cuántos correos salieron de verdad. 0 si no se pidió mandarlo por correo. */
  emailEnviados?: number;
  /** Por qué no salió el correo, si se pidió y falló. */
  emailError?: string;
}

export interface ComunicadoInput {
  titulo: string;
  asunto?: string;
  cuerpo?: string;
  estado?: string;
  prioridad?: string;
  recurrencia?: string;
  todaEmpresa?: boolean;
  rolesDestinatarios?: string[];
  empleadosDestinatarios?: string[];
  departamentosDestinatarios?: string[];
  envio?: string | null;
  observaciones?: string;
  /** Documentos ya subidos al bucket; aquí solo viajan sus metadatos. */
  adjuntos?: ComunicadoAdjunto[];
  /** Además del aviso en la app, mandarlo por correo al publicarlo. */
  enviarEmail?: boolean;
  /** Dirección que se abre desde el aviso y desde el comunicado. */
  enlace?: string;
  /** Lo que se lee en el botón del enlace. */
  enlaceTexto?: string;
}

/**
 * Deja la dirección lista para pinchar, o vacía si no vale.
 *
 * Se acepta escribirla a medias ("www.algo.com"): se le pone el "https://"
 * delante. Lo que no sea una dirección de web se descarta, para que el botón
 * del comunicado no lleve a ningún sitio raro.
 */
function normalizarEnlace(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const conEsquema = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(conEsquema);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function toRow(input: ComunicadoInput) {
  return {
    titulo: input.titulo,
    asunto: input.asunto ?? null,
    cuerpo: input.cuerpo ?? "",
    estado: input.estado ?? "borrador",
    prioridad: input.prioridad ?? "normal",
    recurrencia: input.recurrencia ?? "sin_repeticion",
    toda_empresa: input.todaEmpresa ?? true,
    roles_destinatarios: input.rolesDestinatarios ?? [],
    empleados_destinatarios: input.empleadosDestinatarios ?? [],
    departamentos_destinatarios: input.departamentosDestinatarios ?? [],
    envio: input.envio ?? null,
    observaciones: input.observaciones ?? null,
    adjuntos: input.adjuntos ?? [],
    enviar_email: input.enviarEmail ?? false,
    enlace: normalizarEnlace(input.enlace),
    enlace_texto: (input.enlaceTexto ?? "").trim() || null,
  };
}

/**
 * Avisos de un comunicado recién publicado: push al móvil, campana in-app y,
 * si se pidió, correo con los documentos adjuntos.
 *
 * Ningún fallo de aviso tumba la publicación: el comunicado ya está guardado.
 * Devuelve el resultado del correo para poder decirlo en pantalla, porque un
 * correo que no sale es justo lo que nadie se entera de que no ha salido.
 */
async function avisarComunicadoPublicado(
  comunicadoId: string,
  enviarEmail: boolean,
): Promise<{ emailEnviados: number; emailError?: string }> {
  try {
    const { notificarComunicadoNuevo } = await import(
      "@/features/mi-panel/mobile/lib/push-comunicado"
    );
    await notificarComunicadoNuevo(comunicadoId);
  } catch (e) {
    console.error("[comunicados] push:", e);
  }
  try {
    // Notificación in-app (campana + registro) — motor de alertas PRP-065.
    const { emitirNotifComunicado } = await import(
      "@/features/notificaciones/actions/emisores-actions"
    );
    await emitirNotifComunicado(comunicadoId);
  } catch (e) {
    console.error("[comunicados] notif:", e);
  }

  if (!enviarEmail) return { emailEnviados: 0 };
  try {
    const { enviarComunicadoPorEmail } = await import(
      "@/features/gerencia/services/comunicado-email"
    );
    const res = await enviarComunicadoPorEmail(comunicadoId);
    return { emailEnviados: res.enviados, emailError: res.ok ? undefined : res.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[comunicados] email:", msg);
    return { emailEnviados: 0, emailError: msg };
  }
}

export async function createComunicado(
  input: ComunicadoInput,
): Promise<ResultadoGuardarComunicado> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("comunicados")
      .insert({
        ...toRow(input),
        empresa_id: empresaId,
        creador_id: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    if (data?.id && data?.estado === "publicado") {
      const aviso = await avisarComunicadoPublicado(
        data.id as string,
        input.enviarEmail === true,
      );
      return { ok: true, data, ...aviso };
    }

    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] createComunicado:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Cambia SOLO el estado de un comunicado: publicarlo, archivarlo o devolverlo a
 * borrador. Nada más se toca.
 *
 * Existe porque `updateComunicado` reescribe el comunicado ENTERO a partir de
 * lo que haya en pantalla: usarlo para cambiar el estado desde el listado
 * borraba los documentos adjuntos, los destinatarios y la fecha de envío, que
 * ahí no se están viendo.
 *
 * Al publicar dispara los mismos avisos que al publicarlo desde su ficha: push
 * al móvil, campana de la app y, si el comunicado lo pedía, correo con sus
 * documentos. El correo sale UNA sola vez, aunque se publique de nuevo.
 */
export async function cambiarEstadoComunicado(
  id: string,
  estado: "borrador" | "programado" | "publicado" | "archivado",
  /** Si se dice, se guarda antes de publicar: es la decisión del momento de mandarlo. */
  enviarEmail?: boolean,
): Promise<ResultadoGuardarComunicado> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: anterior } = await supabase
      .from("comunicados")
      .select("estado, email_enviado_at, enviar_email, recurrencia, envio")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!anterior) return { ok: false, error: "El comunicado ya no existe" };

    const cambios: Record<string, unknown> = {
      estado,
      updated_at: new Date().toISOString(),
    };
    if (enviarEmail !== undefined) cambios.enviar_email = enviarEmail;

    // Al publicar se apunta CUÁNDO salió, que es lo que se enseña en la columna
    // de envío. En los que se repiten no se toca: ahí `envio` es la fecha de la
    // próxima vez y machacarla haría que el cron lo volviera a mandar.
    if (estado === "publicado" && anterior.recurrencia === "sin_repeticion") {
      cambios.envio = new Date().toISOString();
    }

    const { error } = await supabase
      .from("comunicados")
      .update(cambios)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    const quiereEmail = enviarEmail ?? anterior.enviar_email === true;
    const eraBorrador = anterior.estado !== "publicado";
    if (estado === "publicado" && eraBorrador) {
      const yaSalioElCorreo = !!anterior.email_enviado_at;
      const aviso = await avisarComunicadoPublicado(id, quiereEmail && !yaSalioElCorreo);
      return { ok: true, ...aviso };
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] cambiarEstadoComunicado:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Manda por correo un comunicado YA publicado.
 *
 * Hace falta porque el correo solo sale en el momento de publicar: si se
 * publicó sin marcar el correo, o el envío falló, no había forma de mandarlo
 * después salvo volver a crear el comunicado. Deja marcado el comunicado como
 * «también por correo» para que quede constancia de que salió.
 */
export async function enviarCorreoComunicado(
  id: string,
): Promise<ResultadoGuardarComunicado> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: fila } = await supabase
      .from("comunicados")
      .select("estado")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!fila) return { ok: false, error: "El comunicado ya no existe" };
    if (fila.estado !== "publicado") {
      return { ok: false, error: "Publica el comunicado antes de mandarlo por correo" };
    }

    await supabase
      .from("comunicados")
      .update({ enviar_email: true })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    const { enviarComunicadoPorEmail } = await import(
      "@/features/gerencia/services/comunicado-email"
    );
    const res = await enviarComunicadoPorEmail(id);
    return {
      ok: res.ok,
      error: res.ok ? undefined : res.error,
      emailEnviados: res.enviados,
      emailError: res.ok ? undefined : res.error,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] enviarCorreoComunicado:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateComunicado(
  id: string,
  input: ComunicadoInput,
): Promise<ResultadoGuardarComunicado> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data: anterior } = await supabase
      .from("comunicados")
      .select("estado, email_enviado_at")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!anterior) return { ok: false, error: "El comunicado ya no existe" };

    const { error } = await supabase
      .from("comunicados")
      .update({ ...toRow(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    // Solo notificamos al pasar de borrador → publicado para evitar spam de pushes
    // en ediciones menores de un comunicado ya publicado.
    const eraBorrador = anterior?.estado !== "publicado";
    const ahoraPublicado = (input.estado ?? "borrador") === "publicado";
    if (eraBorrador && ahoraPublicado) {
      // El correo solo sale la PRIMERA vez. Si ya salió, volver a guardar el
      // comunicado no vuelve a llenar la bandeja de toda la plantilla.
      const yaSalioElCorreo = !!anterior?.email_enviado_at;
      const aviso = await avisarComunicadoPublicado(
        id,
        input.enviarEmail === true && !yaSalioElCorreo,
      );
      return { ok: true, ...aviso };
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] updateComunicado:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteComunicado(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("comunicados")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] deleteComunicado:", msg);
    return { ok: false, error: msg };
  }
}
