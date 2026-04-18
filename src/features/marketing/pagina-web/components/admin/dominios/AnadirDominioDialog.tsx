"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
import { anadirDominio } from "../../../actions/dominios-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paginaId: string;
  onAdded: () => void;
}

export function AnadirDominioDialog({ open, onOpenChange, paginaId, onAdded }: Props) {
  const [hostname, setHostname] = useState("");
  const [enviando, setEnviando] = useState(false);

  const onConfirmar = async () => {
    if (!hostname.trim()) return;
    setEnviando(true);
    const res = await anadirDominio({ paginaId, hostname: hostname.trim() });
    if (res.ok) {
      toast.success("Dominio añadido. Configura el DNS en tu registrador.");
      onOpenChange(false);
      setHostname("");
      onAdded();
    } else {
      toast.error(res.error);
    }
    setEnviando(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Añadir dominio
          </DialogTitle>
          <DialogDescription>
            Asocia un dominio o subdominio a esta página. Luego configura el DNS en tu
            registrador (SiteGround, Cloudflare, etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="hostname">Hostname</Label>
            <Input
              id="hostname"
              placeholder="bacanalmadrid.com · sanvalentin.bacanalmadrid.com"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              disabled={enviando}
            />
            <p className="text-xs text-muted-foreground">
              Acepta apex (bacanalmadrid.com) o subdominios. Para apex usa un A record a
              <code className="mx-1">76.76.21.21</code>. Para subdominios, CNAME a
              <code className="mx-1">cname.vercel-dns.com</code>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onConfirmar}
            disabled={enviando || !hostname.trim()}
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Añadiendo…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" /> Añadir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
