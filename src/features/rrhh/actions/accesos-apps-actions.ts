"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/anon";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { encryptOptional, decrypt } from "@/features/accesos/lib/crypto";
import {
  type AccesoApp,
  type AccesoCredencial,
  MAX_ACCESOS_POR_APP,
} from "@/features/rrhh/data/accesos-apps";

/** Minutos que dura una verificación de identidad antes de volver a pedirla. */
const VERIFICACION_VALIDEZ_MIN = 5;

/** Marca que sustituye a la contraseña en las listas (nunca se envía cifrada/clara al cliente sin verificar). */
const PWD_OCULTA = "";

/** ¿El texto tiene formato cifrado AES (iv:tag:enc)? */
function esCifrado(s: string): boolean {
  return typeof s === "string" && s.split(":").length === 3 && s.length > 20;
}

type Row = {
  id: string;
  empresa_slug: string;
  empresa_id: string | null;
  nombre: string;
  descripcion: string;
  url: string;
  icono: string;
  logo_url: string | null;
  categoria: string;
  departamentos: string[];
  roles_autorizados: string[];
  accesos: AccesoCredencial[] | null;
  usuario: string;
  contrasena: string;
  estado: AccesoApp["estado"];
  responsable: string;
  notas: string;
  tipo_integracion: AccesoApp["tipoIntegracion"];
  updated_at: string;
};

/** Normaliza la lista de accesos: filtra vacíos y aplica el tope de 10. */
function normalizarAccesos(accesos?: AccesoCredencial[] | null): AccesoCredencial[] {
  const list = (accesos ?? [])
    .map((a) => ({
      etiqueta: (a.etiqueta ?? "").trim(),
      usuario: (a.usuario ?? "").trim(),
      contrasena: a.contrasena ?? "",
      roles: Array.isArray(a.roles)
        ? a.roles.map((r) => (r ?? "").trim()).filter(Boolean)
        : [],
    }))
    .filter((a) => a.etiqueta || a.usuario || a.contrasena);
  return list.slice(0, MAX_ACCESOS_POR_APP);
}

/**
 * Convierte una fila a AccesoApp para ENVIAR AL CLIENTE.
 * SEGURIDAD: nunca incluye contraseñas (ni cifradas ni en claro). El cliente
 * solo sabe si un acceso "tiene" contraseña (para pintar ••••). El revelado va
 * por `revelarAccesoApp` con verificación de identidad.
 */
function rowToApp(r: Row): AccesoApp {
  const accesos = normalizarAccesos(r.accesos);
  // Compat: si no hay array pero sí columnas legacy, materializa un acceso.
  if (accesos.length === 0 && (r.usuario || r.contrasena)) {
    accesos.push({ etiqueta: "", usuario: r.usuario, contrasena: r.contrasena });
  }
  // Oculta toda contraseña antes de salir al cliente; marca si existía.
  const accesosSeguros = accesos.map((a) => ({
    ...a,
    tieneContrasena: !!(a.contrasena && a.contrasena.length > 0),
    contrasena: PWD_OCULTA,
  }));
  return {
    id: r.id,
    empresaId: r.empresa_slug,
    nombre: r.nombre,
    descripcion: r.descripcion,
    url: r.url,
    icono: r.icono,
    logoUrl: r.logo_url ?? undefined,
    categoria: r.categoria,
    departamentos: r.departamentos ?? [],
    rolesAutorizados: r.roles_autorizados ?? [],
    accesos: accesosSeguros,
    usuario: accesosSeguros[0]?.usuario ?? r.usuario ?? "",
    contrasena: PWD_OCULTA,
    estado: r.estado,
    responsable: r.responsable,
    notas: r.notas,
    tipoIntegracion: r.tipo_integracion,
    ultimaActualizacion: (r.updated_at ?? "").slice(0, 10),
  };
}

/**
 * Construye la fila a guardar, CIFRANDO las contraseñas.
 * `prev` = accesos actuales en BD (cifrados). Si el cliente manda una contraseña
 * vacía para un acceso existente, se PRESERVA la cifrada previa (no se borra).
 * Si manda texto, se cifra. El emparejado con lo previo es por posición/etiqueta.
 */
function appToRow(
  a: Partial<AccesoApp> & { id: string; empresaId: string },
  prev?: AccesoCredencial[] | null,
) {
  const accesos = normalizarAccesos(a.accesos);
  const prevList = prev ?? [];

  const accesosCifrados = accesos.map((acc, i) => {
    const entrante = acc.contrasena ?? "";
    let contrasena: string;
    if (entrante && !esCifrado(entrante)) {
      // El cliente mandó una contraseña nueva en claro → cifrar.
      contrasena = encryptOptional(entrante);
    } else if (esCifrado(entrante)) {
      // Ya viene cifrada (caso raro) → dejar igual.
      contrasena = entrante;
    } else {
      // Vacía → preservar la previa cifrada (match por etiqueta, si no por índice).
      const previo =
        prevList.find((p) => (p.etiqueta ?? "") === (acc.etiqueta ?? "") && p.etiqueta) ??
        prevList[i];
      contrasena = previo?.contrasena ?? "";
    }
    return {
      etiqueta: acc.etiqueta ?? "",
      usuario: acc.usuario ?? "",
      contrasena,
      roles: acc.roles ?? [],
    };
  });

  return {
    id: a.id,
    empresa_slug: a.empresaId,
    nombre: a.nombre ?? "",
    descripcion: a.descripcion ?? "",
    url: a.url ?? "",
    icono: a.icono ?? "🔗",
    logo_url: a.logoUrl ?? null,
    categoria: a.categoria ?? "Otros",
    departamentos: a.departamentos ?? [],
    roles_autorizados: a.rolesAutorizados ?? [],
    accesos: accesosCifrados,
    // Legacy: usuario del primer acceso; contraseña legacy se deja vacía (todo va en accesos[]).
    usuario: accesosCifrados[0]?.usuario ?? a.usuario ?? "",
    contrasena: "",
    estado: a.estado ?? "Activo",
    responsable: a.responsable ?? "",
    notas: a.notas ?? "",
    tipo_integracion: a.tipoIntegracion ?? "enlace",
  };
}

/**
 * Resuelve empresa_id (uuid) a partir del slug usando la sesión del usuario,
 * de forma que RLS (`empresas_read`) garantice que el usuario tiene acceso.
 * Devuelve null si el slug no existe o el usuario no pertenece a esa empresa.
 */
async function resolverEmpresaIdDesdeSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

async function getUserOrNull(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function userTieneRolAdminODirector(userId: string): Promise<boolean> {
  const { esDirector } = await getRolContext(userId);
  return esDirector;
}

/** Lista accesos de UNA empresa. RLS enforça que el usuario pertenezca a ella. */
export async function listAccesosApps(empresaSlug: string): Promise<AccesoApp[]> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) return [];

  const { data, error } = await supabase
    .from("accesos_apps")
    .select("*")
    .eq("empresa_slug", empresaSlug)
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[accesos-apps] listAccesosApps:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToApp(r as Row));
}

/**
 * Lista TODOS los accesos (todas las empresas). Solo admin/director.
 * Otros usuarios reciben array vacío (no se filtra: se rechaza).
 */
export async function listAllAccesosApps(): Promise<AccesoApp[]> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) return [];
  if (!(await userTieneRolAdminODirector(user.id))) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("accesos_apps")
    .select("*")
    .order("empresa_slug", { ascending: true })
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[accesos-apps] listAllAccesosApps:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToApp(r as Row));
}

/** Crea un acceso. RLS rechaza si el usuario no pertenece a la empresa indicada. */
export async function createAccesoApp(
  app: Omit<AccesoApp, "id" | "ultimaActualizacion"> & { id?: string },
): Promise<AccesoApp> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) throw new Error("No autorizado");

  const empresaId = await resolverEmpresaIdDesdeSlug(supabase, app.empresaId);
  if (!empresaId) throw new Error("Empresa no encontrada o sin acceso");

  const id = app.id?.trim() || `app-${Date.now()}`;
  const row = { ...appToRow({ ...app, id }), empresa_id: empresaId };
  const { data, error } = await supabase
    .from("accesos_apps")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[accesos-apps] createAccesoApp:", error);
    throw new Error(`Error al crear acceso: ${error.message}`);
  }
  return rowToApp(data as Row);
}

/** Actualiza un acceso por id. RLS rechaza cross-tenant. */
export async function updateAccesoApp(
  id: string,
  patch: Partial<AccesoApp>,
): Promise<AccesoApp> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) throw new Error("No autorizado");

  // Lee los accesos actuales (cifrados) para preservar contraseñas no editadas.
  const { data: prevRow } = await supabase
    .from("accesos_apps")
    .select("accesos")
    .eq("id", id)
    .maybeSingle();
  const prevAccesos = (prevRow?.accesos ?? null) as AccesoCredencial[] | null;

  const row = appToRow({ ...patch, id, empresaId: patch.empresaId ?? "" }, prevAccesos);
  // Si el patch no trae empresaId, no sobreescribir empresa_slug (ni empresa_id)
  if (!patch.empresaId) {
    delete (row as Partial<typeof row>).empresa_slug;
  } else {
    const empresaId = await resolverEmpresaIdDesdeSlug(supabase, patch.empresaId);
    if (!empresaId) throw new Error("Empresa no encontrada o sin acceso");
    (row as Record<string, unknown>).empresa_id = empresaId;
  }

  const { data, error } = await supabase
    .from("accesos_apps")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("[accesos-apps] updateAccesoApp:", error);
    throw new Error(`Error al actualizar acceso: ${error.message}`);
  }
  return rowToApp(data as Row);
}

/** Elimina un acceso por id. RLS rechaza cross-tenant. */
export async function deleteAccesoApp(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) throw new Error("No autorizado");

  const { error } = await supabase.from("accesos_apps").delete().eq("id", id);
  if (error) {
    console.error("[accesos-apps] deleteAccesoApp:", error);
    throw new Error(`Error al eliminar acceso: ${error.message}`);
  }
}

const LOGOS_BUCKET = "app-logos";

/**
 * Sube una imagen de logo para una app a Supabase Storage y devuelve su URL
 * pública. No persiste en accesos_apps (eso lo hace el guardado de la app con
 * el logoUrl devuelto). Solo authenticated.
 */
export async function subirLogoApp(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) return { ok: false, error: "No autenticado" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No se recibió ninguna imagen" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "El archivo debe ser una imagen" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "La imagen no puede superar 2 MB" };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `logos/${Date.now()}-${Math.floor(file.size)}.${ext}`;

  const { error: upErr } = await admin.storage
    .from(LOGOS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return { ok: false, error: `Error al subir: ${upErr.message}` };

  const { data: { publicUrl } } = admin.storage.from(LOGOS_BUCKET).getPublicUrl(path);
  return { ok: true, url: publicUrl };
}

/**
 * Verificación rápida de identidad antes de revelar cualquier contraseña.
 * Revalida la contraseña de acceso del usuario con un cliente anon efímero
 * (no toca la sesión). Válida `VERIFICACION_VALIDEZ_MIN` minutos en el cliente.
 */
export async function verificarIdentidadAccesos(
  password: string,
): Promise<{ ok: true; validezMin: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) return { ok: false, error: "No autenticado" };
  if (!password) return { ok: false, error: "Introduce tu contraseña" };

  const email = user.email;
  if (!email) return { ok: false, error: "No se pudo verificar tu identidad" };

  const probe = createAnonClient();
  const { error } = await probe.auth.signInWithPassword({ email, password });
  await probe.auth.signOut();
  if (error) return { ok: false, error: "Contraseña incorrecta" };
  return { ok: true, validezMin: VERIFICACION_VALIDEZ_MIN };
}

/**
 * Revela en claro la contraseña de UN acceso concreto de una app.
 * Control de acceso:
 *  - RLS de `accesos_apps` garantiza tenant (el usuario pertenece a la empresa).
 *  - Visibilidad por rol: DIRECCIÓN/admin ve todo; el resto solo accesos cuyo
 *    `roles` incluya su rol_label.
 * El frontend exige pasar antes por `verificarIdentidadAccesos`.
 *
 * @param appId    id de la app en accesos_apps
 * @param indice   posición del acceso dentro de accesos[]
 */
export async function revelarAccesoApp(
  appId: string,
  indice: number,
): Promise<{ ok: true; contrasena: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("accesos_apps")
    .select("accesos, usuario, contrasena")
    .eq("id", appId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "No autorizado" };

  const accesos = normalizarAccesos(data.accesos as AccesoCredencial[] | null);
  if (accesos.length === 0 && (data.usuario || data.contrasena)) {
    accesos.push({ etiqueta: "", usuario: data.usuario as string, contrasena: data.contrasena as string });
  }
  const acc = accesos[indice];
  if (!acc) return { ok: false, error: "Acceso no encontrado" };

  // Visibilidad por rol (salvo dirección/admin).
  const { esDirector, rolNombre } = await getRolContext(user.id);
  if (!esDirector) {
    const roles = (acc.roles ?? []).map((r) => r.trim().toLowerCase());
    const mio = (rolNombre ?? "").trim().toLowerCase();
    if (roles.length === 0 || !roles.includes(mio)) {
      return { ok: false, error: "No autorizado" };
    }
  }

  const guardada = acc.contrasena ?? "";
  if (!guardada) return { ok: false, error: "Este acceso no tiene contraseña" };
  try {
    // Compat: si quedara alguna en claro (sin cifrar), devolverla tal cual.
    const claro = esCifrado(guardada) ? decrypt(guardada) : guardada;
    return { ok: true, contrasena: claro };
  } catch (e) {
    return { ok: false, error: `Error de descifrado: ${(e as Error).message}` };
  }
}
