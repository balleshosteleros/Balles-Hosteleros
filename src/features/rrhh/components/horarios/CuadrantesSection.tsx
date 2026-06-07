"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cuadrante } from "@/features/rrhh/data/cuadrantes";
import {
  listCuadrantes,
  createCuadrante,
  updateCuadrante,
  deleteCuadrante,
} from "@/features/rrhh/actions/cuadrantes-actions";
import { listDepartamentos } from "@/features/rrhh/actions/empleados-actions";
import { listLocales } from "@/features/ajustes/actions/locales-actions";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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
  Pencil,
  Trash2,
  Search,
  MoreVertical,
  Loader2,
  Users,
  Building2,
  MapPin,
  Check,
  X,
  ChevronDown,
  Type,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

interface LocalOpt {
  id: string;
  nombre: string;
}
interface DeptoOpt {
  id: string;
  nombre: string;
}

interface CuadranteDraft {
  nombre: string;
  localId: string | null; // null = todos los locales
  departamentoIds: string[];
}

function draftVacio(): CuadranteDraft {
  return { nombre: "", localId: null, departamentoIds: [] };
}

function pluralDeptos(n: number) {
  if (n === 0) return "0 departamentos";
  if (n === 1) return "1 departamento";
  return `${n} departamentos`;
}

export function CuadrantesSection({ empresaId }: { empresaId: string }) {
  const [cuadrantes, setCuadrantes] = useState<Cuadrante[]>([]);
  const [locales, setLocales] = useState<LocalOpt[]>([]);
  const [departamentos, setDepartamentos] = useState<DeptoOpt[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  useGlobalLoadingSync(cargando || guardando);

  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CuadranteDraft>(draftVacio);
  const [deptoBusqueda, setDeptoBusqueda] = useState("");
  const [deptoPanelOpen, setDeptoPanelOpen] = useState(false);
  const [verDeptosCuadrante, setVerDeptosCuadrante] = useState<Cuadrante | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    const [cr, lr, dr] = await Promise.all([
      listCuadrantes(empresaId),
      listLocales(),
      listDepartamentos(),
    ]);
    if (cr.ok) setCuadrantes(cr.data);
    if (lr.ok)
      setLocales(
        (lr.data ?? [])
          .filter((l) => l.activo)
          .map((l) => ({ id: l.id as string, nombre: l.nombre as string })),
      );
    if (dr.ok)
      setDepartamentos(
        (dr.data ?? [])
          .filter((d) => (d as { estado?: string }).estado === "Activo")
          .map((d) => ({ id: d.id as string, nombre: d.nombre as string }))
          .filter((d) => !!d.id),
      );
    setCargando(false);
  }, [empresaId]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const nombrePorDepto = useMemo(
    () => new Map(departamentos.map((d) => [d.id, d.nombre])),
    [departamentos],
  );

  const filtrados = cuadrantes.filter(
    (c) => !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const abrirNuevo = () => {
    setEditandoId(null);
    setDeptoBusqueda("");
    setDeptoPanelOpen(false);
    setDraft(draftVacio());
    setShowModal(true);
  };

  const abrirEditar = (c: Cuadrante) => {
    setEditandoId(c.id);
    setDeptoBusqueda("");
    setDeptoPanelOpen(false);
    setDraft({
      nombre: c.nombre,
      localId: c.localId,
      departamentoIds: [...c.departamentoIds],
    });
    setShowModal(true);
  };

  const eliminar = async (id: string) => {
    setGuardando(true);
    await deleteCuadrante(id);
    await refrescar();
    setGuardando(false);
  };

  const guardar = async () => {
    const nombre = draft.nombre.trim();
    if (!nombre || draft.departamentoIds.length === 0) return;
    setGuardando(true);
    const input = {
      nombre,
      localId: draft.localId,
      departamentoIds: draft.departamentoIds,
    };
    if (editandoId) await updateCuadrante(editandoId, input);
    else await createCuadrante(empresaId, input);
    await refrescar();
    setGuardando(false);
    setShowModal(false);
    setEditandoId(null);
  };

  const deptosFiltradosModal = departamentos.filter((d) =>
    !deptoBusqueda
      ? true
      : d.nombre.toLowerCase().includes(deptoBusqueda.toLowerCase()),
  );
  const todosSeleccionados =
    departamentos.length > 0 &&
    draft.departamentoIds.length === departamentos.length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Cuadrantes
        </h2>
        <p className="text-sm text-muted-foreground">
          Agrupa empleados por local y departamentos para planificar sus turnos
          dentro de un mismo ámbito.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cuadrante..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="primary" size="sm" onClick={abrirNuevo} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_130px_56px] items-center px-4 py-2.5 border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Nombre</div>
          <div>Local</div>
          <div>Departamentos</div>
          <div className="text-center">Empleados</div>
          <div />
        </div>
        <div className="divide-y">
          {cargando && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Cargando…
            </div>
          )}
          {!cargando &&
            filtrados.map((c) => {
              const nombresDepto = c.departamentoIds
                .map((id) => nombrePorDepto.get(id))
                .filter(Boolean) as string[];
              return (
                <div
                  key={c.id}
                  className="group grid grid-cols-[1.2fr_1fr_1fr_130px_56px] items-center px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="text-sm font-medium truncate pr-2">{c.nombre}</div>
                  <div className="text-sm truncate pr-2">
                    {c.localId ? (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {c.localNombre ?? "Local"}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        Todos los locales
                      </span>
                    )}
                  </div>
                  <div className="text-sm truncate pr-2">
                    {nombresDepto.length === 0 ? (
                      <span className="text-amber-600 dark:text-amber-500">
                        Sin departamentos
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVerDeptosCuadrante(c)}
                        className="inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors max-w-full"
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {nombresDepto.length <= 2
                            ? nombresDepto.join(", ")
                            : `${nombresDepto.slice(0, 2).join(", ")} +${nombresDepto.length - 2}`}
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        c.empleadosCount === 0
                          ? "text-muted-foreground"
                          : "text-foreground font-medium",
                      )}
                    >
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.empleadosCount}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => abrirEditar(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => eliminar(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          {!cargando && filtrados.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Sin cuadrantes configurados
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end text-xs text-muted-foreground">
        {cuadrantes.length} {cuadrantes.length === 1 ? "cuadrante" : "cuadrantes"}
      </div>

      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) setEditandoId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editandoId ? "Editar cuadrante" : "Crear cuadrante"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Type className="h-4 w-4 text-muted-foreground" />
                Nombre de cuadrante
              </label>
              <div className="relative">
                <Input
                  value={draft.nombre}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, nombre: e.target.value }))
                  }
                  placeholder="Nombre de cuadrante"
                  className="pr-9"
                />
                {draft.nombre && (
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, nombre: "" }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Local
              </label>
              <select
                value={draft.localId ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, localId: e.target.value || null }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Todos los locales</option>
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Departamentos</span>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      departamentoIds: todosSeleccionados
                        ? []
                        : departamentos.map((dep) => dep.id),
                    }))
                  }
                  className="ml-auto text-xs text-primary hover:underline"
                >
                  {todosSeleccionados ? "Quitar todos" : "Seleccionar todos"}
                </button>
              </div>
              <div className="pl-6 space-y-2">
                <button
                  type="button"
                  onClick={() => setDeptoPanelOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 h-9 text-sm hover:bg-muted/60 transition-colors"
                >
                  <span className="truncate text-left">
                    {draft.departamentoIds.length === 0
                      ? "Seleccionar departamentos…"
                      : pluralDeptos(draft.departamentoIds.length)}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      deptoPanelOpen && "rotate-180",
                    )}
                  />
                </button>
                {deptoPanelOpen && (
                  <div className="space-y-2 rounded-md border p-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar departamento..."
                        value={deptoBusqueda}
                        onChange={(e) => setDeptoBusqueda(e.target.value)}
                        className="pl-9 h-8 text-sm"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-md border divide-y">
                      {deptosFiltradosModal.length === 0 && (
                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                          No hay departamentos.
                        </p>
                      )}
                      {deptosFiltradosModal.map((dep) => {
                        const checked = draft.departamentoIds.includes(dep.id);
                        return (
                          <button
                            key={dep.id}
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                departamentoIds: checked
                                  ? d.departamentoIds.filter((id) => id !== dep.id)
                                  : [...d.departamentoIds, dep.id],
                              }))
                            }
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors"
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                checked
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-input",
                              )}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                            <span className="truncate">{dep.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={
                guardando ||
                !draft.nombre.trim() ||
                draft.departamentoIds.length === 0
              }
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!verDeptosCuadrante}
        onOpenChange={(v) => (!v ? setVerDeptosCuadrante(null) : null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {verDeptosCuadrante?.nombre} ·{" "}
              {pluralDeptos(verDeptosCuadrante?.departamentoIds.length ?? 0)}
            </DialogTitle>
          </DialogHeader>
          <ul className="max-h-80 overflow-y-auto divide-y">
            {(verDeptosCuadrante?.departamentoIds ?? []).map((id) => (
              <li key={id} className="py-2 text-sm flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{nombrePorDepto.get(id) ?? "Departamento"}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerDeptosCuadrante(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
