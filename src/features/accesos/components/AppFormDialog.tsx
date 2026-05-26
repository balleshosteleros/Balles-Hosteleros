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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORIAS_APP,
  appExternaSchema,
  type AppExterna,
  type AppExternaInput,
} from "../data/tipos";
import { createApp, updateApp, deleteApp } from "../actions/apps-actions";

export function AppFormDialog({
  open,
  onOpenChange,
  app,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  app: AppExterna | null;
  onSaved: () => void;
}) {
  const editing = !!app;
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [categoria, setCategoria] = useState<AppExternaInput["categoria"]>("Otros");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre(app?.nombre ?? "");
      setUrl(app?.url ?? "");
      setLogoUrl(app?.logo_url ?? "");
      setCategoria((app?.categoria ?? "Otros") as AppExternaInput["categoria"]);
      setNotas(app?.notas ?? "");
    }
  }, [open, app]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: AppExternaInput = {
      nombre,
      url: url.trim(),
      logo_url: logoUrl.trim(),
      categoria,
      notas,
    };
    const parsed = appExternaSchema.safeParse(input);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSaving(true);
    const res = editing
      ? await updateApp(app!.id, parsed.data)
      : await createApp(parsed.data);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "App actualizada" : "App creada");
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!app) return;
    if (
      !confirm(
        `¿Eliminar "${app.nombre}" y TODAS sus credenciales? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    const res = await deleteApp(app.id);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("App eliminada");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar app" : "Nueva app"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Modifica los datos de la app. Las credenciales se gestionan por separado."
              : "Crea una nueva app externa. Después podrás añadir credenciales."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="app-nombre">Nombre *</Label>
            <Input
              id="app-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Glovo, Banco Sabadell..."
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="app-url">URL</Label>
            <Input
              id="app-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label htmlFor="app-logo">Logo (URL)</Label>
            <Input
              id="app-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="Vacío = favicon automático"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Si lo dejas vacío, usamos el favicon de la URL.
            </p>
          </div>
          <div>
            <Label htmlFor="app-cat">Categoría *</Label>
            <Select
              value={categoria}
              onValueChange={(v) => setCategoria(v as AppExternaInput["categoria"])}
            >
              <SelectTrigger id="app-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_APP.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="app-notas">Notas</Label>
            <Textarea
              id="app-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {editing && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="mr-auto"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Eliminar
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || deleting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || deleting}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
