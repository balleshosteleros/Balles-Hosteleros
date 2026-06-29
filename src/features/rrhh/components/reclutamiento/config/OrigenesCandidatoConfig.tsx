"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import {
  listOrigenesCandidato,
  createOrigenCandidato,
  toggleOrigenCandidato,
  deleteOrigenCandidato,
  type OrigenCandidatoConfig,
} from "@/features/rrhh/actions/reclutamiento-origenes-actions";

export function OrigenesCandidatoConfig() {
  const [origenes, setOrigenes] = useState<OrigenCandidatoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState("");
  const [creando, setCreando] = useState(false);
  const { confirm, dialog } = useConfirmDelete();

  useEffect(() => {
    let cancel = false;
    void listOrigenesCandidato().then((data) => {
      if (!cancel) {
        setOrigenes(data);
        setLoading(false);
      }
    });
    return () => { cancel = true; };
  }, []);

  const crear = async () => {
    const nombre = nuevo.trim();
    if (!nombre) return;
    setCreando(true);
    const res = await createOrigenCandidato(nombre);
    setCreando(false);
    if (!res.ok) { toast.error(res.error); return; }
    setOrigenes((prev) => [...prev, res.origen]);
    setNuevo("");
    toast.success("Origen añadido");
  };

  const alternar = async (o: OrigenCandidatoConfig) => {
    const activo = !o.activo;
    setOrigenes((prev) => prev.map((x) => (x.id === o.id ? { ...x, activo } : x)));
    const res = await toggleOrigenCandidato(o.id, activo);
    if (!res.ok) {
      toast.error(res.error);
      setOrigenes((prev) => prev.map((x) => (x.id === o.id ? { ...x, activo: !activo } : x)));
    }
  };

  const borrar = async (o: OrigenCandidatoConfig) => {
    const ok = await confirm({
      title: "Borrar origen",
      description: `Se eliminará "${o.nombre}" de la lista. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    const res = await deleteOrigenCandidato(o.id);
    if (!res.ok) { toast.error(res.error); return; }
    setOrigenes((prev) => prev.filter((x) => x.id !== o.id));
    toast.success("Origen borrado");
  };

  return (
    <Card>
      {dialog}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">¿Por dónde nos has conocido?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Opciones que el candidato elige al postular (obligatorio). El nombre no
            se puede modificar: para cambiarlo, borra y crea uno nuevo.
          </p>
        </div>
      </div>
      <CardContent className="p-0">
        {loading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            {origenes.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Aún no hay orígenes. Añade el primero abajo.
              </p>
            )}
            {origenes.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <span className={`text-sm ${o.activo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  {o.nombre}
                </span>

                <div className="flex items-center gap-1.5">
                  <Switch checked={o.activo} onCheckedChange={() => alternar(o)} />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 hover:text-destructive"
                    onClick={() => borrar(o)}
                    title="Borrar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Añadir nuevo */}
            <div className="flex items-center gap-2 px-5 py-3 bg-muted/20">
              <Input
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") crear(); }}
                placeholder="Nuevo origen (ej. TikTok, feria de empleo…)"
                className="h-8 text-sm max-w-xs"
              />
              <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={crear} disabled={!nuevo.trim() || creando}>
                <Plus className="h-3.5 w-3.5" /> Añadir
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
