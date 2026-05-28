import "server-only";

import {
  getMiFichajeHoy,
  getMiPanelResumen,
  listarComunicadosVisibles,
  type ComunicadoVisible,
  type MiPanelResumen,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaId } from "@/features/empresa/actions/empresa-activa-actions";

export interface MobileHomeData {
  nombre: string;
  saludo: string;
  fichajeHoy: Awaited<ReturnType<typeof getMiFichajeHoy>>["data"];
  resumen: MiPanelResumen;
  comunicadosRecientes: ComunicadoVisible[];
  cumpleEstaSemana: Array<{ nombre: string; fechaTexto: string; diasRestantes: number }>;
}

function diasDesdeHoy(fechaNac: string): { diaMes: number; mesMes: number; diasHasta: number } | null {
  const d = new Date(fechaNac);
  if (Number.isNaN(d.getTime())) return null;
  const hoy = new Date();
  const esteAnio = hoy.getFullYear();
  const cumpleEsteAnio = new Date(esteAnio, d.getMonth(), d.getDate());
  let target = cumpleEsteAnio;
  // Si ya pasó hace más de 1 día, calculamos para el año que viene.
  const diff = Math.round((cumpleEsteAnio.getTime() - hoy.setHours(0, 0, 0, 0)) / 86_400_000);
  if (diff < -1) target = new Date(esteAnio + 1, d.getMonth(), d.getDate());
  const diasHasta = Math.round((target.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  return { diaMes: d.getDate(), mesMes: d.getMonth(), diasHasta };
}

function formatearCumple(fechaNac: string): string {
  const d = new Date(fechaNac);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

function saludoPorHora(d: Date): string {
  const h = d.getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export async function getMobileHomeData(): Promise<MobileHomeData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nombre = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nombre, apellidos")
      .eq("user_id", user.id)
      .maybeSingle();
    nombre = `${profile?.nombre ?? ""} ${profile?.apellidos ?? ""}`.trim();
    if (!nombre) nombre = user.email?.split("@")[0] ?? "";
  }

  const empresaId = await getEmpresaActivaId();

  const [fichajeRes, resumenRes, comunicadosRes, cumples] = await Promise.all([
    getMiFichajeHoy(),
    getMiPanelResumen(),
    listarComunicadosVisibles(),
    empresaId ? listarCumpleEstaSemana(supabase, empresaId, user?.id ?? null) : Promise.resolve([]),
  ]);

  return {
    nombre: nombre || "Empleado",
    saludo: saludoPorHora(new Date()),
    fichajeHoy: fichajeRes.ok ? fichajeRes.data : null,
    resumen: resumenRes.data,
    comunicadosRecientes: (comunicadosRes.ok ? comunicadosRes.data : []).slice(0, 3),
    cumpleEstaSemana: cumples,
  };
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function listarCumpleEstaSemana(
  supabase: SupabaseLike,
  empresaId: string,
  selfUserId: string | null,
): Promise<MobileHomeData["cumpleEstaSemana"]> {
  const { data } = await supabase
    .from("empleados")
    .select("user_id, nombre, apellidos, fecha_nacimiento, fecha_baja")
    .eq("empresa_id", empresaId)
    .not("fecha_nacimiento", "is", null);
  if (!data) return [];

  return (data as Array<{
    user_id: string | null;
    nombre: string | null;
    apellidos: string | null;
    fecha_nacimiento: string | null;
    fecha_baja: string | null;
  }>)
    .filter((e) => !e.fecha_baja && e.fecha_nacimiento)
    .filter((e) => !selfUserId || e.user_id !== selfUserId) // no mostrarse a uno mismo
    .map((e) => {
      const fecha = e.fecha_nacimiento!;
      const dias = diasDesdeHoy(fecha);
      return {
        nombreCompleto: `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim() || "Compañero/a",
        fechaTexto: formatearCumple(fecha),
        diasHasta: dias?.diasHasta ?? 999,
      };
    })
    .filter((e) => e.diasHasta >= 0 && e.diasHasta <= 7)
    .sort((a, b) => a.diasHasta - b.diasHasta)
    .slice(0, 5)
    .map((e) => ({
      nombre: e.nombreCompleto,
      fechaTexto: e.fechaTexto,
      diasRestantes: e.diasHasta,
    }));
}
