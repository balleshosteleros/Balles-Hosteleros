"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, LayoutTemplate, Loader2, Plus, Wand2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearPagina } from "../../actions/paginas-actions";
import {
  crearWebPrototipo,
  estadoModulosPrototipo,
  type ModuloEstado,
} from "../../actions/prototipo-actions";
import type { PaginaWebTipo } from "../../types";
import type { ModuloWeb } from "../../services/prototipo-web";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/** "prototipo" = se monta sola con los datos del software. */
type Modo = "prototipo" | PaginaWebTipo;

export function NuevaPaginaModal({ open, onOpenChange, onCreated }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [modo, setModo] = useState<Modo>("prototipo");
  const [creando, setCreando] = useState(false);

  const [modulos, setModulos] = useState<ModuloEstado[] | null>(null);
  const [seleccion, setSeleccion] = useState<Set<ModuloWeb>>(new Set());

  // Al abrir en modo prototipo, preguntamos al software qué módulos puede
  // rellenar con datos reales.
  useEffect(() => {
    if (!open || modo !== "prototipo" || modulos) return;
    let cancel = false;
    (async () => {
      const r = await estadoModulosPrototipo();
      if (cancel || !r.ok) return;
      setModulos(r.data);
      setSeleccion(
        new Set(r.data.filter((m) => m.pordefecto && m.disponible).map((m) => m.clave)),
      );
    })();
    return () => {
      cancel = true;
    };
  }, [open, modo, modulos]);

  const reset = () => {
    setNombre("");
    setModo("prototipo");
    setCreando(false);
    setModulos(null);
    setSeleccion(new Set());
  };

  const onClose = () => {
    if (!creando) {
      onOpenChange(false);
      setTimeout(reset, 300);
    }
  };

  const alternar = (clave: ModuloWeb) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  };

  const onCrear = async () => {
    const trim = nombre.trim();
    if (modo !== "prototipo" && trim.length < 3) {
      toast.error("Nombre mínimo 3 caracteres");
      return;
    }
    setCreando(true);
    const t = toast.loading("Creando web…");
    try {
      if (modo === "prototipo") {
        if (seleccion.size === 0) {
          toast.error("Activa al menos un módulo", { id: t });
          setCreando(false);
          return;
        }
        const res = await crearWebPrototipo(
          [...seleccion],
          trim || "Web principal",
        );
        if (!res.ok) throw new Error(res.error);
        toast.success("Web creada con tus datos", { id: t });
        onOpenChange(false);
        setTimeout(reset, 300);
        onCreated?.();
        router.push(`/marketing/pagina-web/${res.data.paginaId}`);
        return;
      }

      const res = await crearPagina({ nombre: trim, tipo: modo });
      if (!res.ok) throw new Error(res.error);
      toast.success("Página creada", { id: t });
      onOpenChange(false);
      setTimeout(reset, 300);
      onCreated?.();
      router.push(`/marketing/pagina-web/${res.data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(msg, { id: t });
      setCreando(false);
    }
  };

  const puedeCrear =
    modo === "prototipo" ? seleccion.size > 0 : nombre.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Nueva página web
          </DialogTitle>
          <DialogDescription>
            La web prototipo se monta sola con los datos que ya tienes en el
            software. Tú solo eliges qué módulos quieres.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tipo de página</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                disabled={creando}
                onClick={() => setModo("prototipo")}
                className={`rounded-lg border p-4 text-left transition hover:border-primary/60 disabled:opacity-50 ${
                  modo === "prototipo" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <Wand2 className="h-5 w-5 mb-2" />
                <div className="font-medium text-sm">Web prototipo</div>
                <div className="text-xs text-muted-foreground">
                  Lista en un clic, con tus datos reales.
                </div>
              </button>

              <button
                type="button"
                disabled={creando}
                onClick={() => setModo("WEB_PRINCIPAL")}
                className={`rounded-lg border p-4 text-left transition hover:border-primary/60 disabled:opacity-50 ${
                  modo === "WEB_PRINCIPAL" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <Globe className="h-5 w-5 mb-2" />
                <div className="font-medium text-sm">Web en blanco</div>
                <div className="text-xs text-muted-foreground">
                  Empezar de cero y montar los bloques a mano.
                </div>
              </button>

              <button
                type="button"
                disabled={creando}
                onClick={() => setModo("ONE_PAGE")}
                className={`rounded-lg border p-4 text-left transition hover:border-primary/60 disabled:opacity-50 ${
                  modo === "ONE_PAGE" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <LayoutTemplate className="h-5 w-5 mb-2" />
                <div className="font-medium text-sm">One-page (campaña)</div>
                <div className="text-xs text-muted-foreground">
                  Para San Valentín, bodas, eventos…
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">
              Nombre {modo === "prototipo" ? "(opcional)" : "*"}
            </Label>
            <Input
              id="nombre"
              placeholder={modo === "prototipo" ? "Web principal" : "Ej: San Valentín 2026"}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={creando}
              maxLength={120}
            />
          </div>

          {modo === "prototipo" && (
            <div className="space-y-2">
              <Label>Módulos de la web</Label>
              {!modulos ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comprobando qué datos tienes…
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {modulos.map((m) => {
                    const activo = seleccion.has(m.clave);
                    return (
                      <button
                        key={m.clave}
                        type="button"
                        disabled={creando || !m.disponible}
                        onClick={() => alternar(m.clave)}
                        title={m.motivo ?? undefined}
                        className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
                          activo ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            activo ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                          }`}
                        >
                          {activo ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{m.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {m.disponible ? m.descripcion : m.motivo}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={creando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onCrear}
            disabled={creando || !puedeCrear}
          >
            {creando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" /> Crear y abrir editor
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
