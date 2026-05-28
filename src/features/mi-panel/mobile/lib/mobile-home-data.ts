import "server-only";

import {
  getMiFichajeHoy,
  getMiPanelResumen,
  listarComunicadosVisibles,
  type ComunicadoVisible,
  type MiPanelResumen,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { createClient } from "@/lib/supabase/server";

export interface MobileHomeData {
  nombre: string;
  saludo: string;
  fichajeHoy: Awaited<ReturnType<typeof getMiFichajeHoy>>["data"];
  resumen: MiPanelResumen;
  comunicadosRecientes: ComunicadoVisible[];
  cumpleEstaSemana: Array<{ nombre: string; fecha: string }>;
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

  const [fichajeRes, resumenRes, comunicadosRes] = await Promise.all([
    getMiFichajeHoy(),
    getMiPanelResumen(),
    listarComunicadosVisibles(),
  ]);

  return {
    nombre: nombre || "Empleado",
    saludo: saludoPorHora(new Date()),
    fichajeHoy: fichajeRes.ok ? fichajeRes.data : null,
    resumen: resumenRes.data,
    comunicadosRecientes: (comunicadosRes.ok ? comunicadosRes.data : []).slice(0, 3),
    cumpleEstaSemana: [], // Fase 4 conectará cumpleaños reales.
  };
}
