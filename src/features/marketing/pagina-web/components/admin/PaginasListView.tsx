"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  Globe,
  LayoutTemplate,
  Pencil,
  Trash2,
  Eye,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listarPaginas,
  borrarPagina,
  renombrarPagina,
  cambiarEstadoPagina,
} from "../../actions/paginas-actions";
import { NuevaPaginaModal } from "./NuevaPaginaModal";
import type { PaginaWeb, PaginaWebEstado } from "../../types";

const ESTADO_LABEL: Record<PaginaWebEstado, string> = {
  BORRADOR: "Borrador",
  PUBLICADA: "Publicada",
  ARCHIVADA: "Archivada",
};
const ESTADO_COLOR: Record<PaginaWebEstado, string> = {
  BORRADOR: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  PUBLICADA: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ARCHIVADA: "bg-muted text-muted-foreground",
};

export function PaginasListView() {
  const [items, setItems] = useState<PaginaWeb[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [confirmar, setConfirmar] = useState<
    | { tipo: "archivar" | "eliminar"; id: string; nombre: string }
    | null
  >(null);
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string } | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listarPaginas();
    if (res.ok) setItems(res.data);
    else toast.error(res.error ?? "Error al cargar páginas");
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const acceso = (p: PaginaWeb, campo: string): unknown => {
    if (campo === "estado") return ESTADO_LABEL[p.estado];
    if (campo === "tipo") return p.tipo === "WEB_PRINCIPAL" ? "Web principal" : "One-page";
    if (campo === "nombre") return p.nombre;
    if (campo === "updated_at") return p.updated_at;
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let r = items.filter((p) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return p.nombre.toLowerCase().includes(s) || p.slug_interno.includes(s);
    });
    r = aplicarFiltrosToolbar(r, filtros, acceso);
    r = aplicarOrdenToolbar(r, orden, acceso);
    return r;
  }, [items, search, filtros, orden]);

  const onConfirmar = async () => {
    if (!confirmar) return;
    const res =
      confirmar.tipo === "archivar"
        ? await cambiarEstadoPagina({ id: confirmar.id, estado: "ARCHIVADA" })
        : await borrarPagina(confirmar.id);
    if (res.ok) {
      toast.success(confirmar.tipo === "archivar" ? "Archivada" : "Eliminada");
      cargar();
    } else {
      toast.error(res.error ?? "Error");
    }
    setConfirmar(null);
  };

  const onRenombrar = async () => {
    if (!renombrando || !renombrando.nombre.trim()) return;
    const res = await renombrarPagina({ id: renombrando.id, nombre: renombrando.nombre.trim() });
    if (res.ok) {
      toast.success("Renombrada");
      cargar();
    } else {
      toast.error(res.error ?? "Error");
    }
    setRenombrando(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="h-6 w-6" /> Página web
        </h1>
        <p className="text-sm text-muted-foreground">
          Web corporativa + one-pages de campaña. Dominios custom con SSL automático.
        </p>
      </div>

      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar por nombre o slug..."
        onNuevo={() => setNuevaOpen(true)}
        textoNuevo="Nueva página"
        campos={[
          {
            campo: "estado",
            label: "Estado",
            tipo: "lista",
            opciones: Object.values(ESTADO_LABEL),
          },
          {
            campo: "tipo",
            label: "Tipo",
            tipo: "lista",
            opciones: ["Web principal", "One-page"],
          },
        ]}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        ordenOpciones={[
          { campo: "nombre", label: "Nombre" },
          { campo: "updated_at", label: "Actualizada" },
        ]}
        orden={orden}
        onOrdenChange={setOrden}
        columnas={[
          { campo: "nombre", label: "Nombre" },
          { campo: "tipo", label: "Tipo" },
          { campo: "slug", label: "Slug" },
          { campo: "estado", label: "Estado" },
          { campo: "actualizada", label: "Actualizada" },
        ]}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        extraDerecha={
          <span className="text-xs text-muted-foreground">
            {filtered.length} página{filtered.length !== 1 ? "s" : ""}
          </span>
        }
      />

      {/* Tabla */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Actualizada</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Globe className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No hay páginas creadas todavía
                    </p>
                    <Button variant="primary" size="lg" onClick={() => setNuevaOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Crear la primera
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium max-w-[320px] truncate">
                    <Link
                      href={`/marketing/pagina-web/${p.id}`}
                      className="hover:underline"
                    >
                      {p.nombre}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="font-normal">
                      {p.tipo === "WEB_PRINCIPAL" ? (
                        <>
                          <Globe className="h-3 w-3 mr-1" /> Web principal
                        </>
                      ) : (
                        <>
                          <LayoutTemplate className="h-3 w-3 mr-1" /> One-page
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                    {p.slug_interno}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ESTADO_COLOR[p.estado]}>
                      {ESTADO_LABEL[p.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(p.updated_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/marketing/pagina-web/${p.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir editor">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Renombrar"
                        onClick={() => setRenombrando({ id: p.id, nombre: p.nombre })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {p.estado !== "ARCHIVADA" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Archivar"
                          onClick={() =>
                            setConfirmar({ tipo: "archivar", id: p.id, nombre: p.nombre })
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
                          setConfirmar({ tipo: "eliminar", id: p.id, nombre: p.nombre })
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

      <NuevaPaginaModal open={nuevaOpen} onOpenChange={setNuevaOpen} onCreated={cargar} />

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar?.tipo === "archivar"
                ? "¿Archivar página?"
                : "¿Eliminar definitivamente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.tipo === "archivar"
                ? `"${confirmar.nombre}" quedará archivada. Podrás recuperarla.`
                : `"${confirmar?.nombre}" se eliminará con todos sus bloques, dominios y versiones.`}
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

      <AlertDialog open={!!renombrando} onOpenChange={(o) => !o && setRenombrando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renombrar página</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            value={renombrando?.nombre ?? ""}
            onChange={(e) =>
              setRenombrando((r) => (r ? { ...r, nombre: e.target.value } : null))
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
