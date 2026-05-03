"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Network,
  CalendarDays,
  Timer,
  Fingerprint,
  ClipboardCheck,
  ClipboardList,
  Inbox,
  Megaphone,
  Files,
  GraduationCap,
  Settings,
  ChevronRight,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import type { MiPanelResumen } from "@/features/mi-panel/actions/mi-panel-actions";

interface Tile {
  href: string;
  title: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  metric: string;
  hint: string;
  badge?: { text: string; color: string };
}

interface Props {
  resumen: MiPanelResumen;
  loading?: boolean;
}

function formatFechaCorta(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "—";
  }
}

export function ResumenTiles({ resumen, loading = false }: Props) {
  const tiles: Tile[] = [
    {
      href: "/mi-panel/equipo",
      title: "EQUIPO",
      icon: Network,
      iconColor: "text-cyan-600",
      iconBg: "bg-cyan-50",
      metric: "Organigrama",
      hint: "Ver compañeros y estructura",
    },
    {
      href: "/mi-panel/calendario",
      title: "CALENDARIO",
      icon: CalendarDays,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      metric: `${resumen.solicitudes.aprobadas}`,
      hint: resumen.solicitudes.aprobadas === 1 ? "ausencia aprobada" : "ausencias aprobadas",
    },
    {
      href: "/mi-panel/horario",
      title: "HORARIO",
      icon: Timer,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      metric: "Semanal",
      hint: "Tu turno asignado",
    },
    {
      href: "/mi-panel/fichajes",
      title: "FICHAJES",
      icon: Fingerprint,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      metric: `${resumen.fichajes.mesHoras.toFixed(1)} h`,
      hint: `${resumen.fichajes.mesCount} fichajes este mes`,
      badge:
        resumen.fichajes.incidencias > 0
          ? {
              text: `${resumen.fichajes.incidencias} incidencia${resumen.fichajes.incidencias > 1 ? "s" : ""}`,
              color: "bg-red-100 text-red-700 border-red-200",
            }
          : undefined,
    },
    {
      href: "/mi-panel/condiciones",
      title: "CONDICIONES",
      icon: ClipboardCheck,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      metric: "Contrato",
      hint: "Revisar tus condiciones laborales",
    },
    {
      href: "/mi-panel/cuestionarios",
      title: "CUESTIONARIOS",
      icon: ClipboardList,
      iconColor: "text-fuchsia-600",
      iconBg: "bg-fuchsia-50",
      metric: `${resumen.cuestionarios.pendientes}`,
      hint:
        resumen.cuestionarios.pendientes === 1
          ? "pendiente de responder"
          : "pendientes de responder",
    },
    {
      href: "/mi-panel/ausencias",
      title: "SOLICITUDES",
      icon: Inbox,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      metric: `${resumen.solicitudes.pendientes}`,
      hint:
        resumen.solicitudes.pendientes === 1
          ? "pendiente"
          : "pendientes",
      badge:
        resumen.solicitudes.pendientes > 0
          ? {
              text: "Revisar",
              color: "bg-amber-100 text-amber-800 border-amber-200",
            }
          : undefined,
    },
    {
      href: "/mi-panel/comunicados",
      title: "COMUNICADOS",
      icon: Megaphone,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
      metric: `${resumen.comunicados.total}`,
      hint:
        resumen.comunicados.ultimoTitulo
          ? `Último: ${resumen.comunicados.ultimoTitulo}`
          : "Sin comunicados",
    },
    {
      href: "/mi-panel/documentos",
      title: "DOCUMENTOS",
      icon: Files,
      iconColor: "text-slate-700",
      iconBg: "bg-slate-100",
      metric: "4 carpetas",
      hint: "Nóminas, contratos, justificantes",
    },
    {
      href: "/mi-panel/formacion",
      title: "FORMACIÓN",
      icon: GraduationCap,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-50",
      metric: "Mis cursos",
      hint: "Acceder al portal de formación",
    },
    {
      href: "/ajustes",
      title: "AJUSTES",
      icon: Settings,
      iconColor: "text-muted-foreground",
      iconBg: "bg-muted/50",
      metric: "Cuenta",
      hint: "Editar tu perfil y preferencias",
    },
  ];

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mi panel</h2>
          <p className="text-xs text-muted-foreground">
            Resumen de toda tu actividad
          </p>
        </div>
        {resumen.comunicados.ultimaFecha && (
          <span className="text-[11px] text-muted-foreground">
            Último comunicado · {formatFechaCorta(resumen.comunicados.ultimaFecha)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group relative flex flex-col gap-3 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${t.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${t.iconColor}`} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.title}
                </p>
                <p className="text-lg font-bold text-slate-800 mt-0.5 tabular-nums">
                  {loading ? "…" : t.metric}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {t.hint}
                </p>
              </div>
              {t.badge && (
                <Badge
                  variant="outline"
                  className={`absolute top-3 right-9 text-[10px] ${t.badge.color}`}
                >
                  {t.badge.text === "Revisar" ? null : (
                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                  )}
                  {t.badge.text}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
