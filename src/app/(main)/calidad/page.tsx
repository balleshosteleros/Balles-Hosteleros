import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  ClipboardCheck,
  MessageSquare,
  Star,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { getCalidadDashboard } from "@/features/calidad/actions/dashboard-actions";
import type { KpiThresholds } from "@/features/calidad/types/dashboard";
import { CalidadKpiConfigDialog } from "@/features/calidad/components/CalidadKpiConfigDialog";

export const dynamic = "force-dynamic";

type Tone = "ok" | "warning" | "bad" | "neutral";

const toneText: Record<Tone, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: "text-foreground",
};

const toneDot: Record<Tone, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  bad: "bg-red-500",
  neutral: "bg-muted-foreground",
};

const toneBadge: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
  bad: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60",
  neutral: "bg-muted text-muted-foreground border-transparent",
};

function toneAsc(value: number | null, okMin: number, warningMin: number): Tone {
  if (value == null) return "neutral";
  if (value >= okMin) return "ok";
  if (value >= warningMin) return "warning";
  return "bad";
}

function toneDesc(value: number | null, okMax: number, warningMax: number): Tone {
  if (value == null) return "neutral";
  if (value <= okMax) return "ok";
  if (value <= warningMax) return "warning";
  return "bad";
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone,
  thresholdLabel,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone: Tone;
  thresholdLabel?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl font-black ${toneText[tone]}`}>{value}</span>
        {unit && (
          <span className="text-sm font-medium text-muted-foreground">{unit}</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${toneDot[tone]}`} />
        <span className="text-[11px] text-muted-foreground">
          {hint ?? thresholdLabel ?? ""}
        </span>
      </div>
    </div>
  );
}

function MiniStat({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-md border bg-background p-2 text-center">
      <div className={`text-lg font-bold ${toneText[tone]}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
    </div>
  );
}

function thresholdAscLabel(thresholds: KpiThresholds, okKey: keyof KpiThresholds, warningKey: keyof KpiThresholds, unit: string): string {
  return `Verde ≥ ${thresholds[okKey]}${unit} · Aviso ≥ ${thresholds[warningKey]}${unit}`;
}

function thresholdDescLabel(thresholds: KpiThresholds, okKey: keyof KpiThresholds, warningKey: keyof KpiThresholds, unit: string): string {
  return `Verde ≤ ${thresholds[okKey]}${unit} · Aviso ≤ ${thresholds[warningKey]}${unit}`;
}

export default async function CalidadDashboardPage() {
  const dashboard = await getCalidadDashboard();
  const t = dashboard.thresholds;

  const auditoriasCountTone = toneAsc(
    dashboard.auditorias.enviadasTrimestre,
    t.auditoriasTrimestreOk,
    t.auditoriasTrimestreWarning,
  );
  const auditoriasNotaTone = toneAsc(
    dashboard.auditorias.notaMediaTrimestre,
    t.auditoriasNotaOk,
    t.auditoriasNotaWarning,
  );
  const inspeccionesCountTone = toneAsc(
    dashboard.inspecciones.enviadasTrimestre,
    t.inspeccionesTrimestreOk,
    t.inspeccionesTrimestreWarning,
  );
  const inspeccionesNotaTone = toneAsc(
    dashboard.inspecciones.notaMediaTrimestre,
    t.inspeccionesNotaOk,
    t.inspeccionesNotaWarning,
  );
  const resenasRatingTone = toneAsc(
    dashboard.resenas.ratingMedio,
    t.resenasRatingOk,
    t.resenasRatingWarning,
  );
  const resenasPendientesTone = toneDesc(
    dashboard.resenas.pctPendientesPct,
    t.resenasPendientesPctOk,
    t.resenasPendientesPctWarning,
  );
  const cuestionariosTone = toneAsc(
    dashboard.cuestionarios.pctRespuestaActivas,
    t.cuestionariosRespuestaPctOk,
    t.cuestionariosRespuestaPctWarning,
  );

  const notaAuditorias = dashboard.auditorias.notaMediaTrimestre;
  const notaInspecciones = dashboard.inspecciones.notaMediaTrimestre;
  const ratingResenas = dashboard.resenas.ratingMedio;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Cuadro de mando</h1>
            <p className="text-sm text-muted-foreground">
              {dashboard.empresaNombre ?? "Sin empresa activa"} · {dashboard.trimestre.label}
            </p>
          </div>
        </div>
        <CalidadKpiConfigDialog initialThresholds={t} />
      </div>

      {/* KPI principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={ClipboardList}
          label="Auditorías trimestre"
          value={String(dashboard.auditorias.enviadasTrimestre)}
          tone={auditoriasCountTone}
          thresholdLabel={thresholdAscLabel(
            t,
            "auditoriasTrimestreOk",
            "auditoriasTrimestreWarning",
            "",
          )}
        />
        <KpiCard
          icon={ClipboardCheck}
          label="Inspecciones trimestre"
          value={String(dashboard.inspecciones.enviadasTrimestre)}
          tone={inspeccionesCountTone}
          thresholdLabel={thresholdAscLabel(
            t,
            "inspeccionesTrimestreOk",
            "inspeccionesTrimestreWarning",
            "",
          )}
        />
        <KpiCard
          icon={Star}
          label="Rating reseñas"
          value={ratingResenas != null ? ratingResenas.toFixed(2) : "—"}
          unit={ratingResenas != null ? "/5" : undefined}
          tone={resenasRatingTone}
          thresholdLabel={thresholdAscLabel(
            t,
            "resenasRatingOk",
            "resenasRatingWarning",
            "/5",
          )}
        />
        <KpiCard
          icon={MessageSquare}
          label="Respuesta cuestionarios"
          value={`${dashboard.cuestionarios.pctRespuestaActivas}`}
          unit="%"
          tone={cuestionariosTone}
          thresholdLabel={thresholdAscLabel(
            t,
            "cuestionariosRespuestaPctOk",
            "cuestionariosRespuestaPctWarning",
            "%",
          )}
        />
      </div>

      {/* Paneles por submódulo */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Auditorías */}
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-wide">AUDITORÍAS</h2>
            </div>
            <Link
              href="/calidad/auditorias"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todo →
            </Link>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <MiniStat
                value={dashboard.auditorias.enviadasTrimestre}
                label="Trimestre"
                tone={auditoriasCountTone}
              />
              <MiniStat
                value={dashboard.auditorias.pendientesBorrador}
                label="Borrador"
                tone={dashboard.auditorias.pendientesBorrador > 0 ? "warning" : "neutral"}
              />
              <MiniStat
                value={notaAuditorias != null ? notaAuditorias.toFixed(1) : "—"}
                label="Nota media"
                tone={auditoriasNotaTone}
              />
              <MiniStat
                value={dashboard.auditorias.plantillasActivas}
                label="Plantillas"
                tone="neutral"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Por local · trimestre
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneBadge[auditoriasNotaTone]}`}
                >
                  Nota objetivo ≥ {t.auditoriasNotaOk}
                </span>
              </div>
              {dashboard.auditorias.porLocal.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground text-center">
                  Sin auditorías en este trimestre
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {dashboard.auditorias.porLocal.map((row) => {
                    const localTone = toneAsc(
                      row.notaMedia,
                      t.auditoriasNotaOk,
                      t.auditoriasNotaWarning,
                    );
                    return (
                      <li
                        key={row.local}
                        className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate font-medium">{row.local}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground">
                            {row.envios} audit.
                          </span>
                          <span className={`font-bold ${toneText[localTone]}`}>
                            {row.notaMedia != null ? row.notaMedia.toFixed(1) : "—"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Inspecciones */}
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-wide">INSPECCIONES</h2>
            </div>
            <Link
              href="/calidad/inspecciones"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todo →
            </Link>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <MiniStat
                value={dashboard.inspecciones.enviadasTrimestre}
                label="Trimestre"
                tone={inspeccionesCountTone}
              />
              <MiniStat
                value={dashboard.inspecciones.pendientesRevision}
                label="Pendientes"
                tone={
                  dashboard.inspecciones.pendientesRevision > 0 ? "warning" : "ok"
                }
              />
              <MiniStat
                value={notaInspecciones != null ? notaInspecciones.toFixed(1) : "—"}
                label="Nota media"
                tone={inspeccionesNotaTone}
              />
              <MiniStat
                value={dashboard.inspecciones.plantillasPublicadas}
                label="Plantillas"
                tone="neutral"
              />
            </div>
            <div className="rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Revisadas en el trimestre</span>
                <span className="font-bold">
                  {dashboard.inspecciones.revisadasTrimestre} /{" "}
                  {dashboard.inspecciones.enviadasTrimestre}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width:
                      dashboard.inspecciones.enviadasTrimestre > 0
                        ? `${Math.min(
                            100,
                            (dashboard.inspecciones.revisadasTrimestre /
                              dashboard.inspecciones.enviadasTrimestre) *
                              100,
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
            {dashboard.inspecciones.pendientesRevision > 0 && (
              <Link
                href="/calidad/inspecciones"
                className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 hover:brightness-95 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>
                  {dashboard.inspecciones.pendientesRevision} envíos pendientes de
                  revisión
                </span>
              </Link>
            )}
          </div>
        </section>

        {/* Reseñas */}
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-wide">RESEÑAS</h2>
            </div>
            <Link
              href="/calidad/resenas"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todo →
            </Link>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <MiniStat
                value={ratingResenas != null ? ratingResenas.toFixed(2) : "—"}
                label="Rating medio"
                tone={resenasRatingTone}
              />
              <MiniStat
                value={dashboard.resenas.totalTrimestre}
                label="Trimestre"
                tone="neutral"
              />
              <MiniStat
                value={dashboard.resenas.excelente}
                label="Excelente"
                tone="ok"
              />
              <MiniStat
                value={dashboard.resenas.malo + dashboard.resenas.regular}
                label="A mejorar"
                tone={
                  dashboard.resenas.malo + dashboard.resenas.regular > 0
                    ? "warning"
                    : "neutral"
                }
              />
            </div>
            <div className="rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Sin responder</span>
                <span className={`font-bold ${toneText[resenasPendientesTone]}`}>
                  {dashboard.resenas.sinResponder} ({dashboard.resenas.pctPendientesPct}%)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {thresholdDescLabel(
                  t,
                  "resenasPendientesPctOk",
                  "resenasPendientesPctWarning",
                  "%",
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Cuestionarios */}
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-wide">CUESTIONARIOS</h2>
            </div>
            <Link
              href="/calidad/cuestionarios"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todo →
            </Link>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <MiniStat
                value={dashboard.cuestionarios.campanasActivas}
                label="Activas"
                tone="neutral"
              />
              <MiniStat
                value={`${dashboard.cuestionarios.pctRespuestaActivas}%`}
                label="Respondidos"
                tone={cuestionariosTone}
              />
              <MiniStat
                value={dashboard.cuestionarios.reunionesPendientesActivas}
                label="Reuniones"
                tone={
                  dashboard.cuestionarios.reunionesPendientesActivas > 0
                    ? "warning"
                    : "ok"
                }
              />
              <MiniStat
                value={dashboard.cuestionarios.puntosAbiertosTotal}
                label="Puntos"
                tone={
                  dashboard.cuestionarios.puntosAbiertosTotal > 0 ? "warning" : "ok"
                }
              />
            </div>
            <div className="rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  Cuestionarios respondidos
                </span>
                <span className="font-bold">
                  {dashboard.cuestionarios.respondidosActivas} /{" "}
                  {dashboard.cuestionarios.enviosTotalesActivas}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{
                    width:
                      dashboard.cuestionarios.enviosTotalesActivas > 0
                        ? `${Math.min(
                            100,
                            dashboard.cuestionarios.pctRespuestaActivas,
                          )}%`
                        : "0%",
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {thresholdAscLabel(
                  t,
                  "cuestionariosRespuestaPctOk",
                  "cuestionariosRespuestaPctWarning",
                  "%",
                )}
              </p>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
