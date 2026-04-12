"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Camera,
  ClipboardCheck,
  FileText,
  ShoppingCart,
  Eye,
  Pencil,
  Trash2,
  X,
  Check,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Estado = "propuesto" | "en_cata" | "aprobado" | "rechazado" | "en_carta";
type Destino = "cocina" | "sala" | "ambos";

type NuevoPlato = {
  id: string;
  nombre: string;
  descripcion: string;
  destino: Destino;
  estado: Estado;
  propuestoPor: string;
  fecha: string;
  pasos: {
    fotosMarketing: boolean;
    cata1: boolean;
    cata2: boolean;
    grabarProducto: boolean;
    fichaProveedor: boolean;
  };
};

const ESTADO_CONFIG: Record<
  Estado,
  { label: string; color: string }
> = {
  propuesto: { label: "Propuesto", color: "bg-blue-100 text-blue-700" },
  en_cata: { label: "En cata", color: "bg-amber-100 text-amber-700" },
  aprobado: { label: "Aprobado", color: "bg-emerald-100 text-emerald-700" },
  rechazado: { label: "Rechazado", color: "bg-red-100 text-red-700" },
  en_carta: { label: "En carta", color: "bg-violet-100 text-violet-700" },
};

const DESTINO_LABEL: Record<Destino, string> = {
  cocina: "Cocina",
  sala: "Sala",
  ambos: "Cocina y Sala",
};

const PASOS_LABEL: {
  key: keyof NuevoPlato["pasos"];
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "fotosMarketing", label: "Fotos de marketing", icon: Camera },
  { key: "cata1", label: "Cata 1 — platos a ver", icon: ClipboardCheck },
  { key: "cata2", label: "Cata 2 — platos a ver", icon: ClipboardCheck },
  { key: "grabarProducto", label: "Grabar producto", icon: FileText },
  {
    key: "fichaProveedor",
    label: "Pedir fichas proveedor / producto compra",
    icon: ShoppingCart,
  },
];

function progreso(pasos: NuevoPlato["pasos"]): number {
  const total = PASOS_LABEL.length;
  const completados = PASOS_LABEL.filter((p) => pasos[p.key]).length;
  return Math.round((completados / total) * 100);
}

const SEED: NuevoPlato[] = [
  {
    id: "np-1",
    nombre: "Tataki de atún con wakame",
    descripcion: "Tataki de atún rojo sobre alga wakame con vinagreta de sésamo tostado.",
    destino: "ambos",
    estado: "en_cata",
    propuestoPor: "Chef principal",
    fecha: "2026-04-10",
    pasos: {
      fotosMarketing: true,
      cata1: true,
      cata2: false,
      grabarProducto: false,
      fichaProveedor: true,
    },
  },
];

type FormData = {
  nombre: string;
  descripcion: string;
  destino: Destino;
};

export function NuevosPlatosView() {
  const [platos, setPlatos] = useState<NuevoPlato[]>(SEED);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<Estado | "todos">("todos");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<FormData>({
    nombre: "",
    descripcion: "",
    destino: "ambos",
  });
  const [detalle, setDetalle] = useState<NuevoPlato | null>(null);

  const filtrados = useMemo(() => {
    let list = platos;
    if (filtroEstado !== "todos")
      list = list.filter((p) => p.estado === filtroEstado);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.descripcion.toLowerCase().includes(q),
      );
    }
    return list;
  }, [platos, filtroEstado, busqueda]);

  function crear() {
    if (!form.nombre.trim()) {
      toast.error("Falta el nombre del plato");
      return;
    }
    const nuevo: NuevoPlato = {
      id: `np-${Date.now()}`,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      destino: form.destino,
      estado: "propuesto",
      propuestoPor: "Tú",
      fecha: new Date().toISOString().slice(0, 10),
      pasos: {
        fotosMarketing: false,
        cata1: false,
        cata2: false,
        grabarProducto: false,
        fichaProveedor: false,
      },
    };
    setPlatos((prev) => [nuevo, ...prev]);
    setShowNew(false);
    setForm({ nombre: "", descripcion: "", destino: "ambos" });
    toast.success("Plato propuesto");
  }

  function togglePaso(platoId: string, paso: keyof NuevoPlato["pasos"]) {
    setPlatos((prev) =>
      prev.map((p) =>
        p.id === platoId
          ? { ...p, pasos: { ...p.pasos, [paso]: !p.pasos[paso] } }
          : p,
      ),
    );
    if (detalle?.id === platoId) {
      setDetalle((prev) =>
        prev
          ? { ...prev, pasos: { ...prev.pasos, [paso]: !prev.pasos[paso] } }
          : prev,
      );
    }
  }

  function cambiarEstado(platoId: string, estado: Estado) {
    setPlatos((prev) =>
      prev.map((p) => (p.id === platoId ? { ...p, estado } : p)),
    );
    if (detalle?.id === platoId)
      setDetalle((prev) => (prev ? { ...prev, estado } : prev));
    toast.success(`Estado cambiado a "${ESTADO_CONFIG[estado].label}"`);
  }

  function eliminar(id: string) {
    setPlatos((prev) => prev.filter((p) => p.id !== id));
    if (detalle?.id === id) setDetalle(null);
    toast.success("Plato eliminado");
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)}>
          <Plus className="mr-1 h-4 w-4" /> Proponer plato
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar plato…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Select
          value={filtroEstado}
          onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {(Object.keys(ESTADO_CONFIG) as Estado[]).map((k) => (
              <SelectItem key={k} value={k}>
                {ESTADO_CONFIG[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtrados.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No hay platos que coincidan.
            </CardContent>
          </Card>
        )}
        {filtrados.map((p) => {
          const pct = progreso(p.pasos);
          const completados = PASOS_LABEL.filter(
            (pa) => p.pasos[pa.key],
          ).length;
          return (
            <Card
              key={p.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setDetalle(p)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{p.nombre}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {DESTINO_LABEL[p.destino]} · {p.fecha}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0 text-[10px] border-0",
                      ESTADO_CONFIG[p.estado].color,
                    )}
                  >
                    {ESTADO_CONFIG[p.estado].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {p.descripcion || "Sin descripción"}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {completados}/{PASOS_LABEL.length} pasos
                  </span>
                  <span className="font-semibold text-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog nuevo plato */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Proponer nuevo plato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre del plato</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Tataki de atún"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <textarea
                value={form.descripcion}
                onChange={(e) =>
                  setForm({ ...form, descripcion: e.target.value })
                }
                placeholder="Ingredientes, presentación, notas…"
                className="mt-1 min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label>Destino</Label>
              <Select
                value={form.destino}
                onValueChange={(v) =>
                  setForm({ ...form, destino: v as Destino })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cocina">Cocina</SelectItem>
                  <SelectItem value="sala">Sala</SelectItem>
                  <SelectItem value="ambos">Cocina y Sala</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
            <Button onClick={crear}>Proponer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalle */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        {detalle && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <DialogTitle className="text-lg">{detalle.nombre}</DialogTitle>
                <Badge
                  className={cn(
                    "shrink-0 text-[10px] border-0",
                    ESTADO_CONFIG[detalle.estado].color,
                  )}
                >
                  {ESTADO_CONFIG[detalle.estado].label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {DESTINO_LABEL[detalle.destino]} · Propuesto por{" "}
                {detalle.propuestoPor} · {detalle.fecha}
              </p>
            </DialogHeader>

            {detalle.descripcion && (
              <p className="text-sm text-muted-foreground">
                {detalle.descripcion}
              </p>
            )}

            {/* Checklist de pasos */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pasos del proceso
              </p>
              {PASOS_LABEL.map(({ key, label, icon: Icon }) => (
                <label
                  key={key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    detalle.pasos[key]
                      ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20"
                      : "hover:bg-muted/40",
                  )}
                >
                  <Checkbox
                    checked={detalle.pasos[key]}
                    onCheckedChange={() => togglePaso(detalle.id, key)}
                  />
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span
                    className={cn(
                      "text-sm",
                      detalle.pasos[key] && "line-through text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                  {detalle.pasos[key] && (
                    <Check className="ml-auto h-4 w-4 text-emerald-600" />
                  )}
                </label>
              ))}
              <div className="pt-1">
                <Progress value={progreso(detalle.pasos)} className="h-2" />
              </div>
            </div>

            {/* Cambiar estado */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cambiar estado
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ESTADO_CONFIG) as Estado[]).map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={detalle.estado === k ? "default" : "outline"}
                    onClick={() => cambiarEstado(detalle.id, k)}
                    className="text-xs"
                  >
                    {ESTADO_CONFIG[k].label}
                  </Button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => eliminar(detalle.id)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
