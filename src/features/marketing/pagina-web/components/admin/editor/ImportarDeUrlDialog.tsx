"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paginaId: string;
  onImported: () => void;
}

export function ImportarDeUrlDialog({ open, onOpenChange, paginaId, onImported }: Props) {
  const [url, setUrl] = useState("https://www.bacanalmadrid.com");
  const [cargando, setCargando] = useState(false);
  useGlobalLoadingSync(cargando);

  const onImportar = async () => {
    if (!url.trim()) return;
    setCargando(true);
    const t = toast.loading("Importando contenido… puede tardar hasta 30s");
    try {
      const res = await fetch("/api/pagina-web/importar-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paginaId, url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Error al importar", { id: t });
      } else {
        toast.success(
          `Importados ${json.bloques} bloques · ${json.stats?.imagenesEncontradas ?? 0} imágenes`,
          { id: t },
        );
        onOpenChange(false);
        onImported();
      }
    } catch (err) {
      toast.error((err as Error).message, { id: t });
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Importar desde URL
          </DialogTitle>
          <DialogDescription>
            Extrae contenido público (textos e imágenes) de una web existente y genera
            bloques iniciales. Siempre en modo <strong>BORRADOR</strong> — revisa antes
            de publicar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="url">URL pública</Label>
            <Input
              id="url"
              placeholder="https://www.bacanalmadrid.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={cargando}
            />
            <p className="text-xs text-muted-foreground">
              La web debe ser accesible sin login. El contenido existente de la página
              actual se <strong>sobrescribirá</strong>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={cargando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onImportar}
            disabled={cargando || !url.trim()}
          >
            {cargando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" /> Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
