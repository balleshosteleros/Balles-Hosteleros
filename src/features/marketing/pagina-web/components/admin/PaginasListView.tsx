"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  Globe,
  LayoutTemplate,
  Pencil,
  Trash2,
  Eye,
  Settings,
  FileText,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  colVisible,
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
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
import { listarPaginas, borrarPagina } from "../../actions/paginas-actions";
import { NuevaPaginaModal } from "./NuevaPaginaModal";
import { GenerarLegalesDialog } from "./GenerarLegalesDialog";
import type { PaginaWeb, PaginaWebEstado } from "../../types";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";

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
  const { empresaActual } = useEmpresa();
  const [items, setItems] = useState<PaginaWeb[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [legalesOpen, setLegalesOpen] = useState(false);
  // Sin "archivar": el estado ARCHIVADA sigue existiendo en el modelo por
  // compatibilidad, pero ya no se ofrece como acción.
  const [confirmar, setConfirmar] = useState<{ id: string; nombre: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // El `finally` no es opcional: sin él, cualquier excepción (red caída,
  // sesión caducada, error del servidor) dejaba la pantalla girando el spinner
  // para siempre, sin mensaje y sin forma de salir salvo recargar.
  const cargar = useCallback(async () => {
    setLoading(true);
    setErrorCarga(null);
    try {
      const res = await listarPaginas();
      if (res.ok) setItems(res.data);
      else {
        setErrorCarga(res.error ?? "No se pudieron cargar las páginas.");
        toast.error(res.error ?? "No se pudieron cargar las páginas.");
      }
    } catch (err) {
      console.error("[pagina-web][PaginasListView] cargar:", err);
      setErrorCarga("No se pudieron cargar las páginas. Comprueba la conexión.");
      toast.error("No se pudieron cargar las páginas.");
    } finally {
      setLoading(false);
    }
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
    const res = await borrarPagina(confirmar.id);
    if (res.ok) {
      toast.success("Eliminada");
      cargar();
    } else {
      toast.error(res.error ?? "Error");
    }
    setConfirmar(null);
  };

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Nombre" },
    { campo: "tipo", label: "Tipo" },
    { campo: "slug", label: "Slug" },
    { campo: "estado", label: "Estado" },
    { campo: "actualizada", label: "Actualizada" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: PaginaWeb) => ReactNode }> = {
    nombre: {
      th: <TableHead key="nombre">Nombre</TableHead>,
      td: (p) => (
        <TableCell key="nombre" className="font-medium max-w-[320px] truncate">
          <span className="flex items-center gap-1.5">
            <Link href={`/marketing/pagina-web/${p.id}`} className="truncate hover:underline">
              {p.nombre}
            </Link>
            {p.legal_tipo && (
              <Lock
                className="h-3 w-3 shrink-0 text-muted-foreground"
                strokeWidth={2}
                aria-label="Se genera con los datos de la empresa"
              />
            )}
          </span>
        </TableCell>
      ),
    },
    tipo: {
      th: <TableHead key="tipo">Tipo</TableHead>,
      td: (p) => (
        <TableCell key="tipo" className="text-xs">
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
      ),
    },
    slug: {
      th: <TableHead key="slug">Slug</TableHead>,
      td: (p) => (
        <TableCell key="slug" className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
          {p.slug_interno}
        </TableCell>
      ),
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
    actualizada: {
      th: <TableHead key="actualizada">Actualizada</TableHead>,
      td: (p) => (
        <TableCell key="actualizada" className="text-sm text-muted-foreground whitespace-nowrap">
          {/* `empresaActual` puede no estar aún resuelta en el primer render
              (el contexto la deriva de una lista que llega por red). Sin este
              opcional, la fila entera reventaba y la pantalla se quedaba
              cargando sin decir nada. */}
          {formatFechaEnZona(p.updated_at, empresaActual?.zonaHoraria, {
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
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
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
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => setLegalesOpen(true)}
              title="Generar política de privacidad, aviso legal y cookies"
            >
              <FileText className="h-4 w-4 mr-2" strokeWidth={1.75} />
              Páginas legales
            </Button>
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
          </>
        }
      />

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
            {!loading && errorCarga && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Globe className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">{errorCarga}</p>
                    <Button variant="outline" onClick={cargar}>
                      Reintentar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading && !errorCarga && filtered.length === 0 && (
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
                  {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {/* Ver = la WEB, en una pestaña nueva. Editar = el editor.
                          Antes el ojo abría el editor y el lápiz solo renombraba,
                          así que no había forma de ver la web desde aquí. */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Ver la web en una pestaña nueva"
                        onClick={() =>
                          window.open(`/pagina-web-preview/${p.id}`, "_blank", "noopener,noreferrer")
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Link href={`/marketing/pagina-web/${p.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        title="Eliminar"
                        onClick={() => setConfirmar({ id: p.id, nombre: p.nombre })}
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

      <GenerarLegalesDialog
        open={legalesOpen}
        onOpenChange={setLegalesOpen}
        onGenerated={cargar}
      />

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${confirmar?.nombre}" se eliminará con todos sus bloques, dominios y versiones.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmar}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
