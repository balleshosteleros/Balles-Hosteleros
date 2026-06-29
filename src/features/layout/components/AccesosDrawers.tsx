"use client";

// ─────────────────────────────────────────────────────────────────────────
// DOS herramientas de la barra superior, ambas en panel grande (Sheet 50vw):
//
//  • AplicacionesDrawer (cohete) — SIN secretos. Lista las apps con su logo,
//    el usuario (no sensible) y el botón para abrir la web. Pensado para uso
//    diario sin fricción de seguridad.
//
//  • AccesosDrawer (candado Lock) — BÓVEDA SEGURA. Revela contraseñas, PINs y
//    datos sensibles SOLO tras verificación de identidad y según el rol del
//    usuario (la action revelarAccesoApp aplica el control). El cliente nunca
//    recibe secretos hasta pulsar "ver".
// ─────────────────────────────────────────────────────────────────────────

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, Eye, Copy, Loader2, Lock, Rocket } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { toast } from "sonner";
import {
  listAccesosApps,
  revelarAccesoApp,
} from "@/features/rrhh/actions/accesos-apps-actions";
import {
  VerificacionAccesosProvider,
  useVerificacionAccesos,
} from "@/features/rrhh/components/useVerificacionAccesos";
import type { AccesoApp } from "@/features/rrhh/data/accesos-apps";

// ── Logo de la app (favicon/simpleicons con fallback a inicial) ───────────
function AppLogo({ nombre, logoUrl }: { nombre: string; logoUrl?: string | null }) {
  const [err, setErr] = useState(false);
  if (logoUrl && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={nombre}
        onError={() => setErr(true)}
        className={`h-7 w-7 rounded-md object-contain p-0.5 shrink-0 ${
          logoUrl.includes("simpleicons.org")
            ? "bg-transparent"
            : "bg-white dark:bg-white/90 border border-border/40"
        }`}
      />
    );
  }
  return (
    <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-xs font-bold shrink-0">
      {nombre[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ── Celda de revelado seguro (idéntica lógica a la previa) ────────────────
function PasswordCell({
  appId,
  indice,
  tiene,
  nombreExtra,
}: {
  appId: string;
  indice: number;
  tiene: boolean;
  nombreExtra?: string;
}) {
  const { ensureVerificado } = useVerificacionAccesos();
  const [valor, setValor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Oculta el valor revelado tras 15s.
  useEffect(() => {
    if (valor === null) return;
    const t = setTimeout(() => setValor(null), 15_000);
    return () => clearTimeout(t);
  }, [valor]);

  if (!tiene) return <span className="text-muted-foreground text-xs">—</span>;

  const revelar = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const ok = await ensureVerificado();
      if (!ok) return;
      const res = await revelarAccesoApp(appId, indice, nombreExtra);
      if (res.ok) setValor(res.contrasena);
      else toast.error(res.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex min-w-0 max-w-full items-start gap-1 font-mono text-xs">
      <span className="min-w-0 break-all">{valor !== null ? valor : "••••••••"}</span>
      {valor !== null ? (
        <button
          onClick={() => {
            navigator.clipboard.writeText(valor);
            toast.success(nombreExtra ? `${nombreExtra} copiado` : "Contraseña copiada");
          }}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          title="Copiar"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={revelar}
          disabled={loading}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Ver"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}

// ── Carga compartida de apps activas de la empresa ────────────────────────
function useAccesosApps(empresaSlug: string, open: boolean) {
  const [apps, setApps] = useState<AccesoApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!open || !empresaSlug) return;
    let alive = true;
    setLoading(true);
    setBusqueda("");
    listAccesosApps(empresaSlug)
      .then((rows) => {
        if (alive) setApps(rows.filter((a) => a.estado === "Activo"));
      })
      .catch((e) => console.error("[accesos] drawer:", e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, empresaSlug]);

  const q = busqueda.trim().toLowerCase();
  const appsFiltradas = useMemo(() => {
    if (!q) return apps;
    return apps.filter((app) => {
      if (app.nombre.toLowerCase().includes(q)) return true;
      return app.accesos.some(
        (acc) =>
          (acc.usuario ?? "").toLowerCase().includes(q) ||
          (acc.etiqueta ?? "").toLowerCase().includes(q),
      );
    });
  }, [apps, q]);

  return { apps, appsFiltradas, loading, busqueda, setBusqueda, q };
}

function Buscador({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-8"
        autoFocus
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 1) APLICACIONES — solo enlaces + usuario (sin secretos)
// ════════════════════════════════════════════════════════════════════════
export function AplicacionesDrawer({
  empresaSlug,
  children,
}: {
  empresaSlug: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { appsFiltradas, loading, busqueda, setBusqueda, q } = useAccesosApps(empresaSlug, open);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b py-3 pl-5 pr-14 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4 text-amber-600" />
            Aplicaciones
          </SheetTitle>
        </SheetHeader>
        <div className="px-5 py-3 shrink-0 border-b">
          <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar aplicación o usuario…" />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading && (
            <div className="py-10 flex justify-center">
              <LoadingSpinner />
            </div>
          )}
          {!loading && appsFiltradas.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {q ? "Sin coincidencias." : "No hay aplicaciones."}
            </div>
          )}
          {!loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {appsFiltradas.map((app) => {
                const usuario = app.accesos[0]?.usuario || app.usuario || "";
                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors"
                  >
                    <AppLogo nombre={app.nombre} logoUrl={app.logoUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{app.nombre}</div>
                      <div className="text-xs text-muted-foreground truncate font-mono">
                        {usuario || <span className="not-italic font-sans">{app.categoria}</span>}
                      </div>
                    </div>
                    {app.url && (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background"
                        title="Abrir aplicación"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 2) ACCESOS Y CONTRASEÑAS — bóveda segura (Lock)
// ════════════════════════════════════════════════════════════════════════
export function AccesosDrawer({
  empresaSlug,
  children,
}: {
  empresaSlug: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { appsFiltradas, loading, busqueda, setBusqueda, q } = useAccesosApps(empresaSlug, open);

  // Solo apps con algún secreto que revelar. Conservamos el ÍNDICE ORIGINAL de
  // cada acceso (revelarAccesoApp lo usa posicionalmente) antes de filtrar.
  const conSecretos = useMemo(
    () =>
      appsFiltradas
        .map((app) => ({
          app,
          accesos: app.accesos
            .map((acc, indiceOriginal) => ({ acc, indiceOriginal }))
            .filter(
              ({ acc }) =>
                acc.tieneContrasena || (acc.datosExtra ?? []).some((d) => d.tiene),
            ),
        }))
        .filter((x) => x.accesos.length > 0),
    [appsFiltradas],
  );

  return (
    // Provider FUERA del Sheet: el diálogo de verificación sobrevive al cierre.
    <VerificacionAccesosProvider>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent side="right" className="flex flex-col gap-0 p-0">
          <SheetHeader className="border-b py-3 pl-5 pr-14 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-red-500" />
              Accesos y contraseñas
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              Bóveda segura. Cada revelado exige verificar tu identidad y respeta tu rol.
            </p>
          </SheetHeader>
          <div className="px-5 py-3 shrink-0 border-b">
            <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar app, usuario o etiqueta…" />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {loading && (
              <div className="py-10 flex justify-center">
                <LoadingSpinner />
              </div>
            )}
            {!loading && conSecretos.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {q ? "Sin coincidencias." : "No tienes credenciales visibles."}
              </div>
            )}
            {!loading &&
              conSecretos.map(({ app, accesos }) => (
                <div
                  key={app.id}
                  className="mb-3 rounded-lg border border-border/50 overflow-hidden"
                >
                  <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 border-b border-border/40">
                    <AppLogo nombre={app.nombre} logoUrl={app.logoUrl} />
                    <span className="text-sm font-semibold truncate flex-1">{app.nombre}</span>
                    {app.url && (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title="Abrir aplicación"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="divide-y divide-border/40">
                    {accesos.map(({ acc, indiceOriginal }) => {
                      const datosExtra = (acc.datosExtra ?? []).filter((d) => d.tiene);
                      return (
                        <div key={indiceOriginal} className="px-3 py-2.5 space-y-1.5">
                          {acc.etiqueta && (
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {acc.etiqueta}
                            </div>
                          )}
                          {acc.usuario && (
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <span className="shrink-0 text-muted-foreground">Usuario:</span>
                              <span className="min-w-0 break-all text-right font-mono">{acc.usuario}</span>
                            </div>
                          )}
                          {acc.tieneContrasena && (
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <span className="shrink-0 text-muted-foreground">Contraseña:</span>
                              <PasswordCell appId={app.id} indice={indiceOriginal} tiene />
                            </div>
                          )}
                          {datosExtra.map((d) => (
                            <div
                              key={d.nombre}
                              className="flex items-start justify-between gap-3 text-xs"
                            >
                              <span className="shrink-0 max-w-[45%] truncate text-muted-foreground">
                                {d.nombre}:
                              </span>
                              <PasswordCell
                                appId={app.id}
                                indice={indiceOriginal}
                                tiene
                                nombreExtra={d.nombre}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </VerificacionAccesosProvider>
  );
}
