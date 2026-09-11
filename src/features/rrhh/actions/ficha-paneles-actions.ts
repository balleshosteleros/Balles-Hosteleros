"use server";

/**
 * Paneles del trabajador vistos desde SU FICHA (RRHH).
 *
 * La ficha del empleado enseña exactamente lo mismo que él ve en «Mis paneles»,
 * en el mismo orden. Las acciones de Mi panel no sirven tal cual porque leen
 * siempre al usuario de la sesión (y su RLS solo autoriza lo propio): aquí se
 * repiten las mismas lecturas pero apuntando al empleado de la ficha, con
 * cliente admin y SIEMPRE acotadas a la empresa activa, igual que el resto de
 * la ficha (`getEmpleadoConPerfil`). Todo es de SOLO LECTURA: cada panel se
 * edita en su módulo, que es la fuente única.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/supabase/get-context";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { urlNominasDeMes } from "@/features/rrhh/services/nominas/nomina-url";
import type { CategoriaDocumento, DocumentoEmpleado } from "@/features/mi-panel/actions/mis-documentos-actions";

/** Empleado de la ficha, atado a la empresa activa. Null si no es de ella. */
async function resolverEmpleado(empleadoId: string): Promise<{
  admin: ReturnType<typeof createAdminClient>;
  empresaId: string;
  empleadoId: string;
  userId: string | null;
} | null> {
  const { empresaId } = await getAppContext();
  if (!empresaId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("empleados")
    .select("id, user_id")
    .eq("id", empleadoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!data) return null;
  return {
    admin,
    empresaId,
    empleadoId: data.id as string,
    userId: (data.user_id as string | null) ?? null,
  };
}

/* ─── POINTS ──────────────────────────────────────────────────────────── */

export type PointsEmpleadoNivel = {
  orden: number;
  nombre: string;
  toquesMin: number;
  badgeColor: string;
};

export type PointsEmpleadoMovimiento = {
  id: string;
  fecha: string;
  motivo: string;
  toques: number;
  origen: string;
};

export type PointsEmpleado = {
  acumulados: number;
  canjeables: number;
  niveles: PointsEmpleadoNivel[];
  movimientos: PointsEmpleadoMovimiento[];
};

export async function getPointsEmpleado(
  empleadoId: string,
): Promise<{ ok: boolean; data: PointsEmpleado | null; error?: string }> {
  const vacio: PointsEmpleado = { acumulados: 0, canjeables: 0, niveles: [], movimientos: [] };
  try {
    const ctx = await resolverEmpleado(empleadoId);
    if (!ctx) return { ok: false, data: null, error: "Empleado no encontrado" };
    // Sin cuenta de acceso no hay points: el saldo cuelga del usuario.
    if (!ctx.userId) return { ok: true, data: vacio };

    const [balanceR, nivelesR, movsR] = await Promise.all([
      ctx.admin
        .from("toques_balance")
        // Hay una fila por persona Y empresa (es la clave de la tabla): quien
        // trabaja en las dos tiene dos saldos, y la ficha es de UNA empresa.
        .select("toques_acumulados, toques_canjeables")
        .eq("user_id", ctx.userId)
        .eq("empresa_id", ctx.empresaId)
        .maybeSingle(),
      ctx.admin
        .from("toques_niveles")
        .select("orden, nombre, toques_min, badge_color")
        .eq("empresa_id", ctx.empresaId)
        .order("orden", { ascending: true }),
      ctx.admin
        .from("toques_movimientos")
        .select("id, created_at, fecha, motivo, toques, origen")
        .eq("user_id", ctx.userId)
        .eq("empresa_id", ctx.empresaId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    return {
      ok: true,
      data: {
        acumulados: Number(balanceR.data?.toques_acumulados ?? 0),
        canjeables: Number(balanceR.data?.toques_canjeables ?? 0),
        niveles: (nivelesR.data ?? []).map((n) => ({
          orden: Number(n.orden ?? 0),
          nombre: (n.nombre as string) ?? "",
          toquesMin: Number(n.toques_min ?? 0),
          badgeColor: (n.badge_color as string) ?? "#9ca3af",
        })),
        movimientos: (movsR.data ?? []).map((m) => ({
          id: m.id as string,
          fecha: ((m.fecha as string | null) ?? (m.created_at as string) ?? "").slice(0, 10),
          motivo: (m.motivo as string | null) ?? "",
          toques: Number(m.toques ?? 0),
          origen: (m.origen as string | null) ?? "",
        })),
      },
    };
  } catch (err) {
    console.error("[ficha-paneles] getPointsEmpleado:", err);
    return { ok: false, data: null, error: friendlyError(err, "points") };
  }
}

/* ─── FORMACIÓN ───────────────────────────────────────────────────────── */

export type CursoEmpleado = {
  id: string;
  titulo: string;
  puesto: string | null;
  lecciones: number;
  completadas: number;
};

export async function getFormacionEmpleado(
  empleadoId: string,
): Promise<{ ok: boolean; data: CursoEmpleado[]; error?: string }> {
  try {
    const ctx = await resolverEmpleado(empleadoId);
    if (!ctx) return { ok: false, data: [], error: "Empleado no encontrado" };

    // Ve lo mismo que él en su portal: los cursos GENERALES de la empresa y,
    // además, los de los PUESTOS que ocupa. Solo publicados; la Escuela es otro
    // portal (el de los alumnos) y no cuenta como su formación.
    const { data: filas } = await ctx.admin
      .from("empleado_puestos")
      .select("puesto_id, puesto_nombre, es_principal")
      .eq("empleado_id", ctx.empleadoId)
      .order("es_principal", { ascending: false });
    const puestoIds = (filas ?? [])
      .map((f) => f.puesto_id as string | null)
      .filter((id): id is string => !!id);

    const [generalesR, dePuestoR, puestosR] = await Promise.all([
      ctx.admin
        .from("formacion_cursos")
        .select("id, titulo, puesto_id")
        .eq("empresa_id", ctx.empresaId)
        .eq("ambito", "general")
        .eq("publicado", true)
        .order("orden", { ascending: true }),
      puestoIds.length > 0
        ? ctx.admin
            .from("formacion_cursos")
            .select("id, titulo, puesto_id")
            .eq("empresa_id", ctx.empresaId)
            .eq("ambito", "puesto")
            .eq("publicado", true)
            .in("puesto_id", puestoIds)
            .order("orden", { ascending: true })
        : Promise.resolve({ data: [] as { id: string; titulo: string; puesto_id: string | null }[] }),
      ctx.admin.from("puestos").select("id, nombre").eq("empresa_id", ctx.empresaId),
    ]);

    const cursos = [...(generalesR.data ?? []), ...(dePuestoR.data ?? [])];
    if (cursos.length === 0) return { ok: true, data: [] };
    const cursoIds = cursos.map((c) => c.id as string);

    const [leccionesR, progresoR] = await Promise.all([
      ctx.admin
        .from("formacion_lecciones")
        .select("id, curso_id")
        .eq("empresa_id", ctx.empresaId)
        .in("curso_id", cursoIds),
      ctx.userId
        ? ctx.admin.from("formacion_progreso").select("leccion_id").eq("user_id", ctx.userId)
        : Promise.resolve({ data: [] as { leccion_id: string }[] }),
    ]);

    const hechas = new Set((progresoR.data ?? []).map((p) => p.leccion_id as string));
    const porCurso = new Map<string, { total: number; hechas: number }>();
    for (const l of leccionesR.data ?? []) {
      const cid = l.curso_id as string;
      const acc = porCurso.get(cid) ?? { total: 0, hechas: 0 };
      acc.total += 1;
      if (hechas.has(l.id as string)) acc.hechas += 1;
      porCurso.set(cid, acc);
    }

    const nombrePuesto = new Map<string, string>(
      (puestosR.data ?? []).map((p) => [p.id as string, (p.nombre as string) ?? ""]),
    );

    return {
      ok: true,
      data: cursos.map((c) => {
        const cont = porCurso.get(c.id as string) ?? { total: 0, hechas: 0 };
        const pid = c.puesto_id as string | null;
        return {
          id: c.id as string,
          titulo: (c.titulo as string) ?? "",
          puesto: pid ? nombrePuesto.get(pid) ?? null : null,
          lecciones: cont.total,
          completadas: cont.hechas,
        };
      }),
    };
  } catch (err) {
    console.error("[ficha-paneles] getFormacionEmpleado:", err);
    return { ok: false, data: [], error: friendlyError(err, "formacion") };
  }
}

/* ─── COMUNICADOS ─────────────────────────────────────────────────────── */

export type ComunicadoEmpleado = {
  id: string;
  titulo: string;
  tipo: string;
  createdAt: string;
  vistoEl: string | null;
};

export async function getComunicadosEmpleado(
  empleadoId: string,
): Promise<{ ok: boolean; data: ComunicadoEmpleado[]; error?: string }> {
  try {
    const ctx = await resolverEmpleado(empleadoId);
    if (!ctx) return { ok: false, data: [], error: "Empleado no encontrado" };

    // Su departamento y su rol deciden qué le llega, igual que en su panel.
    const { data: emp } = await ctx.admin
      .from("empleados")
      .select("departamentos!empleados_departamento_id_fkey(nombre)")
      .eq("id", ctx.empleadoId)
      .maybeSingle();
    const depRel = (emp as { departamentos?: { nombre?: string } | { nombre?: string }[] } | null)?.departamentos;
    const depObj = Array.isArray(depRel) ? depRel[0] : depRel;
    let dep = (depObj?.nombre ?? "").trim().toLowerCase();
    let rol = "";
    if (ctx.userId) {
      const { data: u } = await ctx.admin
        .from("usuarios")
        .select("departamento, rol_label")
        .eq("user_id", ctx.userId)
        .maybeSingle();
      rol = ((u?.rol_label as string | null) ?? "").trim().toLowerCase();
      if (!dep) dep = ((u?.departamento as string | null) ?? "").trim().toLowerCase();
    }

    const { data } = await ctx.admin
      .from("comunicados")
      .select(
        "id, titulo, tipo, created_at, estado, toda_empresa, roles_destinatarios, empleados_destinatarios, departamentos_destinatarios",
      )
      .eq("empresa_id", ctx.empresaId)
      .order("created_at", { ascending: false })
      .limit(200);

    const visibles = (data ?? []).filter((c: Record<string, unknown>) => {
      if (((c.estado as string | undefined) ?? "publicado") !== "publicado") return false;
      if (c.toda_empresa === true) return true;
      const empleados = (c.empleados_destinatarios as string[] | undefined) ?? [];
      if (ctx.userId && empleados.includes(ctx.userId)) return true;
      const departamentos = (c.departamentos_destinatarios as string[] | undefined) ?? [];
      if (dep && departamentos.some((d) => (d ?? "").trim().toLowerCase() === dep)) return true;
      const roles = ((c.roles_destinatarios as string[] | undefined) ?? []).map((r) =>
        (r ?? "").trim().toLowerCase(),
      );
      if (rol && roles.includes(rol)) return true;
      if (dep && roles.includes(dep)) return true;
      return false;
    });

    // El «visto» de cada trabajador vive en su propio aviso.
    const vistoPorId = new Map<string, string>();
    if (ctx.userId && visibles.length > 0) {
      const { data: avisos } = await ctx.admin
        .from("notificaciones")
        .select("entidad_id, vista_at")
        .eq("usuario_id", ctx.userId)
        .eq("entidad_tipo", "comunicados")
        .in("entidad_id", visibles.map((c: Record<string, unknown>) => c.id as string));
      for (const a of avisos ?? []) {
        const cuando = a.vista_at as string | null;
        if (cuando) vistoPorId.set(a.entidad_id as string, cuando);
      }
    }

    return {
      ok: true,
      data: visibles.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        titulo: (c.titulo as string) ?? "",
        tipo: (c.tipo as string) ?? "informativo",
        createdAt: c.created_at as string,
        vistoEl: vistoPorId.get(c.id as string) ?? null,
      })),
    };
  } catch (err) {
    console.error("[ficha-paneles] getComunicadosEmpleado:", err);
    return { ok: false, data: [], error: friendlyError(err, "comunicados") };
  }
}

/* ─── DOCUMENTOS ──────────────────────────────────────────────────────── */

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-07" → "Julio 2026". */
function nombreMesPeriodo(periodo: string): string {
  const [y, m] = (periodo ?? "").split("-");
  const mes = MESES_ES[Number(m) - 1];
  return mes ? `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${y}` : periodo;
}

function grupoVacio(): Record<CategoriaDocumento, DocumentoEmpleado[]> {
  return {
    nominas: [],
    contratos: [],
    justificantes: [],
    "registros-jornada": [],
    entregas: [],
    sanciones: [],
    "bajas-medicas": [],
    otros: [],
  };
}

/** Los documentos de su expediente, los mismos que él abre en su carpeta. */
export async function getDocumentosEmpleado(
  empleadoId: string,
): Promise<{ ok: boolean; data: Record<CategoriaDocumento, DocumentoEmpleado[]>; error?: string }> {
  try {
    const ctx = await resolverEmpleado(empleadoId);
    if (!ctx) return { ok: false, data: grupoVacio(), error: "Empleado no encontrado" };

    const { data: filas } = await ctx.admin
      .from("documentos_empleado")
      .select("id, categoria, nombre, tipo_mime, tamano_bytes, created_at")
      .eq("empresa_id", ctx.empresaId)
      .eq("empleado_id", ctx.empleadoId)
      .order("created_at", { ascending: false });

    const grupos = grupoVacio();
    for (const row of filas ?? []) {
      const r = row as {
        id: string; categoria: CategoriaDocumento; nombre: string;
        tipo_mime: string | null; tamano_bytes: number | null; created_at: string;
      };
      if (!grupos[r.categoria]) continue;
      grupos[r.categoria].push({
        id: r.id,
        categoria: r.categoria,
        nombre: r.nombre,
        tipoMime: r.tipo_mime,
        tamanoBytes: r.tamano_bytes,
        fecha: (r.created_at ?? "").slice(0, 10),
      });
    }

    return { ok: true, data: grupos };
  } catch (err) {
    console.error("[ficha-paneles] getDocumentosEmpleado:", err);
    return { ok: false, data: grupoVacio(), error: friendlyError(err, "documentos") };
  }
}

/**
 * Sus nóminas, agrupadas por mes igual que en su carpeta.
 *
 * Solo salen las de meses YA CONFIRMADOS por RRHH, que son las únicas que él
 * ve: mientras el mes está en borrador la nómina existe, pero no se le ha
 * publicado, y la ficha no debe enseñar algo que él todavía no tiene.
 */
export async function listNominasEmpleado(
  empleadoId: string,
): Promise<{ ok: boolean; data: { periodo: string; periodoLabel: string; documentos: number }[]; error?: string }> {
  try {
    const ctx = await resolverEmpleado(empleadoId);
    if (!ctx) return { ok: false, data: [], error: "Empleado no encontrado" };

    const [filasR, mesesR] = await Promise.all([
      ctx.admin
        .from("rrhh_pagos_nominas")
        .select("periodo")
        .eq("empresa_id", ctx.empresaId)
        .eq("empleado_id", ctx.empleadoId)
        .not("nomina_path", "is", null),
      ctx.admin
        .from("rrhh_nominas_mes")
        .select("periodo, confirmado_en")
        .eq("empresa_id", ctx.empresaId)
        .not("confirmado_en", "is", null),
    ]);

    const confirmados = new Set(
      (mesesR.data ?? []).map((m) => (m as { periodo: string }).periodo),
    );

    const porMes = new Map<string, number>();
    for (const f of filasR.data ?? []) {
      const p = (f as { periodo: string }).periodo;
      if (!confirmados.has(p)) continue;
      porMes.set(p, (porMes.get(p) ?? 0) + 1);
    }

    const data = [...porMes.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([periodo, documentos]) => ({
        periodo,
        periodoLabel: nombreMesPeriodo(periodo),
        documentos,
      }));
    return { ok: true, data };
  } catch (err) {
    console.error("[ficha-paneles] listNominasEmpleado:", err);
    return { ok: false, data: [], error: friendlyError(err, "nóminas") };
  }
}

/** El PDF de la nómina de un mes (combinado si ese mes tiene varias). */
export async function getNominaEmpleadoUrlFicha(
  empleadoId: string,
  periodo: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const ctx = await resolverEmpleado(empleadoId);
    if (!ctx) return { ok: false, error: "Empleado no encontrado" };

    const { data: filas } = await ctx.admin
      .from("rrhh_pagos_nominas")
      .select("nomina_path, orden")
      .eq("empresa_id", ctx.empresaId)
      .eq("empleado_id", ctx.empleadoId)
      .eq("periodo", periodo)
      .order("orden", { ascending: true });
    const paths = (filas ?? [])
      .map((r) => (r as { nomina_path: string | null }).nomina_path)
      .filter((p): p is string => !!p);

    return await urlNominasDeMes({
      empresaId: ctx.empresaId,
      empleadoId: ctx.empleadoId,
      periodo,
      paths,
    });
  } catch (err) {
    console.error("[ficha-paneles] getNominaEmpleadoUrlFicha:", err);
    return { ok: false, error: friendlyError(err, "nómina") };
  }
}

/**
 * URL firmada (1 h) de un documento de la ficha. El documento se comprueba
 * contra ESE empleado y la empresa activa antes de firmar nada: sin ese filtro,
 * el id de un documento de otra empresa devolvería el PDF igual.
 */
export async function getDocumentoEmpleadoUrlFicha(
  empleadoId: string,
  documentoId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const ctx = await resolverEmpleado(empleadoId);
    if (!ctx) return { ok: false, error: "Empleado no encontrado" };

    const { data: doc } = await ctx.admin
      .from("documentos_empleado")
      .select("storage_path")
      .eq("id", documentoId)
      .eq("empresa_id", ctx.empresaId)
      .eq("empleado_id", ctx.empleadoId)
      .maybeSingle();
    if (!doc) return { ok: false, error: "Documento no disponible" };
    const { data: signed, error } = await ctx.admin.storage
      .from("empleados-docs")
      .createSignedUrl((doc as { storage_path: string }).storage_path, 60 * 60);
    if (error) throw error;
    return { ok: true, url: signed?.signedUrl };
  } catch (err) {
    console.error("[ficha-paneles] getDocumentoEmpleadoUrlFicha:", err);
    return { ok: false, error: friendlyError(err, "documento") };
  }
}
