"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Pencil, Trash2, Loader2, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { revelarCredencial } from "../actions/revelar-action";
import { deleteCredencial } from "../actions/credenciales-actions";
import type { Credencial } from "../data/tipos";

export function CredencialRow({
  credencial,
  canManage,
  onEdit,
  onDeleted,
}: {
  credencial: Credencial;
  canManage: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [revelado, setRevelado] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRevelar() {
    if (revelado) {
      setRevelado(null);
      return;
    }
    setLoading(true);
    const res = await revelarCredencial(credencial.id);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRevelado(res.password);
    setTimeout(() => setRevelado(null), 10000);
  }

  async function handleCopy() {
    setLoading(true);
    const res = await revelarCredencial(credencial.id);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    try {
      await navigator.clipboard.writeText(res.password);
      toast.success("Contraseña copiada");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar la credencial "${credencial.etiqueta}"?`)) return;
    setDeleting(true);
    const res = await deleteCredencial(credencial.id);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Credencial eliminada");
    onDeleted();
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{credencial.etiqueta}</span>
            {credencial.url_especifica && (
              <a
                href={credencial.url_especifica}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
                title="Abrir URL específica"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <ShieldCheck className="h-3 w-3 text-muted-foreground" />
            {credencial.roles.length === 0 ? (
              <span className="text-[10px] text-muted-foreground italic">Sin roles</span>
            ) : (
              credencial.roles.map((r) => (
                <Badge key={r.id} variant="secondary" className="text-[10px] font-normal py-0">
                  {r.nombre}
                </Badge>
              ))
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onEdit}
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
              title="Eliminar"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5 text-xs">
        <div>
          <span className="text-muted-foreground">Usuario:</span>{" "}
          <span className="font-mono">{credencial.usuario}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Contraseña:</span>
          <span className="font-mono flex-1">
            {revelado ?? "••••••••••"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleRevelar}
            disabled={loading}
            title={revelado ? "Ocultar" : "Revelar"}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : revelado ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCopy}
            disabled={loading}
            title="Copiar"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        {credencial.notas && (
          <p className="text-muted-foreground text-[11px] italic pt-0.5">
            {credencial.notas}
          </p>
        )}
      </div>
    </div>
  );
}
