"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  credencialSchema,
  credencialUpdateSchema,
  type Credencial,
  type CredencialInput,
  type RolOption,
} from "../data/tipos";
import {
  createCredencial,
  updateCredencial,
} from "../actions/credenciales-actions";

export function CredencialFormDialog({
  open,
  onOpenChange,
  appId,
  credencial,
  roles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appId: string;
  credencial: Credencial | null;
  roles: RolOption[];
  onSaved: () => void;
}) {
  const editing = !!credencial;
  const [etiqueta, setEtiqueta] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [urlEspecifica, setUrlEspecifica] = useState("");
  const [notas, setNotas] = useState("");
  const [rolesIds, setRolesIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEtiqueta(credencial?.etiqueta ?? "");
      setUsuario(credencial?.usuario ?? "");
      setPassword("");
      setUrlEspecifica(credencial?.url_especifica ?? "");
      setNotas(credencial?.notas ?? "");
      setRolesIds(credencial?.roles.map((r) => r.id) ?? []);
    }
  }, [open, credencial]);

  function toggleRol(id: string) {
    setRolesIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editing) {
      const input = {
        app_id: appId,
        etiqueta,
        usuario,
        password: password || undefined,
        url_especifica: urlEspecifica.trim(),
        notas,
        roles_ids: rolesIds,
      };
      const parsed = credencialUpdateSchema.safeParse(input);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
        return;
      }
      setSaving(true);
      const res = await updateCredencial(credencial!.id, parsed.data);
      setSaving(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Credencial actualizada");
      onOpenChange(false);
      onSaved();
    } else {
      const input: CredencialInput = {
        app_id: appId,
        etiqueta,
        usuario,
        password,
        url_especifica: urlEspecifica.trim(),
        notas,
        roles_ids: rolesIds,
      };
      const parsed = credencialSchema.safeParse(input);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
        return;
      }
      setSaving(true);
      const res = await createCredencial(parsed.data);
      setSaving(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Credencial creada");
      onOpenChange(false);
      onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar credencial" : "Nueva credencial"}
          </DialogTitle>
          <DialogDescription>
            La contraseña se cifra antes de guardarse. Solo los roles
            seleccionados podrán ver esta credencial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="cred-etiqueta">Etiqueta *</Label>
            <Input
              id="cred-etiqueta"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="Ej: Admin, Cocina, Glovo Habana..."
              required
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Distingue esta credencial de otras de la misma app.
            </p>
          </div>
          <div>
            <Label htmlFor="cred-usuario">Usuario *</Label>
            <Input
              id="cred-usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="cred-pwd">
              Contraseña {editing ? "(dejar vacío para no cambiar)" : "*"}
            </Label>
            <Input
              id="cred-pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!editing}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="cred-url">URL específica</Label>
            <Input
              id="cred-url"
              type="url"
              value={urlEspecifica}
              onChange={(e) => setUrlEspecifica(e.target.value)}
              placeholder="Si la app tiene varios subdominios..."
            />
          </div>
          <div>
            <Label htmlFor="cred-notas">Notas</Label>
            <Textarea
              id="cred-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Roles que pueden ver esta credencial *
            </Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Obligatorio: selecciona al menos un rol.
            </p>
            <div className="border rounded-md max-h-44 overflow-y-auto p-1">
              {roles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No hay roles definidos en esta empresa
                </p>
              ) : (
                roles.map((r) => {
                  const checked = rolesIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRol(r.id)}
                        className="accent-primary"
                      />
                      <span>{r.nombre}</span>
                    </label>
                  );
                })
              )}
            </div>
            {rolesIds.length === 0 && (
              <p className="text-[11px] text-destructive mt-1">
                Debes seleccionar al menos un rol.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || rolesIds.length === 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? "Guardar" : "Crear credencial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
