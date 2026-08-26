"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser, getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { MAX_DOCUMENTOS_CIERRE, DIAS_BLOQUEO_DEFAULT, DIAS_BLOQUEO_MAX } from "@/features/gerencia/types/cierres";
import type { SupabaseClient } from "@supabase/supabase-js";
const BUCKET = "cierres-documentos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type CierreModo = "fijo" | "libre";

// Tipo de movimiento registrado en el submódulo Cierres.
export type CierreTipo = "cierre" | "retirada" | "ingreso";

export interface CierreGasto {
  id?: string;
  tipo: string;
  descripcion: string;
  importe: number;
}

// Documento adjunto a un cierre/ingreso. Se admiten varios (máx. 3, controlado en UI/backend).
export interface CierreDocumento {
  path: string;
  name: string;
  size: number;
  mime: string | null;
  url: string | null;
}

export interface CierreRow {
  id: string;
  tipo: CierreTipo;
  fecha: string;
  semana_iso: string | null;
  efectivo_retirado: number;
  /** Solo en retiradas: true si el dinero ENTRA en caja, false si SALE. */
  retirada_entrada: boolean;
  total_contado: number;
  cuadra: boolean;
  descuadre: number;
  notas: string | null;
  storage_path: string | null;
  file_name: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  documentos: CierreDocumento[];
  registrado_por: string | null;
  url: string | null;
  gastos: CierreGasto[];
  total_gastos: number;
  created_at: string;
}

export interface CierresConfig {
  modo: CierreModo;
  dia_semana: number | null;
  // Días de retraso admitidos para apuntar (0 = sin bloqueo).
  dias_bloqueo: number;
  // Rol que, además de dirección, puede saltarse el plazo. null = solo dirección.
  rol_excepcion_id: string | null;
}

// Regla de cierre periódica (estilo Google Calendar): "cada N semanas, estos días".
export interface CierreProgramacion {
  id: string;
  nombre: string;
  intervalo_semanas: number;   // 1 = cada semana, 2 = quincenal, ...
  dias_semana: number[];       // 0=Lun .. 6=Dom (mismo orden que la UI)
  fecha_inicio: string;        // YYYY-MM-DD
  fecha_fin: string | null;    // null = sin fin
  activo: boolean;
}

export interface CierreProgramacionInput {
  id?: string;
  nombre: string;
  intervalo_semanas: number;
  dias_semana: number[];
  fecha_inicio: string;
  fecha_fin: string | null;
  activo: boolean;
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
return { supabase, user, empresaId };
}

// ── Bloqueo de apuntes retroactivos ──────────────────────────
// Ningún apunte (cierre, retirada o ingreso) puede registrarse con más días de
// retraso de los configurados. Se salta el plazo:
//   · Dirección (es_admin_plataforma), SIEMPRE.
//   · El rol autorizado en Ajustes → Deptos → Gerencia → Cierres
//     (`rol_excepcion_id`), si lo hay.
// `dias_bloqueo = 0` desactiva el bloqueo.
//
// Devuelve el mensaje de error si hay que BLOQUEAR, o null si se permite.
async function comprobarPlazoApunte(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  fecha: string,
): Promise<string | null> {
  const { data: cfg } = await supabase
    .from("cierres_config")
    .select("dias_bloqueo, rol_excepcion_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  // El tope manda incluso sobre lo guardado: filas antiguas con plazos largos
  // (7, 30…) quedan recortadas al máximo, no se respetan tal cual.
  const diasCfg = Number(cfg?.dias_bloqueo ?? DIAS_BLOQUEO_DEFAULT);
  const dias = Number.isFinite(diasCfg) ? Math.min(DIAS_BLOQUEO_MAX, diasCfg) : DIAS_BLOQUEO_DEFAULT;
  if (dias <= 0) return null; // 0 = sin bloqueo

  // "Hoy" según la empresa, no según el servidor.
  const tz = await getZonaHorariaEmpresa(supabase as unknown as SupabaseClient, empresaId);
  const hoy = hoyEnZona(tz);

  // Días de retraso = hoy − fecha del apunte (en días naturales completos).
  const msDia = 24 * 60 * 60 * 1000;
  const tHoy = Date.parse(`${hoy}T00:00:00Z`);
  const tApunte = Date.parse(`${fecha}T00:00:00Z`);
  if (!Number.isFinite(tHoy) || !Number.isFinite(tApunte)) return null;

  const retraso = Math.round((tHoy - tApunte) / msDia);
  if (retraso <= dias) return null; // dentro de plazo (o fecha futura)

  // Fuera de plazo: solo pasa el rol marcado como excepción en la configuración
  // de cierres. Sin bypass de director: la excepción se concede ahí, no por el
  // flag de plataforma.
  const { rolId } = await getRolContext();
  if (cfg?.rol_excepcion_id && rolId === cfg.rol_excepcion_id) return null;

  return `Fuera de plazo: no se pueden registrar apuntes con más de ${dias} ${dias === 1 ? "día" : "días"} de retraso (este lleva ${retraso}). Solo el rol autorizado puede hacerlo.`;
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

// Normaliza el JSONB `documentos` a un array tipado. Si viene vacío, cae al
// documento único legacy (storage_path/file_name/...) para no perder adjuntos antiguos.
function normalizarDocumentos(
  raw: unknown,
  legacy: { path: string | null; name: string | null; size: number | null; mime: string | null },
): Array<{ path: string; name: string; size: number; mime: string | null }> {
  const out: Array<{ path: string; name: string; size: number; mime: string | null }> = [];
  if (Array.isArray(raw)) {
    for (const d of raw) {
      const o = (d ?? {}) as Record<string, unknown>;
      const path = typeof o.path === "string" ? o.path : "";
      if (!path) continue;
      out.push({
        path,
        name: typeof o.name === "string" && o.name ? o.name : "documento",
        size: Number(o.size ?? 0) || 0,
        mime: typeof o.mime === "string" ? o.mime : null,
      });
    }
  }
  if (out.length === 0 && legacy.path) {
    out.push({ path: legacy.path, name: legacy.name || "documento", size: legacy.size ?? 0, mime: legacy.mime });
  }
  return out;
}

// Genera URLs firmadas para cada documento.
async function firmarDocumentos(
  supabase: SupabaseClient,
  docs: Array<{ path: string; name: string; size: number; mime: string | null }>,
): Promise<CierreDocumento[]> {
  const out: CierreDocumento[] = [];
  for (const d of docs) {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(d.path, SIGNED_URL_TTL_SECONDS);
    out.push({ ...d, url: signed.data?.signedUrl ?? null });
  }
  return out;
}

// Efecto de un movimiento sobre el efectivo de la caja fuerte.
// El cierre SIEMPRE suma. El ingreso SIEMPRE resta (el dinero va al banco).
// La retirada suma o resta según `retirada_entrada` (false = sale, true = entra).
// MISMA fórmula que la UI (`importeEfectivo` en CierresView) — si cambia una, cambian las dos.
//
// NO se exporta: este archivo es "use server" y ahí solo pueden salir funciones
// async (si no, el build entero falla con "Server Actions must be async functions").
// Es una ayuda interna, así que se queda dentro del módulo.
function efectoEnCaja(mov: { tipo: CierreTipo; efectivo_retirado: number; retirada_entrada?: boolean }): number {
  const magnitud = Math.abs(Number(mov.efectivo_retirado) || 0);
  if (mov.tipo === "retirada") return mov.retirada_entrada ? magnitud : -magnitud;
  return mov.tipo === "cierre" ? magnitud : -magnitud;
}

// Redondeo a céntimos: evita que los flotantes den saldos tipo -0,0000001.
function céntimos(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * El efectivo acumulado en la caja fuerte NUNCA puede quedar por debajo de cero:
 * no se puede sacar dinero que no se tiene.
 *
 * No basta con mirar el saldo final: los movimientos se ordenan por fecha, así que
 * uno con fecha atrasada puede dejar en negativo el acumulado de los días POSTERIORES.
 * Por eso se recalcula el running total completo con el movimiento nuevo insertado
 * en su sitio y se rechaza si CUALQUIER punto de la línea queda negativo.
 *
 * Devuelve null si el movimiento es válido, o el mensaje de error si no lo es.
 */
function validarSaldoNoNegativo(
  existentes: Array<{ fecha: string; created_at: string; tipo: CierreTipo; efectivo_retirado: number; retirada_entrada: boolean }>,
  nuevo: { fecha: string; tipo: CierreTipo; efectivo_retirado: number; retirada_entrada: boolean },
): string | null {
  const efecto = efectoEnCaja(nuevo);
  // Los movimientos que SUMAN efectivo nunca pueden dejar la caja en negativo.
  if (efecto >= 0) return null;

  // Saldo disponible justo ANTES de este movimiento (todo lo anterior a su fecha).
  const saldoPrevio = céntimos(
    existentes
      .filter((m) => m.fecha <= nuevo.fecha)
      .reduce((s, m) => s + efectoEnCaja(m), 0),
  );

  const importe = Math.abs(efecto);
  const accion = nuevo.tipo === "ingreso" ? "ingresar" : "retirar";

  if (saldoPrevio <= 0) {
    return `No hay efectivo acumulado en caja a fecha ${nuevo.fecha} (saldo: ${fmtEuro(saldoPrevio)}). `
      + `No puedes ${accion} ${fmtEuro(importe)} de un dinero que no tienes.`;
  }
  if (importe > saldoPrevio) {
    return `Solo hay ${fmtEuro(saldoPrevio)} de efectivo acumulado en caja a fecha ${nuevo.fecha}. `
      + `No puedes ${accion} ${fmtEuro(importe)} porque dejaría el acumulado en ${fmtEuro(céntimos(saldoPrevio - importe))}, y eso es imposible: `
      + `no se puede sacar dinero que no se tiene. Como máximo puedes ${accion} ${fmtEuro(saldoPrevio)}.`;
  }

  // El movimiento cabe en su fecha, pero al ir atrasado puede hundir días posteriores.
  const posteriores = existentes.filter((m) => m.fecha > nuevo.fecha).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.created_at < b.created_at ? -1 : 1));
  let run = céntimos(saldoPrevio + efecto);
  for (const m of posteriores) {
    run = céntimos(run + efectoEnCaja(m));
    if (run < 0) {
      return `Este movimiento cuadra el ${nuevo.fecha}, pero dejaría el acumulado en ${fmtEuro(run)} el ${m.fecha}, `
      + `y el efectivo acumulado nunca puede quedar por debajo de cero. Revisa la fecha o el importe.`;
    }
  }
  return null;
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function listCierres(): Promise<{ ok: true; data: CierreRow[] } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("cierres_semanales")
      .select("id, tipo, fecha, semana_iso, efectivo_retirado, retirada_entrada, total_contado, cuadra, descuadre, notas, storage_path, file_name, size_bytes, mime_type, documentos, registrado_por, created_at")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false });

    if (error) {
      console.error("[cierres:list] error:", error.message);
      return { ok: false, error: error.message };
    }

    // Gastos de todos los cierres de la empresa, agrupados por cierre_id.
    const gastosPorCierre: Record<string, CierreGasto[]> = {};
    {
      const { data: gData, error: gErr } = await supabase
        .from("cierres_gastos")
        .select("id, cierre_id, tipo, descripcion, importe")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: true });
      if (gErr) {
        console.error("[cierres:list] gastos:", gErr.message);
      } else {
        for (const g of gData ?? []) {
          const cid = g.cierre_id as string;
          (gastosPorCierre[cid] ??= []).push({
            id: g.id as string,
            tipo: (g.tipo as string | null) ?? "",
            descripcion: (g.descripcion as string | null) ?? "",
            importe: Number(g.importe ?? 0),
          });
        }
      }
    }

    const rows: CierreRow[] = [];
    for (const r of data ?? []) {
      const sp = r.storage_path as string | null;
      // Documentos adjuntos: el array JSONB `documentos`, con fallback al doc único legacy.
      const documentos = await firmarDocumentos(
        supabase,
        normalizarDocumentos(r.documentos, {
          path: sp,
          name: r.file_name as string | null,
          size: r.size_bytes as number | null,
          mime: r.mime_type as string | null,
        }),
      );
      // `url` = primer documento (compatibilidad con consumidores antiguos).
      const url = documentos[0]?.url ?? null;
      rows.push({
        id: r.id as string,
        tipo: (((r.tipo as string | null) ?? "cierre") as CierreTipo),
        fecha: ((r.fecha as string) ?? "").slice(0, 10),
        semana_iso: (r.semana_iso as string | null) ?? null,
        efectivo_retirado: Number(r.efectivo_retirado ?? 0),
        retirada_entrada: r.retirada_entrada === true,
        total_contado: Number(r.total_contado ?? 0),
        cuadra: Boolean(r.cuadra),
        descuadre: Number(r.descuadre ?? 0),
        notas: (r.notas as string | null) ?? null,
        storage_path: sp,
        file_name: (r.file_name as string | null) ?? null,
        size_bytes: (r.size_bytes as number | null) ?? null,
        mime_type: (r.mime_type as string | null) ?? null,
        documentos,
        registrado_por: (r.registrado_por as string | null) ?? null,
        url,
        gastos: gastosPorCierre[r.id as string] ?? [],
        total_gastos: (gastosPorCierre[r.id as string] ?? []).reduce((s, g) => s + g.importe, 0),
        created_at: (r.created_at as string) ?? "",
      });
    }
    return { ok: true, data: rows };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:list] excepción:", msg);
    return { ok: false, error: msg };
  }
}

// Documento ya subido directamente al bucket por el navegador (URL firmada).
// El servidor solo recibe los metadatos, nunca el binario → sin límite de 4.5 MB de Vercel.
export interface CierreDocumentoSubido {
  path: string;
  name: string;
  size: number;
  mime: string | null;
}

// Genera URLs de subida firmadas para que el navegador suba los adjuntos DIRECTO
// al bucket, saltando el límite de body de las Server Actions (4.5 MB en Vercel).
export async function crearUrlsSubidaCierre(
  archivos: Array<{ name: string; type: string }>,
): Promise<{ ok: true; data: Array<{ token: string; path: string }> } | { ok: false; error: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const lista = (archivos ?? []).slice(0, MAX_DOCUMENTOS_CIERRE);
    if (lista.length === 0) return { ok: false, error: "No hay archivos que subir" };

    const salida: Array<{ token: string; path: string }> = [];
    let idx = 0;
    for (const a of lista) {
      const safe = sanitizeFilename(a.name || "documento");
      // Carpeta temporal por empresa; al confirmar el cierre se referencian por path.
      const path = `${empresaId}/_pendientes/${Date.now()}_${idx}_${safe}`;
      idx += 1;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        console.error("[cierres:signedUpload]", error?.message);
        return { ok: false, error: "No se pudo preparar la subida" };
      }
      salida.push({ token: data.token, path: data.path });
    }
    return { ok: true, data: salida };
  } catch (e) {
    console.error("[cierres:crearUrlsSubidaCierre]", e);
    return { ok: false, error: "Error al preparar la subida" };
  }
}

export async function createCierre(formData: FormData): Promise<{ ok: true; data: CierreRow } | { ok: false; error: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const tipoRaw = ((formData.get("tipo") as string | null) || "cierre").trim();
    const tipo: CierreTipo = tipoRaw === "retirada" || tipoRaw === "ingreso" ? tipoRaw : "cierre";
    const fecha = ((formData.get("fecha") as string | null) || "").trim();
    const efectivoStr = ((formData.get("efectivo_retirado") as string | null) || "0").trim();
    const contadoStr = ((formData.get("total_contado") as string | null) || "0").trim();
    const notas = ((formData.get("notas") as string | null) || "").trim();
    const registradoPor = ((formData.get("registrado_por") as string | null) || "").trim();
    // Documentos ya subidos al bucket por el navegador. Solo llegan metadatos (path/name/size/mime).
    let docsSubidos: CierreDocumentoSubido[] = [];
    const docsRaw = (formData.get("documentos") as string | null) || "";
    if (docsRaw) {
      try {
        const parsed = JSON.parse(docsRaw) as unknown;
        if (Array.isArray(parsed)) {
          docsSubidos = parsed
            .map((d) => {
              const o = (d ?? {}) as Record<string, unknown>;
              return {
                path: String(o.path ?? "").trim(),
                name: String(o.name ?? "documento").trim() || "documento",
                size: Number(o.size ?? 0) || 0,
                mime: typeof o.mime === "string" ? o.mime : null,
              };
            })
            .filter((d) => d.path)
            .slice(0, MAX_DOCUMENTOS_CIERRE);
        }
      } catch (e) {
        console.error("[cierres:create] documentos parse:", e);
      }
    }

    if (!fecha) return { ok: false, error: "La fecha es obligatoria" };

    // Quién apunta el movimiento es obligatorio: todo cierre queda con responsable.
    if (!registradoPor) {
      return { ok: false, error: "Indica quién apunta el cierre: es obligatorio" };
    }

    // Cierres e ingresos exigen al menos un justificante adjunto (la retirada no).
    if (tipo !== "retirada" && docsSubidos.length === 0) {
      return { ok: false, error: `Debes adjuntar un documento para registrar ${tipo === "ingreso" ? "un ingreso" : "un cierre"}` };
    }

    // NINGÚN apunte con más retraso del permitido. Dirección siempre puede, y
    // opcionalmente el rol autorizado en Configuración. El plazo se mide en la
    // zona horaria de la EMPRESA (PRP-069): si no, cerca de medianoche el
    // servidor (UTC) contaría un día de más.
    const bloqueo = await comprobarPlazoApunte(supabase, empresaId, fecha);
    if (bloqueo) return { ok: false, error: bloqueo };

    // Gastos de la semana (registro informativo, no altera el descuadre).
    let gastosInput: CierreGasto[] = [];
    const gastosRaw = tipo === "cierre" ? ((formData.get("gastos") as string | null) || "") : "";
    if (gastosRaw) {
      try {
        const parsed = JSON.parse(gastosRaw) as unknown;
        if (Array.isArray(parsed)) {
          gastosInput = parsed
            .map((g) => {
              const o = g as Record<string, unknown>;
              const tipo = String(o.tipo ?? "").trim();
              const descripcion = String(o.descripcion ?? "").trim();
              const importe = Number(String(o.importe ?? "0").replace(",", ".")) || 0;
              return { tipo, descripcion, importe };
            })
            // Descartar filas vacías (sin tipo/descripción y sin importe).
            .filter((g) => g.tipo || g.descripcion || g.importe !== 0);
        }
      } catch (e) {
        console.error("[cierres:create] gastos parse:", e);
      }
    }

    // Importe del movimiento: siempre se guarda como magnitud (positivo).
    // En la retirada, el sentido elegido en el formulario se guarda aparte:
    //   retiradaEntrada = false → sale dinero de caja (por defecto)
    //   retiradaEntrada = true  → entra dinero en caja
    const efectivo = Math.abs(Number(efectivoStr.replace(",", ".")) || 0);
    const retiradaEntrada = tipo === "retirada"
      && ((formData.get("retirada_sentido") as string | null) || "salida").trim() === "entrada";
    // El total contado y el descuadre solo tienen sentido en el cierre semanal.
    // En retiradas/ingresos no hay descuadre: se guarda cuadrado (descuadre 0).
    const contado = tipo === "cierre" ? Number(contadoStr.replace(",", ".")) || 0 : 0;
    // Referencia = total cierre (lo que debe haber). Descuadre = retirado − cierre.
    // Si se retira MÁS que el cierre → sobra. Si se retira MENOS → falta.
    // >0 sobra · <0 falta · 0 cuadra. No se acepta valor manual.
    const descuadre = tipo === "cierre" ? Math.round((efectivo - contado) * 100) / 100 : 0;
    const cuadra = descuadre === 0;

    // ── Reglas del descuadre (barrera real, la UI solo acompaña) ──
    // Si el cierre NO cuadra hay que decidir qué se hace con la diferencia:
    //   "descuadre" → se cierra con descuadre y la nota de motivos es obligatoria.
    //   "gastos"    → la diferencia se justifica declarando gastos.
    // Si CUADRA no se admiten gastos: no hay diferencia que declarar.
    const resolucionRaw = ((formData.get("resolucion_descuadre") as string | null) || "").trim();
    const totalGastos = Math.round(gastosInput.reduce((s, g) => s + g.importe, 0) * 100) / 100;

    // Cuando SOBRA dinero (descuadre > 0) no se ha pagado nada, así que no hay
    // gasto que declarar: la única salida es cerrar con descuadre dejando por
    // escrito el justificante de por qué sobra.
    const sobra = tipo === "cierre" && descuadre > 0;

    if (tipo === "cierre" && !cuadra) {
      if (sobra) {
        if (gastosInput.length > 0) {
          return {
            ok: false,
            error: `Sobran ${fmtEuro(descuadre)}: cuando sobra dinero no se declaran gastos, `
              + `porque no se ha pagado nada. Deja por escrito el justificante de por qué sobra.`,
          };
        }
        if (!notas) {
          return {
            ok: false,
            error: `Escribe el justificante de por qué sobran ${fmtEuro(descuadre)}: es obligatorio`,
          };
        }
      } else if (resolucionRaw !== "descuadre" && resolucionRaw !== "gastos") {
        return { ok: false, error: "Hay descuadre: elige si cierras con descuadre o si declaras gastos" };
      }
      if (!sobra && resolucionRaw === "descuadre") {
        if (!notas) {
          return { ok: false, error: "Explica en las notas los motivos del descuadre: es obligatorio" };
        }
        if (gastosInput.length > 0) {
          return { ok: false, error: "Has elegido cerrar con descuadre: no se pueden declarar gastos" };
        }
      }
      if (!sobra && resolucionRaw === "gastos") {
        if (totalGastos <= 0) {
          return { ok: false, error: "Has elegido declarar gastos: añade al menos un gasto con importe" };
        }
        // Los gastos declarados justifican la diferencia, así que tienen que
        // cubrirla EXACTAMENTE: ni de más ni de menos. Se compara contra el
        // valor absoluto porque los importes siempre se apuntan en positivo.
        const objetivo = Math.abs(descuadre);
        if (totalGastos !== objetivo) {
          const sobran = céntimos(totalGastos - objetivo);
          return {
            ok: false,
            error: `Los gastos declarados suman ${fmtEuro(totalGastos)} y la diferencia del cierre es ${fmtEuro(objetivo)}. `
              + `Tienen que coincidir exactamente: ${sobran > 0 ? `sobran ${fmtEuro(sobran)}` : `faltan ${fmtEuro(-sobran)}`}.`,
          };
        }
      }
    } else if (gastosInput.length > 0) {
      // Cuadra (o no es un cierre): no hay diferencia que justificar con gastos.
      return {
        ok: false,
        error: tipo === "cierre"
          ? "El cierre cuadra: no se pueden declarar gastos porque no hay diferencia que justificar"
          : "Solo se pueden declarar gastos en un cierre con descuadre",
      };
    }

    // GUARDIA DE CAJA: el efectivo acumulado nunca puede quedar por debajo de cero.
    // Se comprueba en el servidor (barrera real) además de en la UI, porque aquí es
    // donde se decide si el movimiento entra o no en la caja.
    if (efectivo > 0) {
      const { data: previos, error: previosErr } = await supabase
        .from("cierres_semanales")
        .select("fecha, created_at, tipo, efectivo_retirado, retirada_entrada")
        .eq("empresa_id", empresaId);

      if (previosErr) {
        console.error("[cierres:create] saldo previo:", previosErr.message);
        return { ok: false, error: "No se pudo comprobar el efectivo acumulado en caja" };
      }

      const existentes = (previos ?? []).map((m) => ({
        fecha: ((m.fecha as string) ?? "").slice(0, 10),
        created_at: (m.created_at as string) ?? "",
        tipo: (((m.tipo as string | null) ?? "cierre") as CierreTipo),
        efectivo_retirado: Number(m.efectivo_retirado ?? 0),
        retirada_entrada: m.retirada_entrada === true,
      }));

      const problema = validarSaldoNoNegativo(existentes, {
        fecha,
        tipo,
        efectivo_retirado: efectivo,
        retirada_entrada: retiradaEntrada,
      });
      if (problema) return { ok: false, error: problema };
    }

    const { data: row, error: dbErr } = await supabase
      .from("cierres_semanales")
      .insert({
        empresa_id: empresaId,
        tipo,
        fecha,
        semana_iso: isoWeek(fecha),
        efectivo_retirado: efectivo,
        retirada_entrada: retiradaEntrada,
        total_contado: contado,
        cuadra,
        descuadre,
        notas: notas || null,
        registrado_por: registradoPor || null,
        registrado_por_uid: user.id,
      })
      .select("id, created_at")
      .single();

    if (dbErr || !row) {
      console.error("[cierres:create] db:", dbErr?.message);
      return { ok: false, error: dbErr?.message ?? "No se pudo crear el cierre" };
    }

    const cierreId = row.id as string;
    // Los documentos ya están en el bucket (subida directa a `_pendientes`).
    // Los movemos a la carpeta definitiva del cierre y recopilamos los metadatos.
    const documentosMeta: Array<{ path: string; name: string; size: number; mime: string | null }> = [];
    let idx = 0;
    for (const doc of docsSubidos) {
      const safe = sanitizeFilename(doc.name);
      const destino = `${empresaId}/${cierreId}/${Date.now()}_${idx}_${safe}`;
      idx += 1;
      const { error: mvErr } = await supabase.storage.from(BUCKET).move(doc.path, destino);
      if (mvErr) {
        console.error("[cierres:create] move:", mvErr.message);
        // Si no se pudo mover (p. ej. ya movido), conservamos el path original.
        documentosMeta.push({ path: doc.path, name: doc.name, size: doc.size, mime: doc.mime });
        continue;
      }
      documentosMeta.push({ path: destino, name: doc.name, size: doc.size, mime: doc.mime });
    }

    if (documentosMeta.length > 0) {
      // El primer documento se refleja también en las columnas legacy por compatibilidad.
      const primero = documentosMeta[0];
      const { error: updErr } = await supabase
        .from("cierres_semanales")
        .update({
          documentos: documentosMeta,
          storage_path: primero.path,
          file_name: primero.name,
          size_bytes: primero.size,
          mime_type: primero.mime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cierreId);
      if (updErr) console.error("[cierres:create] update path:", updErr.message);
    }

    const documentos = await firmarDocumentos(supabase, documentosMeta);
    const primeroDoc = documentos[0] ?? null;
    const storagePath = primeroDoc ? documentosMeta[0].path : null;
    const fileName = primeroDoc?.name ?? null;
    const fileSize = primeroDoc?.size ?? null;
    const mimeType = primeroDoc?.mime ?? null;
    const signedUrl = primeroDoc?.url ?? null;

    // Insertar los gastos de la semana asociados al cierre.
    let gastosGuardados: CierreGasto[] = [];
    if (gastosInput.length > 0) {
      const { data: gRows, error: gErr } = await supabase
        .from("cierres_gastos")
        .insert(
          gastosInput.map((g) => ({
            cierre_id: cierreId,
            empresa_id: empresaId,
            tipo: g.tipo,
            descripcion: g.descripcion || null,
            importe: g.importe,
          })),
        )
        .select("id, tipo, descripcion, importe");
      if (gErr) {
        console.error("[cierres:create] gastos insert:", gErr.message);
      } else {
        gastosGuardados = (gRows ?? []).map((g) => ({
          id: g.id as string,
          tipo: (g.tipo as string | null) ?? "",
          descripcion: (g.descripcion as string | null) ?? "",
          importe: Number(g.importe ?? 0),
        }));
      }
    }

    return {
      ok: true,
      data: {
        id: cierreId,
        tipo,
        fecha,
        semana_iso: isoWeek(fecha),
        efectivo_retirado: efectivo,
        retirada_entrada: retiradaEntrada,
        total_contado: contado,
        cuadra,
        descuadre,
        notas: notas || null,
        storage_path: storagePath,
        file_name: fileName,
        size_bytes: fileSize,
        mime_type: mimeType,
        documentos,
        registrado_por: registradoPor || null,
        url: signedUrl,
        gastos: gastosGuardados,
        total_gastos: gastosGuardados.reduce((s, g) => s + g.importe, 0),
        created_at: (row.created_at as string) ?? new Date().toISOString(),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:create] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCierre(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: row } = await supabase
      .from("cierres_semanales")
      .select("storage_path, documentos")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    // Recopilar todas las rutas a borrar (array `documentos` + doc legacy), sin duplicados.
    const paths = new Set<string>();
    if (Array.isArray(row?.documentos)) {
      for (const d of row!.documentos as unknown[]) {
        const p = (d as Record<string, unknown>)?.path;
        if (typeof p === "string" && p) paths.add(p);
      }
    }
    if (row?.storage_path) paths.add(row.storage_path as string);
    if (paths.size > 0) {
      await supabase.storage.from(BUCKET).remove([...paths]);
    }

    const { error } = await supabase
      .from("cierres_semanales")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[cierres:delete] db:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:delete] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function getCierresConfig(): Promise<{ ok: true; data: CierresConfig } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("cierres_config")
      .select("modo, dia_semana, dias_bloqueo, rol_excepcion_id")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error) {
      console.error("[cierres:cfg:get]", error.message);
      return { ok: false, error: error.message };
    }

    if (!data) {
      return {
        ok: true,
        data: { modo: "libre", dia_semana: null, dias_bloqueo: DIAS_BLOQUEO_DEFAULT, rol_excepcion_id: null },
      };
    }

    return {
      ok: true,
      data: {
        modo: ((data.modo as string) ?? "libre") as CierreModo,
        dia_semana: (data.dia_semana as number | null) ?? null,
        // Recortado al tope: la pantalla debe ver exactamente el plazo que el
        // servidor va a aplicar, aunque en BD haya un valor antiguo mayor.
        dias_bloqueo: Math.min(DIAS_BLOQUEO_MAX, Number(data.dias_bloqueo ?? DIAS_BLOQUEO_DEFAULT) || 0),
        rol_excepcion_id: (data.rol_excepcion_id as string | null) ?? null,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:cfg:get] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCierresConfig(input: {
  modo: CierreModo;
  dia_semana: number | null;
  dias_bloqueo?: number;
  rol_excepcion_id?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const dia = input.modo === "fijo" ? input.dia_semana : null;

    // El día de cierre es ajuste de uso diario (engranaje del módulo). El PLAZO
    // para apuntar vive en Ajustes → Departamentos → Gerencia → Cierres y solo
    // lo toca dirección, así que aquí únicamente viaja si viene explícito.
    const tocaPlazo = input.dias_bloqueo !== undefined || input.rol_excepcion_id !== undefined;

    const fila: Record<string, unknown> = {
      empresa_id: empresaId,
      modo: input.modo,
      dia_semana: dia,
      updated_at: new Date().toISOString(),
    };

    if (tocaPlazo) {
      // Cambiar el plazo exige GERENCIA (editar): si no, cualquiera se lo
      // abriría y se saltaría la norma por la puerta de atrás.
      const { permisos } = await getRolContext();
      if (!puedeEditarModulo(permisos, "GERENCIA")) {
        return { ok: false, error: "Sin permisos: necesitas Gerencia para cambiar el plazo para apuntar" };
      }
      // Plazo saneado: entero de 0 a DIAS_BLOQUEO_MAX (0 = sin bloqueo).
      // El tope es duro: más días permitirían apuntar cierres antiguos que
      // recalculan en cadena el efectivo acumulado de hoy.
      const diasRaw = Number(input.dias_bloqueo ?? DIAS_BLOQUEO_DEFAULT);
      fila.dias_bloqueo = Number.isFinite(diasRaw)
        ? Math.min(DIAS_BLOQUEO_MAX, Math.max(0, Math.round(diasRaw)))
        : DIAS_BLOQUEO_DEFAULT;
      fila.rol_excepcion_id = input.rol_excepcion_id ?? null;
    }

    const { error } = await supabase
      .from("cierres_config")
      .upsert(fila, { onConflict: "empresa_id" });

    if (error) {
      console.error("[cierres:cfg:set]", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:cfg:set] excepción:", msg);
    return { ok: false, error: msg };
  }
}

// ── Programaciones periódicas de cierre ──────────────────────

function normalizarDias(dias: unknown): number[] {
  if (!Array.isArray(dias)) return [];
  const set = new Set<number>();
  for (const d of dias) {
    const n = Number(d);
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export async function listCierresProgramaciones(): Promise<{ ok: true; data: CierreProgramacion[] } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("cierres_programaciones")
      .select("id, nombre, intervalo_semanas, dias_semana, fecha_inicio, fecha_fin, activo")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[cierres:prog:list]", error.message);
      return { ok: false, error: error.message };
    }

    const rows: CierreProgramacion[] = (data ?? []).map((r) => ({
      id: r.id as string,
      nombre: ((r.nombre as string | null) ?? "Cierre").trim() || "Cierre",
      intervalo_semanas: Number(r.intervalo_semanas ?? 1) || 1,
      dias_semana: normalizarDias(r.dias_semana),
      fecha_inicio: ((r.fecha_inicio as string) ?? "").slice(0, 10),
      fecha_fin: r.fecha_fin ? ((r.fecha_fin as string).slice(0, 10)) : null,
      activo: Boolean(r.activo),
    }));
    return { ok: true, data: rows };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:prog:list] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function upsertCierreProgramacion(input: CierreProgramacionInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const dias = normalizarDias(input.dias_semana);
    if (dias.length === 0) return { ok: false, error: "Elige al menos un día de la semana" };
    if (!input.fecha_inicio) return { ok: false, error: "La fecha de inicio es obligatoria" };
    const intervalo = Math.min(52, Math.max(1, Math.round(Number(input.intervalo_semanas) || 1)));
    if (input.fecha_fin && input.fecha_fin < input.fecha_inicio) {
      return { ok: false, error: "La fecha de fin no puede ser anterior a la de inicio" };
    }

    const payload = {
      empresa_id: empresaId,
      nombre: (input.nombre || "").trim() || "Cierre",
      intervalo_semanas: intervalo,
      dias_semana: dias,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin || null,
      activo: input.activo,
      updated_at: new Date().toISOString(),
    };

    const q = input.id
      ? supabase.from("cierres_programaciones").update(payload).eq("id", input.id).eq("empresa_id", empresaId)
      : supabase.from("cierres_programaciones").insert(payload);

    const { error } = await q;
    if (error) {
      console.error("[cierres:prog:upsert]", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:prog:upsert] excepción:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCierreProgramacion(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { error } = await supabase
      .from("cierres_programaciones")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[cierres:prog:delete]", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cierres:prog:delete] excepción:", msg);
    return { ok: false, error: msg };
  }
}
