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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { toast } from "sonner";
import { cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import {
  listAccesosApps,
  revelarAccesoApp,
} from "@/features/rrhh/actions/accesos-apps-actions";
import {
  VerificacionAccesosProvider,
  useVerificacionAccesos,
} from "@/features/rrhh/components/useVerificacionAccesos";
import type { AccesoApp } from "@/features/rrhh/data/accesos-apps";
import { faviconDesdeUrl } from "@/features/rrhh/data/accesos-apps";
import { useAuth } from "@/features/auth/contexts/auth-context";

// ── Logo de la app (favicon/simpleicons con fallback a inicial) ───────────
// `size` permite agrandarlo en el panel de aplicaciones (lanzador visual).
function AppLogo({
  nombre,
  logoUrl,
  url,
  size = "sm",
}: {
  nombre: string;
  logoUrl?: string | null;
  url?: string | null;
  size?: "sm" | "lg";
}) {
  const [err, setErr] = useState(false);
  // Si no hay logo guardado, derivar uno automático (marca conocida o favicon).
  const efectivo = logoUrl || faviconDesdeUrl(url ?? "", nombre) || "";
  const box = size === "lg" ? "h-11 w-11" : "h-7 w-7";
  const radius = size === "lg" ? "rounded-xl" : "rounded-md";
  if (efectivo && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={efectivo}
        alt={nombre}
        onError={() => setErr(true)}
        className={`${box} ${radius} object-contain p-1 shrink-0 ${
          efectivo.includes("simpleicons.org")
            ? "bg-transparent"
            : "bg-white dark:bg-white/90 border border-border/40"
        }`}
      />
    );
  }
  return (
    <div
      className={`${box} ${radius} bg-muted flex items-center justify-center font-bold shrink-0 ${
        size === "lg" ? "text-base" : "text-xs"
      }`}
    >
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

/**
 * Carga, UNA vez al montar, cuántas apps visibles tiene el usuario en su empresa
 * (ya filtradas por departamento del rol en el servidor). Sirve para decidir si el
 * botón del cohete/candado se muestra activo o gris+deshabilitado.
 * `tieneDatos = null` mientras carga (el botón se deja activo para no parpadear).
 */
function useTieneAccesos(empresaSlug: string) {
  const [tieneDatos, setTieneDatos] = useState<boolean | null>(null);
  useEffect(() => {
    if (!empresaSlug) return;
    let alive = true;
    listAccesosApps(empresaSlug)
      .then((rows) => {
        if (alive) setTieneDatos(rows.some((a) => a.estado === "Activo"));
      })
      .catch(() => {
        if (alive) setTieneDatos(true); // ante error, no bloquear el botón
      });
    return () => {
      alive = false;
    };
  }, [empresaSlug]);
  return tieneDatos;
}

/**
 * Trigger gris + deshabilitado + tooltip cuando el usuario no tiene NINGÚN
 * acceso asignado. Reutiliza el mismo botón (`children`) pero lo apaga y le pone
 * un tooltip explicativo; al pulsarlo NO abre nada. Si hay datos, devuelve el
 * botón tal cual (envuelto en SheetTrigger por el llamador).
 */
function TriggerDeshabilitado({
  children,
  mensaje,
}: {
  children: ReactNode;
  mensaje: string;
}) {
  // Apaga el botón: gris, sin hover, cursor no-permitido y sin acción.
  const apagado = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        disabled: true,
        title: undefined,
        className: `${(children as ReactElement<{ className?: string }>).props.className ?? ""} opacity-40 grayscale pointer-events-none`,
        onClick: undefined,
      })
    : children;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        {/* span: el botón está deshabilitado y no dispararía el tooltip por sí solo */}
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-not-allowed" tabIndex={0}>
            {apagado}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{mensaje}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const tieneDatos = useTieneAccesos(empresaSlug);
  const { appsFiltradas, loading, busqueda, setBusqueda, q } = useAccesosApps(empresaSlug, open);

  // Sin ningún acceso asignado → botón gris, deshabilitado, con tooltip. No abre.
  if (tieneDatos === false) {
    return (
      <TriggerDeshabilitado mensaje="No tienes aplicaciones asignadas">
        {children}
      </TriggerDeshabilitado>
    );
  }

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
            q ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Search className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium">Sin coincidencias</p>
                <p className="max-w-[260px] text-xs text-muted-foreground">
                  No encontramos ninguna aplicación para «{q}».
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:ring-amber-900/40">
                  <Rocket className="h-7 w-7 text-amber-500" />
                </div>
                <p className="text-sm font-semibold">No tienes aplicaciones asignadas</p>
                <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                  Tu departamento todavía no tiene ninguna aplicación asignada. Si crees que es un error,
                  contacta con dirección.
                </p>
              </div>
            )
          )}
          {!loading && appsFiltradas.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {appsFiltradas.map((app) => {
                const usuario = app.accesos[0]?.usuario || app.usuario || "";
                const abrir = () => {
                  if (app.url && app.url.trim()) {
                    const href = app.url.startsWith("http") ? app.url : `https://${app.url}`;
                    window.open(href, "_blank", "noopener,noreferrer");
                  } else {
                    toast.info(`«${app.nombre}» no tiene un enlace web configurado.`);
                  }
                };
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={abrir}
                    className="flex items-center gap-3 rounded-lg border border-border/50 p-3 text-left hover:bg-muted/50 hover:border-border transition-colors"
                    title={app.url ? "Abrir aplicación" : "Sin enlace web"}
                  >
                    <AppLogo nombre={app.nombre} logoUrl={app.logoUrl} url={app.url} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{app.nombre}</div>
                      <div className="text-xs text-muted-foreground truncate font-mono">
                        {usuario || <span className="not-italic font-sans">{app.categoria}</span>}
                      </div>
                    </div>
                    {app.url && (
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
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
  const { profile, hasRole } = useAuth();
  const miRol = (profile?.rol_label ?? "").trim().toLowerCase();
  const soyDirector = hasRole("director") || hasRole("admin");

  // ¿Tengo alguna credencial visible para mi rol? Carga al montar para decidir si
  // el candado va activo o gris+deshabilitado. null = cargando (botón activo).
  const [tieneCredenciales, setTieneCredenciales] = useState<boolean | null>(null);
  useEffect(() => {
    if (!empresaSlug) return;
    let alive = true;
    listAccesosApps(empresaSlug)
      .then((rows) => {
        if (!alive) return;
        const hay = rows.some((app) =>
          app.estado === "Activo" &&
          app.accesos.some((acc) => {
            const tieneSecreto =
              acc.tieneContrasena || (acc.datosExtra ?? []).some((d) => d.tiene);
            if (!tieneSecreto) return false;
            if (soyDirector) return true;
            const r = (acc.roles ?? []).map((x) => x.trim().toLowerCase());
            return r.length > 0 && r.includes(miRol);
          }),
        );
        setTieneCredenciales(hay);
      })
      .catch(() => {
        if (alive) setTieneCredenciales(true);
      });
    return () => {
      alive = false;
    };
  }, [empresaSlug, miRol, soyDirector]);

  const { appsFiltradas, loading, busqueda, setBusqueda, q } = useAccesosApps(empresaSlug, open);

  // Solo apps con algún secreto que revelar Y que mi rol pueda ver. Conservamos el
  // ÍNDICE ORIGINAL de cada acceso (revelarAccesoApp lo usa posicionalmente).
  // PRIVACIDAD: un acceso solo aparece si soy director/admin, o si su lista `roles`
  // incluye mi rol. Sin rol marcado = solo dirección. Así nadie ve siquiera la fila
  // (••••) de una contraseña de otro departamento. El servidor vuelve a comprobarlo
  // al revelar (defensa en profundidad).
  const puedoVerAcceso = (roles?: string[]) => {
    if (soyDirector) return true;
    const r = (roles ?? []).map((x) => x.trim().toLowerCase());
    return r.length > 0 && r.includes(miRol);
  };
  const conSecretos = useMemo(
    () =>
      appsFiltradas
        .map((app) => ({
          app,
          accesos: app.accesos
            .map((acc, indiceOriginal) => ({ acc, indiceOriginal }))
            .filter(
              ({ acc }) =>
                (acc.tieneContrasena || (acc.datosExtra ?? []).some((d) => d.tiene)) &&
                puedoVerAcceso(acc.roles),
            ),
        }))
        .filter((x) => x.accesos.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appsFiltradas, miRol, soyDirector],
  );

  // Sin ninguna credencial visible para mi rol → candado gris, deshabilitado,
  // con tooltip. No abre la bóveda. (Va tras todos los hooks: no rompe su orden.)
  if (tieneCredenciales === false) {
    return (
      <TriggerDeshabilitado mensaje="No tienes accesos asignados">
        {children}
      </TriggerDeshabilitado>
    );
  }

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
              q ? (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Search className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium">Sin coincidencias</p>
                  <p className="max-w-[260px] text-xs text-muted-foreground">
                    No encontramos ninguna credencial para «{q}».
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100 dark:bg-red-950/30 dark:ring-red-900/40">
                    <Lock className="h-7 w-7 text-red-500" />
                  </div>
                  <p className="text-sm font-semibold">No tienes accesos asignados</p>
                  <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                    Tu departamento todavía no tiene ninguna contraseña ni credencial asignada.
                  </p>
                </div>
              )
            )}
            {!loading &&
              conSecretos.map(({ app, accesos }) => (
                <div
                  key={app.id}
                  className="mb-3 rounded-lg border border-border/50 overflow-hidden"
                >
                  <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 border-b border-border/40">
                    <AppLogo nombre={app.nombre} logoUrl={app.logoUrl} url={app.url} />
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
