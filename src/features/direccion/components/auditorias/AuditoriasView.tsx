"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, ClipboardList, ChevronRight, CircleSlash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import {
  listAuditorias,
  createAuditoria,
} from "@/features/direccion/actions/auditorias-actions";
import {
  listDepartamentos,
  type DepartamentoRow,
} from "@/features/ajustes/actions/departamentos-actions";
import {
  type Auditoria,
  VALORACION_META,
  periodoLabel,
} from "@/features/direccion/data/auditorias";
import { AuditoriaDetalle } from "./AuditoriaDetalle";

// Opciones de mes para el selector "Nueva auditoría": mes actual y los 11
// anteriores. Se calcula en cliente a partir de la fecha de hoy.
function mesesRecientes(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const hoy = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: periodoLabel(value) });
  }
  return out;
}

export function AuditoriasView() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("todos");
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  // Dialog "Nueva auditoría"
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [nuevoDepto, setNuevoDepto] = useState<string>("");
  const [nuevoPeriodo, setNuevoPeriodo] = useState<string>(mesesRecientes()[0].value);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listAuditorias();
    if (res.ok) setAuditorias(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    listDepartamentos()
      .then((d) => setDepartamentos(d.filter((x) => x.estado === "Activo")))
      .catch(() => setDepartamentos([]));
  }, [cargar]);

  const periodosDisponibles = useMemo(() => {
    const set = new Set(auditorias.map((a) => a.periodo));
    return Array.from(set).sort().reverse();
  }, [auditorias]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return auditorias.filter((a) => {
      if (filtroPeriodo !== "todos" && a.periodo !== filtroPeriodo) return false;
      if (q && !a.departamento_nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [auditorias, busqueda, filtroPeriodo]);

  async function handleCrear() {
    if (!nuevoDepto) {
      toast.error("Elige un departamento");
      return;
    }
    setCreando(true);
    const res = await createAuditoria({ departamentoId: nuevoDepto, periodo: nuevoPeriodo });
    setCreando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Auditoría creada");
    setNuevaOpen(false);
    setNuevoDepto("");
    await cargar();
    setSeleccionada(res.data.id);
  }

  // Vista de detalle de una auditoría concreta.
  if (seleccionada) {
    return (
      <AuditoriaDetalle
        auditoriaId={seleccionada}
        cabecera={auditorias.find((a) => a.id === seleccionada) ?? null}
        onVolver={() => {
          setSeleccionada(null);
          cargar();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar departamento"
        onNuevo={() => setNuevaOpen(true)}
        textoNuevo="Nueva auditoría"
      />

      {/* Filtros en fila aparte (BARRA HORIZONTAL 1) */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {periodosDisponibles.map((p) => (
              <SelectItem key={p} value={p}>
                {periodoLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 opacity-40" />
          <p className="text-sm">
            No hay auditorías todavía. Crea la primera con “Nueva auditoría”.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((a) => (
            <AuditoriaCard
              key={a.id}
              auditoria={a}
              onClick={() => setSeleccionada(a.id)}
            />
          ))}
        </div>
      )}

      {/* Dialog Nueva auditoría */}
      <Dialog open={nuevaOpen} onOpenChange={setNuevaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva auditoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Select value={nuevoDepto} onValueChange={setNuevoDepto}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mes</Label>
              <Select value={nuevoPeriodo} onValueChange={setNuevoPeriodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mesesRecientes().map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCrear} disabled={creando}>
              {creando ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditoriaCard({
  auditoria,
  onClick,
}: {
  auditoria: Auditoria;
  onClick: () => void;
}) {
  const val = auditoria.valoracion ? VALORACION_META[auditoria.valoracion] : null;
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{auditoria.departamento_nombre}</p>
          <p className="text-sm text-muted-foreground">
            {periodoLabel(auditoria.periodo)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {val ? (
          <Badge variant="outline" className={cn("gap-1.5", val.badge)}>
            <span className={cn("h-2 w-2 rounded-full", val.dot)} />
            {val.label}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            <CircleSlash className="h-3 w-3" />
            Sin valorar
          </Badge>
        )}
        {auditoria.estado === "cerrada" && (
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
            Cerrada
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{auditoria.total_puntos} puntos</span>
        {auditoria.puntos_abiertos > 0 && (
          <span className="text-rose-600">{auditoria.puntos_abiertos} abiertos</span>
        )}
      </div>
    </button>
  );
}
