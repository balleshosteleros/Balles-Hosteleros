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
import { Loader2, ShieldCheck, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  credencialSchema,
  type Credencial,
  type CredencialInput,
  type DatoExtraInput,
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
  const [rolResponsable, setRolResponsable] = useState("");
  const [datosExtra, setDatosExtra] = useState<DatoExtraInput[]>([]);
  const [rolesIds, setRolesIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEtiqueta(credencial?.etiqueta ?? "");
      setUsuario(credencial?.usuario ?? "");
      setPassword("");
      setUrlEspecifica(credencial?.url_especifica ?? "");
      setNotas(credencial?.notas ?? "");
      setRolResponsable(credencial?.rol_responsable ?? "");
      // Al editar, los nombres de datos extra se muestran pero el valor entra vacío:
      // si lo dejas vacío se elimina ese dato; si escribes uno nuevo, se re-cifra.
      setDatosExtra(
        (credencial?.datos_extra ?? []).map((d) => ({ nombre: d.nombre, valor: "" })),
      );
      setRolesIds(credencial?.roles.map((r) => r.id) ?? []);
    }
  }, [open, credencial]);

  function toggleRol(id: string) {
    setRolesIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  function addDatoExtra() {
    setDatosExtra((prev) => [...prev, { nombre: "", valor: "" }]);
  }
  function updateDatoExtra(i: number, key: "nombre" | "valor", v: string) {
    setDatosExtra((prev) => prev.map((d, idx) => (idx === i ? { ...d, [key]: v } : d)));
  }
  function removeDatoExtra(i: number) {
    setDatosExtra((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Solo se mandan datos extra con nombre Y valor (los demás se ignoran/eliminan).
    const datosLimpios = datosExtra.filter((d) => d.nombre.trim() && d.valor.length > 0);

    const input: CredencialInput = {
      app_id: appId,
      etiqueta,
      usuario: usuario.trim(),
      password: password || "",
      url_especifica: urlEspecifica.trim(),
      notas,
      rol_responsable: rolResponsable.trim(),
      datos_extra: datosLimpios,
      roles_ids: rolesIds,
    };

    const parsed = credencialSchema.safeParse(input);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setSaving(true);
    const res = editing
      ? await updateCredencial(credencial!.id, parsed.data)
      : await createCredencial(parsed.data);
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Credencial actualizada" : "Credencial creada");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar credencial" : "Nueva credencial"}
          </DialogTitle>
          <DialogDescription>
            La contraseña y los datos extra se cifran antes de guardarse. Solo
            los roles del campo &quot;rol visible&quot; podrán verla.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="cred-etiqueta">Etiqueta *</Label>
            <Input
              id="cred-etiqueta"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="Ej: Dirección, Contabilidad, Terraza..."
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="cred-usuario">Usuario</Label>
            <Input
              id="cred-usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="email, código o identificador"
            />
          </div>

          <div>
            <Label htmlFor="cred-pwd">
              Contraseña {editing ? "(vacío = no cambiar)" : ""}
            </Label>
            <Input
              id="cred-pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {/* DATO EXTRA — lista flexible (PIN, PUK, código empresa, etc.) */}
          <div>
            <Label className="flex items-center justify-between">
              <span>Datos extra</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={addDatoExtra}
              >
                <Plus className="h-3 w-3 mr-1" /> Añadir
              </Button>
            </Label>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Para PIN, PUK, código de empresa, verificación, códigos de
              respaldo... El valor se cifra.
            </p>
            <div className="space-y-1.5">
              {datosExtra.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={d.nombre}
                    onChange={(e) => updateDatoExtra(i, "nombre", e.target.value)}
                    placeholder="Nombre (PIN, PUK...)"
                    className="flex-1"
                  />
                  <Input
                    type="password"
                    value={d.valor}
                    onChange={(e) => updateDatoExtra(i, "valor", e.target.value)}
                    placeholder={editing ? "valor (vacío = quitar)" : "valor"}
                    autoComplete="new-password"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground shrink-0"
                    onClick={() => removeDatoExtra(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="cred-rol-resp">Rol responsable (informativo)</Label>
            <Input
              id="cred-rol-resp"
              value={rolResponsable}
              onChange={(e) => setRolResponsable(e.target.value)}
              placeholder="Ej: Logística, Contabilidad..."
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Indica el departamento que usa esta cuenta. No controla la
              visibilidad.
            </p>
          </div>

          <div>
            <Label htmlFor="cred-url">URL específica</Label>
            <Input
              id="cred-url"
              type="url"
              value={urlEspecifica}
              onChange={(e) => setUrlEspecifica(e.target.value)}
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
              Rol visible (quién puede verla) *
            </Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Obligatorio: al menos un rol. Puedes marcar varios. Dirección la
              ve siempre.
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
