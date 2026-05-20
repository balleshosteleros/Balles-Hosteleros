"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

type DashboardMetric = {
  value: number;
  label: string;
  tone: "default" | "green" | "amber" | "red" | "blue";
};

type DashboardAlert = {
  title: string;
  detail: string;
  href: string;
  tone: "green" | "amber" | "red" | "blue";
};

type DashboardRecentEmployee = {
  id: string;
  nombre: string;
  puesto: string;
  fechaAlta: string;
  estado: string;
};

export type RrhhDashboard = {
  empresaNombre: string | null;
  metrics: {
    empleadosActivos: DashboardMetric;
    altasRecientes: DashboardMetric;
    fichajesAbiertos: DashboardMetric;
    firmasPendientes: DashboardMetric;
    solicitudesPendientes: DashboardMetric;
  };
  recentEmployees: DashboardRecentEmployee[];
  alerts: DashboardAlert[];
};

function thirtyDaysAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

async function resolveEmpresaId() {
  const { supabase, userId, empresaId } = await getAppContext();
  if (!userId) return { supabase, empresaId: null };
  const activeEmpresaId = await getEmpresaActivaForUser(supabase, userId);
  return { supabase, empresaId: activeEmpresaId ?? empresaId };
}

export async function getRrhhDashboard(): Promise<RrhhDashboard> {
  const { supabase, empresaId } = await resolveEmpresaId();
  const empty: RrhhDashboard = {
    empresaNombre: null,
    metrics: {
      empleadosActivos: { value: 0, label: "Empleados activos", tone: "default" },
      altasRecientes: { value: 0, label: "Altas últimos 30 días", tone: "green" },
      fichajesAbiertos: { value: 0, label: "Fichajes abiertos", tone: "amber" },
      firmasPendientes: { value: 0, label: "Firmas pendientes", tone: "blue" },
      solicitudesPendientes: { value: 0, label: "Solicitudes pendientes", tone: "red" },
    },
    recentEmployees: [],
    alerts: [],
  };

  if (!empresaId) return empty;

  try {
    const since = thirtyDaysAgo();
    const today = new Date().toISOString().slice(0, 10);

    const [
      empresaRes,
      empleadosActivosRes,
      altasRecientesRes,
      fichajesAbiertosRes,
      fichajesSinCierreRes,
      firmasPendientesRes,
      solicitudesPendientesRes,
      recentEmployeesRes,
    ] = await Promise.all([
      supabase
        .from("empresas")
        .select("nombre")
        .eq("id", empresaId)
        .maybeSingle(),
      supabase
        .from("empleados")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("estado", "Activo"),
      supabase
        .from("empleados")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .gte("fecha_alta", since),
      supabase
        .from("fichajes")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .in("estado", ["trabajando", "pausa"]),
      supabase
        .from("fichajes")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .lt("fecha", today)
        .in("estado", ["trabajando", "pausa"]),
      supabase
        .from("firmas_documentos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("estado", "pendiente"),
      supabase
        .from("solicitudes_personal")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("estado", "pendiente"),
      supabase
        .from("empleados")
        .select("id, nombre, apellidos, puesto, fecha_alta, estado")
        .eq("empresa_id", empresaId)
        .order("fecha_alta", { ascending: false })
        .limit(5),
    ]);

    const fichajesAbiertos = fichajesAbiertosRes.count ?? 0;
    const fichajesSinCierre = fichajesSinCierreRes.count ?? 0;
    const firmasPendientes = firmasPendientesRes.count ?? 0;
    const solicitudesPendientes = solicitudesPendientesRes.count ?? 0;

    const alerts: DashboardAlert[] = [
      fichajesSinCierre > 0
        ? {
            title: "Fichajes sin cierre",
            detail: `${fichajesSinCierre} registro${fichajesSinCierre === 1 ? "" : "s"} abierto${fichajesSinCierre === 1 ? "" : "s"} de días anteriores`,
            href: "/rrhh/fichajes",
            tone: "red",
          }
        : {
            title: "Fichajes al día",
            detail: "No hay fichajes abiertos de días anteriores",
            href: "/rrhh/fichajes",
            tone: "green",
          },
      firmasPendientes > 0
        ? {
            title: "Firmas pendientes",
            detail: `${firmasPendientes} documento${firmasPendientes === 1 ? "" : "s"} esperando firma`,
            href: "/rrhh/firmas",
            tone: "blue",
          }
        : {
            title: "Firmas sin bloqueo",
            detail: "No hay documentos pendientes de firma",
            href: "/rrhh/firmas",
            tone: "green",
          },
      solicitudesPendientes > 0
        ? {
            title: "Solicitudes por revisar",
            detail: `${solicitudesPendientes} solicitud${solicitudesPendientes === 1 ? "" : "es"} pendiente${solicitudesPendientes === 1 ? "" : "s"}`,
            href: "/rrhh/solicitudes",
            tone: "amber",
          }
        : {
            title: "Solicitudes revisadas",
            detail: "No hay solicitudes pendientes",
            href: "/rrhh/solicitudes",
            tone: "green",
          },
    ];

    const recentEmployees: DashboardRecentEmployee[] = (
      recentEmployeesRes.data ?? []
    ).map((row) => ({
      id: row.id as string,
      nombre: `${row.nombre ?? ""} ${row.apellidos ?? ""}`.trim() || "Sin nombre",
      puesto: (row.puesto as string | null) ?? "Sin puesto asignado",
      fechaAlta: (row.fecha_alta as string | null) ?? "",
      estado: (row.estado as string | null) ?? "Sin estado",
    }));

    return {
      empresaNombre: (empresaRes.data?.nombre as string | null | undefined) ?? null,
      metrics: {
        empleadosActivos: {
          value: empleadosActivosRes.count ?? 0,
          label: "Empleados activos",
          tone: "default",
        },
        altasRecientes: {
          value: altasRecientesRes.count ?? 0,
          label: "Altas últimos 30 días",
          tone: "green",
        },
        fichajesAbiertos: {
          value: fichajesAbiertos,
          label: "Fichajes abiertos",
          tone: fichajesSinCierre > 0 ? "red" : "amber",
        },
        firmasPendientes: {
          value: firmasPendientes,
          label: "Firmas pendientes",
          tone: "blue",
        },
        solicitudesPendientes: {
          value: solicitudesPendientes,
          label: "Solicitudes pendientes",
          tone: solicitudesPendientes > 0 ? "red" : "default",
        },
      },
      recentEmployees,
      alerts,
    };
  } catch (err) {
    console.error("[rrhh] getRrhhDashboard:", err);
    return empty;
  }
}
