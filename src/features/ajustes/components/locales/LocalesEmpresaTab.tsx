"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listLocales,
  createLocal,
  updateLocal,
  deleteLocal,
  type LocalInput,
} from "@/features/ajustes/actions/locales-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  MapPin,
  Users,
  Trash2,
  Pencil,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { MapPicker } from "@/features/ajustes/components/locales/MapPicker";
import { AsignacionEmpleadosLocalDialog } from "@/features/ajustes/components/locales/AsignacionEmpleadosLocalDialog";

interface Local {
  id: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  codigo_postal: string | null;
  pais: string;
  lat: number | null;
  lng: number | null;
  radio_metros: number;
  color: string;
  notas: string | null;
  activo: boolean;
  empleados_count: number;
}

const COLOR_DOTS: Record<string, string> = {
  "bg-violet-500": "bg-violet-500",
  "bg-emerald-500": "bg-emerald-500",
  "bg-rose-500": "bg-rose-500",
  "bg-sky-500": "bg-sky-500",
  "bg-amber-500": "bg-amber-500",
  "bg-teal-500": "bg-teal-500",
};

const DRAFT_INICIAL: LocalInput = {
  nombre: "",
  direccion: "",
  ciudad: "",
  codigo_postal: "",
  pais: "España",
  lat: null,
  lng: null,
  radio_metros: 100,
  color: "bg-violet-500",
  notas: "",
  activo: true,
};

interface LocalesEmpresaTabProps {
  empresaId?: string;
}

export function LocalesEmpresaTab({ empresaId }: LocalesEmpresaTabProps = {}) {
  const [locales, setLocales] = useState<Local[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [editando, setEditando] = useState<Local | null>(null);
  const [draft, setDraft] = useState<LocalInput>(DRAFT_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [asignacionLocal, setAsignacionLocal] = useState<Local | null>(null);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const cargar = useCallback(async () => {
    const res = await listLocales(empresaId);
    if (res.ok) setLocales(res.data as Local[]);
  }, [empresaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return locales.filter(
      (c) => !q || c.nombre.toLowerCase().includes(q) || (c.direccion ?? "").toLowerCase().includes(q)
    );
  }, [locales, busqueda]);

  function abrirNuevo() {
    setEditando(null);
    setDraft(DRAFT_INICIAL);
    setDialogAbierto(true);
  }

  function abrirEditar(c: Local) {
    setEditando(c);
    setDraft({
      nombre: c.nombre,
      direccion: c.direccion ?? "",
      ciudad: c.ciudad ?? "",
      codigo_postal: c.codigo_postal ?? "",
      pais: c.pais ?? "España",
      lat: c.lat,
      lng: c.lng,
      radio_metros: c.radio_metros,
      color: c.color,
      notas: c.notas ?? "",
      activo: c.activo,
    });
    setDialogAbierto(true);
  }

  async function guardar() {
    if (!draft.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (draft.lat == null || draft.lng == null) {
      toast.error("Coloca el pin en el mapa para definir la ubicación");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        ...draft,
        nombre: draft.nombre.trim(),
        direccion: draft.direccion?.trim() || null,
        ciudad: draft.ciudad?.trim() || null,
        codigo_postal: draft.codigo_postal?.trim() || null,
        notas: draft.notas?.trim() || null,
      };
      const res = editando
        ? await updateLocal(editando.id, payload)
        : await createLocal(payload, empresaId);
      if (!res.ok) throw new Error(res.error ?? "Error al guardar");
      toast.success(editando ? "Local actualizado" : "Local creado");
      setDialogAbierto(false);
      cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(c: Local) {
    if (c.empleados_count > 0) {
      toast.error(`No puedes eliminar "${c.nombre}" — tiene ${c.empleados_count} empleados asignados.`);
      return;
    }
    const ok = await confirmDelete({
      title: "Eliminar local",
      description: `¿Eliminar el local "${c.nombre}"?`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const res = await deleteLocal(c.id);
    if (res.ok) {
      toast.success("Local eliminado");
      cargar();
    } else {
      toast.error(res.error ?? "Error al eliminar");
    }
  }

  return (
    <Card>
      {confirmDeleteDialog}
      <CardHeader className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Locales
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cada local es un punto físico donde tus empleados fichan. El sistema verifica
              que el empleado esté dentro del radio definido antes de aceptar el fichaje.
            </p>
          </div>
          <Button size="sm" onClick={abrirNuevo}>
            <Plus className="h-4 w-4 mr-1.5" />
            Añadir local
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-3 px-4 py-2.5 bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div>Local</div>
            <div>Dirección</div>
            <div className="text-right">Empleados</div>
            <div className="w-8" />
          </div>
          {filtrados.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <MapPin className="h-7 w-7" strokeWidth={1.5} />
              {locales.length === 0
                ? "Aún no has añadido ningún local."
                : "No hay resultados para tu búsqueda."}
            </div>
          ) : (
            filtrados.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_2fr_auto_auto] gap-3 px-4 py-3 border-t items-center hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", COLOR_DOTS[c.color] ?? "bg-violet-500")} />
                  <button
                    onClick={() => abrirEditar(c)}
                    className="font-medium text-left hover:text-primary truncate"
                  >
                    {c.nombre}
                  </button>
                  {!c.activo && (
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {c.direccion
                    ? [c.direccion, c.codigo_postal, c.ciudad].filter(Boolean).join(", ")
                    : c.lat != null && c.lng != null
                    ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`
                    : "Sin ubicación"}
                </div>
                <button
                  onClick={() => setAsignacionLocal(c)}
                  className="flex items-center gap-1.5 text-sm justify-end hover:text-primary"
                  title="Gestionar empleados"
                >
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium tabular-nums">{c.empleados_count}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => abrirEditar(c)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => eliminar(c)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {asignacionLocal && (
        <AsignacionEmpleadosLocalDialog
          localId={asignacionLocal.id}
          localNombre={asignacionLocal.nombre}
          empresaId={empresaId}
          abierto={!!asignacionLocal}
          onClose={() => setAsignacionLocal(null)}
          onChange={cargar}
        />
      )}

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar local" : "Nuevo local"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input
                  value={draft.nombre}
                  onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                  placeholder="Bacanal Fuenlabrada"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Activo</Label>
                <div className="flex items-center h-9">
                  <Switch
                    checked={draft.activo ?? true}
                    onCheckedChange={(v) => setDraft({ ...draft, activo: v })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_140px] gap-2">
              <div className="space-y-1.5">
                <Label>Dirección</Label>
                <Input
                  value={draft.direccion ?? ""}
                  onChange={(e) => setDraft({ ...draft, direccion: e.target.value })}
                  placeholder="C/ de Leganés, 51"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Código postal</Label>
                <Input
                  value={draft.codigo_postal ?? ""}
                  onChange={(e) => setDraft({ ...draft, codigo_postal: e.target.value })}
                  placeholder="28945"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Ciudad</Label>
                <Input
                  value={draft.ciudad ?? ""}
                  onChange={(e) => setDraft({ ...draft, ciudad: e.target.value })}
                  placeholder="Fuenlabrada"
                />
              </div>
              <div className="space-y-1.5">
                <Label>País</Label>
                <Input
                  value={draft.pais ?? ""}
                  onChange={(e) => setDraft({ ...draft, pais: e.target.value })}
                />
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <Label className="font-semibold">Ubicación en el mapa</Label>
              <MapPicker
                lat={draft.lat ?? null}
                lng={draft.lng ?? null}
                radio={draft.radio_metros}
                direccionInicial={draft.direccion || undefined}
                ciudad={draft.ciudad ?? undefined}
                codigoPostal={draft.codigo_postal ?? undefined}
                pais={draft.pais ?? undefined}
                onChange={(p) => setDraft((d) => ({ ...d, lat: p.lat, lng: p.lng }))}
                onRadioChange={(r) => setDraft((d) => ({ ...d, radio_metros: r }))}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Radio permitido para fichar: <strong>{draft.radio_metros} m</strong>
                </Label>
                <Input
                  type="range"
                  min={20}
                  max={1000}
                  step={10}
                  value={draft.radio_metros}
                  onChange={(e) =>
                    setDraft({ ...draft, radio_metros: parseInt(e.target.value, 10) })
                  }
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : editando ? "Guardar" : "Crear local"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
