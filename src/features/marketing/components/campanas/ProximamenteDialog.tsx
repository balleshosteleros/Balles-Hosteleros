"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canal: "meta" | "google";
}

const TEXTOS: Record<Props["canal"], { titulo: string; descripcion: string }> = {
  meta: {
    titulo: "Meta Ads (Facebook + Instagram) — Próximamente",
    descripcion:
      "Las campañas de Meta requieren conectar la cuenta publicitaria, presupuesto diario y configuración avanzada de público. Estamos preparándolo.",
  },
  google: {
    titulo: "Google Ads — Próximamente",
    descripcion:
      "Las campañas en Google (Search + Performance Max) requieren conectar Google Ads y verificar el sitio. Estamos preparándolo.",
  },
};

export function ProximamenteDialog({ open, onOpenChange, canal }: Props) {
  const t = TEXTOS[canal];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {t.titulo}
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm text-muted-foreground">
            {t.descripcion}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
