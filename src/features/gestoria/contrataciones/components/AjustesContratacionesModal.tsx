"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getContratacionesConfig,
  saveContratacionesConfig,
} from "@/features/gestoria/contrataciones/actions/contrataciones-actions";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AjustesContratacionesModal({ open, onClose }: Props) {
  const [emailGestoria, setEmailGestoria] = useState("");
  const [emailDepartamento, setEmailDepartamento] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getContratacionesConfig()
      .then((r) => {
        if (r.ok) {
          setEmailGestoria(r.config?.email_gestoria ?? "");
          setEmailDepartamento(r.config?.email_departamento ?? "");
        } else {
          toast.error(r.error ?? "Error al cargar configuración");
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    if (!emailGestoria.trim()) {
      toast.error("El email de gestoría es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const r = await saveContratacionesConfig({
        email_gestoria: emailGestoria.trim(),
        email_departamento: emailDepartamento.trim() || null,
      });
      if (r.ok) {
        toast.success("Configuración guardada");
        onClose();
      } else {
        toast.error(r.error ?? "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">AJUSTES — CONTRATACIONES</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>EMAIL DE GESTORÍA *</Label>
            <Input
              type="email"
              value={emailGestoria}
              onChange={(e) => setEmailGestoria(e.target.value)}
              placeholder="gestoria@miempresa.com"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Destinatario por defecto cuando se envía un alta o baja.
            </p>
          </div>
          <div>
            <Label>EMAIL DEPARTAMENTO (POR DEFECTO)</Label>
            <Input
              type="email"
              value={emailDepartamento}
              onChange={(e) => setEmailDepartamento(e.target.value)}
              placeholder="rrhh@miempresa.com"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Opcional. En cada envío puedes añadir un correo extra desde la ficha.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>CANCELAR</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "GUARDANDO…" : "GUARDAR"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
