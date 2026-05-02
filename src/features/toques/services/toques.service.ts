/**
 * toques.service.ts — Lecturas del módulo TOQUES (PRP-033).
 *
 * Todas las funciones usan el cliente Supabase autenticado y dependen de RLS.
 * Compatible tanto con cliente browser como server (recibe el cliente como parámetro).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Balance,
  Canje,
  Ganador,
  Movimiento,
  Nivel,
  NivelProgreso,
  RankingRow,
  Recompensa,
  Regla,
  ToquePeriodo,
} from "@/features/toques/types/toques.types";

// ─── Helpers de mapeo snake → camel ──────────────────────────
type Row = Record<string, unknown>;

function s(row: Row, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function n(row: Row, key: string): number {
  const v = row[key];
  return typeof v === "number" ? v : v == null ? 0 : Number(v) || 0;
}
function b(row: Row, key: string): boolean {
  return Boolean(row[key]);
}
function nul<T>(row: Row, key: string): T | null {
  const v = row[key];
  return v == null ? null : (v as T);
}

function mapRegla(r: Row): Regla {
  return {
    id: s(r, "id"),
    empresaId: s(r, "empresa_id"),
    codigo: s(r, "codigo"),
    nombre: s(r, "nombre"),
    descripcion: s(r, "descripcion"),
    toques: n(r, "toques"),
    periodicidad: (s(r, "periodicidad") || "diario") as Regla["periodicidad"],
    activa: b(r, "activa"),
  };
}

function mapNivel(r: Row): Nivel {
  return {
    id: s(r, "id"),
    empresaId: s(r, "empresa_id"),
    orden: n(r, "orden"),
    nombre: s(r, "nombre"),
    toquesMin: n(r, "toques_min"),
    badgeColor: s(r, "badge_color") || "#6b7280",
    badgeIcon: nul<string>(r, "badge_icon"),
  };
}

function mapRecompensa(r: Row): Recompensa {
  return {
    id: s(r, "id"),
    empresaId: s(r, "empresa_id"),
    nombre: s(r, "nombre"),
    descripcion: s(r, "descripcion"),
    costeToques: n(r, "coste_toques"),
    tipo: (s(r, "tipo") || "custom") as Recompensa["tipo"],
    activa: b(r, "activa"),
    orden: n(r, "orden"),
  };
}

function mapMovimiento(r: Row): Movimiento {
  return {
    id: s(r, "id"),
    empresaId: s(r, "empresa_id"),
    userId: s(r, "user_id"),
    empleadoNombre: s(r, "empleado_nombre"),
    toques: n(r, "toques"),
    origen: (s(r, "origen") || "ajuste") as Movimiento["origen"],
    reglaId: nul<string>(r, "regla_id"),
    recompensaId: nul<string>(r, "recompensa_id"),
    canjeId: nul<string>(r, "canje_id"),
    periodo: nul<Movimiento["periodo"]>(r, "periodo"),
    fecha: s(r, "fecha"),
    motivo: s(r, "motivo"),
    contexto: (r["contexto"] as Record<string, unknown>) ?? {},
    otorgadoPor: nul<string>(r, "otorgado_por"),
    createdAt: s(r, "created_at"),
  };
}

function mapCanje(r: Row): Canje {
  return {
    id: s(r, "id"),
    empresaId: s(r, "empresa_id"),
    userId: s(r, "user_id"),
    empleadoNombre: s(r, "empleado_nombre"),
    recompensaId: s(r, "recompensa_id"),
    recompensaNombre: s(r, "recompensa_nombre"),
    costeToques: n(r, "coste_toques"),
    estado: (s(r, "estado") || "pendiente") as Canje["estado"],
    solicitadoAt: s(r, "solicitado_at"),
    resueltoAt: nul<string>(r, "resuelto_at"),
    resueltoPor: nul<string>(r, "resuelto_por"),
    fechaDisfrute: nul<string>(r, "fecha_disfrute"),
    notasSolicitud: s(r, "notas_solicitud"),
    notasRevision: s(r, "notas_revision"),
  };
}

function mapGanador(r: Row): Ganador {
  return {
    id: s(r, "id"),
    empresaId: s(r, "empresa_id"),
    periodo: (s(r, "periodo") || "mes") as Ganador["periodo"],
    periodoInicio: s(r, "periodo_inicio"),
    periodoFin: s(r, "periodo_fin"),
    userId: s(r, "user_id"),
    empleadoNombre: s(r, "empleado_nombre"),
    totalToques: n(r, "total_toques"),
    bonusOtorgado: n(r, "bonus_otorgado"),
    titulo: nul<string>(r, "titulo"),
    createdAt: s(r, "created_at"),
  };
}

// ─── Cálculo periodo → rango fecha ───────────────────────────
export function rangoPeriodo(periodo: ToquePeriodo, ref: Date = new Date()): { inicio: string; fin: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  const fmt = (date: Date) => date.toISOString().slice(0, 10);

  if (periodo === "historico") {
    return { inicio: "1900-01-01", fin: fmt(new Date(y + 100, 0, 1)) };
  }
  if (periodo === "dia") {
    const x = fmt(ref);
    return { inicio: x, fin: x };
  }
  if (periodo === "semana") {
    // ISO week: lunes a domingo
    const day = ref.getDay() || 7; // 1..7 (lunes=1)
    const monday = new Date(y, m, d - (day - 1));
    const sunday = new Date(y, m, d - (day - 1) + 6);
    return { inicio: fmt(monday), fin: fmt(sunday) };
  }
  if (periodo === "mes") {
    const inicio = new Date(y, m, 1);
    const fin = new Date(y, m + 1, 0);
    return { inicio: fmt(inicio), fin: fmt(fin) };
  }
  if (periodo === "trimestre") {
    const qStart = Math.floor(m / 3) * 3;
    const inicio = new Date(y, qStart, 1);
    const fin = new Date(y, qStart + 3, 0);
    return { inicio: fmt(inicio), fin: fmt(fin) };
  }
  // ano
  return { inicio: `${y}-01-01`, fin: `${y}-12-31` };
}

// ─── Cálculo de nivel + progreso ─────────────────────────────
export function calcularNivel(toquesAcumulados: number, niveles: Nivel[]): NivelProgreso {
  const ordered = [...niveles].sort((a, b) => a.toquesMin - b.toquesMin);
  if (ordered.length === 0) {
    return { actual: null, siguiente: null, toquesActuales: toquesAcumulados, toquesParaSiguiente: 0, progresoPct: 0 };
  }
  let actual: Nivel = ordered[0];
  let siguiente: Nivel | null = ordered[1] ?? null;
  for (let i = 0; i < ordered.length; i++) {
    if (toquesAcumulados >= ordered[i].toquesMin) {
      actual = ordered[i];
      siguiente = ordered[i + 1] ?? null;
    }
  }
  const toquesParaSiguiente = siguiente ? Math.max(0, siguiente.toquesMin - toquesAcumulados) : 0;
  const rango = siguiente ? siguiente.toquesMin - actual.toquesMin : 0;
  const ganados = toquesAcumulados - actual.toquesMin;
  const progresoPct = siguiente && rango > 0 ? Math.min(100, Math.max(0, (ganados / rango) * 100)) : 100;
  return { actual, siguiente, toquesActuales: toquesAcumulados, toquesParaSiguiente, progresoPct };
}

// ─── Lecturas ────────────────────────────────────────────────

export async function getMiBalance(supabase: SupabaseClient, userId: string): Promise<Balance> {
  const { data, error } = await supabase
    .from("toques_balance")
    .select("empresa_id, user_id, toques_acumulados, toques_canjeables, ultimo_movimiento_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[toques_balance:read]", error);
    throw new Error(`No se pudo leer el balance: ${error.message}`);
  }
  if (!data) {
    return { empresaId: "", userId, toquesAcumulados: 0, toquesCanjeables: 0, ultimoMovimientoAt: null };
  }
  return {
    empresaId: s(data, "empresa_id"),
    userId: s(data, "user_id"),
    toquesAcumulados: n(data, "toques_acumulados"),
    toquesCanjeables: n(data, "toques_canjeables"),
    ultimoMovimientoAt: nul<string>(data, "ultimo_movimiento_at"),
  };
}

export async function getMiTimeline(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<Movimiento[]> {
  const { data, error } = await supabase
    .from("toques_movimientos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[toques_movimientos:read]", error);
    throw new Error(`No se pudo leer el timeline: ${error.message}`);
  }
  return (data ?? []).map((r) => mapMovimiento(r as Row));
}

export async function getReglas(supabase: SupabaseClient, empresaId: string): Promise<Regla[]> {
  const { data, error } = await supabase
    .from("toques_reglas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("nombre", { ascending: true });
  if (error) {
    console.error("[toques_reglas:read]", error);
    throw new Error(`No se pudieron leer las reglas: ${error.message}`);
  }
  return (data ?? []).map((r) => mapRegla(r as Row));
}

export async function getNiveles(supabase: SupabaseClient, empresaId: string): Promise<Nivel[]> {
  const { data, error } = await supabase
    .from("toques_niveles")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("orden", { ascending: true });
  if (error) {
    console.error("[toques_niveles:read]", error);
    throw new Error(`No se pudieron leer los niveles: ${error.message}`);
  }
  return (data ?? []).map((r) => mapNivel(r as Row));
}

export async function getRecompensas(supabase: SupabaseClient, empresaId: string): Promise<Recompensa[]> {
  const { data, error } = await supabase
    .from("toques_recompensas")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("activa", true)
    .order("orden", { ascending: true });
  if (error) {
    console.error("[toques_recompensas:read]", error);
    throw new Error(`No se pudieron leer las recompensas: ${error.message}`);
  }
  return (data ?? []).map((r) => mapRecompensa(r as Row));
}

export async function getRanking(
  supabase: SupabaseClient,
  empresaId: string,
  periodo: ToquePeriodo,
  niveles: Nivel[]
): Promise<RankingRow[]> {
  const { inicio, fin } = rangoPeriodo(periodo);
  const { data, error } = await supabase.rpc("toques_ranking", {
    p_empresa_id: empresaId,
    p_inicio: inicio,
    p_fin: fin,
  });
  if (error) {
    console.error("[toques_ranking:rpc]", error);
    throw new Error(`No se pudo calcular el ranking: ${error.message}`);
  }
  const rows = (data ?? []) as Row[];
  // Para el nivel del usuario en ranking necesitamos sus toques ACUMULADOS (no del periodo).
  // Hacemos una query adicional al view balance para los user_ids del ranking.
  const userIds = rows.map((r) => s(r, "user_id")).filter(Boolean);
  let balances: Record<string, number> = {};
  if (userIds.length) {
    const { data: balData } = await supabase
      .from("toques_balance")
      .select("user_id, toques_acumulados")
      .in("user_id", userIds);
    if (balData) {
      balances = Object.fromEntries(
        (balData as Row[]).map((b) => [s(b, "user_id"), n(b, "toques_acumulados")])
      );
    }
  }
  // Avatar y departamento desde profiles
  let profilesById: Record<string, { avatar: string | null; departamento: string | null }> = {};
  if (userIds.length) {
    const { data: profData } = await supabase
      .from("profiles")
      .select("user_id, avatar_url, departamento")
      .in("user_id", userIds);
    if (profData) {
      profilesById = Object.fromEntries(
        (profData as Row[]).map((p) => [
          s(p, "user_id"),
          { avatar: nul<string>(p, "avatar_url"), departamento: nul<string>(p, "departamento") },
        ])
      );
    }
  }

  return rows.map((r, idx) => {
    const userId = s(r, "user_id");
    const acumulados = balances[userId] ?? n(r, "total");
    const nivel = calcularNivel(acumulados, niveles).actual;
    const prof = profilesById[userId];
    return {
      userId,
      empleadoNombre: s(r, "empleado_nombre"),
      total: n(r, "total"),
      posicion: idx + 1,
      nivel,
      avatarUrl: prof?.avatar ?? null,
      departamento: prof?.departamento ?? null,
    };
  });
}

export async function getHallOfFame(supabase: SupabaseClient, empresaId: string, limit = 12): Promise<Ganador[]> {
  const { data, error } = await supabase
    .from("toques_ganadores")
    .select("*")
    .eq("empresa_id", empresaId)
    .in("periodo", ["mes", "trimestre", "ano"])
    .order("periodo_inicio", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[toques_ganadores:read]", error);
    throw new Error(`No se pudo leer el Hall of Fame: ${error.message}`);
  }
  return (data ?? []).map((r) => mapGanador(r as Row));
}

export async function getMisCanjes(supabase: SupabaseClient, userId: string): Promise<Canje[]> {
  const { data, error } = await supabase
    .from("toques_canjes")
    .select("*")
    .eq("user_id", userId)
    .order("solicitado_at", { ascending: false });
  if (error) {
    console.error("[toques_canjes:read_own]", error);
    throw new Error(`No se pudo leer tus canjes: ${error.message}`);
  }
  return (data ?? []).map((r) => mapCanje(r as Row));
}

export async function getCanjesPendientes(supabase: SupabaseClient, empresaId: string): Promise<Canje[]> {
  const { data, error } = await supabase
    .from("toques_canjes")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("estado", "pendiente")
    .order("solicitado_at", { ascending: true });
  if (error) {
    console.error("[toques_canjes:read_pendientes]", error);
    throw new Error(`No se pudo leer los canjes pendientes: ${error.message}`);
  }
  return (data ?? []).map((r) => mapCanje(r as Row));
}

export async function getReservadoEnCanjesPendientes(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("toques_canjes")
    .select("coste_toques")
    .eq("user_id", userId)
    .eq("estado", "pendiente");
  if (error) {
    console.error("[toques_canjes:read_reservado]", error);
    return 0;
  }
  return ((data ?? []) as Row[]).reduce((acc, r) => acc + n(r, "coste_toques"), 0);
}
