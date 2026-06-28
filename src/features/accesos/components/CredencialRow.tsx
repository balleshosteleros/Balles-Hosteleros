"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Pencil, Trash2, Loader2, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { revelarCredencial } from "../actions/revelar-action";
import { deleteCredencial } from "../actions/credenciales-actions";
import { useVerificacionAccesos } from "./useVerificacionAccesos";
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
  // Valores revelados por campo: "password" o el nombre de un dato extra.
  const [revelado, setRevelado] = useState<Record<string, string>>({});
  const [loadingCampo, setLoadingCampo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const { ensureVerificado } = useVerificacionAccesos();

  async function revelarCampo(campo: string): Promise<string | null> {
    // Gate: cualquier visualización exige verificación vigente.
    const ok = await ensureVerificado();
    if (!ok) return null;
    setLoadingCampo(campo);
    const res = await revelarCredencial(credencial.id, campo);
    setLoadingCampo(null);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    return res.valor;
  }

  async function handleToggle(campo: string) {
    if (revelado[campo] !== undefined) {
      setRevelado((prev) => {
        const next = { ...prev };
        delete next[campo];
        return next;
      });
      return;
    }
    const valor = await revelarCampo(campo);
    if (valor === null) return;
    setRevelado((prev) => ({ ...prev, [campo]: valor }));
    setTimeout(() => {
      setRevelado((prev) => {
        const next = { ...prev };
        delete next[campo];
        return next;
      });
    }, 10000);
  }

  async function handleCopy(campo: string) {
    const valor = await revelarCampo(campo);
    if (valor === null) return;
    try {
      await navigator.clipboard.writeText(valor);
      toast.success("Copiado");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  }

  async function handleDelete() {
    const ok = await confirmDelete({
      title: "Eliminar credencial",
      description: `¿Eliminar la credencial "${credencial.etiqueta}"?`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
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

  function SecretField({ label, campo }: { label: string; campo: string }) {
    const loading = loadingCampo === campo;
    const value = revelado[campo];
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-mono flex-1 break-all">{value ?? "••••••••••"}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => handleToggle(campo)}
          disabled={loading}
          title={value !== undefined ? "Ocultar" : "Revelar"}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : value !== undefined ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => handleCopy(campo)}
          disabled={loading}
          title="Copiar"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      {confirmDeleteDialog}
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
            {credencial.rol_responsable && (
              <span className="text-[10px] text-muted-foreground">
                · usa: {credencial.rol_responsable}
              </span>
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
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit} title="Editar">
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
        {credencial.usuario && (
          <div>
            <span className="text-muted-foreground">Usuario:</span>{" "}
            <span className="font-mono break-all">{credencial.usuario}</span>
          </div>
        )}
        <SecretField label="Contraseña" campo="password" />
        {credencial.datos_extra.map((d) => (
          <SecretField key={d.nombre} label={d.nombre} campo={d.nombre} />
        ))}
        {credencial.notas && (
          <p className="text-muted-foreground text-[11px] italic pt-0.5">{credencial.notas}</p>
        )}
      </div>
    </div>
  );
}
