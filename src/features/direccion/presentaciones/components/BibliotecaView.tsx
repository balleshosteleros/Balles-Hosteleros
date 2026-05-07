"use client";

import { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus, Sparkles, Archive, Trash2, Eye, Pencil, Palette, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  ordenarColumnas,
  colVisible,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listPresentaciones, archivarPresentacion, eliminarPresentacion, renombrarPresentacion,
} from "../actions/presentaciones-actions";
import { GeneradorInteligenteModal } from "./GeneradorInteligenteModal";
import type { Presentacion, Estado } from "../types/presentaciones";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

const ESTADO_LABEL: Record<Estado, string> = {
  borrador: "Borrador",
  generando: "Generando…",
  listo: "Lista",
  fallida: "Fallida",
  archivada: "Archivada",
};
const ESTADO_COLOR: Record<Estado, string> = {
  borrador: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  generando: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  listo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  fallida: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  archivada: "bg-muted text-muted-foreground",
};

export function BibliotecaView() {
  const [items, setItems] = useState<Presentacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [confirmar, setConfirmar] = useState<
    { tipo: "archivar" | "eliminar"; id: string; titulo: string } | null
  >(null);
  const [renombrando, setRenombrando] = useState<{ id: string; titulo: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listPresentaciones();
    if (res.ok) setItems(res.data);
    else toast.error("Error al cargar presentaciones");
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const acceso = (p: Presentacion, campo: string): unknown => {
    if (campo === "estado") return ESTADO_LABEL[p.estado];
    if (campo === "audiencia") return p.audiencia ?? "";
    if (campo === "slides") return p.num_slides;
    if (campo === "fecha") return p.created_at;
    if (campo === "titulo") return p.titulo;
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let r = items;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(
        (p) =>
          p.titulo.toLowerCase().includes(s) ||
          p.prompt_original.toLowerCase().includes(s),
      );
    }
    r = aplicarFiltrosToolbar(r, filtros, acceso);
    r = aplicarOrdenToolbar(r, orden, acceso);
    return r;
  }, [items, search, filtros, orden]);

  const onConfirmar = async () => {
    if (!confirmar) return;
    const res =
      confirmar.tipo === "archivar"
        ? await archivarPresentacion(confirmar.id)
        : await eliminarPresentacion(confirmar.id);
    if (res.ok) {
      toast.success(confirmar.tipo === "archivar" ? "Archivada" : "Eliminada");
      cargar();
    } else {
      toast.error(res.error ?? "Error");
    }
    setConfirmar(null);
  };

  const onRenombrar = async () => {
    if (!renombrando || !renombrando.titulo.trim()) return;
    const res = await renombrarPresentacion(renombrando.id, renombrando.titulo.trim());
    if (res.ok) {
      toast.success("Renombrada");
      cargar();
    } else {
      toast.error(res.error ?? "Error");
    }
    setRenombrando(null);
  };

  const columnasDef: ToolbarColumna[] = [
    { campo: "titulo", label: "Título" },
    { campo: "audiencia", label: "Audiencia" },
    { campo: "slides", label: "Slides" },
    { campo: "estado", label: "Estado" },
    { campo: "fecha", label: "Fecha" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: Presentacion) => ReactNode }> = {
    titulo: {
      th: <TableHead key="titulo">Título</TableHead>,
      td: (p) => (
        <TableCell key="titulo" className="font-medium max-w-[320px] truncate">
          <Link
            href={`/direccion/presentaciones/${p.id}`}
            className="hover:underline"
          >
            {p.titulo}
          </Link>
        </TableCell>
      ),
    },
    audiencia: {
      th: <TableHead key="audiencia">Audiencia</TableHead>,
      td: (p) => (
        <TableCell key="audiencia" className="text-sm text-muted-foreground max-w-[240px] truncate">
          {p.audiencia ?? "—"}
        </TableCell>
      ),
    },
    slides: {
      th: <TableHead key="slides">Slides</TableHead>,
      td: (p) => <TableCell key="slides">{p.num_slides}</TableCell>,
    },
    estado: {
      th: <TableHead key="estado">Estado</TableHead>,
      td: (p) => (
        <TableCell key="estado">
          <Badge variant="outline" className={ESTADO_COLOR[p.estado]}>
            {ESTADO_LABEL[p.estado]}
          </Badge>
        </TableCell>
      ),
    },
    fecha: {
      th: <TableHead key="fecha">Fecha</TableHead>,
      td: (p) => (
        <TableCell key="fecha" className="text-sm text-muted-foreground whitespace-nowrap">
          {new Date(p.created_at).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6" /> Presentaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Genera presentaciones con IA manteniendo tu imagen de marca.
          </p>
        </div>
        <Link href="/direccion/presentaciones/branding">
          <Button variant="outline" size="sm">
            <Palette className="h-4 w-4 mr-2" /> Imagen de marca
          </Button>
        </Link>
      </div>

      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        onNuevo={() => setNuevaOpen(true)}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        orden={orden}
        onOrdenChange={setOrden}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <Button
            size="icon"
            variant={showConfig ? "default" : "outline"}
            className="h-9 w-9"
            onClick={() => setShowConfig((v) => !v)}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />
      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} presentación{filtered.length !== 1 ? "es" : ""}
      </p>

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {columnasRender.map((c) => columnDefs[c.campo]?.th)}
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <LoadingSpinner />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No hay presentaciones todavía
                    </p>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => setNuevaOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Crear la primera
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/direccion/presentaciones/${p.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Renombrar"
                        onClick={() => setRenombrando({ id: p.id, titulo: p.titulo })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {p.estado !== "archivada" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Archivar"
                          onClick={() =>
                            setConfirmar({ tipo: "archivar", id: p.id, titulo: p.titulo })
                          }
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        title="Eliminar"
                        onClick={() =>
                          setConfirmar({ tipo: "eliminar", id: p.id, titulo: p.titulo })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      {/* Modal crear */}
      <GeneradorInteligenteModal open={nuevaOpen} onOpenChange={setNuevaOpen} onSuccess={cargar} />

      {/* Confirmación archivar/eliminar */}
      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar?.tipo === "archivar" ? "¿Archivar presentación?" : "¿Eliminar definitivamente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.tipo === "archivar"
                ? `"${confirmar.titulo}" quedará en el filtro Archivadas. Podrás recuperarla.`
                : `"${confirmar?.titulo}" se eliminará permanentemente con todas sus slides.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmar}
              className={
                confirmar?.tipo === "eliminar"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : undefined
              }
            >
              {confirmar?.tipo === "archivar" ? "Archivar" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renombrar */}
      <AlertDialog open={!!renombrando} onOpenChange={(o) => !o && setRenombrando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renombrar presentación</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            value={renombrando?.titulo ?? ""}
            onChange={(e) =>
              setRenombrando((r) => (r ? { ...r, titulo: e.target.value } : null))
            }
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onRenombrar}>Guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
