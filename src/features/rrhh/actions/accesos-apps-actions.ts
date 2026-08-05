"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { normalizarModulo, puedeVerHerramienta } from "@/features/auth/lib/permisos";
import { encryptOptional, decrypt } from "@/features/accesos/lib/crypto";
import {
  type AccesoApp,
  type AccesoCredencial,
  MAX_ACCESOS_POR_APP,
  MAX_DATOS_EXTRA_POR_ACCESO,
} from "@/features/rrhh/data/accesos-apps";
import { MAX_IMAGEN_MB, MAX_IMAGEN_BYTES } from "@/shared/lib/documentos";

/** Minutos que dura una verificación de identidad antes de volver a pedirla. */
const VERIFICACION_VALIDEZ_MIN = 5;

/** Marca que sustituye a la contraseña en las listas (nunca se envía cifrada/clara al cliente sin verificar). */
const PWD_OCULTA = "";

/** ¿El texto tiene formato cifrado AES (iv:tag:enc)? */
function esCifrado(s: string): boolean {
  return typeof s === "string" && s.split(":").length === 3 && s.length > 20;
}

// ---------------------------------------------------------------------------
// PRP-075 · Los DOS ESCUDOS de la bóveda, aplicados en SERVIDOR.
//
//   Escudo 1 — ENTRAR: el rol necesita el candado HERR_ACCESOS en Ajustes →
//     Roles. Sin él no recibe ni una fila (antes solo se ocultaba el icono en
//     el navegador, así que la puerta era cosmética).
//   Escudo 2 — LISTAR: dentro, solo los accesos donde SU rol esté marcado. Si
//     no lo está, el acceso NO viaja al cliente: ni etiqueta, ni usuario, ni
//     el hecho de que exista. Antes se enviaba todo y se ocultaba al pintar.
//
// Dirección (es_admin_plataforma) mantiene su bypass intencional.
// `roles` vacío en un acceso = solo dirección (fail-closed).
// ---------------------------------------------------------------------------

/** ¿El rol puede ver una credencial concreta? Comparación sin acentos. */
function rolPuedeVerAcceso(acc: AccesoCredencial, rolNombre: string | null): boolean {
  const roles = (acc.roles ?? []).map((r) => normalizarModulo(r));
  if (roles.length === 0) return false; // sin roles marcados = solo dirección
  return roles.includes(normalizarModulo(rolNombre ?? ""));
}

/**
 * Deja en cada app SOLO las credenciales que ese rol puede ver, y descarta las
 * apps que se quedan sin ninguna. Lo que no se puede ver, no se envía.
 */
function filtrarAccesosPorRol(apps: AccesoApp[], rolNombre: string | null): AccesoApp[] {
  const out: AccesoApp[] = [];
  for (const app of apps) {
    const visibles = app.accesos.filter((a) => rolPuedeVerAcceso(a, rolNombre));
    if (visibles.length === 0) continue;
    out.push({
      ...app,
      accesos: visibles,
      // `usuario` de nivel app es un espejo del primer acceso: recalcularlo
      // evita filtrar el login de una credencial que este rol no puede ver.
      usuario: visibles[0]?.usuario ?? "",
      rolesAutorizados: [],
    });
  }
  return out;
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

/**
 * Forma interna (en memoria) de un dato extra dentro de un acceso. En BD se
 * persiste como `datos_extra: [{ nombre, valor_cifrado }]`; aquí lo manejamos
 * con `nombre` + `valor` (que puede ser el valor cifrado o en claro según fase).
 */
type DatoExtraInterno = { nombre: string; valor: string };

/**
 * Normaliza los datos extra de un acceso. Acepta tanto la forma que viene del
 * cliente (`datosExtra: [{nombre, valor}]`) como la de BD
 * (`datos_extra: [{nombre, valor_cifrado}]`). Conserva `valor` tal cual venga
 * (cifrado o claro); el cifrado/descifrado se hace en appToRow/revelar.
 * Filtra datos sin nombre.
 */
function normalizarDatosExtra(acc: unknown): DatoExtraInterno[] {
  const a = (acc ?? {}) as Record<string, unknown>;
  const raw = (a.datosExtra ?? a.datos_extra ?? []) as unknown[];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => {
      const o = (d ?? {}) as Record<string, unknown>;
      const nombre = String(o.nombre ?? "").trim();
      const valor = String(o.valor ?? o.valor_cifrado ?? "");
      return { nombre, valor };
    })
    .filter((d) => d.nombre)
    // Tope de datos extra por acceso: se aplica en servidor, no solo en la UI.
    .slice(0, MAX_DATOS_EXTRA_POR_ACCESO);
}

/** Normaliza la lista de accesos: filtra vacíos y aplica el tope. */
function normalizarAccesos(accesos?: AccesoCredencial[] | null): AccesoCredencial[] {
  const list = (accesos ?? [])
    .map((a) => ({
      etiqueta: (a.etiqueta ?? "").trim(),
      usuario: (a.usuario ?? "").trim(),
      contrasena: a.contrasena ?? "",
      roles: Array.isArray(a.roles)
        ? a.roles.map((r) => (r ?? "").trim()).filter(Boolean)
        : [],
      datosExtra: normalizarDatosExtra(a),
    }))
    .filter((a) => a.etiqueta || a.usuario || a.contrasena || a.datosExtra.length > 0);
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
  // Oculta toda contraseña / dato extra antes de salir al cliente; marca si existían.
  const accesosSeguros = accesos.map((a, i) => ({
    ...a,
    // Posición real en BD: se estampa ANTES de filtrar por rol, para que
    // `revelarAccesoApp` siga apuntando a la credencial correcta.
    indiceReal: i,
    tieneContrasena: !!(a.contrasena && a.contrasena.length > 0),
    contrasena: PWD_OCULTA,
    // Los datos extra viajan con nombre + tiene (NUNCA el valor cifrado/claro).
    datosExtra: normalizarDatosExtra(a).map((d) => ({
      nombre: d.nombre,
      valor: "",
      tiene: !!(d.valor && d.valor.length > 0),
    })),
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
    // Empareja con el acceso previo (por etiqueta, si no por índice) para poder
    // preservar contraseña y datos extra cifrados cuando el cliente los deja vacíos.
    const previo =
      prevList.find((p) => (p.etiqueta ?? "") === (acc.etiqueta ?? "") && p.etiqueta) ??
      prevList[i];

    const entrante = acc.contrasena ?? "";
    let contrasena: string;
    if (entrante && !esCifrado(entrante)) {
      // El cliente mandó una contraseña nueva en claro → cifrar.
      contrasena = encryptOptional(entrante);
    } else if (esCifrado(entrante)) {
      // Ya viene cifrada (caso raro) → dejar igual.
      contrasena = entrante;
    } else {
      // Vacía → preservar la previa cifrada.
      contrasena = previo?.contrasena ?? "";
    }

    // Datos extra previos de este acceso (forma BD: {nombre, valor_cifrado}).
    const previosExtra = normalizarDatosExtra(previo);
    const datosExtra = normalizarDatosExtra(acc).map((d) => {
      const valor = d.valor ?? "";
      let valorCifrado: string;
      if (valor && !esCifrado(valor)) {
        valorCifrado = encryptOptional(valor);
      } else if (esCifrado(valor)) {
        valorCifrado = valor;
      } else {
        // Vacío → preservar el cifrado previo del dato extra con el mismo nombre.
        const prevDato = previosExtra.find((p) => p.nombre === d.nombre);
        valorCifrado = prevDato?.valor ?? "";
      }
      return { nombre: d.nombre, valor_cifrado: valorCifrado };
    });

    return {
      etiqueta: acc.etiqueta ?? "",
      usuario: acc.usuario ?? "",
      contrasena,
      roles: acc.roles ?? [],
      datos_extra: datosExtra,
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

/**
 * PRP-075 · Regla de Ivan: **editar exige permiso de AJUSTES**. El candado de la
 * barra es SOLO LECTURA — desde ahí no se crea ni se modifica nada. Quien no
 * tenga acceso a Ajustes no puede tocar una credencial, aunque invoque la
 * server action directamente. Dirección mantiene su bypass.
 *
 * Es la contrapartida necesaria al escudo 2: quien puede editar un acceso podría
 * marcarse a sí mismo entre los roles autorizados y verlo todo.
 */
async function exigirPermisoEdicionAccesos(userId: string): Promise<void> {
  const { esDirector, permisos } = await getRolContext(userId);
  if (esDirector) return;
  const ajustes = permisos.find((p) => normalizarModulo(p.modulo) === "AJUSTES");
  if (!ajustes?.editar) {
    throw new Error("No autorizado: se necesita permiso de edición en Ajustes");
  }
}

/**
 * Normaliza un nombre de departamento para comparar sin depender de mayúsculas,
 * acentos ni variantes (RRHH ↔ Recursos Humanos). Devuelve minúsculas sin tildes.
 */
function normDepto(s: string): string {
  const base = (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // quita acentos
  // Sinónimos: RRHH = recursos humanos.
  if (base === "rrhh" || base === "recursos humanos") return "recursos humanos";
  return base;
}

/**
 * Departamentos que el ROL del usuario le permite VER en la empresa indicada.
 *
 * FUENTE ÚNICA DE VERDAD: la tabla puente `empresa_role_departamentos`
 * (M:N rol↔departamento). Si tu rol tiene un departamento asignado ahí, lo ves;
 * si se lo quitas, dejas de verlo al instante. No hay ningún otro atajo (no se
 * usa el nombre del rol). Dirección/admin no pasa por aquí (ve todo).
 */
async function departamentosVisiblesDelRol(userId: string): Promise<Set<string>> {
  const set = new Set<string>();
  const { rolId } = await getRolContext(userId);
  if (!rolId) return set;

  const admin = createAdminClient();
  const { data } = await admin
    .from("empresa_role_departamentos")
    .select("departamentos:departamento_id ( nombre )")
    .eq("rol_id", rolId);
  for (const row of data ?? []) {
    const nombre = (row as { departamentos?: { nombre?: string } | null }).departamentos?.nombre;
    if (nombre) set.add(normDepto(nombre));
  }
  return set;
}

/**
 * Lista accesos de UNA empresa. RLS enforça que el usuario pertenezca a ella.
 *
 * SEGURIDAD (panel de aplicaciones): además del tenant, filtra por los
 * DEPARTAMENTOS QUE EL ROL DEL USUARIO PUEDE VER. Una app solo se devuelve si:
 *  - el usuario es dirección/admin (ve todo), o
 *  - la app no tiene departamentos asignados (visible para toda la empresa), o
 *  - la app incluye "Todos", o
 *  - algún departamento de la app está entre los que su ROL puede ver.
 * Si tu rol NO tiene ese departamento, NO ves la app. El cliente nunca recibe
 * apps de departamentos ajenos (el filtrado es en servidor).
 */
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

  const { esDirector, rolNombre, permisos } = await getRolContext(user.id);
  if (esDirector) return (data ?? []).map((r) => rowToApp(r as Row));

  // Escudo 1 — sin el candado en Ajustes → Roles no se recibe NADA, aunque se
  // invoque esta action directamente saltándose la interfaz.
  if (!puedeVerHerramienta(permisos, "HERR_ACCESOS")) return [];

  const misDeptos = await departamentosVisiblesDelRol(user.id);

  const visibles = (data ?? []).filter((r) => {
    const deptos = ((r as Row).departamentos ?? []).map((d) => normDepto(d));
    if (deptos.length === 0) return true; // sin restricción = toda la empresa
    if (deptos.includes("todos")) return true;
    return deptos.some((d) => misDeptos.has(d));
  });

  // Escudo 2 — solo las credenciales donde este rol esté marcado. El resto no
  // sale del servidor (antes viajaban y se ocultaban al pintar).
  const filtradas = filtrarAccesosPorRol(visibles.map((r) => rowToApp(r as Row)), rolNombre);

  // Red de seguridad (PRP-075): contrastamos con lo que la tabla `credenciales`
  // deja pasar por RLS. Si la BD devuelve MENOS de lo que hemos calculado aquí,
  // mandamos lo de la BD: ante discrepancia, gana el criterio más restrictivo.
  return await recortarSegunCredencialesRLS(supabase, filtradas, rolNombre);
}

/**
 * Contrasta el resultado calculado en código con lo que la tabla `credenciales`
 * autoriza por RLS (los dos escudos aplicados por la propia base de datos).
 * Solo QUITA credenciales: nunca añade. Si la consulta falla, se devuelve lo
 * calculado (la protección en servidor ya se ha aplicado antes).
 */
async function recortarSegunCredencialesRLS(
  supabase: Awaited<ReturnType<typeof createClient>>,
  apps: AccesoApp[],
  rolNombre: string | null,
): Promise<AccesoApp[]> {
  if (apps.length === 0) return apps;
  const { data, error } = await supabase
    .from("credenciales")
    .select("origen_id, origen_indice");
  if (error || !data) return apps; // sin señal de la BD, no relajamos nada
  const permitidas = new Set(
    data.map((c) => `${c.origen_id}#${c.origen_indice}`),
  );
  const out: AccesoApp[] = [];
  for (const app of apps) {
    const visibles = app.accesos.filter((a) =>
      permitidas.has(`${app.id}#${a.indiceReal ?? 0}`),
    );
    if (visibles.length === 0) continue;
    out.push({ ...app, accesos: visibles, usuario: visibles[0]?.usuario ?? "" });
  }
  // Trazabilidad: si el criterio de la BD no coincide con el del código,
  // conviene saberlo (indica datos desincronizados entre las dos tablas).
  const antes = apps.reduce((n, a) => n + a.accesos.length, 0);
  const despues = out.reduce((n, a) => n + a.accesos.length, 0);
  if (antes !== despues) {
    console.warn(
      `[accesos] RLS recortó ${antes - despues} credencial(es) para rol "${rolNombre}"`,
    );
  }
  return out;
}

/**
 * Lista TODOS los accesos (todas las empresas). Solo admin/director.
 * Otros usuarios reciben array vacío (no se filtra: se rechaza).
 */
export async function listAllAccesosApps(empresaSlug?: string): Promise<AccesoApp[]> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) return [];
  if (!(await userTieneRolAdminODirector(user.id))) return [];

  // Aislamiento por empresa: esta action usa el cliente admin (se salta la RLS),
  // así que el filtro por empresa hay que ponerlo A MANO. Sin él, estando en
  // Ajustes de HABANA se listaban también las credenciales de BACANAL.
  const admin = createAdminClient();
  let q = admin.from("accesos_apps").select("*");
  if (empresaSlug) q = q.eq("empresa_slug", empresaSlug);
  const { data, error } = await q
    .order("empresa_slug", { ascending: true })
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[accesos-apps] listAllAccesosApps:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToApp(r as Row));
}

/**
 * PRP-075 · Réplica de una fila de `accesos_apps` en las tablas nuevas
 * (`aplicaciones` + `credenciales`). Mientras conviven ambos modelos, toda
 * escritura debe reflejarse en las dos o la RLS de `credenciales` empezaría a
 * negar accesos legítimos (o a permitir los ya borrados).
 *
 * Usa cliente admin a propósito: la escritura en `credenciales` está reservada
 * a dirección por RLS, y aquí ya se ha validado el permiso de edición antes.
 * Nunca descifra: copia el valor cifrado tal cual.
 */
async function sincronizarTablasNuevas(row: Row & { empresa_id: string | null }): Promise<void> {
  try {
    if (!row.empresa_id) return;
    const admin = createAdminClient();
    const tieneEnlace = (row.url ?? "").trim().length > 0;

    let aplicacionId: string | null = null;
    if (tieneEnlace) {
      const { data: app } = await admin
        .from("aplicaciones")
        .upsert(
          {
            empresa_id: row.empresa_id,
            origen_id: row.id,
            nombre: row.nombre ?? "",
            descripcion: row.descripcion ?? "",
            url: row.url ?? "",
            icono: row.icono ?? "",
            logo_url: row.logo_url ?? null,
            categoria: row.categoria ?? "Otros",
            departamentos: row.departamentos ?? [],
            estado: row.estado ?? "Activo",
            responsable: row.responsable ?? "",
            notas: row.notas ?? "",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "origen_id" },
        )
        .select("id")
        .maybeSingle();
      aplicacionId = (app?.id as string) ?? null;
    }

    // Las credenciales se reescriben enteras: es la forma segura de reflejar
    // altas, bajas y reordenaciones dentro del array jsonb.
    await admin.from("credenciales").delete().eq("origen_id", row.id);

    const accesos = (row.accesos ?? []) as unknown as Array<Record<string, unknown>>;
    if (accesos.length === 0) return;
    await admin.from("credenciales").insert(
      accesos.map((a, i) => ({
        empresa_id: row.empresa_id,
        aplicacion_id: aplicacionId,
        origen_id: row.id,
        origen_indice: i,
        etiqueta: String(a.etiqueta ?? ""),
        usuario: String(a.usuario ?? ""),
        secreto: (a.contrasena as string) || null,
        datos_extra: (a.datos_extra ?? a.datosExtra ?? []) as unknown,
        roles: (Array.isArray(a.roles) ? a.roles : []) as string[],
      })),
    );
  } catch (e) {
    // No bloquea la operación principal: la fuente sigue siendo accesos_apps.
    console.error("[accesos-apps] sincronizarTablasNuevas:", e);
  }
}

/** Crea un acceso. RLS rechaza si el usuario no pertenece a la empresa indicada. */
export async function createAccesoApp(
  app: Omit<AccesoApp, "id" | "ultimaActualizacion"> & { id?: string },
): Promise<AccesoApp> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) throw new Error("No autorizado");
  await exigirPermisoEdicionAccesos(user.id);

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
  await sincronizarTablasNuevas(data as Row & { empresa_id: string | null });
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
  await exigirPermisoEdicionAccesos(user.id);

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
  await sincronizarTablasNuevas(data as Row & { empresa_id: string | null });
  return rowToApp(data as Row);
}

/** Elimina un acceso por id. RLS rechaza cross-tenant. */
export async function deleteAccesoApp(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await getUserOrNull(supabase);
  if (!user) throw new Error("No autorizado");
  await exigirPermisoEdicionAccesos(user.id);

  // Limpia también las tablas nuevas (credenciales cae en cascada por FK, pero
  // las sueltas cuelgan de origen_id, así que se borran explícitamente).
  try {
    const admin = createAdminClient();
    await admin.from("credenciales").delete().eq("origen_id", id);
    await admin.from("aplicaciones").delete().eq("origen_id", id);
  } catch (e) {
    console.error("[accesos-apps] limpieza tablas nuevas:", e);
  }

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
  if (file.size > MAX_IMAGEN_BYTES) return { ok: false, error: `La imagen no puede superar ${MAX_IMAGEN_MB} MB` };

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
 *
 * Comprueba la contraseña llamando DIRECTAMENTE a la REST API de Supabase Auth
 * con un fetch aislado (sin crear ningún cliente Supabase). Así NO toca ni la
 * cookie ni los tokens de la sesión activa → el usuario NO se desloguea, pase
 * la contraseña bien o mal. Solo devuelve ok/error.
 * Válida `VERIFICACION_VALIDEZ_MIN` minutos en el cliente.
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return { ok: false, error: "Configuración no disponible" };

  try {
    // Endpoint de login por contraseña. NO persiste sesión: es un fetch puro.
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Contraseña incorrecta" };
    return { ok: true, validezMin: VERIFICACION_VALIDEZ_MIN };
  } catch {
    return { ok: false, error: "No se pudo verificar. Inténtalo de nuevo." };
  }
}

/**
 * Revela en claro la contraseña de UN acceso concreto de una app.
 * Control de acceso:
 *  - RLS de `accesos_apps` garantiza tenant (el usuario pertenece a la empresa).
 *  - Visibilidad por rol: DIRECCIÓN/admin ve todo; el resto solo accesos cuyo
 *    `roles` incluya su rol_label.
 * El frontend exige pasar antes por `verificarIdentidadAccesos`.
 *
 * @param appId       id de la app en accesos_apps
 * @param indice      posición del acceso dentro de accesos[]
 * @param nombreExtra (opcional) si se pasa, revela el dato extra con ese nombre
 *                    en vez de la contraseña.
 */
export async function revelarAccesoApp(
  appId: string,
  indice: number,
  nombreExtra?: string,
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

  // Visibilidad por rol (salvo dirección/admin). Los DOS escudos, en servidor.
  const { esDirector, rolNombre, permisos } = await getRolContext(user.id);
  if (!esDirector) {
    // Escudo 1 — sin candado en Ajustes → Roles, no se revela nada.
    if (!puedeVerHerramienta(permisos, "HERR_ACCESOS")) {
      return { ok: false, error: "No autorizado" };
    }
    // Escudo 2 — su rol debe estar marcado en ESTE acceso (sin acentos).
    if (!rolPuedeVerAcceso(acc, rolNombre)) {
      return { ok: false, error: "No autorizado" };
    }
    // Escudo 3 (PRP-075) — además, la BD debe autorizar esta credencial por RLS.
    // Doble llave: aunque un fallo del código dejara pasar el check anterior,
    // la propia base de datos tiene que estar de acuerdo antes de descifrar.
    const { data: permitida } = await supabase
      .from("credenciales")
      .select("id")
      .eq("origen_id", appId)
      .eq("origen_indice", indice)
      .maybeSingle();
    if (!permitida) return { ok: false, error: "No autorizado" };
  }

  // Si se pide un dato extra concreto, devuelve ESE valor en vez de la contraseña.
  if (nombreExtra) {
    const extras = normalizarDatosExtra(acc);
    const dato = extras.find((d) => d.nombre === nombreExtra);
    if (!dato) return { ok: false, error: "Dato extra no encontrado" };
    const guardadoExtra = dato.valor ?? "";
    if (!guardadoExtra) return { ok: false, error: "Este dato extra no tiene valor" };
    try {
      const claro = esCifrado(guardadoExtra) ? decrypt(guardadoExtra) : guardadoExtra;
      return { ok: true, contrasena: claro };
    } catch (e) {
      return { ok: false, error: `Error de descifrado: ${(e as Error).message}` };
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
