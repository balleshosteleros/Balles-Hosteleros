"use server";

/**
 * MESA DE INCIDENCIAS de albaranes (PRP-074 · F2).
 *
 * Puente entre el detector puro (`detectar-incidencias.ts`, sin BD) y la base de
 * datos: carga el catálogo real de la empresa, ejecuta la detección, y persiste
 * cada anomalía con su propuesta para que la decisión humana quede registrada.
 *
 * Regla rectora (Iván, 05-ago-2026): el sistema PROPONE, el humano DECIDE. Ninguna
 * incidencia desaparece sin decisión explícita, y ninguna decisión hace falta dos
 * veces: lo resuelto se memoriza en los alias y la próxima vez viene ya ligado.
 */

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { registrarEventoAlbaran } from "@/features/logistica/lib/albaranes/eventos";
import {
  detectarIncidencias,
  type AliasProveedor,
  type EntradaDeteccion,
  type FormatoCompra,
  type Incidencia,
  type PrecioHistorico,
  type ProductoCatalogo,
  type ResultadoDeteccion,
  type TipoIncidencia,
} from "@/features/logistica/lib/albaranes/detectar-incidencias";
import type { ProveedorFiscal } from "@/features/logistica/lib/albaranes/identidad-fiscal";
import { normalizarTexto } from "@/features/logistica/lib/albaranes/formato-compra";
import type {
  CabeceraOcrAlbaran,
  LineaOcrAlbaran,
} from "@/features/logistica/lib/albaranes/ocr-albaran";
import {
  evaluarEmpresaDestinatario,
  type AvisoEmpresa,
  type EmpresaIdentidad,
} from "@/features/logistica/lib/albaranes/empresa-destinatario";

export type EstadoIncidencia = "abierta" | "resuelta" | "aceptada_con_motivo" | "descartada";

/** Incidencia tal y como vive en BD (con su id, para poder decidirla). */
export interface IncidenciaPersistida extends Incidencia {
  id: string;
  estado: EstadoIncidencia;
  motivo: string | null;
  /** La decisión humana registrada (si ya se decidió): permite retomar la intención
   *  — p.ej. "crear producto" elegido en la mesa — al abrir el albarán en Revisión. */
  decision?: { accion: string; payload?: Record<string, unknown> } | null;
}

export type ResultadoMesa =
  | {
      ok: true;
      incidencias: IncidenciaPersistida[];
      vinculosAutomaticos: ResultadoDeteccion["vinculosAutomaticos"];
      proveedorId: string | null;
      proveedorNombre: string | null;
      puedeConfirmar: boolean;
      /** Aviso de empresa equivocada (destinatario del papel ≠ empresa activa), o null si cuadra. */
      avisoEmpresa: AvisoEmpresa | null;
    }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Carga del catálogo
// ---------------------------------------------------------------------------

/**
 * Identidad fiscal de la empresa activa + todas las del usuario, para cruzar contra el
 * destinatario del papel (aviso de empresa equivocada). Devuelve solo lo accesible por RLS.
 */
async function cargarIdentidadEmpresas(
  supabase: Awaited<ReturnType<typeof getLogisticaContext>>["supabase"],
  empresaId: string,
): Promise<{ activa: EmpresaIdentidad; empresas: EmpresaIdentidad[] } | null> {
  const { data } = await supabase.from("empresas").select("id, nombre, nif, razon_social");
  const empresas: EmpresaIdentidad[] = (data ?? []).map((e) => ({
    id: e.id as string,
    nombre: (e.nombre as string) ?? "",
    nif: (e.nif as string | null) ?? null,
    razonSocial: (e.razon_social as string | null) ?? null,
  }));
  const activa = empresas.find((e) => e.id === empresaId);
  if (!activa) return null; // sin identidad de la activa no se puede cruzar
  return { activa, empresas };
}

/**
 * Trae de una vez todo lo que el detector necesita saber de la empresa.
 * Se hace en paralelo: son consultas independientes.
 */
async function cargarCatalogo(
  supabase: Awaited<ReturnType<typeof getLogisticaContext>>["supabase"],
  empresaId: string,
): Promise<Omit<EntradaDeteccion, "cabecera" | "lineas">> {
  const [provRes, prodRes, aliasRes, fmtRes, precioRes] = await Promise.all([
    supabase
      .from("proveedores")
      .select("id, nombre_comercial, razon_social, cif_nif, codigo_postal, ciudad, provincia")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo"),
    supabase
      .from("productos")
      .select("id, nombre, nombre_proveedor, categoria, iva, medida, formato, controla_stock")
      .eq("empresa_id", empresaId)
      .eq("tipo", "compra")
      .eq("estado", "Activo"),
    supabase
      .from("producto_proveedor_aliases")
      .select("producto_id, proveedor_id, alias_normalizado, referencia")
      .eq("empresa_id", empresaId),
    supabase
      .from("formatos")
      .select("id, nombre, equivalencias, unidad_id")
      .eq("empresa_id", empresaId)
      .eq("tipo", "compra")
      .eq("activa", true),
    // Último precio por producto: se ordena desc y el primero de cada uno gana.
    supabase
      .from("producto_precios_compra")
      .select("producto_id, precio, iva, fecha_inicio")
      .order("fecha_inicio", { ascending: false }),
  ]);

  const proveedores: ProveedorFiscal[] = (provRes.data ?? []).map((p) => ({
    id: p.id as string,
    nombreComercial: (p.nombre_comercial as string) ?? "",
    razonSocial: (p.razon_social as string) ?? null,
    cifNif: (p.cif_nif as string) ?? null,
    codigoPostal: (p.codigo_postal as string) ?? null,
    ciudad: (p.ciudad as string) ?? null,
    provincia: (p.provincia as string) ?? null,
  }));

  const productos: ProductoCatalogo[] = (prodRes.data ?? []).map((p) => ({
    id: p.id as string,
    nombre: (p.nombre as string) ?? "",
    nombreProveedor: (p.nombre_proveedor as string) ?? null,
    categoria: (p.categoria as string) ?? null,
    iva: (p.iva as string) ?? null,
    medida: (p.medida as string) ?? null,
    formato: (p.formato as string) ?? null,
    // Por defecto SÍ controla stock: solo los gastos se dan de alta sin él.
    controlaStock: (p.controla_stock as boolean) ?? true,
  }));

  const aliases: AliasProveedor[] = (aliasRes.data ?? []).map((a) => ({
    productoId: a.producto_id as string,
    proveedorId: a.proveedor_id as string,
    aliasNormalizado: (a.alias_normalizado as string) ?? "",
    referencia: (a.referencia as string) ?? null,
  }));

  const formatos: FormatoCompra[] = (fmtRes.data ?? []).map((f) => ({
    id: f.id as string,
    nombre: (f.nombre as string) ?? "",
    equivalencia: f.equivalencias === null ? null : Number(f.equivalencias),
    unidadId: (f.unidad_id as string) ?? null,
  }));

  const vistos = new Set<string>();
  const precios: PrecioHistorico[] = [];
  for (const row of precioRes.data ?? []) {
    const id = row.producto_id as string;
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    precios.push({
      productoId: id,
      precio: Number(row.precio),
      iva: (row.iva as string) ?? null,
      fecha: (row.fecha_inicio as string) ?? "",
    });
  }

  return { proveedores, productos, aliases, formatos, precios };
}

// ---------------------------------------------------------------------------
// Analizar y persistir
// ---------------------------------------------------------------------------

/**
 * Ejecuta la detección sobre lo leído por el OCR y guarda las incidencias.
 *
 * Se llama justo después del OCR, ANTES de que el usuario vea nada: cuando se abre
 * la mesa, las propuestas ya están calculadas y persistidas.
 */
export async function analizarIncidenciasAlbaran(input: {
  cabecera: CabeceraOcrAlbaran;
  lineas: LineaOcrAlbaran[];
  albaranId?: string | null;
  importacionId?: string | null;
  duplicadoExactoDe?: { id: string; numero: string } | null;
  duplicadoNegocioDe?: { id: string; numero: string } | null;
}): Promise<ResultadoMesa> {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  if (!userId || !empresaId) {
    return { ok: false, error: "Sesión caducada o sin empresa activa. Vuelve a entrar." };
  }

  try {
    const [catalogo, identidad] = await Promise.all([
      cargarCatalogo(supabase, empresaId),
      cargarIdentidadEmpresas(supabase, empresaId),
    ]);

    // Aviso de empresa equivocada: el destinatario del papel vs la empresa activa.
    const avisoEmpresa = identidad
      ? evaluarEmpresaDestinatario(input.cabecera.destinatario, identidad.activa, identidad.empresas)
      : null;

    const resultado = detectarIncidencias({
      cabecera: input.cabecera,
      lineas: input.lineas,
      duplicadoExactoDe: input.duplicadoExactoDe ?? null,
      duplicadoNegocioDe: input.duplicadoNegocioDe ?? null,
      ...catalogo,
    });

    // Re-análisis idempotente: al reanalizar la misma importación (p.ej. tras cambiar de
    // empresa por el aviso), no dejar las incidencias del análisis anterior colgando de la
    // importación —al guardar se ligarían todas al albarán—. Se borran las abiertas sin albarán.
    if (input.importacionId && !input.albaranId) {
      await supabase
        .from("albaran_incidencias")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("importacion_id", input.importacionId)
        .is("albaran_id", null);
    }

    // Se persisten para que la decisión quede auditada y el trabajo a medias no
    // se pierda al cerrar la pantalla.
    const filas = resultado.incidencias.map((i) => ({
      empresa_id: empresaId,
      albaran_id: input.albaranId ?? null,
      importacion_id: input.importacionId ?? null,
      linea_id: i.lineaId,
      tipo: i.tipo,
      severidad: i.severidad,
      detalle: i.detalle,
      propuesta: {
        titulo: i.titulo,
        explicacion: i.explicacion,
        acciones: i.acciones,
      },
      estado: "abierta" as const,
    }));

    let persistidas: IncidenciaPersistida[] = [];
    if (filas.length > 0) {
      const { data, error } = await supabase
        .from("albaran_incidencias")
        .insert(filas)
        .select("id, linea_id, tipo");
      if (error) {
        console.error("[incidencias-albaran] insert:", error.message);
        return { ok: false, error: "No se pudieron guardar las incidencias detectadas." };
      }
      // El insert respeta el orden de entrada, así que se casan por índice.
      persistidas = resultado.incidencias.map((inc, idx) => ({
        ...inc,
        id: (data?.[idx]?.id as string) ?? "",
        estado: "abierta" as EstadoIncidencia,
        motivo: null,
      }));
    }

    await registrarEventoAlbaran(supabase, {
      empresaId,
      albaranId: input.albaranId ?? null,
      importacionId: input.importacionId ?? null,
      actorId: userId,
      tipo: "incidencias_detectadas",
      payload: {
        total: resultado.incidencias.length,
        bloqueantes: resultado.incidencias.filter((i) => i.severidad === "bloqueante").length,
        tipos: resultado.incidencias.map((i) => i.tipo),
        vinculosAutomaticos: resultado.vinculosAutomaticos.length,
        proveedorIdentificado: resultado.identificacion.proveedor?.id ?? null,
        motivoIdentificacion: resultado.identificacion.motivo,
      },
    });

    if (avisoEmpresa) {
      await registrarEventoAlbaran(supabase, {
        empresaId,
        albaranId: input.albaranId ?? null,
        importacionId: input.importacionId ?? null,
        actorId: userId,
        tipo: "aviso_empresa_destinatario",
        payload: {
          veredicto: avisoEmpresa.veredicto,
          porCif: avisoEmpresa.porCif,
          empresaDetectada: avisoEmpresa.empresaDetectada?.nombre ?? null,
          destinatario: avisoEmpresa.destinatarioTexto,
        },
      });
    }

    return {
      ok: true,
      incidencias: persistidas,
      vinculosAutomaticos: resultado.vinculosAutomaticos,
      proveedorId: resultado.identificacion.proveedor?.id ?? null,
      proveedorNombre: resultado.identificacion.proveedor?.nombreComercial ?? null,
      puedeConfirmar: resultado.puedeConfirmar,
      avisoEmpresa,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[incidencias-albaran] analizar:", msg);
    return { ok: false, error: "No se pudo analizar el albarán. Inténtalo de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Decidir
// ---------------------------------------------------------------------------

export interface DecisionIncidencia {
  incidenciaId: string;
  /** Clave de la acción elegida (la que venía en la propuesta). */
  accion: string;
  /** Datos aplicados (producto elegido, equivalencia, precio corregido...). */
  payload?: Record<string, unknown>;
  /** Obligatorio si la acción lo pedía. */
  motivo?: string;
}

/**
 * EJECUTA los efectos de una decisión aceptada (fix Fernando 06-ago).
 *
 * Antes la decisión solo se ANOTABA: aceptar "una caja son 24" no escribía en
 * ningún sitio que la confirmación transaccional leyera, así que la RPC del
 * PRP-073 volvía a bloquear la misma pregunta que el usuario ya había contestado.
 * Ahora una equivalencia aceptada alimenta `formatos` (la fuente que lee la RPC)
 * y `producto_formato_aliases` (que hasta hoy nadie escribía ni leía).
 */
async function ejecutarEfectosDecision(
  supabase: Awaited<ReturnType<typeof getLogisticaContext>>["supabase"],
  empresaId: string,
  userId: string,
  d: DecisionIncidencia,
): Promise<{ productoId: string; productoNombre: string } | void> {
  const p = d.payload ?? {};

  // "crear_gasto" (línea de servicio: portes, punto verde…) trae TODO lo necesario
  // (nombre, categoría "Gastos", sin control de stock), así que aquí sí se puede crear
  // el producto de verdad — a diferencia de "crear" mercancía, que necesita categoría
  // humana y se difiere al asistente. Devuelve el producto para que el cliente ligue
  // la línea sin pasos extra (antes había que ignorarla a mano, línea a línea).
  if (d.accion === "crear_gasto") {
    const nombre = String(p.nombre ?? "").trim();
    if (!nombre) return;

    const { data: existente } = await supabase
      .from("productos")
      .select("id, nombre")
      .eq("empresa_id", empresaId)
      .eq("tipo", "compra")
      .ilike("nombre", nombre)
      .limit(1)
      .maybeSingle();
    if (existente) return { productoId: existente.id as string, productoNombre: existente.nombre as string };

    const { data: creado, error } = await supabase
      .from("productos")
      .insert({
        empresa_id: empresaId,
        tipo: "compra",
        nombre,
        categoria: String(p.categoria ?? "Gastos"),
        estado: "Activo",
        controla_stock: false,
        medida: "Unidades",
        created_by: userId,
      })
      .select("id, nombre")
      .single();
    if (error || !creado) {
      console.error("[incidencias-albaran] crear_gasto:", error?.message);
      return;
    }
    return { productoId: creado.id as string, productoNombre: creado.nombre as string };
  }

  if (d.accion !== "aceptar_equivalencia" && d.accion !== "escribir_equivalencia") return;

  const equivalencia = Number(p.equivalencia);
  const nombreFormato = String(p.formato ?? "").trim();
  const medida = (p.medida === "kg" || p.medida === "l" ? p.medida : "ud") as "ud" | "kg" | "l";
  if (!(equivalencia > 0) || !nombreFormato) return;

  // 1) `formatos` (tipo compra): es EXACTAMENTE lo que la confirmación transaccional
  //    consulta por nombre. Sin esto, la decisión era decorativa.
  const { data: meds } = await supabase
    .from("medidas")
    .select("id, codigo")
    .eq("empresa_id", empresaId)
    .eq("tipo", "compra");
  const canon: Record<"ud" | "kg" | "l", string[]> = {
    ud: ["ud", "uds", "u", "unidades", "unidad"],
    kg: ["kg", "kilogramos", "kilogramo", "kilo", "kilos"],
    l: ["l", "litros", "litro", "lt"],
  };
  const filas = (meds ?? []) as Array<{ id: string; codigo: string }>;
  const unidad =
    filas.find((m) => canon[medida].includes(String(m.codigo ?? "").toLowerCase().trim())) ?? filas[0];
  if (unidad) {
    const { data: fmt } = await supabase
      .from("formatos")
      .select("id, equivalencias")
      .eq("empresa_id", empresaId)
      .eq("tipo", "compra")
      .ilike("nombre", nombreFormato)
      .limit(1)
      .maybeSingle();
    if (!fmt) {
      await supabase.from("formatos").insert({
        empresa_id: empresaId,
        unidad_id: unidad.id,
        nombre: nombreFormato,
        equivalencias: equivalencia,
        orden: 999,
        activa: true,
        tipo: "compra",
      });
    } else if (fmt.equivalencias === null) {
      // Rellena el hueco (la deuda de los 115 formatos a NULL se cierra con el uso),
      // pero NUNCA pisa una equivalencia ya definida a mano.
      await supabase.from("formatos").update({ equivalencias: equivalencia }).eq("id", fmt.id);
    }
  }

  // 2) Alias de formato del proveedor: la tabla del PRP-074 gana por fin su escritor.
  const aliasNormalizado = normalizarTexto(nombreFormato);
  if (aliasNormalizado) {
    await supabase.from("producto_formato_aliases").upsert(
      {
        empresa_id: empresaId,
        proveedor_id: (p.proveedorId as string | undefined) ?? null,
        producto_id: (p.productoId as string | undefined) ?? null,
        alias: nombreFormato,
        alias_normalizado: aliasNormalizado,
        contenido: equivalencia,
        medida,
        created_by: userId,
      },
      { onConflict: "empresa_id,proveedor_id,producto_id,alias_normalizado", ignoreDuplicates: false },
    );
  }
}

/**
 * Registra la decisión humana sobre una o varias incidencias.
 *
 * Acepta un lote porque el botón "Aceptar todas las propuestas" resuelve muchas de
 * golpe, y así queda una sola marca de tiempo coherente para todas.
 */
export async function decidirIncidencias(
  decisiones: DecisionIncidencia[],
): Promise<
  | {
      ok: true;
      resueltas: number;
      /** Productos creados por efectos de decisión (p.ej. crear_gasto), por incidencia:
       *  el cliente los usa para ligar la línea sin que el usuario repita el trabajo. */
      efectos: Record<string, { productoId: string; productoNombre: string }>;
    }
  | { ok: false; error: string }
> {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  if (!userId || !empresaId) {
    return { ok: false, error: "Sesión caducada o sin empresa activa. Vuelve a entrar." };
  }
  if (decisiones.length === 0) return { ok: true, resueltas: 0, efectos: {} };

  const ahora = new Date().toISOString();
  let resueltas = 0;
  const efectos: Record<string, { productoId: string; productoNombre: string }> = {};

  for (const d of decisiones) {
    const conMotivo = typeof d.motivo === "string" && d.motivo.trim() !== "";
    // El CHECK de BD lo exige, pero se valida antes para dar un mensaje claro.
    const estado: EstadoIncidencia =
      d.accion === "descartar"
        ? "descartada"
        : conMotivo
          ? "aceptada_con_motivo"
          : "resuelta";

    const { error } = await supabase
      .from("albaran_incidencias")
      .update({
        estado,
        decision: { accion: d.accion, payload: d.payload ?? {} },
        motivo: conMotivo ? d.motivo!.trim() : null,
        decidida_por: userId,
        decidida_at: ahora,
      })
      .eq("id", d.incidenciaId)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[incidencias-albaran] decidir:", error.message);
      return { ok: false, error: "No se pudo guardar una de las decisiones." };
    }

    // Lo decidido se EJECUTA (fix Fernando 06-ago). Un fallo del efecto no tumba el
    // lote: la decisión queda registrada y el efecto se puede reintentar/aplicar a mano.
    if (estado !== "descartada") {
      try {
        const efecto = await ejecutarEfectosDecision(supabase, empresaId, userId, d);
        if (efecto) efectos[d.incidenciaId] = efecto;
      } catch (err) {
        console.error("[incidencias-albaran] efecto de decisión:", err);
      }
    }
    resueltas++;
  }

  return { ok: true, resueltas, efectos };
}

/**
 * Ata al albarán las incidencias que se detectaron ANTES de que existiera.
 *
 * El análisis corre justo después del OCR, cuando todavía no hay albarán: las
 * incidencias nacen con `importacion_id` pero sin `albaran_id`. Si no se ligan al
 * guardar, quedan huérfanas y al abrir el albarán en Revisión no aparece ninguna.
 */
export async function ligarIncidenciasAlAlbaran(
  importacionId: string,
  albaranId: string,
): Promise<{ ok: boolean; ligadas: number }> {
  const { supabase, empresaId } = await getLogisticaContext();
  if (!empresaId) return { ok: false, ligadas: 0 };

  const { data, error } = await supabase
    .from("albaran_incidencias")
    .update({ albaran_id: albaranId })
    .eq("importacion_id", importacionId)
    .eq("empresa_id", empresaId)
    .is("albaran_id", null)
    .select("id");

  if (error) {
    console.error("[incidencias-albaran] ligar:", error.message);
    return { ok: false, ligadas: 0 };
  }
  return { ok: true, ligadas: data?.length ?? 0 };
}

/** Incidencias abiertas de un albarán, para retomar la revisión otro día. */
export async function listarIncidenciasAlbaran(
  albaranId: string,
): Promise<{ ok: true; incidencias: IncidenciaPersistida[] } | { ok: false; error: string }> {
  const { supabase, empresaId } = await getLogisticaContext();
  if (!empresaId) return { ok: false, error: "Sin empresa activa." };

  const { data, error } = await supabase
    .from("albaran_incidencias")
    .select("id, linea_id, tipo, severidad, detalle, propuesta, estado, motivo, decision")
    .eq("albaran_id", albaranId)
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[incidencias-albaran] listar:", error.message);
    return { ok: false, error: "No se pudieron cargar las incidencias." };
  }

  const incidencias: IncidenciaPersistida[] = (data ?? []).map((row) => {
    const prop = (row.propuesta ?? {}) as {
      titulo?: string;
      explicacion?: string;
      acciones?: Incidencia["acciones"];
    };
    return {
      id: row.id as string,
      lineaId: (row.linea_id as string) ?? null,
      tipo: row.tipo as TipoIncidencia,
      severidad: row.severidad as Incidencia["severidad"],
      titulo: prop.titulo ?? "",
      explicacion: prop.explicacion ?? "",
      acciones: prop.acciones ?? [],
      detalle: (row.detalle ?? {}) as Record<string, unknown>,
      estado: row.estado as EstadoIncidencia,
      motivo: (row.motivo as string) ?? null,
      decision: (row.decision as IncidenciaPersistida["decision"]) ?? null,
    };
  });

  return { ok: true, incidencias };
}

// ---------------------------------------------------------------------------
// Memoria: lo resuelto no se vuelve a preguntar
// ---------------------------------------------------------------------------

/**
 * Memoriza cómo llama un proveedor a un producto nuestro.
 *
 * Esto es lo que hace que la mesa se encoja con el uso: la próxima vez que llegue
 * ese texto de ese proveedor, el matcher liga con score 1 y no pregunta.
 *
 * Nota: `producto_proveedor_aliases` existía desde el PRP-073 pero NADIE la
 * escribía — solo se leía. Aquí es donde se alimenta.
 */
export async function memorizarAliasProducto(input: {
  productoId: string;
  proveedorId: string;
  alias: string;
  referencia?: string | null;
}): Promise<{ ok: boolean }> {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  if (!empresaId) return { ok: false };

  const aliasNormalizado = normalizarTexto(input.alias);
  if (!aliasNormalizado) return { ok: false };

  const { error } = await supabase.from("producto_proveedor_aliases").upsert(
    {
      empresa_id: empresaId,
      producto_id: input.productoId,
      proveedor_id: input.proveedorId,
      alias: input.alias.trim(),
      alias_normalizado: aliasNormalizado,
      referencia: input.referencia ?? null,
      created_by: userId,
    },
    { onConflict: "empresa_id,proveedor_id,alias_normalizado", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[incidencias-albaran] memorizarAlias:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Memoriza cuánto contiene un formato de un proveedor (número + medida).
 *
 * "CJ. 12x1L" de este proveedor = 12 L. La próxima vez el stock se calcula solo:
 * cantidad × contenido.
 */
export async function memorizarFormatoProveedor(input: {
  alias: string;
  contenido: number;
  medida: "ud" | "kg" | "l";
  proveedorId?: string | null;
  productoId?: string | null;
}): Promise<{ ok: boolean }> {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  if (!empresaId) return { ok: false };

  const aliasNormalizado = normalizarTexto(input.alias);
  if (!aliasNormalizado || !(input.contenido > 0)) return { ok: false };

  const { error } = await supabase.from("producto_formato_aliases").upsert(
    {
      empresa_id: empresaId,
      proveedor_id: input.proveedorId ?? null,
      producto_id: input.productoId ?? null,
      alias: input.alias.trim(),
      alias_normalizado: aliasNormalizado,
      contenido: input.contenido,
      medida: input.medida,
      created_by: userId,
    },
    { onConflict: "empresa_id,proveedor_id,producto_id,alias_normalizado", ignoreDuplicates: false },
  );

  if (error) {
    console.error("[incidencias-albaran] memorizarFormato:", error.message);
    return { ok: false };
  }
  return { ok: true };
}
