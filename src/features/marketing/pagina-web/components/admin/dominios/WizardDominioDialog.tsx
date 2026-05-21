"use client";

/**
 * Wizard guiado en 4 pasos para asociar un dominio propio a una página.
 * Sustituye a AnadirDominioDialog (que pedía hostname + un párrafo técnico).
 *
 * Flujo:
 *   1. ¿Cuál es tu dirección web?   (input + ejemplos)
 *   2. Copia estos dos datos         (DNS hint + cómo pegarlos en SiteGround)
 *   3. Comprueba                     (polling + botón manual)
 *   4. Listo                         (link a la web ya online)
 *
 * Sin jerga: nada de "CNAME"/"A record" en el copy principal; aparece sólo
 * en la línea técnica pequeña por si el registrador lo pide así.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { anadirDominio, verificarDominio } from "../../../actions/dominios-actions";
import type { DnsHint } from "../../../types";

type Paso = "DIRECCION" | "DNS" | "VERIFICAR" | "LISTO";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paginaId: string;
  onCompletado: () => void;
}

interface DominioState {
  id: string;
  hostname: string;
  dns: DnsHint;
}

export function WizardDominioDialog({ open, onOpenChange, paginaId, onCompletado }: Props) {
  const [paso, setPaso] = useState<Paso>("DIRECCION");
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [dominio, setDominio] = useState<DominioState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    setPaso("DIRECCION");
    setHostname("");
    setError(null);
    setEnviando(false);
    setVerificando(false);
    setDominio(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cuando se cierra el diálogo, resetear estado para la próxima apertura.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Polling de verificación en el paso VERIFICAR.
  useEffect(() => {
    if (paso !== "VERIFICAR" || !dominio) return;
    pollRef.current = setInterval(async () => {
      const res = await verificarDominio(dominio.id);
      if (res.ok && res.data.estado === "VERIFICADO") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setPaso("LISTO");
        onCompletado();
      }
    }, 15_000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [paso, dominio, onCompletado]);

  const onCrearDominio = async () => {
    setError(null);
    const limpio = hostname.trim().toLowerCase();
    if (!limpio) {
      setError("Escribe tu dirección web (ej. bacanalmadrid.com)");
      return;
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(limpio)) {
      setError("La dirección no parece válida. Ej: bacanalmadrid.com");
      return;
    }

    setEnviando(true);
    const res = await anadirDominio({ paginaId, hostname: limpio });
    setEnviando(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDominio({ id: res.data.id, hostname: limpio, dns: res.data.dns as DnsHint });
    setPaso("DNS");
    onCompletado();
  };

  const onVerificarAhora = async () => {
    if (!dominio) return;
    setVerificando(true);
    const res = await verificarDominio(dominio.id);
    setVerificando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data.estado === "VERIFICADO") {
      setPaso("LISTO");
      onCompletado();
    } else {
      toast.message(
        "Todavía no nos llega la señal del dominio. Espera unos minutos y vuelve a comprobar.",
      );
    }
  };

  const copiar = async (valor: string, etiqueta: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      toast.success(`${etiqueta} copiado`);
    } catch {
      toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.");
    }
  };

  const cerrar = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Globe className="h-5 w-5" />
            Conectar tu dirección web
          </DialogTitle>
        </DialogHeader>

        <PasosIndicador paso={paso} />

        <div className="py-2">
          {paso === "DIRECCION" && (
            <PasoDireccion
              hostname={hostname}
              onHostnameChange={(v) => {
                setHostname(v);
                setError(null);
              }}
              error={error}
              enviando={enviando}
              onSiguiente={onCrearDominio}
              onCancelar={cerrar}
            />
          )}

          {paso === "DNS" && dominio && (
            <PasoDns
              hostname={dominio.hostname}
              dns={dominio.dns}
              onCopiar={copiar}
              onSiguiente={() => setPaso("VERIFICAR")}
              onAtras={() => setPaso("DIRECCION")}
            />
          )}

          {paso === "VERIFICAR" && dominio && (
            <PasoVerificar
              hostname={dominio.hostname}
              verificando={verificando}
              onVerificarAhora={onVerificarAhora}
              onAtras={() => setPaso("DNS")}
            />
          )}

          {paso === "LISTO" && dominio && (
            <PasoListo hostname={dominio.hostname} onCerrar={cerrar} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Indicador de pasos ─────────────────────────────────────────── */

function PasosIndicador({ paso }: { paso: Paso }) {
  const orden: Paso[] = ["DIRECCION", "DNS", "VERIFICAR", "LISTO"];
  const idx = orden.indexOf(paso);
  const labels: Record<Paso, string> = {
    DIRECCION: "Tu dirección",
    DNS: "Configurar",
    VERIFICAR: "Comprobar",
    LISTO: "¡Listo!",
  };
  return (
    <div className="flex items-center gap-2 px-1 pb-2">
      {orden.map((p, i) => {
        const activo = i === idx;
        const hecho = i < idx;
        return (
          <div key={p} className="flex items-center gap-2 flex-1">
            <div
              className={[
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors",
                hecho
                  ? "bg-emerald-500 text-white"
                  : activo
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {hecho ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={[
                "text-xs whitespace-nowrap",
                activo ? "font-medium" : "text-muted-foreground",
              ].join(" ")}
            >
              {labels[p]}
            </span>
            {i < orden.length - 1 && (
              <div
                className={[
                  "flex-1 h-px",
                  i < idx ? "bg-emerald-500" : "bg-muted",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Paso 1: Dirección ──────────────────────────────────────────── */

function PasoDireccion({
  hostname,
  onHostnameChange,
  error,
  enviando,
  onSiguiente,
  onCancelar,
}: {
  hostname: string;
  onHostnameChange: (v: string) => void;
  error: string | null;
  enviando: boolean;
  onSiguiente: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">¿Cuál es la dirección de tu web?</h3>
        <p className="text-sm text-muted-foreground">
          Escribe el dominio que ya tienes contratado. Si todavía no lo tienes, primero
          cómpralo en tu registrador (SiteGround, GoDaddy, etc.) y luego vuelve aquí.
        </p>
      </div>

      <div className="space-y-2">
        <Input
          autoFocus
          value={hostname}
          onChange={(e) => onHostnameChange(e.target.value)}
          placeholder="bacanalmadrid.com"
          className="h-12 text-base"
          disabled={enviando}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !enviando) onSiguiente();
          }}
        />
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground"
            onClick={() => onHostnameChange("bacanalmadrid.com")}
          >
            Ejemplo: bacanalmadrid.com
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground"
            onClick={() => onHostnameChange("www.bacanalmadrid.com")}
          >
            Ejemplo: www.bacanalmadrid.com
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 pt-1">{error}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="primary" size="lg" onClick={onSiguiente} disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparando…
            </>
          ) : (
            <>
              Continuar <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─── Paso 2: Pegar DNS en SiteGround ────────────────────────────── */

function PasoDns({
  hostname,
  dns,
  onCopiar,
  onSiguiente,
  onAtras,
}: {
  hostname: string;
  dns: DnsHint;
  onCopiar: (v: string, etiqueta: string) => void;
  onSiguiente: () => void;
  onAtras: () => void;
}) {
  const esCName = dns.tipo === "CNAME";

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Copia estos dos datos en SiteGround</h3>
        <p className="text-sm text-muted-foreground">
          Para que <strong>{hostname}</strong> apunte a tu nueva web, hay que pegar
          dos valores donde tienes contratado el dominio.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 divide-y">
        <CampoCopiable
          etiqueta={esCName ? "Apunta este subdominio…" : "Apunta el dominio raíz (@)…"}
          valor={dns.name}
          onCopiar={(v) => onCopiar(v, "Nombre")}
        />
        <CampoCopiable
          etiqueta="…a este destino"
          valor={dns.value}
          onCopiar={(v) => onCopiar(v, "Destino")}
        />
        <div className="px-4 py-2 text-[11px] text-muted-foreground">
          Tipo de registro: <strong>{dns.tipo}</strong>{" "}
          {esCName ? "(subdominio)" : "(dominio raíz)"}
        </div>
      </div>

      <details className="rounded-lg border bg-muted/10 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">
          ¿Dónde pego esto en SiteGround? (paso a paso)
        </summary>
        <ol className="list-decimal pl-5 mt-3 space-y-1.5 text-muted-foreground">
          <li>
            Entra en tu cuenta de SiteGround y abre <strong>Site Tools</strong> del
            dominio.
          </li>
          <li>
            Ve a <strong>Domain → DNS Zone Editor</strong>.
          </li>
          <li>
            {esCName ? (
              <>
                Pulsa <strong>“Add Record”</strong> y elige tipo{" "}
                <strong>CNAME</strong>.
              </>
            ) : (
              <>
                Busca si ya existe un registro <strong>A</strong> para{" "}
                <strong>@</strong>. Si existe, edítalo. Si no, pulsa{" "}
                <strong>“Add Record”</strong> y elige tipo <strong>A</strong>.
              </>
            )}
          </li>
          <li>
            En <strong>Nombre / Host</strong> pega:{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted">{dns.name}</code>
          </li>
          <li>
            En <strong>{esCName ? "Destino / Points to" : "IP / Apunta a"}</strong>{" "}
            pega: <code className="px-1.5 py-0.5 rounded bg-muted">{dns.value}</code>
          </li>
          <li>
            <strong>Guarda</strong>. SiteGround tarda entre 5 minutos y media hora en
            propagar el cambio.
          </li>
        </ol>
      </details>

      <div className="flex justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={onAtras}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <Button variant="primary" size="lg" onClick={onSiguiente}>
          Ya lo he pegado, comprobar <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function CampoCopiable({
  etiqueta,
  valor,
  onCopiar,
}: {
  etiqueta: string;
  valor: string;
  onCopiar: (v: string) => void;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {etiqueta}
        </div>
        <div className="font-mono text-sm truncate">{valor}</div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onCopiar(valor)}
        className="shrink-0"
      >
        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
      </Button>
    </div>
  );
}

/* ─── Paso 3: Verificar ──────────────────────────────────────────── */

function PasoVerificar({
  hostname,
  verificando,
  onVerificarAhora,
  onAtras,
}: {
  hostname: string;
  verificando: boolean;
  onVerificarAhora: () => void;
  onAtras: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 py-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground shrink-0" />
        <div>
          <h3 className="text-lg font-semibold">Esperando a que el dominio responda…</h3>
          <p className="text-sm text-muted-foreground">
            Estamos comprobando <strong>{hostname}</strong> cada 15 segundos. Suele
            tardar entre 5 y 30 minutos desde que guardas en SiteGround.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">
          Puedes cerrar esta ventana sin problema.
        </p>
        Cuando esté listo, el dominio aparecerá como <strong>Verificado</strong> en la
        lista. Mientras tanto, también puedes seguir editando la web.
      </div>

      <div className="flex justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={onAtras}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Ver datos del DNS
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onVerificarAhora}
          disabled={verificando}
        >
          {verificando ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Comprobando…
            </>
          ) : (
            <>Comprobar ahora</>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─── Paso 4: Listo ──────────────────────────────────────────────── */

function PasoListo({ hostname, onCerrar }: { hostname: string; onCerrar: () => void }) {
  return (
    <div className="space-y-5 text-center py-4">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-emerald-500 text-white flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9" />
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5" /> ¡Tu web está online!
        </h3>
        <p className="text-sm text-muted-foreground">
          <strong>{hostname}</strong> ya apunta a tu nueva página. El certificado SSL
          se activa automáticamente.
        </p>
      </div>

      <div className="flex justify-center gap-2 pt-2">
        <a href={`https://${hostname}`} target="_blank" rel="noopener noreferrer">
          <Button variant="primary" size="lg">
            <ExternalLink className="h-4 w-4 mr-2" /> Abrir mi web
          </Button>
        </a>
        <Button variant="outline" size="lg" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
