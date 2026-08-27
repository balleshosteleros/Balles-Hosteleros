"use server";

/**
 * Revisión de nóminas subidas (por la gestoría o a mano) + histórico de archivos.
 *
 * Flujo: las nóminas se vuelcan al registro de pagos como provisionales, pero cada
 * una lleva un `revision_estado`. RRHH ve aquí todas las del mes, con un indicador
 * de si tienen incidencia, puede abrir el documento y APROBAR (queda 'correcta') o
 * DENEGAR (queda 'denegada' y se descuenta de la suma de `rrhh_pagos`).
 *
 * `listarSubidasHistorico` alimenta la vista de histórico de documentos subidos.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { BUCKET_NOMINAS, EXT_POR_MIME } from "@/features/rrhh/services/nominas/procesar-nominas";
import { rechazarMesNominasGestoria } from "@/features/rrhh/services/nominas/rechazo-gestoria";
import { MOTIVO_MIN_CARACTERES } from "@/features/rrhh/lib/nominas-rechazo";
import { revalidatePath } from "next/cache";

export type RevisionEstado = "correcta" | "con_incidencia" | "denegada";

export interface NominaRevision {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  periodo: string;
  orden: number;
  neto: number;
  ssEmpleado: number;
  ssEmpresa: number;
  irpf: number;
  estado: RevisionEstado;
  incidencia: string | null;
  tieneDocumento: boolean;
}

/** Nóminas individuales de un mes con su estado de revisión (para la vista RRHH). */
export async function listarNominasRevision(periodo: string): Promise<NominaRevision[]> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return [];

    const { data, error } = await supabase
      .from("rrhh_pagos_nominas")
      .select(
        "id, empleado_id, periodo, orden, neto, ss_empleado, ss_empresa, irpf, revision_estado, incidencia, nomina_path",
      )
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .order("orden", { ascending: true });
    if (error) throw error;

    const filas = data ?? [];
    // Nombres de empleado en un tiro.
    const ids = [...new Set(filas.map((f) => f.empleado_id as string))];
    const nombres = new Map<string, string>();
    if (ids.length > 0) {
      const { data: emps } = await supabase
        .from("empleados")
        .select("id, nombre, apellidos")
        .in("id", ids);
      for (const e of emps ?? []) {
        nombres.set(e.id as string, `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim());
      }
    }

    return filas.map((f) => ({
      id: f.id as string,
      empleadoId: f.empleado_id as string,
      empleadoNombre: nombres.get(f.empleado_id as string) ?? "—",
      periodo: f.periodo as string,
      orden: (f.orden as number) ?? 0,
      neto: Number(f.neto ?? 0),
      ssEmpleado: Number(f.ss_empleado ?? 0),
      ssEmpresa: Number(f.ss_empresa ?? 0),
      irpf: Number(f.irpf ?? 0),
      estado: (f.revision_estado as RevisionEstado) ?? "correcta",
      incidencia: (f.incidencia as string | null) ?? null,
      tieneDocumento: Boolean(f.nomina_path),
    }));
  } catch (err) {
    console.error("[rrhh] listarNominasRevision:", err);
    return [];
  }
}

/**
 * Recalcula la SUMA de las nóminas NO denegadas de un empleado/mes y la vuelca a
 * `rrhh_pagos` (mantiene la fila del pago coherente tras aprobar/denegar).
 */
async function recalcularSumaPago(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  empleadoId: string,
  periodo: string,
): Promise<void> {
  const { data } = await admin
    .from("rrhh_pagos_nominas")
    .select("ss_empleado, ss_empresa, irpf, neto, nomina_path, orden")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId)
    .eq("periodo", periodo)
    .neq("revision_estado", "denegada")
    .order("orden", { ascending: true });
  const lista = data ?? [];
  const suma = lista.reduce(
    (a, r) => ({
      ss_empleado: a.ss_empleado + Number(r.ss_empleado),
      ss_empresa: a.ss_empresa + Number(r.ss_empresa),
      irpf: a.irpf + Number(r.irpf),
      nomina: a.nomina + Number(r.neto),
    }),
    { ss_empleado: 0, ss_empresa: 0, irpf: 0, nomina: 0 },
  );
  // `nomina` es un sumando del total a percibir: hay que recalcular `total` con el
  // resto del desglose, o la fila queda con el total anterior y el empleado vería
  // un importe distinto al de su liquidación.
  const { data: prev } = await admin
    .from("rrhh_pagos")
    .select("pago, propina, horas_extras, bonus, propina_mes_anterior, ajuste")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId)
    .eq("periodo", periodo)
    .maybeSingle();
  const total =
    Number(prev?.pago ?? 0) +
    suma.nomina +
    Number(prev?.propina ?? 0) +
    Number(prev?.horas_extras ?? 0) +
    Number(prev?.bonus ?? 0) +
    Number(prev?.propina_mes_anterior ?? 0) +
    Number(prev?.ajuste ?? 0);

  await admin
    .from("rrhh_pagos")
    .update({
      ...suma,
      nomina_path: lista[0]?.nomina_path ?? null,
      total: Math.round(total * 100) / 100,
    })
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId)
    .eq("periodo", periodo);
}

/**
 * Aprobar o denegar una nómina en revisión. Aprobar → 'correcta'. Denegar →
 * 'denegada' (deja de contar en la suma del pago). No se puede tocar si la
 * liquidación de ese pago ya fue enviada (inmutable).
 */
export async function revisarNomina(
  nominaId: string,
  accion: "aprobar" | "denegar",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autorizado" };

    const { data: nom, error: e0 } = await supabase
      .from("rrhh_pagos_nominas")
      .select("id, empresa_id, empleado_id, periodo")
      .eq("id", nominaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (e0) throw e0;
    if (!nom) return { ok: false, error: "Nómina no encontrada" };

    // Bloqueo: si la liquidación de ese pago ya fue enviada, no se toca.
    const { data: pago } = await supabase
      .from("rrhh_pagos")
      .select("confirmacion_enviada_at")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", nom.empleado_id as string)
      .eq("periodo", nom.periodo as string)
      .maybeSingle();
    if (pago?.confirmacion_enviada_at) {
      return { ok: false, error: "La liquidación de ese mes ya fue enviada: no se puede modificar." };
    }

    const admin = createAdminClient();
    const nuevoEstado: RevisionEstado = accion === "aprobar" ? "correcta" : "denegada";
    const { error: e1 } = await admin
      .from("rrhh_pagos_nominas")
      .update({
        revision_estado: nuevoEstado,
        // Al aprobar limpiamos la incidencia; al denegar la conservamos como motivo.
        ...(accion === "aprobar" ? { incidencia: null } : {}),
        revisado_por: userId ?? null,
        revisado_en: new Date().toISOString(),
      })
      .eq("id", nominaId)
      .eq("empresa_id", empresaId);
    if (e1) throw e1;

    await recalcularSumaPago(
      admin,
      empresaId,
      nom.empleado_id as string,
      nom.periodo as string,
    );

    revalidatePath("/rrhh/pagos");
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] revisarNomina:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export interface SubidaHistorico {
  id: string;
  periodo: string;
  origen: "gestoria" | "manual";
  archivoNombre: string | null;
  archivoBytes: number | null;
  leidas: number;
  guardadas: number;
  yaExistian: number;
  sinEmpleado: number;
  mesIncorrecto: number;
  createdAt: string;
}

/** Histórico de archivos de nóminas subidos (auditoría), más reciente primero. */
export async function listarSubidasHistorico(limit = 60): Promise<SubidaHistorico[]> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return [];
    const { data, error } = await supabase
      .from("nominas_gestoria_subidas")
      .select(
        "id, periodo, origen, archivo_nombre, archivo_bytes, leidas, guardadas, ya_existian, sin_empleado, mes_incorrecto, created_at",
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      periodo: r.periodo as string,
      origen: (r.origen as "gestoria" | "manual") ?? "gestoria",
      archivoNombre: (r.archivo_nombre as string | null) ?? null,
      archivoBytes: (r.archivo_bytes as number | null) ?? null,
      leidas: Number(r.leidas ?? 0),
      guardadas: Number(r.guardadas ?? 0),
      yaExistian: Number(r.ya_existian ?? 0),
      sinEmpleado: Number(r.sin_empleado ?? 0),
      mesIncorrecto: Number(r.mes_incorrecto ?? 0),
      createdAt: r.created_at as string,
    }));
  } catch (err) {
    console.error("[rrhh] listarSubidasHistorico:", err);
    return [];
  }
}

// ── Estado del MES: borrador ⇄ confirmado ────────────────────────────────────
// Mientras el mes está en BORRADOR, RRHH puede borrar nóminas mal subidas y
// volver a subirlas. Al CONFIRMAR, el mes queda inmutable para todos los roles
// (lo garantizan los triggers de BD, no solo este código) y las nóminas se
// publican en la carpeta del empleado.

export interface EstadoMesNominas {
  confirmado: boolean;
  confirmadoEn: string | null;
  /** Si el usuario actual puede confirmar/reabrir (gestor de pagos). */
  puedeGestionar: boolean;
  /** TC1 del mes (recibo de cotizaciones de la EMPRESA), si se ha subido. */
  tc1: { nombre: string; importe: number | null; trabajadores: number | null } | null;
  /** Mes DEVUELTO a la gestoría: se espera que vuelva a subirlo todo corregido. */
  rechazado: boolean;
  rechazadoEn: string | null;
  /** Anomalías que RRHH comunicó a la gestoría en la última devolución. */
  rechazoMotivo: string | null;
  /** Entrega nº N de la gestoría para este mes (cada rechazo la sube en 1). */
  ronda: number;
}

/** Estado de confirmación del mes de nóminas. */
export async function getEstadoMesNominas(periodo: string): Promise<EstadoMesNominas> {
  const vacio: EstadoMesNominas = {
    confirmado: false, confirmadoEn: null, puedeGestionar: false, tc1: null,
    rechazado: false, rechazadoEn: null, rechazoMotivo: null, ronda: 1,
  };
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return vacio;
    const { data } = await supabase
      .from("rrhh_nominas_mes")
      .select(
        "confirmado_en, tc1_path, tc1_nombre, tc1_importe, tc1_trabajadores, rechazado_en, rechazo_motivo, ronda",
      )
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .maybeSingle();
    // `puede_gestionar_pagos()` es la MISMA función que aplica la RLS, así que la
    // pantalla y la base de datos no pueden discrepar.
    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    const confirmadoEn = (data?.confirmado_en as string | null) ?? null;
    const rechazadoEn = (data?.rechazado_en as string | null) ?? null;
    return {
      confirmado: confirmadoEn !== null,
      confirmadoEn,
      puedeGestionar: puede === true,
      tc1: data?.tc1_path
        ? {
            nombre: (data.tc1_nombre as string | null) ?? "TC1",
            importe: data.tc1_importe != null ? Number(data.tc1_importe) : null,
            trabajadores: data.tc1_trabajadores != null ? Number(data.tc1_trabajadores) : null,
          }
        : null,
      rechazado: rechazadoEn !== null,
      rechazadoEn,
      rechazoMotivo: (data?.rechazo_motivo as string | null) ?? null,
      ronda: Number(data?.ronda ?? 1),
    };
  } catch (err) {
    console.error("[rrhh] getEstadoMesNominas:", err);
    return vacio;
  }
}

/**
 * Confirma el mes: cierra las nóminas y las publica al empleado. A partir de aquí
 * los importes que vienen de la nómina son inmutables para cualquier rol.
 */
export async function confirmarMesNominas(periodo: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };

    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    if (puede !== true) {
      return { ok: false as const, error: "No tienes permiso para confirmar las nóminas." };
    }

    // No tiene sentido cerrar un mes sin nóminas: sería un candado en falso.
    const { count } = await supabase
      .from("rrhh_pagos_nominas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo);
    if (!count) {
      return { ok: false as const, error: "No hay nóminas de este mes que confirmar." };
    }

    // Aviso (no bloqueo): confirmar con incidencias sin revisar es decisión de RRHH.
    const { count: pendientes } = await supabase
      .from("rrhh_pagos_nominas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .eq("revision_estado", "con_incidencia");

    const { error } = await supabase
      .from("rrhh_nominas_mes")
      .upsert(
        { empresa_id: empresaId, periodo, confirmado_en: new Date().toISOString(), confirmado_por: userId },
        { onConflict: "empresa_id,periodo" },
      );
    if (error) throw error;

    revalidatePath("/rrhh/pagos");
    revalidatePath("/mi-panel/documentos");
    return { ok: true as const, conIncidencia: pendientes ?? 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] confirmarMesNominas:", msg);
    return { ok: false as const, error: msg };
  }
}

// ── Mes RECHAZADO: se devuelve a la gestoría para que lo suba todo corregido ──

/**
 * Devuelve las nóminas del mes a la gestoría con las anomalías que redacta RRHH.
 *
 * Es la alternativa a confirmar: en vez de publicar al empleado, se borra todo lo
 * que subió la gestoría, se le manda un correo con el texto de RRHH y se le
 * reabre el enlace para que suba la entrega completa corregida. El motivo es
 * OBLIGATORIO — sin decir qué está mal, la gestoría no puede corregir nada.
 */
export async function rechazarMesNominas(periodo: string, motivo: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };

    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    if (puede !== true) {
      return { ok: false as const, error: "No tienes permiso para devolver las nóminas a la gestoría." };
    }

    const texto = (motivo ?? "").trim();
    if (texto.length < MOTIVO_MIN_CARACTERES) {
      return {
        ok: false as const,
        error: `Explica las anomalías con detalle (mínimo ${MOTIVO_MIN_CARACTERES} caracteres): es el mensaje que recibe la gestoría.`,
      };
    }

    // Un mes ya confirmado está publicado al empleado: primero hay que reabrirlo.
    const { data: mes } = await supabase
      .from("rrhh_nominas_mes")
      .select("confirmado_en")
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (mes?.confirmado_en) {
      return {
        ok: false as const,
        error: "Este mes ya está confirmado y publicado a los empleados. Reábrelo antes de devolverlo a la gestoría.",
      };
    }

    // Devolver un mes vacío no tiene sentido: no hay nada que corregir.
    const { count } = await supabase
      .from("rrhh_pagos_nominas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo);
    if (!count) {
      return { ok: false as const, error: "No hay nóminas de este mes que devolver." };
    }

    const admin = createAdminClient();
    const r = await rechazarMesNominasGestoria(admin, empresaId, periodo, texto, userId);

    revalidatePath("/rrhh/pagos");
    revalidatePath("/mi-panel/documentos");
    return { ok: true as const, ...r };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] rechazarMesNominas:", msg);
    return { ok: false as const, error: msg };
  }
}

export interface RechazoHistorico {
  id: string;
  periodo: string;
  ronda: number;
  motivo: string;
  nominasBorradas: number;
  tc1Borrado: boolean;
  emailEnviado: boolean;
  emailDestino: string | null;
  createdAt: string;
}

/** Devoluciones a la gestoría de un mes, más reciente primero. */
export async function listarRechazosMes(periodo: string): Promise<RechazoHistorico[]> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return [];
    const { data, error } = await supabase
      .from("rrhh_nominas_rechazos")
      .select("id, periodo, ronda, motivo, nominas_borradas, tc1_borrado, email_enviado, email_destino, created_at")
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      periodo: r.periodo as string,
      ronda: Number(r.ronda ?? 1),
      motivo: (r.motivo as string) ?? "",
      nominasBorradas: Number(r.nominas_borradas ?? 0),
      tc1Borrado: Boolean(r.tc1_borrado),
      emailEnviado: Boolean(r.email_enviado),
      emailDestino: (r.email_destino as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  } catch (err) {
    console.error("[rrhh] listarRechazosMes:", err);
    return [];
  }
}

/**
 * Reabre un mes confirmado para poder corregirlo. Solo DIRECCIÓN: deshacer un
 * cierre es excepcional y deja de publicar las nóminas al empleado hasta que se
 * vuelva a confirmar.
 */
export async function reabrirMesNominas(periodo: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { permisos } = await getRolContext();
    if (!puedeEditarModulo(permisos, "RECURSOS HUMANOS")) {
      return { ok: false as const, error: "Sin permisos: necesitas Recursos Humanos para reabrir un mes ya confirmado." };
    }

    const { error } = await supabase
      .from("rrhh_nominas_mes")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo);
    if (error) throw error;

    revalidatePath("/rrhh/pagos");
    revalidatePath("/mi-panel/documentos");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] reabrirMesNominas:", msg);
    return { ok: false as const, error: msg };
  }
}

/**
 * Borra DE VERDAD una nómina mal subida: su fila, su documento del bucket y
 * recalcula la suma del pago. Es la única forma de corregir los importes que
 * vienen de la nómina (no se editan a mano): se borra y se vuelve a subir.
 * Imposible si el mes ya está confirmado.
 */
export async function borrarNominaSubida(nominaId: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    if (puede !== true) {
      return { ok: false as const, error: "No tienes permiso para borrar nóminas." };
    }

    const admin = createAdminClient();
    const { data: fila } = await admin
      .from("rrhh_pagos_nominas")
      .select("id, empresa_id, empleado_id, periodo, nomina_path")
      .eq("id", nominaId)
      .maybeSingle();
    if (!fila) return { ok: false as const, error: "Esa nómina ya no existe." };
    if (fila.empresa_id !== empresaId) {
      return { ok: false as const, error: "Esa nómina no es de esta empresa." };
    }

    const periodo = fila.periodo as string;
    const empleadoId = fila.empleado_id as string;

    const { data: mes } = await admin
      .from("rrhh_nominas_mes")
      .select("confirmado_en")
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (mes?.confirmado_en) {
      return {
        ok: false as const,
        error: "Las nóminas de este mes ya están confirmadas. Para corregirlas hay que reabrir el mes.",
      };
    }

    // Bloqueo previo por liquidación ya enviada al empleado (regla existente).
    const { data: pago } = await admin
      .from("rrhh_pagos")
      .select("confirmacion_enviada_at")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (pago?.confirmacion_enviada_at) {
      return { ok: false as const, error: "La liquidación ya se envió: reábrela antes de tocar sus nóminas." };
    }

    const { error: delErr } = await admin.from("rrhh_pagos_nominas").delete().eq("id", nominaId);
    if (delErr) throw delErr;

    // El documento se borra DESPUÉS de la fila: si fallara, quedaría un fichero
    // huérfano (inocuo) en vez de una fila apuntando a un documento inexistente.
    const path = fila.nomina_path as string | null;
    if (path) {
      const { error: stErr } = await admin.storage.from(BUCKET_NOMINAS).remove([path]);
      if (stErr) console.error("[rrhh] borrarNominaSubida (documento huérfano):", stErr.message);
    }

    await recalcularSumaPago(admin, empresaId, empleadoId, periodo);
    revalidatePath("/rrhh/pagos");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] borrarNominaSubida:", msg);
    return { ok: false as const, error: msg };
  }
}

// ── TC1: recibo de cotizaciones de la EMPRESA (no de un empleado) ────────────
// Es el documento que acompaña a las nóminas del mes: bases, cuotas y nº de
// trabajadores de TODA la empresa. Se guarda una vez por empresa+periodo y se
// consulta desde la cabecera de Pagos; nunca va a la carpeta de un empleado.

/** Sube (o reemplaza) el TC1 del mes. Importe y nº de trabajadores son opcionales. */
export async function subirTc1Mes(input: {
  periodo: string;
  nombre: string;
  mimeType: string;
  archivoBase64: string;
  importe?: number | null;
  trabajadores?: number | null;
}) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };

    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    if (puede !== true) return { ok: false as const, error: "No tienes permiso para subir el TC1." };

    const ext = EXT_POR_MIME[input.mimeType];
    if (!ext) return { ok: false as const, error: "Formato no admitido. Usa PDF o imagen." };

    const admin = createAdminClient();
    const path = `${empresaId}/${input.periodo}/TC1.${ext}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET_NOMINAS)
      .upload(path, Buffer.from(input.archivoBase64, "base64"), {
        upsert: true, // reemplazar el TC1 del mes es normal (lo reenvía la gestoría)
        contentType: input.mimeType,
      });
    if (upErr) throw upErr;

    const { error } = await supabase.from("rrhh_nominas_mes").upsert(
      {
        empresa_id: empresaId,
        periodo: input.periodo,
        tc1_path: path,
        tc1_nombre: input.nombre,
        tc1_importe: input.importe ?? null,
        tc1_trabajadores: input.trabajadores ?? null,
        tc1_subido_en: new Date().toISOString(),
        tc1_subido_por: userId,
      },
      { onConflict: "empresa_id,periodo" },
    );
    if (error) throw error;

    revalidatePath("/rrhh/pagos");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] subirTc1Mes:", msg);
    return { ok: false as const, error: msg };
  }
}

/** URL firmada (1 h) para abrir el TC1 del mes. */
export async function getTc1MesUrl(periodo: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { data } = await supabase
      .from("rrhh_nominas_mes")
      .select("tc1_path")
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .maybeSingle();
    const path = (data?.tc1_path as string | null) ?? null;
    if (!path) return { ok: false as const, error: "No hay TC1 de este mes." };

    const admin = createAdminClient();
    const { data: signed, error } = await admin.storage
      .from(BUCKET_NOMINAS)
      .createSignedUrl(path, 60 * 60);
    if (error) throw error;
    return { ok: true as const, url: signed?.signedUrl ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] getTc1MesUrl:", msg);
    return { ok: false as const, error: msg };
  }
}

/** Quita el TC1 del mes (documento y datos). No se puede si el mes está confirmado. */
export async function borrarTc1Mes(periodo: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    if (puede !== true) return { ok: false as const, error: "No tienes permiso." };

    const { data } = await supabase
      .from("rrhh_nominas_mes")
      .select("tc1_path, confirmado_en")
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (data?.confirmado_en) {
      return { ok: false as const, error: "El mes está confirmado. Reábrelo para cambiar el TC1." };
    }
    const path = (data?.tc1_path as string | null) ?? null;
    if (!path) return { ok: true as const };

    const admin = createAdminClient();
    const { error } = await admin
      .from("rrhh_nominas_mes")
      .update({
        tc1_path: null, tc1_nombre: null, tc1_importe: null,
        tc1_trabajadores: null, tc1_subido_en: null, tc1_subido_por: null,
      })
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo);
    if (error) throw error;
    // El fichero se borra después: si fallara, queda huérfano (inocuo).
    const { error: stErr } = await admin.storage.from(BUCKET_NOMINAS).remove([path]);
    if (stErr) console.error("[rrhh] borrarTc1Mes (fichero huérfano):", stErr.message);

    revalidatePath("/rrhh/pagos");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] borrarTc1Mes:", msg);
    return { ok: false as const, error: msg };
  }
}

// ── ¿Se puede subir la entrega de UN mes concreto? ───────────────────────────
// Las nóminas se suben eligiendo a qué mes pertenecen (no tiene por qué ser el
// mes que muestre el calendario). Antes de dejar adjuntar hay que saber si ese
// mes YA tiene entrega: con que haya UN solo documento, la entrega está hecha y
// no se admiten más — para cambiarla hay que devolver el mes a la gestoría o
// reabrirlo, no acumular archivos encima.

export interface EstadoSubidaMes {
  periodo: string;
  /** Nº de nóminas ya subidas de ese mes (0 = mes libre). */
  nominas: number;
  /** Mes ya cerrado: inmutable hasta reabrirlo. */
  confirmado: boolean;
}

/** Nóminas ya subidas y estado de cierre de cada mes indicado (AAAA-MM). */
export async function getEstadoSubidaMeses(periodos: string[]): Promise<EstadoSubidaMes[]> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || periodos.length === 0) return [];

    const { data: filas } = await supabase
      .from("rrhh_pagos_nominas")
      .select("periodo")
      .eq("empresa_id", empresaId)
      .in("periodo", periodos);
    const cuenta = new Map<string, number>();
    for (const f of filas ?? []) {
      const p = f.periodo as string;
      cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
    }

    const { data: meses } = await supabase
      .from("rrhh_nominas_mes")
      .select("periodo, confirmado_en")
      .eq("empresa_id", empresaId)
      .in("periodo", periodos);
    const confirmados = new Set(
      (meses ?? []).filter((m) => m.confirmado_en != null).map((m) => m.periodo as string),
    );

    return periodos.map((p) => ({
      periodo: p,
      nominas: cuenta.get(p) ?? 0,
      confirmado: confirmados.has(p),
    }));
  } catch (err) {
    console.error("[rrhh] getEstadoSubidaMeses:", err);
    return [];
  }
}
