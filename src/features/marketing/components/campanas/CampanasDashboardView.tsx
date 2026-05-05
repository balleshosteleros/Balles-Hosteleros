"use client";

import Link from "next/link";
import { Mail, MessageCircle, Megaphone, Send, BarChart3, Target } from "lucide-react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useCampanas } from "@/features/marketing/hooks/useCampanas";
import type { EstadoCampana } from "@/features/marketing/data/campanas";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

function StatCard({
  value,
  label,
  color = "default",
}: {
  value: number;
  label: string;
  color?: "default" | "emerald" | "amber" | "red" | "blue" | "orange" | "gray";
}) {
  const valueClass: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
    orange: "text-orange-600 dark:text-orange-400",
    gray: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className={`text-2xl font-black ${valueClass[color]}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</div>
    </div>
  );
}

function ModuleCard({
  icon: Icon,
  title,
  href,
  children,
}: {
  icon: React.ElementType;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold tracking-wide">{title}</span>
        <Link
          href={href}
          className="ml-auto text-xs text-primary hover:underline font-medium"
        >
          Ver todo →
        </Link>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function statsPorEstado<T extends { estado: EstadoCampana }>(list: T[]) {
  return {
    total: list.length,
    borrador: list.filter((x) => x.estado === "borrador").length,
    programada: list.filter((x) => x.estado === "programada").length,
    activa: list.filter((x) => x.estado === "activa").length,
    pausada: list.filter((x) => x.estado === "pausada").length,
    finalizada: list.filter((x) => x.estado === "finalizada").length,
    fallida: list.filter((x) => x.estado === "fallida").length,
  };
}

export function CampanasDashboardView() {
  const { empresaActual } = useEmpresa();
  const { emails, whatsapps, metas, loaded } = useCampanas(empresaActual.id);

  const emailStats = statsPorEstado(emails);
  const waStats = statsPorEstado(whatsapps);
  const metaStats = statsPorEstado(metas);

  const gastoMeta = metas.reduce((a, m) => a + (m.estadisticas?.gasto ?? 0), 0);
  const conversionesMeta = metas.reduce((a, m) => a + (m.estadisticas?.conversiones ?? 0), 0);
  const enviadosEmail = emails.reduce((a, e) => a + (e.estadisticas?.enviados ?? 0), 0);
  const enviadosWa = whatsapps.reduce((a, w) => a + (w.estadisticas?.enviados ?? 0), 0);

  const activas =
    emailStats.activa + emailStats.programada +
    waStats.activa + waStats.programada +
    metaStats.activa + metaStats.programada;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Send className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Campañas</h1>
          <p className="text-sm text-muted-foreground">
            Crea y gestiona campañas de Email, WhatsApp y Meta (Facebook + Instagram) desde un único lugar
          </p>
        </div>
      </div>

      {/* Summary row — estilo logística */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/marketing/campanas/email" className="rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campañas activas</span>
          </div>
          <div className="text-3xl font-black text-foreground">{activas}</div>
        </Link>
        <Link href="/marketing/campanas/email" className="rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensajes enviados</span>
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
            {(enviadosEmail + enviadosWa).toLocaleString("es-ES")}
          </div>
        </Link>
        <Link href="/marketing/campanas/meta" className="rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gasto Meta</span>
          </div>
          <div className="text-3xl font-black text-foreground">
            {gastoMeta.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
          </div>
        </Link>
        <Link href="/marketing/campanas/meta" className="rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversiones</span>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {conversionesMeta.toLocaleString("es-ES")}
          </div>
        </Link>
      </div>

      {/* Detailed module cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ModuleCard icon={Mail} title="EMAIL" href="/marketing/campanas/email">
          <div className="grid grid-cols-3 gap-2">
            <StatCard value={emailStats.total} label="TOTAL" color="default" />
            <StatCard value={emailStats.borrador} label="BORRADOR" color="gray" />
            <StatCard value={emailStats.programada} label="PROGRAMADA" color="blue" />
            <StatCard value={emailStats.activa} label="ACTIVA" color="emerald" />
            <StatCard value={emailStats.finalizada} label="FINALIZADA" color="default" />
            <StatCard value={emailStats.fallida} label="FALLIDA" color="red" />
          </div>
        </ModuleCard>

        <ModuleCard icon={MessageCircle} title="WHATSAPP" href="/marketing/campanas/whatsapp">
          <div className="grid grid-cols-3 gap-2">
            <StatCard value={waStats.total} label="TOTAL" color="default" />
            <StatCard value={waStats.borrador} label="BORRADOR" color="gray" />
            <StatCard value={waStats.programada} label="PROGRAMADA" color="blue" />
            <StatCard value={waStats.activa} label="ACTIVA" color="emerald" />
            <StatCard value={waStats.finalizada} label="FINALIZADA" color="default" />
            <StatCard value={waStats.fallida} label="FALLIDA" color="red" />
          </div>
        </ModuleCard>

        <ModuleCard icon={Megaphone} title="META (FB + IG)" href="/marketing/campanas/meta">
          <div className="grid grid-cols-3 gap-2">
            <StatCard value={metaStats.total} label="TOTAL" color="default" />
            <StatCard value={metaStats.borrador} label="BORRADOR" color="gray" />
            <StatCard value={metaStats.activa} label="ACTIVA" color="emerald" />
            <StatCard value={metaStats.pausada} label="PAUSADA" color="amber" />
            <StatCard value={metaStats.finalizada} label="FINALIZADA" color="default" />
            <StatCard value={metaStats.fallida} label="FALLIDA" color="red" />
          </div>
        </ModuleCard>
      </div>

      {/* Quick links — estilo logística */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { href: "/marketing/campanas/email", icon: Mail, label: "Email" },
          { href: "/marketing/campanas/whatsapp", icon: MessageCircle, label: "WhatsApp" },
          { href: "/marketing/campanas/meta", icon: Megaphone, label: "Meta" },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors text-center"
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {!loaded && <LoadingSpinner size="sm" />}
    </div>
  );
}
