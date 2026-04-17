"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, LayoutTemplate, Loader2, Plus } from "lucide-react";
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
import type { PaginaWebTipo } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function NuevaPaginaModal({ open, onOpenChange, onCreated }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<PaginaWebTipo>("ONE_PAGE");
  const [creando, setCreando] = useState(false);

  const reset = () => {
    setNombre("");
    setTipo("ONE_PAGE");
    setCreando(false);
  };

  const onClose = () => {
    if (!creando) {
      onOpenChange(false);
      setTimeout(reset, 300);
    }
  };

  const onCrear = async () => {
    const trim = nombre.trim();
    if (trim.length < 3) {
      toast.error("Nombre mínimo 3 caracteres");
      return;
    }
    setCreando(true);
    const t = toast.loading("Creando página…");
    try {
      const res = await crearPagina({ nombre: trim, tipo });
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Nueva página web
          </DialogTitle>
          <DialogDescription>
            Elige si será la web principal del restaurante o una one-page para una campaña.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              placeholder="Ej: San Valentín 2026"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={creando}
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Usado como título interno y base para el slug.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de página</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={creando}
                onClick={() => setTipo("WEB_PRINCIPAL")}
                className={`rounded-lg border p-4 text-left transition hover:border-primary/60 disabled:opacity-50 ${
                  tipo === "WEB_PRINCIPAL" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <Globe className="h-5 w-5 mb-2" />
                <div className="font-medium text-sm">Web principal</div>
                <div className="text-xs text-muted-foreground">
                  Sitio corporativo del restaurante (inicio, carta, reservas, contacto).
                </div>
              </button>

              <button
                type="button"
                disabled={creando}
                onClick={() => setTipo("ONE_PAGE")}
                className={`rounded-lg border p-4 text-left transition hover:border-primary/60 disabled:opacity-50 ${
                  tipo === "ONE_PAGE" ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <LayoutTemplate className="h-5 w-5 mb-2" />
                <div className="font-medium text-sm">One-page (campaña)</div>
                <div className="text-xs text-muted-foreground">
                  Una sola página para campaña (San Valentín, bodas, eventos…).
                </div>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={creando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onCrear}
            disabled={creando || nombre.trim().length < 3}
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
