"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EtiquetasPanel } from "@/features/sala/components/reservas/EtiquetasPanel";
import { EtiquetaChip } from "@/features/sala/components/reservas/config/EtiquetaChip";
import { ClienteBloqueoTicketBanner } from "@/features/sala/components/clientes/ClienteBloqueoTicketBanner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { Settings, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ESTADOS_RESERVA,
  ESTADO_DOT_CLASS,
  ESTADO_RESERVA_LABELS,
  type EstadoReserva,
} from "@/features/sala/data/reservas";
import { Button } from "@/components/ui/button";
import { Cliente, ClasificacionCliente } from "@/features/sala/data/clientes";
import { listClientes, createCliente } from "@/features/sala/actions/clientes-actions";
import { guardarFichaCliente } from "@/features/sala/actions/cliente-ficha-actions";
import {
  listClientesEnriquecidos,
  type ClienteEnriquecido,
} from "@/features/sala/actions/clientes-enriquecidos-actions";
import {
  clasificacionEfectiva,
  normalizarUmbrales,
  notaValoracion,
  type UmbralesClasificacion,
} from "@/features/sala/lib/clasificacion-cliente";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import { toast } from "sonner";
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
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { IOActions } from "@/shared/io";
import { clientesIO } from "@/features/sala/io/clientes.io";

/** Filas por hoja en la tabla de clientes. */
const POR_PAGINA = 50;

const clasificacionBadge: Record<ClasificacionCliente, string> = {
  "VIP": "bg-amber-100 text-amber-800 border-amber-300",
  "REGULAR": "bg-blue-100 text-blue-800 border-blue-300",
  "NUEVO": "bg-purple-100 text-purple-800 border-purple-300",
};

const ENRIQUECIDO_VACIO: ClienteEnriquecido = {
  clienteId: "",
  proximas: [],
  historico: [],
  porEstado: {},
  etiquetas: [],
  resenas: [],
  valoracionesSolicitadas: [],
  ratingMedio: null,
  visitas: 0,
  ultimaVisita: null,
};

function mapDbToCliente(row: Record<string, unknown>): Cliente {
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? "",
    apellidos: (row.apellidos as string) ?? "",
    telefono: (row.telefono as string) ?? "",
    email: (row.email as string) ?? "",
    clasificacion: (row.clasificacion as ClasificacionCliente) ?? "NUEVO",
    visitas: (row.visitas as number) ?? 0,
    ultimaVisita: (row.ultima_visita as string) ?? "",
    observaciones: (row.observaciones as string) ?? "",
    notasInternas: (row.notas_internas as string) ?? "",
  };
}

/** "12 sept · 21:00" — corto para que quepa en la celda. */
function fechaCorta(fecha: string, hora: string): string {
  try {
    const d = new Date(`${fecha}T00:00:00`);
    const txt = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return hora ? `${txt} · ${hora}` : txt;
  } catch {
    return `${fecha} ${hora}`.trim();
  }
}

function fechaLarga(fecha: string): string {
  try {
    const d = new Date(`${fecha}T00:00:00`);
    return d.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return fecha;
  }
}

function formatNota(n: number): string {
  // Coma decimal (regla de formato numérico del proyecto).
  return n.toFixed(1).replace(".", ",");
}


/** Estrellas de la nota media. `size` en px para reusar en tabla y ficha. */
function Estrellas({ nota, size = 13 }: { nota: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={
            i <= Math.round(nota)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          }
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

export function ClientesView() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [enriquecidos, setEnriquecidos] = useState<Record<string, ClienteEnriquecido>>({});
  const [umbrales, setUmbrales] = useState<UmbralesClasificacion>(normalizarUmbrales({}));
  /** Zona de la empresa: las fechas se pintan con ella, no con la del navegador. */
  const [zonaHoraria, setZonaHoraria] = useState("Europe/Madrid");
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [pagina, setPagina] = useState(1);

  // Borrador de la ficha: se edita en local y solo se persiste al pulsar Guardar.
  const [borrador, setBorrador] = useState<Cliente | null>(null);
  const [guardando, setGuardando] = useState(false);

  const loadClientes = useCallback(async () => {
    try {
      const [res, extra] = await Promise.all([
        listClientes(),
        listClientesEnriquecidos(),
      ]);
      if (res.ok) {
        setClientes(res.data.map(mapDbToCliente));
      } else {
        toast.error("Error al cargar clientes");
      }
      if (extra.ok) {
        setEnriquecidos(extra.data);
        setUmbrales(extra.umbrales);
        setZonaHoraria(extra.zonaHoraria);
      }
    } catch {
      toast.error("Error de conexion al cargar clientes");
    }
  }, []);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  const extraDe = useCallback(
    (id: string): ClienteEnriquecido => enriquecidos[id] ?? ENRIQUECIDO_VACIO,
    [enriquecidos],
  );

  /**
   * Clasificación que se pinta: manual si la hay, si no la calculada sobre las
   * visitas REALES (las contadas de sus reservas, no el contador guardado).
   */
  const clasifDe = useCallback(
    (c: Cliente): ClasificacionCliente =>
      clasificacionEfectiva({ visitas: extraDe(c.id).visitas, umbrales }),
    [umbrales, extraDe],
  );

  const acceso = useCallback(
    (c: Cliente, campo: string): unknown => {
      if (campo === "clasificacion") return clasifDe(c);
      if (campo === "visitas") return extraDe(c.id).visitas;
      if (campo === "ultimaVisita") return extraDe(c.id).ultimaVisita ?? "";
      // Nombre completo: la columna pinta nombre + apellidos, así que filtrar
      // por "nombre" tiene que casar con lo que se ve, no solo con el de pila.
      if (campo === "nombre")
        return [c.nombre, c.apellidos].filter(Boolean).join(" ");
      if (campo === "proximas") return extraDe(c.id).proximas.length;
      if (campo === "resenas") return extraDe(c.id).ratingMedio ?? 0;
      // Array: el filtro de lista casa si coincide CUALQUIERA de las etiquetas.
      if (campo === "etiquetas")
        return extraDe(c.id).etiquetas.map((e) => e.nombre);
      return (c as unknown as Record<string, unknown>)[campo];
    },
    [clasifDe, extraDe],
  );

  const filtrados = useMemo(() => {
    let lista = clientes.filter((c) => {
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.apellidos.toLowerCase().includes(q) ||
        c.telefono.includes(busqueda) ||
        c.email.toLowerCase().includes(q)
      );
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [clientes, busqueda, filtros, orden, acceso]);

  // Al buscar o filtrar se vuelve a la primera hoja: si estabas en la 7 y el
  // filtro deja 20 resultados, quedarte en la 7 enseña una tabla vacía.
  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtros]);

  /**
   * Paginación: 50 por hoja. Con la clientela de un restaurante la tabla
   * entera son miles de filas y el navegador se arrastra al pintarlas.
   */
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  /**
   * Página efectiva. Se acota en el render en vez de con un efecto: si al
   * filtrar quedan menos hojas de las que había, la página guardada se sale de
   * rango y la tabla se vería vacía hasta que el usuario tocara algo.
   */
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = useMemo(
    () =>
      filtrados.slice(
        (paginaActual - 1) * POR_PAGINA,
        paginaActual * POR_PAGINA,
      ),
    [filtrados, paginaActual],
  );

  /** Etiquetas realmente en uso, para el desplegable del filtro. */
  const opcionesEtiquetas = useMemo(() => {
    const set = new Set<string>();
    for (const e of Object.values(enriquecidos)) {
      for (const et of e.etiquetas) set.add(et.nombre);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [enriquecidos]);

  const handleNuevo = async () => {
    const res = await createCliente({ nombre: "Nuevo cliente" });
    if (res.ok) {
      toast.success("Cliente creado");
      loadClientes();
    } else {
      toast.error(res.error ?? "Error al crear cliente");
    }
  };

  const abrirFicha = (c: Cliente) => {
    setSelectedCliente(c);
    setBorrador({ ...c });
  };

  const cerrarFicha = () => {
    setSelectedCliente(null);
    setBorrador(null);
    // Las etiquetas se guardan solas mientras la ficha está abierta; al cerrar
    // se recarga para que la tabla refleje lo que se haya tocado.
    loadClientes();
  };

  const handleGuardarFicha = async () => {
    if (!borrador) return;
    setGuardando(true);
    try {
      const res = await guardarFichaCliente(borrador.id, {
        nombre: borrador.nombre,
        apellidos: borrador.apellidos,
        telefono: borrador.telefono,
        email: borrador.email,
        observaciones: borrador.observaciones,
        notasInternas: borrador.notasInternas,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Ficha guardada");
      cerrarFicha();
    } finally {
      setGuardando(false);
    }
  };

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Nombre", bloqueada: true },
    { campo: "telefono", label: "Teléfono" },
    { campo: "email", label: "Email" },
    { campo: "clasificacion", label: "Clasificación" },
    { campo: "etiquetas", label: "Etiquetas" },
    { campo: "proximas", label: "Próximas reservas" },
    { campo: "resenas", label: "Nota media" },
    { campo: "visitas", label: "Visitas" },
    { campo: "ultimaVisita", label: "Última visita" },
    { campo: "observaciones", label: "Observaciones" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (item: Cliente) => ReactNode }> = {
    nombre: {
      th: (
        <TableColumnHeader
          key="nombre"
          label="Nombre"
          campo="nombre"
          filtroTipo="texto"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => (
        <td key="nombre" className="p-3 font-medium">
          {[c.nombre, c.apellidos].filter(Boolean).join(" ")}
        </td>
      ),
    },
    telefono: {
      th: (
        <TableColumnHeader
          key="telefono"
          label="Teléfono"
          campo="telefono"
          filtroTipo="texto"
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (c) => <td key="telefono" className="p-3">{c.telefono || "—"}</td>,
    },
    email: {
      th: (
        <TableColumnHeader
          key="email"
          label="Email"
          campo="email"
          filtroTipo="texto"
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (c) => <td key="email" className="p-3">{c.email || "—"}</td>,
    },
    clasificacion: {
      th: (
        <TableColumnHeader
          key="clasificacion"
          label="Clasificación"
          campo="clasificacion"
          filtroTipo="lista"
          opciones={["VIP", "REGULAR", "NUEVO"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => {
        const clasif = clasifDe(c);
        return (
          <td key="clasificacion" className="p-3">
            <Badge className={clasificacionBadge[clasif]} variant="outline">
              {clasif}
            </Badge>
          </td>
        );
      },
    },
    etiquetas: {
      th: (
        <TableColumnHeader
          key="etiquetas"
          label="Etiquetas"
          campo="etiquetas"
          filtroTipo="lista"
          opciones={opcionesEtiquetas}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (c) => {
        const etiquetas = extraDe(c.id).etiquetas;
        return (
          <td key="etiquetas" className="p-3">
            {etiquetas.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {etiquetas.slice(0, 3).map((e) => (
                  <EtiquetaChip
                    key={e.id}
                    nombre={e.nombre}
                    emoji={e.emoji}
                    color={e.color}
                  />
                ))}
                {etiquetas.length > 3 && (
                  <span className="text-xs text-muted-foreground self-center">
                    +{etiquetas.length - 3}
                  </span>
                )}
              </span>
            )}
          </td>
        );
      },
    },
    proximas: {
      th: (
        <TableColumnHeader
          key="proximas"
          label="Próximas reservas"
          campo="proximas"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => {
        const proximas = extraDe(c.id).proximas;
        if (proximas.length === 0) {
          return (
            <td key="proximas" className="p-3 text-muted-foreground">—</td>
          );
        }
        const siguiente = proximas[0];
        return (
          <td key="proximas" className="p-3">
            <span className="font-medium">
              {fechaCorta(siguiente.fecha, siguiente.hora)}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {siguiente.personas}{" "}
              {siguiente.personas === 1 ? "persona" : "personas"}
            </span>
            {proximas.length > 1 && (
              <span className="ml-1 text-xs text-muted-foreground">
                (+{proximas.length - 1})
              </span>
            )}
          </td>
        );
      },
    },
    resenas: {
      th: (
        <TableColumnHeader
          key="resenas"
          label="Nota media"
          campo="resenas"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => {
        const { ratingMedio, resenas } = extraDe(c.id);
        if (ratingMedio === null) {
          return <td key="resenas" className="p-3 text-muted-foreground">—</td>;
        }
        return (
          <td key="resenas" className="p-3">
            <span className="inline-flex items-center gap-1.5">
              <Estrellas nota={ratingMedio} />
              <span className="font-medium">{formatNota(ratingMedio)}</span>
              {resenas.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  ({resenas.length})
                </span>
              )}
            </span>
          </td>
        );
      },
    },
    visitas: {
      th: (
        <TableColumnHeader
          key="visitas"
          label="Visitas"
          campo="visitas"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => <td key="visitas" className="p-3">{extraDe(c.id).visitas}</td>,
    },
    ultimaVisita: {
      th: (
        <TableColumnHeader
          key="ultimaVisita"
          label="Última visita"
          campo="ultimaVisita"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => {
        const ultima = extraDe(c.id).ultimaVisita;
        return (
          <td key="ultimaVisita" className="p-3">
            {ultima ? fechaCorta(ultima, "") : "—"}
          </td>
        );
      },
    },
    observaciones: {
      th: (
        <TableColumnHeader
          key="observaciones"
          label="Observaciones"
          campo="observaciones"
          filtroTipo="texto"
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (c) => (
        <td key="observaciones" className="p-3 text-muted-foreground truncate max-w-[200px]">{c.observaciones || "—"}</td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  const fichaExtra = borrador ? extraDe(borrador.id) : ENRIQUECIDO_VACIO;

  const clasifFicha = clasificacionEfectiva({
    visitas: fichaExtra.visitas,
    umbrales,
  });

  return (
    <div className="p-6 space-y-6 pb-28">
      {/* Toolbar estándar (BARRA HORIZONTAL 1) */}
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={handleNuevo}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <>
            <IOActions config={clientesIO} onSuccess={() => window.location.reload()} />
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

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40">
              {columnasRender.map((c) => columnDefs[c.campo]?.th)}
            </tr></thead>
            <tbody>
              {visibles.map(c => (
                <tr key={c.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => abrirFicha(c)}>
                  {columnasRender.map((col) => columnDefs[col.campo]?.td(c))}
                </tr>
              ))}
            </tbody>
          </table>

          {filtrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay clientes que coincidan.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-4 border-t px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {(paginaActual - 1) * POR_PAGINA + 1}–
                {Math.min(paginaActual * POR_PAGINA, filtrados.length)} de{" "}
                {filtrados.length}
              </span>
              {totalPaginas > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={paginaActual === 1}
                    onClick={() => setPagina(paginaActual - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="px-2 text-muted-foreground">
                    Hoja {paginaActual} de {totalPaginas}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={paginaActual === totalPaginas}
                    onClick={() => setPagina(paginaActual + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCliente} onOpenChange={(v) => { if (!v) cerrarFicha(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ficha de cliente</DialogTitle></DialogHeader>
          {borrador && (
            <div className="space-y-4 text-sm">
              <ClienteBloqueoTicketBanner clienteId={borrador.id} />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cli-nombre">Nombre</Label>
                  <Input
                    id="cli-nombre"
                    value={borrador.nombre}
                    onChange={(e) =>
                      setBorrador({ ...borrador, nombre: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cli-apellidos">Apellidos</Label>
                  <Input
                    id="cli-apellidos"
                    value={borrador.apellidos}
                    onChange={(e) =>
                      setBorrador({ ...borrador, apellidos: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cli-telefono">Teléfono</Label>
                  <Input
                    id="cli-telefono"
                    value={borrador.telefono}
                    onChange={(e) =>
                      setBorrador({ ...borrador, telefono: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cli-email">Email</Label>
                  <Input
                    id="cli-email"
                    type="email"
                    value={borrador.email}
                    onChange={(e) =>
                      setBorrador({ ...borrador, email: e.target.value })
                    }
                  />
                </div>
              </div>

              {/*
                Clasificación: dato CALCULADO por visitas, no editable. Antes se
                podía fijar a mano y acababa diciendo lo que hubiera puesto el
                último que tocó la ficha, no lo mismo para todos.
              */}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">Clasificación</Label>
                <div>
                  <Badge
                    className={clasificacionBadge[clasifFicha]}
                    variant="outline"
                  >
                    {clasifFicha}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se calcula sola por visitas: menos de {umbrales.regularMin} →
                  NUEVO · {umbrales.regularMin} → REGULAR · {umbrales.vipMin} →
                  VIP.
                </p>
              </div>

              {/*
                Visitas y última visita son datos CALCULADOS de las reservas,
                no campos que se guarden: por eso se muestran, no se editan.
              */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground">Visitas</Label>
                  <p>{fichaExtra.visitas}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Última visita</Label>
                  <p>
                    {fichaExtra.ultimaVisita
                      ? fechaLarga(fichaExtra.ultimaVisita)
                      : "—"}
                  </p>
                </div>
              </div>

              {/*
                Resumen de comportamiento: de sus N reservas, cuántas en cada
                estado. Es la lectura rápida de si un cliente cancela mucho o
                no se presenta, sin tener que contar la lista a mano.
              */}
              <div className="pt-2 border-t space-y-1.5">
                <Label className="text-muted-foreground">
                  Reservas por estado
                </Label>
                {fichaExtra.historico.length === 0 ? (
                  <p className="text-muted-foreground">Sin reservas todavía.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ESTADOS_RESERVA.filter(
                      (e) => (fichaExtra.porEstado[e] ?? 0) > 0,
                    ).map((e) => (
                      <span
                        key={e}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                      >
                        <span className={cn("h-2 w-2 rounded-full", ESTADO_DOT_CLASS[e])} />
                        <span className="text-muted-foreground">
                          {ESTADO_RESERVA_LABELS[e]}
                        </span>
                        <span className="font-medium">
                          {fichaExtra.porEstado[e]}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Próximas reservas del cliente */}
              <div className="pt-2 border-t space-y-1.5">
                <Label className="text-muted-foreground">Próximas reservas</Label>
                {fichaExtra.proximas.length === 0 ? (
                  <p className="text-muted-foreground">Sin reservas próximas.</p>
                ) : (
                  <ul className="space-y-1">
                    {fichaExtra.proximas.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span>
                          <span className="font-medium">{fechaLarga(r.fecha)}</span>
                          <span className="text-muted-foreground"> · {r.hora}</span>
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {r.personas} {r.personas === 1 ? "persona" : "personas"}
                          {r.zona ? ` · ${r.zona}` : ""}
                          {r.mesa ? ` · Mesa ${r.mesa}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/*
                Puntuaciones que este cliente nos ha dado por correo tras su
                visita. No tiene nada que ver con las reseñas públicas de
                Google, que son anónimas y no se pueden atribuir a una ficha.
              */}
              <div className="pt-2 border-t space-y-1.5">
                <Label className="text-muted-foreground">Nota media</Label>
                {fichaExtra.resenas.length === 0 ? (
                  <p className="text-muted-foreground">
                    Todavía no ha puntuado ninguna visita.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fichaExtra.ratingMedio !== null && (
                      <div className="flex items-center gap-2">
                        <Estrellas nota={fichaExtra.ratingMedio} size={15} />
                        <span className="font-medium">
                          {formatNota(fichaExtra.ratingMedio)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          media de {fichaExtra.resenas.length}{" "}
                          {fichaExtra.resenas.length === 1
                            ? "valoración"
                            : "valoraciones"}
                        </span>
                      </div>
                    )}
                    <ul className="space-y-1">
                      {fichaExtra.resenas.map((r) => {
                        // La nota de la valoración es la media de su desglose,
                        // igual que en el histórico y en la columna de la lista.
                        const nota = notaValoracion(r);
                        return (
                        <li key={r.id} className="rounded-md border px-3 py-2">
                          <div className="flex items-center gap-2">
                            {nota !== null && (
                              <>
                                <Estrellas nota={nota} />
                                <span className="font-medium">
                                  {formatNota(nota)}
                                </span>
                              </>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatFechaEnZona(r.fecha, zonaHoraria)}
                            </span>
                          </div>
                          {/* Desglose: dice QUÉ falló, no solo cuánto. */}
                          {(r.comida !== null ||
                            r.servicio !== null ||
                            r.ambiente !== null) && (
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                              {([
                                ["Comida", r.comida],
                                ["Servicio", r.servicio],
                                ["Ambiente", r.ambiente],
                              ] as const).map(([etiqueta, notaCat]) =>
                                notaCat === null ? null : (
                                  <span
                                    key={etiqueta}
                                    className="inline-flex items-center gap-1 text-xs"
                                  >
                                    <span className="text-muted-foreground">
                                      {etiqueta}
                                    </span>
                                    <Estrellas nota={notaCat} size={11} />
                                  </span>
                                ),
                              )}
                            </div>
                          )}
                          {r.comentario && (
                            <p className="mt-1 text-muted-foreground">
                              {r.comentario}
                            </p>
                          )}
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/*
                Histórico de peticiones: cuándo se le pidió opinión y si
                contestó. Sin esto, un cliente al que se le ha pedido cinco
                veces sin respuesta se ve igual que uno al que no se le pidió
                nunca.
              */}
              <div className="pt-2 border-t space-y-1.5">
                <Label className="text-muted-foreground">
                  Valoraciones solicitadas
                </Label>
                {fichaExtra.valoracionesSolicitadas.length === 0 ? (
                  <p className="text-muted-foreground">
                    Todavía no se le ha pedido ninguna valoración.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {fichaExtra.valoracionesSolicitadas.map((v) => {
                      const media = notaValoracion(v.resena);
                      return (
                        <li
                          key={v.id}
                          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                        >
                          <span className="text-xs text-muted-foreground">
                            Enviada el{" "}
                            {formatFechaEnZona(v.enviadoAt, zonaHoraria)}
                            {v.fechaVisita
                              ? ` · visita del ${fechaLarga(v.fechaVisita)}`
                              : ""}
                          </span>
                          {media === null ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              No ha contestado
                            </span>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1.5">
                              <Estrellas nota={media} />
                              <span className="font-medium">
                                {formatNota(media)}
                              </span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cli-observaciones">Observaciones</Label>
                <Textarea
                  id="cli-observaciones"
                  rows={2}
                  value={borrador.observaciones}
                  onChange={(e) =>
                    setBorrador({ ...borrador, observaciones: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cli-notas">Notas internas</Label>
                <Textarea
                  id="cli-notas"
                  rows={2}
                  value={borrador.notasInternas}
                  onChange={(e) =>
                    setBorrador({ ...borrador, notasInternas: e.target.value })
                  }
                />
              </div>

              {/*
                Histórico de reservas. Cada línea lleva al día de esa reserva en
                el plano de sala (`/sala/reservas?fecha=…`), que es donde se ve
                en su mesa y en su contexto.
              */}
              <div className="pt-2 border-t space-y-1.5">
                <Label className="text-muted-foreground">
                  Histórico de reservas
                </Label>
                {fichaExtra.historico.length === 0 ? (
                  <p className="text-muted-foreground">Sin reservas todavía.</p>
                ) : (
                  <ul className="space-y-1">
                    {fichaExtra.historico.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/sala/reservas?fecha=${r.fecha}${
                            r.turno ? `&turno=${r.turno}` : ""
                          }`}
                          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-muted/40 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                ESTADO_DOT_CLASS[r.estado as EstadoReserva],
                              )}
                            />
                            <span className="font-medium">
                              {fechaLarga(r.fecha)}
                            </span>
                            <span className="text-muted-foreground">
                              · {r.hora}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {ESTADO_RESERVA_LABELS[r.estado as EstadoReserva] ??
                              r.estado}
                            {" · "}
                            {r.personas}{" "}
                            {r.personas === 1 ? "persona" : "personas"}
                            {r.mesa ? ` · Mesa ${r.mesa}` : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-2 border-t space-y-1.5">
                <Label className="text-muted-foreground">Etiquetas</Label>
                {/*
                  Las etiquetas se guardan solas al pulsarlas, así que aquí NO
                  se recarga la lista: hacerlo con la ficha abierta dejaría el
                  borrador con datos viejos y al Guardar se pisarían las
                  correcciones que otra persona haya hecho entretanto. La lista
                  se refresca al cerrar la ficha.
                */}
                <EtiquetasPanel scope="cliente" entityId={borrador.id} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleGuardarFicha} disabled={guardando}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
