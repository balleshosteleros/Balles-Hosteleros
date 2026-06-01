"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { reintentarNotifsFallidas, type SaludRwgData } from "@/features/canales-google-rwg/actions/salud-actions";
import { toast } from "sonner";

interface Props {
  data: SaludRwgData;
}

function semaforo(p95Ms: number | null, errores5xx: number) {
  if (errores5xx > 0) return { color: "bg-red-500", label: "Crítico" };
  if (p95Ms == null) return { color: "bg-zinc-400", label: "Sin datos" };
  if (p95Ms > 2000) return { color: "bg-red-500", label: "Crítico" };
  if (p95Ms > 1000) return { color: "bg-amber-500", label: "Atención" };
  return { color: "bg-emerald-500", label: "OK" };
}

function formatBytes(b: number | null): string {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function SaludRwgView({ data }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onReintentar = () => {
    startTransition(async () => {
      const r = await reintentarNotifsFallidas();
      if (r.ok) {
        toast.success("Notificaciones fallidas reencoladas");
        router.refresh();
      } else {
        toast.error(r.error ?? "Error al reintentar");
      }
    });
  };

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-5xl">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ajustes / Canales / Google
          </span>
          <h1 className="text-base font-semibold">Salud del canal Reserve with Google</h1>
        </div>
        <Button size="sm" variant="outline" asChild className="text-xs h-8 gap-1.5">
          <Link href="/ajustes/canales/google">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
        </Button>
      </header>

      {/* PANEL 1 — Booking Server */}
      <section className="rounded-md border bg-card">
        <div className="px-4 py-2.5 border-b">
          <h2 className="text-sm font-medium">Booking Server (últimas 24h)</h2>
        </div>
        <div className="divide-y">
          {data.endpoints.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted-foreground italic text-center">
              No hay llamadas registradas todavía.
            </p>
          ) : (
            data.endpoints.map((e) => {
              const sem = semaforo(e.p95Ms, e.errores5xx24h);
              const tasa = e.llamadas24h > 0
                ? `${Math.round((e.ok24h / e.llamadas24h) * 100)}%`
                : "—";
              return (
                <div key={e.endpoint} className="px-4 py-2 flex items-center gap-3 text-xs">
                  <span className={`inline-block w-2 h-2 rounded-full ${sem.color}`} title={sem.label} />
                  <span className="font-mono w-[200px] truncate">{e.endpoint}</span>
                  <span className="text-muted-foreground w-[100px]">
                    {e.llamadas24h} llamadas
                  </span>
                  <span className="w-[80px]">{tasa} OK</span>
                  <span className="w-[120px]">
                    P95: <span className="font-mono">{e.p95Ms == null ? "—" : `${e.p95Ms} ms`}</span>
                  </span>
                  <span className={e.errores5xx24h > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                    {e.errores5xx24h} errores 5xx
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* PANEL 2 — Feeds */}
      <section className="rounded-md border bg-card">
        <div className="px-4 py-2.5 border-b">
          <h2 className="text-sm font-medium">Feeds subidos al Actions Center</h2>
        </div>
        <div className="divide-y">
          {data.feeds.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted-foreground italic text-center">
              Sin runs todavía.
            </p>
          ) : (
            data.feeds.map((f, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3 text-xs">
                {f.estado === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                {f.estado === "fallido" && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                {f.estado === "corriendo" && <RefreshCw className="h-4 w-4 text-blue-500 shrink-0 animate-spin" />}
                <span className="font-mono w-[160px] truncate">{f.feedType}</span>
                <span className="text-muted-foreground w-[140px]">{formatFecha(f.iniciadoEn)}</span>
                <span className="w-[90px]">{formatBytes(f.bytes)}</span>
                <span className="w-[80px]">
                  {f.slotsCount != null && f.slotsCount > 0 ? `${f.slotsCount} slots` : ""}
                </span>
                {f.errorMsg && (
                  <span className="text-red-600 truncate flex items-center gap-1" title={f.errorMsg}>
                    <AlertTriangle className="h-3 w-3" />
                    {f.errorMsg.slice(0, 60)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* PANEL 3 — Notificaciones salientes */}
      <section className="rounded-md border bg-card">
        <div className="px-4 py-2.5 border-b flex items-center justify-between">
          <h2 className="text-sm font-medium">Notificaciones salientes a Google</h2>
          {data.notif.fallidas > 0 && (
            <Button size="sm" variant="outline" onClick={onReintentar} disabled={pending} className="text-xs h-7 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              {pending ? "Reintentando…" : `Reintentar ${data.notif.fallidas} fallidas`}
            </Button>
          )}
        </div>
        <div className="px-4 py-3 grid grid-cols-3 gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Pendientes</p>
            <p className="text-base font-semibold">{data.notif.pendientes}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Fallidas</p>
            <p className={"text-base font-semibold " + (data.notif.fallidas > 0 ? "text-red-600" : "")}>
              {data.notif.fallidas}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Enviadas (24h)</p>
            <p className="text-base font-semibold text-emerald-600">{data.notif.enviadas24h}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
