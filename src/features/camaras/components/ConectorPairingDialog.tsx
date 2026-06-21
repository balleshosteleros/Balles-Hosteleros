"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Copy,
  Check,
  Router,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import {
  listConectores,
  createConector,
  regenerarPairing,
  deleteConector,
  getConector,
} from "@/features/camaras/actions/conectores-actions";
import {
  ESTADO_LABEL,
  type ConectorEstado,
  type ConectorPublic,
} from "@/features/camaras/types/conector";

const ESTADO_BADGE: Record<ConectorEstado, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  emparejado: "bg-blue-100 text-blue-700",
  online: "bg-emerald-100 text-emerald-700",
  offline: "bg-zinc-200 text-zinc-600",
  error: "bg-red-100 text-red-700",
};

function apiBase(): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Payload que lee el firmware del Conector Balles al escanear el QR. */
function qrPayload(code: string): string {
  return JSON.stringify({ v: 1, code, api: apiBase() });
}

export function ConectorPairingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { confirm, dialog: confirmDialog } = useConfirmDelete();

  const [conectores, setConectores] = useState<ConectorPublic[]>([]);
  const [cargando, setCargando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  // id del conector cuyo QR estamos mostrando (vista detalle); null = lista
  const [verId, setVerId] = useState<string | null>(null);

  const verConector = conectores.find((c) => c.id === verId) ?? null;

  const recargar = useCallback(async () => {
    setCargando(true);
    const res = await listConectores();
    if (res.ok) setConectores(res.data);
    else if (res.error) toast.error(res.error);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (open) recargar();
  }, [open, recargar]);

  // Polling del estado mientras vemos un QR pendiente de emparejar.
  const verRef = useRef<ConectorPublic | null>(null);
  verRef.current = verConector;
  useEffect(() => {
    if (!open || !verId) return;
    const estado = verRef.current?.estado;
    if (estado && estado !== "pendiente") return; // ya emparejado: no hace falta poll
    const t = setInterval(async () => {
      const res = await getConector(verId);
      if (res.ok) {
        setConectores((prev) =>
          prev.map((c) => (c.id === verId ? res.data : c)),
        );
        if (res.data.estado !== "pendiente") {
          toast.success("Conector emparejado");
          clearInterval(t);
        }
      }
    }, 4000);
    return () => clearInterval(t);
  }, [open, verId]);

  async function crear() {
    const n = nombre.trim();
    if (!n) {
      toast.error("Ponle un nombre al conector");
      return;
    }
    setCreando(true);
    const res = await createConector({ nombre: n });
    setCreando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConectores((prev) => [res.data, ...prev]);
    setNombre("");
    setVerId(res.data.id); // salta directo al QR
  }

  async function regenerar(id: string) {
    const res = await regenerarPairing(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConectores((prev) => prev.map((c) => (c.id === id ? res.data : c)));
    toast.success("Código regenerado");
  }

  async function eliminar(c: ConectorPublic) {
    const ok = await confirm({
      title: `¿Eliminar “${c.nombre}”?`,
      description:
        "Se desvincula el conector. Las cámaras que dependían de él dejarán de emitir hasta reasignarlas.",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const res = await deleteConector(c.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConectores((prev) => prev.filter((x) => x.id !== c.id));
    if (verId === c.id) setVerId(null);
    toast.success("Conector eliminado");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Router className="h-4 w-4 text-slate-700" />
            {verConector ? "Emparejar conector" : "Conectores de cámaras"}
          </DialogTitle>
        </DialogHeader>

        {verConector ? (
          <PairingView
            conector={verConector}
            onVolver={() => setVerId(null)}
            onRegenerar={() => regenerar(verConector.id)}
          />
        ) : (
          <ListView
            conectores={conectores}
            cargando={cargando}
            nombre={nombre}
            setNombre={setNombre}
            creando={creando}
            onCrear={crear}
            onVer={setVerId}
            onEliminar={eliminar}
          />
        )}
      </DialogContent>
      {confirmDialog}
    </Dialog>
  );
}

function EstadoBadge({ estado }: { estado: ConectorEstado }) {
  const Icon = estado === "online" ? Wifi : estado === "offline" ? WifiOff : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${ESTADO_BADGE[estado]}`}
    >
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {ESTADO_LABEL[estado]}
    </span>
  );
}

function ListView({
  conectores,
  cargando,
  nombre,
  setNombre,
  creando,
  onCrear,
  onVer,
  onEliminar,
}: {
  conectores: ConectorPublic[];
  cargando: boolean;
  nombre: string;
  setNombre: (v: string) => void;
  creando: boolean;
  onCrear: () => void;
  onVer: (id: string) => void;
  onEliminar: (c: ConectorPublic) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        El conector es la cajita que se enchufa al router del local. Detecta las
        cámaras solo y envía el vídeo al portal, sin abrir puertos ni IP pública.
      </p>

      {/* Alta */}
      <div className="flex gap-2">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del conector (ej: Habana sala)"
          onKeyDown={(e) => e.key === "Enter" && !creando && onCrear()}
        />
        <Button
          className="shrink-0 gap-1 bg-teal-600 hover:bg-teal-700"
          onClick={onCrear}
          disabled={creando}
        >
          <Plus className="h-4 w-4" />
          {creando ? "…" : "Nuevo"}
        </Button>
      </div>

      {/* Lista */}
      {cargando ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground">
          Cargando…
        </p>
      ) : conectores.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted-foreground leading-relaxed">
          Aún no hay conectores. Crea el primero para enlazar la cajita del
          local con el portal.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {conectores.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{c.nombre}</p>
                <div className="mt-0.5">
                  <EstadoBadge estado={c.estado} />
                </div>
              </div>
              {c.estado === "pendiente" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onVer(c.id)}
                >
                  Ver código
                </Button>
              )}
              <button
                type="button"
                onClick={() => onEliminar(c)}
                className="p-1 text-muted-foreground hover:text-destructive"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PairingView({
  conector,
  onVolver,
  onRegenerar,
}: {
  conector: ConectorPublic;
  onVolver: () => void;
  onRegenerar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const emparejado = conector.estado !== "pendiente";
  const code = conector.pairing_code ?? "";

  async function copiar() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="truncate text-sm font-medium">{conector.nombre}</p>
        <EstadoBadge estado={conector.estado} />
      </div>

      {emparejado ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-6 w-6" />
          </span>
          <p className="text-sm font-semibold text-emerald-800">
            Conector emparejado
          </p>
          <p className="text-[11px] text-emerald-700 leading-relaxed">
            La cajita ya está enlazada con el portal. En cuanto detecte las
            cámaras del local, aparecerán en el visor.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg border bg-white p-3">
              <QRCodeSVG value={qrPayload(code)} size={168} level="M" />
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-3 py-1 font-mono text-base tracking-widest">
                {code}
              </code>
              <button
                type="button"
                onClick={copiar}
                className="p-1.5 text-muted-foreground hover:text-foreground"
                title="Copiar código"
              >
                {copiado ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <ol className="space-y-1 rounded-md bg-muted/40 px-4 py-3 text-[11px] text-muted-foreground leading-relaxed">
            <li>1. Enchufa la cajita al router y a la corriente.</li>
            <li>2. Escanea este QR (o teclea el código) en la cajita.</li>
            <li>3. Quedará emparejada sola; esta ventana se actualiza al instante.</li>
          </ol>

          <p className="text-center text-[10px] text-muted-foreground">
            El código caduca en unos minutos y solo sirve una vez.
          </p>
        </>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <Button variant="outline" size="sm" className="gap-1" onClick={onVolver}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        {!emparejado && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={onRegenerar}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerar código
          </Button>
        )}
      </div>
    </div>
  );
}
