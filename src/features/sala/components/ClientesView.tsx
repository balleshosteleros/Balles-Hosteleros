"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useModuloDisponible } from "@/features/empresa/contexts/catalogo-empresa-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  estadoPermiso,
  ETIQUETA_PERMISO,
  type EstadoPermiso,
} from "@/features/marketing/lib/permiso-publicidad";
import { useSincronizacionEnVivo } from "@/shared/hooks/useSincronizacionEnVivo";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Link from "next/link";
import { CalendarDays, ChevronDown, Settings, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ESTADOS_RESERVA,
  ESTADO_DOT_CLASS,
  ESTADO_RESERVA_LABELS,
  origenLabel,
  zonaLabel,
  type EstadoReserva,
} from "@/features/sala/data/reservas";
import {
  colorOrigen,
  labelOrigen,
  normalizarOrigen,
  ORIGENES_CLIENTE,
} from "@/features/sala/data/origenes";
import { Button } from "@/components/ui/button";
import {
  PREFIJOS_TELEFONO,
  separarPrefijo,
  componerTelefono,
} from "@/features/sala/data/prefijos-telefono";
import { BanderaTelefono } from "@/features/sala/components/clientes/BanderaTelefono";
import { Cliente, ClasificacionCliente } from "@/features/sala/data/clientes";
import { listClientes } from "@/features/sala/actions/clientes-actions";
import { guardarFichaCliente } from "@/features/sala/actions/cliente-ficha-actions";
import { ActividadCliente } from "@/features/sala/components/clientes/ActividadCliente";
import { ComunicacionesCliente } from "@/features/sala/components/clientes/ComunicacionesCliente";
import { HistorialVisitasCliente } from "@/features/sala/components/clientes/HistorialVisitasCliente";
import { CalendarioClientes } from "@/features/sala/components/clientes/CalendarioClientes";
import { PipelinesCliente } from "@/features/producto/pipeline/components/PipelinesCliente";
import { AlumnoEnEscuela } from "@/features/escuela/components/admin/AlumnoEnEscuela";
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
import { friendlyError } from "@/shared/lib/friendly-errors";
import { formatearFechaEs } from "@/shared/lib/fecha";
import { ToolTooltip } from "@/components/ui/tool-tooltip";

/** Filas por hoja en la tabla de clientes. */
const POR_PAGINA = 50;

/**
 * Enlace a una reserva concreta en el plano de sala.
 *
 * Lleva tres cosas y las tres hacen falta: la FECHA abre ese día, el TURNO
 * evita que una reserva de comida quede fuera de pantalla con la lista puesta
 * en cena, y el ID hace que al llegar se abra su ficha. Sin el id se aterriza
 * en el día correcto y hay que buscarla a ojo entre las sesenta del turno.
 */
function enlaceReserva(fecha: string, turno: string | null, reservaId?: string): string {
  const partes = [`fecha=${fecha}`];
  if (turno) partes.push(`turno=${turno}`);
  if (reservaId) partes.push(`reserva=${reservaId}`);
  return `/sala/reservas?${partes.join("&")}`;
}

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
    fechaNacimiento: (row.fecha_nacimiento as string) ?? "",
    permisoEmail: estadoPermiso(row as never, "email"),
    permisoSms: estadoPermiso(row as never, "sms"),
    permisoWhatsapp: estadoPermiso(row as never, "whatsapp"),
    origen: (row.origen as string | null) ?? null,
    nombreWhatsapp: (row.nombre_whatsapp as string | null) ?? null,
  };
}

/**
 * Nombre para pintar en pantalla, o "Sin nombre" si la ficha no lo tiene.
 *
 * Hay clientes sin nombre a propósito: los que entraron por WhatsApp traían
 * como nombre lo que tuvieran en su perfil ("❤️", "S.", un punto), y eso se
 * descarta al importar. La celda en blanco parecía un error de carga; el
 * rótulo dice que el dato falta, que es la verdad.
 */
function nombreVisible(c: Cliente): { texto: string; falta: boolean } {
  const completo = [c.nombre, c.apellidos].filter(Boolean).join(" ").trim();
  return completo ? { texto: completo, falta: false } : { texto: "Sin nombre", falta: true };
}

/** "12 sept · 21:00" — corto para que quepa en la celda. */
function fechaCorta(fecha: string, hora: string): string {
  try {
    const d = new Date(`${fecha}T00:00:00`);
    const txt = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return hora ? `${txt} · ${hora}` : txt;
  } catch {
    return `${formatearFechaEs(fecha)} ${hora}`.trim();
  }
}

/**
 * Fecha corta CON año, para el histórico. `fechaLarga` no lo lleva, y un
 * histórico abarca varios años: "martes, 3 de marzo" no dice de cuál.
 */
function fechaConAnio(fecha: string): string {
  try {
    const d = new Date(`${fecha}T00:00:00`);
    return d.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return fecha;
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
  /** Pestaña abierta de la ficha. Siempre se entra por los datos. */
  const [tabFicha, setTabFicha] = useState<"datos" | "visitas" | "valoraciones">("datos");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Esta pantalla vive en dos módulos según la empresa: SALA en los
  // restaurantes y PRODUCTO en la matriz. Lo que dependa de Sala (volver al
  // plano de mesas) solo aplica donde Sala existe.
  const moduloDisponible = useModuloDisponible();
  const haySala = moduloDisponible("SALA");
  const [showConfig, setShowConfig] = useState(false);
  /** Calendario de cumpleaños y visitas: se abre desde la barra de herramientas. */
  const [showCalendario, setShowCalendario] = useState(false);
  const { empresaActual } = useEmpresa();
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
    } catch (err) {
      toast.error("Error de conexion al cargar clientes", { description: friendlyError(err, "ClientesView") });
    }
  }, []);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  // Sincronizacion en vivo: la ficha de un cliente se actualiza sola cuando otro
  // la edita o llega una reserva suya. Se pausa con la ficha abierta.
  useSincronizacionEnVivo({
    tablas: ["clientes_sala", "reservas"],
    onCambio: () => void loadClientes(),
    pausado: !!selectedCliente,
  });

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
      // Por la etiqueta visible ("Sin preguntar"), no por la clave interna: se
      // filtra por lo que se lee en la columna.
      if (campo === "permisoEmail") return ETIQUETA_PERMISO[c.permisoEmail ?? "sin_preguntar"];
      if (campo === "permisoSms") return ETIQUETA_PERMISO[c.permisoSms ?? "sin_preguntar"];
      if (campo === "permisoWhatsapp")
        return ETIQUETA_PERMISO[c.permisoWhatsapp ?? "sin_preguntar"];
      if (campo === "reservas") return extraDe(c.id).historico.length;
      if (campo === "visitas") return extraDe(c.id).visitas;
      if (campo === "ultimaVisita") return extraDe(c.id).ultimaVisita ?? "";
      // Nombre completo: la columna pinta nombre + apellidos, así que filtrar
      // por "nombre" tiene que casar con lo que se ve, no solo con el de pila.
      if (campo === "nombre")
        return [c.nombre, c.apellidos].filter(Boolean).join(" ");
      // Se filtra y se ordena por la etiqueta que se VE ("Walk-in"), no por la
      // clave cruda que hay en la base ("WALKIN").
      if (campo === "origen") return origenLabel(c.origen);
      if (campo === "proximas") return extraDe(c.id).proximas.length;
      if (campo === "resenas") return extraDe(c.id).ratingMedio ?? 0;
      // "¿Ha valorado?" en palabras, no en número: es lo que se filtra para
      // sacar la lista de a quién se le pidió opinión y no contestó. A todo el
      // mundo se le pide, por correo si reservó o por WhatsApp si entró por ahí,
      // así que no tener valoración es exactamente no haber contestado.
      if (campo === "valorada")
        return extraDe(c.id).resenas.length > 0 ? "Sí" : "No";
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

  /** Canales por los que ha entrado gente de verdad, para el filtro. */
  const opcionesOrigen = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientes) set.add(origenLabel(c.origen));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [clientes]);

  /**
   * Canales del desplegable de la ficha: los habituales más los que ya estén
   * en uso en la base. Si solo se ofrecieran los habituales, abrir una ficha
   * cuyo origen es una campaña vieja y guardar se lo llevaría por delante.
   */
  const opcionesOrigenFicha = useMemo(() => {
    const set = new Set<string>(ORIGENES_CLIENTE);
    for (const c of clientes) {
      if (c.origen) set.add(normalizarOrigen(c.origen));
    }
    return Array.from(set).sort((a, b) =>
      labelOrigen(a).localeCompare(labelOrigen(b), "es"),
    );
  }, [clientes]);

  /** Etiquetas realmente en uso, para el desplegable del filtro. */
  const opcionesEtiquetas = useMemo(() => {
    const set = new Set<string>();
    for (const e of Object.values(enriquecidos)) {
      for (const et of e.etiquetas) set.add(et.nombre);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [enriquecidos]);

  const abrirFicha = useCallback((c: Cliente) => {
    setSelectedCliente(c);
    setBorrador({ ...c });
  }, []);

  /**
   * Ficha pedida por URL (`?cliente=<id>`). Es como se llega aquí desde el
   * listado de reservas de la pantalla de Sala al pulsar el nombre: la ficha se
   * abre sola en cuanto la lista de clientes está cargada, sin que el usuario
   * tenga que buscar a esa persona en la tabla.
   */
  const clientePedido = searchParams?.get("cliente") ?? null;
  useEffect(() => {
    if (!clientePedido || clientes.length === 0) return;
    // Si ya está abierta la que pide la URL no se toca: reabrirla en cada
    // render tiraría lo que el usuario estuviera escribiendo en la ficha.
    if (selectedCliente?.id === clientePedido) return;
    const c = clientes.find((x) => x.id === clientePedido);
    if (c) abrirFicha(c);
    // `selectedCliente` queda fuera a propósito: solo hay que reaccionar a que
    // cambie la URL o a que acaben de llegar los clientes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientePedido, clientes, abrirFicha]);

  const cerrarFicha = useCallback(() => {
    setSelectedCliente(null);
    setBorrador(null);
    // Si no, la siguiente ficha se abriría en la pestaña que dejó la anterior.
    setTabFicha("datos");
    // Se llega aquí desde Sala con `?cliente=<id>`. Si el parámetro se queda en
    // la URL, el efecto que abre la ficha pedida vuelve a dispararse y la
    // reabre: cerrarla resultaba imposible. Se limpia para que cerrar sea
    // cerrar de verdad.
    if (searchParams?.get("cliente")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("cliente");
      const qs = params.toString();
      // Sobre la RUTA ACTUAL, no sobre "/sala/clientes": esta misma pantalla
      // vive también en /producto/clientes (empresa matriz), y cerrar una ficha
      // allí no puede echar al usuario al módulo de Sala.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    // Las etiquetas se guardan solas mientras la ficha está abierta; al cerrar
    // se recarga para que la tabla refleje lo que se haya tocado.
    loadClientes();
  }, [searchParams, router, pathname, loadClientes]);

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
        fechaNacimiento: borrador.fechaNacimiento || null,
        // Los que están de baja NO se mandan: esa decisión es del cliente y se
        // queda como está, mande lo que mande esta pantalla.
        ...(borrador.permisoEmail !== "baja"
          ? { permisoEmail: borrador.permisoEmail ?? "sin_preguntar" }
          : {}),
        ...(borrador.permisoSms !== "baja"
          ? { permisoSms: borrador.permisoSms ?? "sin_preguntar" }
          : {}),
        ...(borrador.permisoWhatsapp !== "baja"
          ? { permisoWhatsapp: borrador.permisoWhatsapp ?? "sin_preguntar" }
          : {}),
        origen: borrador.origen || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Ficha guardada");
      // Guardar cierra y devuelve al plano: se entra aquí desde Sala para
      // arreglar un dato del cliente, y lo que se quiere después es volver a
      // las mesas, no quedarse en la tabla de clientes ni tener que buscar la X.
      // En una empresa sin Sala (la matriz) no hay plano al que volver: se cierra
      // la ficha y se queda en la lista.
      setSelectedCliente(null);
      setBorrador(null);
      setTabFicha("datos");
      if (haySala) router.push("/sala/reservas");
    } finally {
      setGuardando(false);
    }
  };

  /**
   * El color dice lo que hay que hacer con cada uno: verde se le puede escribir,
   * gris está pendiente de que alguien le pregunte, rojo no se le vuelve a
   * escribir nunca.
   */
  const permisoBadge: Record<EstadoPermiso, string> = {
    acepta: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30",
    sin_preguntar: "bg-muted text-muted-foreground border-border",
    baja: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/30",
  };

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Nombre", bloqueada: true },
    { campo: "telefono", label: "Teléfono" },
    { campo: "email", label: "Email" },
    { campo: "origen", label: "Origen" },
    { campo: "clasificacion", label: "Clasificación" },
    { campo: "etiquetas", label: "Etiquetas" },
    { campo: "proximas", label: "Próximas reservas" },
    { campo: "resenas", label: "Nota media" },
    { campo: "valorada", label: "Valorada" },
    { campo: "reservas", label: "Reservas" },
    { campo: "visitas", label: "Visitas" },
    { campo: "ultimaVisita", label: "Última visita" },
    { campo: "permisoEmail", label: "Publicidad" },
    { campo: "permisoSms", label: "Publicidad SMS" },
    { campo: "permisoWhatsapp", label: "Publicidad WhatsApp" },
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
      td: (c) => {
        const n = nombreVisible(c);
        return (
          <td key="nombre" className="p-3">
            <span
              className={cn(
                "font-medium",
                n.falta && "font-normal italic text-muted-foreground",
              )}
            >
              {n.texto}
            </span>
            {/* Sin nombre, lo único que identifica a esa persona es como se
                llama en WhatsApp: es lo que verá quien abra el chat. */}
            {n.falta && c.nombreWhatsapp && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {c.nombreWhatsapp}
              </span>
            )}
          </td>
        );
      },
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
      td: (c) => (
        <td key="telefono" className="p-3">
          {c.telefono ? (
            <span className="inline-flex items-center gap-1.5">
              {/* Bandera del país: de un vistazo se ve quién es de fuera. */}
              <BanderaTelefono telefono={c.telefono} />
              <span className="tabular-nums">{c.telefono}</span>
            </span>
          ) : (
            "—"
          )}
        </td>
      ),
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
    origen: {
      th: (
        <TableColumnHeader
          key="origen"
          label="Origen"
          campo="origen"
          filtroTipo="lista"
          opciones={opcionesOrigen}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => {
        const clave = normalizarOrigen(c.origen);
        return (
          <td key="origen" className="p-3 whitespace-nowrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                !c.origen && "text-muted-foreground",
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorOrigen(clave) }}
              />
              {labelOrigen(clave)}
            </span>
          </td>
        );
      },
    },
    permisoEmail: {
      th: (
        <TableColumnHeader
          key="permisoEmail"
          label="Publicidad"
          campo="permisoEmail"
          filtroTipo="lista"
          opciones={["Acepta", "Sin preguntar", "Baja"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => {
        const estado = c.permisoEmail ?? "sin_preguntar";
        return (
          <td key="permisoEmail" className="p-3">
            <Badge className={permisoBadge[estado]} variant="outline">
              {ETIQUETA_PERMISO[estado]}
            </Badge>
          </td>
        );
      },
    },
    permisoSms: {
      th: (
        <TableColumnHeader
          key="permisoSms"
          label="Publicidad SMS"
          campo="permisoSms"
          filtroTipo="lista"
          opciones={["Acepta", "Sin preguntar", "Baja"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => {
        const estado = c.permisoSms ?? "sin_preguntar";
        return (
          <td key="permisoSms" className="p-3">
            <Badge className={permisoBadge[estado]} variant="outline">
              {ETIQUETA_PERMISO[estado]}
            </Badge>
          </td>
        );
      },
    },
    permisoWhatsapp: {
      th: (
        <TableColumnHeader
          key="permisoWhatsapp"
          label="Publicidad WhatsApp"
          campo="permisoWhatsapp"
          filtroTipo="lista"
          opciones={["Acepta", "Sin preguntar", "Baja"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => {
        const estado = c.permisoWhatsapp ?? "sin_preguntar";
        return (
          <td key="permisoWhatsapp" className="p-3">
            <Badge className={permisoBadge[estado]} variant="outline">
              {ETIQUETA_PERMISO[estado]}
            </Badge>
          </td>
        );
      },
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
            {/*
              Cuántas reservas MÁS tiene, no más comensales. Como "(+1)" pegado
              al número de personas se leía "15 personas y una más", va con la
              palabra entera y en su propia línea, lejos del recuento de gente.
            */}
            {proximas.length > 1 && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                + {proximas.length - 1}{" "}
                {proximas.length - 1 === 1
                  ? "reserva más"
                  : "reservas más"}
              </span>
            )}
          </td>
        );
      },
    },
    valorada: {
      th: (
        <TableColumnHeader
          key="valorada"
          label="Valorada"
          campo="valorada"
          filtroTipo="lista"
          opciones={["Sí", "No"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => {
        const valorada = extraDe(c.id).resenas.length > 0;
        return (
          <td key="valorada" className="p-3">
            <span
              className={cn(
                "text-xs",
                valorada ? "text-emerald-700" : "text-muted-foreground",
              )}
            >
              {valorada ? "Sí" : "No"}
            </span>
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
    reservas: {
      th: (
        <TableColumnHeader
          key="reservas"
          label="Reservas"
          campo="reservas"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      // Todas sus reservas, sin filtrar por estado ni por fecha: es el total
      // de veces que ha reservado, venga o no.
      td: (c) => (
        <td key="reservas" className="p-3">{extraDe(c.id).historico.length}</td>
      ),
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

  /** El desplegable de reservas de la ficha, plegado por defecto. */
  const [reservasAbiertas, setReservasAbiertas] = useState(false);

  /**
   * Las reservas del cliente ordenadas como se buscan: primero las que aún no
   * han pasado —de la más próxima a la más lejana, que es la pregunta con
   * prisa: "¿cuándo vuelve?"— y debajo las anteriores, de la más reciente a la
   * más antigua.
   *
   * "Aún no ha pasado" se decide contra el día de HOY en la zona de la EMPRESA,
   * no la del navegador: a las 01:00 de Indonesia en el restaurante todavía es
   * la tarde anterior, y la reserva de esta noche se habría pintado como
   * pasada.
   */
  const reservasDeLaFicha = useMemo(() => {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: zonaHoraria });
    const proximas = fichaExtra.historico
      .filter((r) => r.fecha >= hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
    const pasadas = fichaExtra.historico
      .filter((r) => r.fecha < hoy)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora));
    return {
      proximas,
      todas: [
        ...proximas.map((r) => ({ ...r, esProxima: true })),
        ...pasadas.map((r) => ({ ...r, esProxima: false })),
      ],
    };
  }, [fichaExtra.historico, zonaHoraria]);

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
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <>
            {/* Discreto a propósito: se consulta de vez en cuando, no es una
                acción del día a día. Icono suelto, sin texto ni contador, para
                no romper la barra (BARRA HORIZONTAL 1). */}
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setShowCalendario(true)}
              title="Calendario de cumpleaños y visitas"
              aria-label="Calendario de cumpleaños y visitas"
            >
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
            </Button>
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

      <CalendarioClientes
        abierto={showCalendario}
        onClose={() => setShowCalendario(false)}
        color={empresaActual.color}
        zonaHoraria={zonaHoraria}
        onAbrirCliente={(id) => {
          const c = clientes.find((x) => x.id === id);
          if (!c) return;
          setShowCalendario(false);
          abrirFicha(c);
        }}
      />

      <Card>
        <CardContent className="p-0">
          <table data-tabla-consulta className="w-full text-sm">
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
              {/*
                La ficha se lee en dos partes: los DATOS del cliente y lo que ha
                valorado. Antes era una sola columna larguísima y las valoraciones
                quedaban enterradas bajo el histórico de reservas.
              */}
              <Tabs
                value={tabFicha}
                onValueChange={(v) => setTabFicha(v as "datos" | "visitas" | "valoraciones")}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="datos">Datos</TabsTrigger>
                  <TabsTrigger value="visitas">
                    Reservas
                    {borrador.visitas > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {borrador.visitas}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="valoraciones">
                    Valoraciones
                    {fichaExtra.resenas.length > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {fichaExtra.resenas.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="datos" className="mt-4 space-y-4">

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
                    {/* Como se llama en WhatsApp. No se edita: es lo que tiene
                        puesto el cliente en su perfil, no una opinión nuestra.
                        Se enseña para poder encontrarle en el chat, y porque
                        cuando el nombre está vacío es lo único que hay. */}
                    {borrador.nombreWhatsapp &&
                      borrador.nombreWhatsapp !== borrador.nombre && (
                        <p className="text-xs text-muted-foreground">
                          En WhatsApp: {borrador.nombreWhatsapp}
                        </p>
                      )}
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
                    <Label htmlFor="cli-telefono" className="flex items-center gap-1.5">
                    Teléfono
                    {/* Solo la bandera, sin el nombre del país: el prefijo va
                        justo debajo en su selector y decía lo mismo dos
                        veces. */}
                    <BanderaTelefono telefono={borrador.telefono} />
                  </Label>
                    {/* Prefijo pegado al número y elegido de una lista: antes era
                        un campo suelto y a mano, así que la mitad de las fichas
                        se quedaban sin él o con un valor inventado. */}
                    <div className="flex gap-1.5">
                      <ToolTooltip label={
                          PREFIJOS_TELEFONO.find(
                            (x) => x.prefijo === separarPrefijo(borrador.telefono).prefijo,
                          )?.label ?? ""
                        }>
                        <select
                          value={separarPrefijo(borrador.telefono).prefijo}
                          onChange={(e) =>
                            setBorrador({
                              ...borrador,
                              telefono: componerTelefono(
                                e.target.value,
                                separarPrefijo(borrador.telefono).numero,
                              ),
                            })
                          }
                          className="h-9 w-[96px] shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {PREFIJOS_TELEFONO.map((x) => (
                            <option key={x.prefijo} value={x.prefijo}>
                              {x.flag} {x.prefijo}
                            </option>
                          ))}
                        </select>
                      </ToolTooltip>
                      <Input
                        id="cli-telefono"
                        type="tel"
                        className="flex-1"
                        value={separarPrefijo(borrador.telefono).numero}
                        onChange={(e) =>
                          setBorrador({
                            ...borrador,
                            telefono: componerTelefono(
                              separarPrefijo(borrador.telefono).prefijo,
                              e.target.value,
                            ),
                          })
                        }
                      />
                    </div>
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
                  <div className="space-y-1.5">
                    <Label htmlFor="cli-nacimiento">Fecha de nacimiento</Label>
                    <Input
                      id="cli-nacimiento"
                      type="date"
                      value={borrador.fechaNacimiento ?? ""}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setBorrador({ ...borrador, fechaNacimiento: e.target.value })
                      }
                    />
                  </div>
                  {/*
                    Origen: por dónde nos dejó sus datos la PRIMERA vez. No es el
                    canal de sus reservas —hay quien escribe por WhatsApp y no
                    reserva nunca—, por eso se guarda en la ficha y no se deduce.
                    "Sin dato" es una opción real: no hay que rellenarlo a la
                    fuerza inventando un canal.
                  */}
                  <div className="space-y-1.5">
                    <Label htmlFor="cli-origen">Origen</Label>
                    <select
                      id="cli-origen"
                      value={borrador.origen ?? ""}
                      onChange={(e) =>
                        setBorrador({ ...borrador, origen: e.target.value || null })
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Sin dato</option>
                      {opcionesOrigenFicha.map((clave) => (
                        <option key={clave} value={clave}>
                          {labelOrigen(clave)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/*
                  Permiso de publicidad, uno por canal. Lo normal es que alguien
                  quiera los correos y no que le escriban al móvil, así que un
                  solo interruptor para los tres decidía por él.

                  Quien pidió la baja aparece bloqueado: retirarlo lo puede hacer
                  cualquiera desde aquí, pero volver a activarlo tendría que
                  pedirlo el cliente, y esta pantalla no puede demostrar que lo
                  pidió. Se marca en rojo para que se vea por qué no se toca.
                */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Publicidad</Label>
                  {([
                    ["email", "permisoEmail", "Correo"],
                    ["sms", "permisoSms", "SMS"],
                    ["whatsapp", "permisoWhatsapp", "WhatsApp"],
                  ] as const).map(([canal, campo, etiqueta]) => {
                    const estado = borrador[campo] ?? "sin_preguntar";
                    const esBaja = estado === "baja";
                    return (
                      <ToolTooltip key={canal} label={esBaja ? "Pidió no recibir más: solo él puede volver a darse de alta" : undefined}>
                        <label
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            disabled={esBaja}
                            checked={estado === "acepta"}
                            onChange={(e) =>
                              setBorrador({
                                ...borrador,
                                [campo]: e.target.checked ? "acepta" : "sin_preguntar",
                              })
                            }
                          />
                          <span className={esBaja ? "text-red-600 dark:text-red-400" : undefined}>
                            {etiqueta}
                            {esBaja ? " — se dio de baja" : ""}
                          </span>
                        </label>
                      </ToolTooltip>
                    );
                  })}
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
                </div>

                {/*
                  Visitas y última visita son datos CALCULADOS de las reservas,
                  no campos que se guarden: por eso se muestran, no se editan.
                */}
                <div className="grid grid-cols-2 gap-3">
                  {/*
                    Reservas: TODAS las que ha hecho, sea cual sea su estado
                    (futuras, canceladas, no-show incluidas). Es el dato que
                    responde "¿cuántas veces ha reservado?", distinto de las
                    visitas, que solo cuentan las que acabó cumpliendo. Sin él,
                    una ficha recién creada con dos reservas para esta noche
                    salía con un 0 que parecía un fallo.
                  */}
                  <div>
                    <Label className="text-muted-foreground">Reservas</Label>
                    <p>{fichaExtra.historico.length}</p>
                  </div>
                  <div>
                    {/*
                      "Ya vino": las reservas PASADAS a las que asistió. El
                      recuadro de estados cuenta todas, incluidas las futuras, así
                      que 5 confirmadas pueden ser 4 visitas + 1 por venir. Sin
                      esta aclaración en el título, la diferencia parece un fallo.
                    */}
                    <Label className="text-muted-foreground">
                      Visitas (ya vino)
                    </Label>
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
                  {/*
                    La nota que nos ha puesto, resumida. El detalle de cada
                    valoración vive en su pestaña: aquí solo se ve cómo nos
                    valora y se entra a leerlo.
                  */}
                  <div>
                    <Label className="text-muted-foreground">Nota media</Label>
                    {fichaExtra.ratingMedio === null ? (
                      <p className="text-muted-foreground">Sin valoraciones</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTabFicha("valoraciones")}
                        className="flex items-center gap-1.5 text-left hover:underline"
                      >
                        <Estrellas nota={fichaExtra.ratingMedio} size={13} />
                        <span className="font-medium">
                          {formatNota(fichaExtra.ratingMedio)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({fichaExtra.resenas.length})
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/*
                  Resumen de comportamiento: de sus N reservas, cuántas en cada
                  estado. Es la lectura rápida de si un cliente cancela mucho o
                  no se presenta, sin tener que contar la lista a mano.
                */}
                <div className="pt-2 border-t space-y-1.5">
                  <Label className="text-muted-foreground">
                    Reservas por estado (todas, también las futuras)
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
                  RESERVAS del cliente: TODAS en un solo desplegable, en
                  cualquier estado. Primero las que aún no han pasado —que es lo
                  que se mira con prisa— y debajo las anteriores, de la más
                  reciente a la más antigua.

                  Va plegado y con el número en la cabecera: un habitual acumula
                  cientos y desplegadas empujaban fuera de pantalla las
                  etiquetas y el botón de guardar. En columnas y no en línea
                  corrida porque así se lee en vertical: se ve de un vistazo
                  cuántas canceló o por qué canal reserva siempre.

                  Cada fila abre ESA reserva en el plano de sala, en su día y su
                  turno, con su ficha ya abierta.
                */}
                <div className="pt-2 border-t space-y-1.5">
                  <Collapsible
                    open={reservasAbiertas}
                    onOpenChange={setReservasAbiertas}
                    className="space-y-1.5"
                  >
                    <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span>Reservas</span>
                      {fichaExtra.historico.length > 0 && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                          {fichaExtra.historico.length}
                        </span>
                      )}
                      {reservasDeLaFicha.proximas.length > 0 && (
                        <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                          {reservasDeLaFicha.proximas.length}{" "}
                          {reservasDeLaFicha.proximas.length === 1
                            ? "próxima"
                            : "próximas"}
                        </span>
                      )}
                      <ChevronDown
                        className={cn(
                          "ml-auto h-3.5 w-3.5 shrink-0 transition-transform",
                          reservasAbiertas && "rotate-180",
                        )}
                      />
                    </CollapsibleTrigger>
                  <CollapsibleContent>
                  {fichaExtra.historico.length === 0 ? (
                    <p className="text-muted-foreground">Sin reservas todavía.</p>
                  ) : (
                    /*
                      Alto acotado con scroll propio: un cliente habitual acumula
                      cientos de reservas y sin tope empujan fuera de pantalla lo
                      que hay debajo (etiquetas, botón de guardar).
                    */
                    <div className="max-h-72 overflow-y-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                          <tr className="text-left text-muted-foreground">
                            <th className="px-2 py-1.5 font-medium">Fecha</th>
                            <th className="px-2 py-1.5 font-medium">Hora</th>
                            <th className="px-2 py-1.5 font-medium">Estado</th>
                            <th className="px-2 py-1.5 text-right font-medium">
                              Per
                            </th>
                            <th className="px-2 py-1.5 font-medium">Mesa</th>
                            <th className="px-2 py-1.5 font-medium">Zona</th>
                            <th className="px-2 py-1.5 font-medium">Canal</th>
                            <th className="px-2 py-1.5 font-medium">Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reservasDeLaFicha.todas.map((r) => (
                            <tr
                              key={r.id}
                              className={cn(
                                "border-t transition-colors hover:bg-muted/40",
                                // Las que aún no han pasado, marcadas: son las
                                // que se buscan con prisa.
                                r.esProxima && "bg-emerald-500/[0.07]",
                              )}
                            >
                              {/*
                                El enlace va dentro de la primera celda: envolver
                                el <tr> entero en un <a> no es HTML válido dentro
                                de una tabla y el navegador lo saca de sitio.
                              */}
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <ToolTooltip label="Abrir esta reserva en el plano de sala">
                                  <Link
                                    href={enlaceReserva(r.fecha, r.turno, r.id)}
                                    className="font-medium hover:underline"
                                  >
                                    {fechaConAnio(r.fecha)}
                                  </Link>
                                </ToolTooltip>
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                                {r.hora || "—"}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "h-2 w-2 shrink-0 rounded-full",
                                      ESTADO_DOT_CLASS[r.estado as EstadoReserva],
                                    )}
                                  />
                                  {ESTADO_RESERVA_LABELS[
                                    r.estado as EstadoReserva
                                  ] ?? r.estado}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {r.personas || "—"}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                                {r.mesa || "—"}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                                {zonaLabel(r.zona)}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                                {origenLabel(r.origen)}
                              </td>
                              <ToolTooltip label={r.notas ?? undefined}>
                                <td
                                  className="max-w-[16rem] truncate px-2 py-1.5 text-muted-foreground"
                                >
                                  {r.notas || "—"}
                                </td>
                              </ToolTooltip>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  </CollapsibleContent>
                  </Collapsible>
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

                {/* En qué pipelines está. La ficha es UNA y las tarjetas son
                    muchas, igual que las reservas: quien contrata Ágora y
                    Sesame es la misma persona con dos tarjetas, no dos fichas.
                    Solo en la MATRIZ: el pipeline es el comercial del propio
                    software. */}
                <div className="pt-2 border-t empty:hidden">
                  <PipelinesCliente clienteId={borrador.id} />
                </div>

                {/* Si además es alumno de la escuela, el enlace a su ficha de
                    alumno. Misma persona, dos fichas, y desde aquí se llega a
                    la otra. Solo en la MATRIZ: la escuela es del software. */}
                <div className="pt-2 border-t empty:hidden">
                  <AlumnoEnEscuela clienteId={borrador.id} />
                </div>

                {/* Actividad DEL CLIENTE: los cambios de sus datos de contacto,
                    se hayan hecho aquí o desde cualquiera de sus reservas. La
                    actividad de cada reserva va en su propia ficha. */}
                <div className="pt-2 border-t">
                  <ActividadCliente clienteId={borrador.id} />
                </div>

                {/* Comunicaciones DEL CLIENTE: las campañas que se le han
                    mandado a él. Es la misma caja que sale en la ficha de
                    cualquiera de sus reservas: la ficha de un cliente se lee
                    igual venga de donde venga. */}
                <div className="pt-2 border-t">
                  <ComunicacionesCliente clienteId={borrador.id} />
                </div>
                </TabsContent>

                <TabsContent value="visitas" className="mt-4 space-y-4">
                {/*
                  Todas las veces que ha reservado, con lo que pasó de verdad:
                  si vino, si canceló o si dejó la mesa vacía. Incluye el
                  histórico traído de CoverManager, que son reservas que nunca
                  existieron en este sistema.
                */}
                <HistorialVisitasCliente clienteId={borrador.id} zonaHoraria={zonaHoraria} />
                </TabsContent>

                <TabsContent value="valoraciones" className="mt-4 space-y-4">
                {/*
                  Puntuaciones que este cliente nos ha dado por correo tras su
                  visita. No tiene nada que ver con las reseñas públicas de
                  Google, que son anónimas y no se pueden atribuir a una ficha.
                */}
                <div className="space-y-1.5">
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
                          const tieneDetalle =
                            r.comida !== null ||
                            r.servicio !== null ||
                            r.ambiente !== null ||
                            Boolean(r.comentario);
                          return (
                          <li key={r.id}>
                            {/*
                              Cada valoración se despliega: en la lista solo se
                              ve la nota y la fecha, y se abre la que interese.
                              Un cliente con veinte visitas llenaba la pestaña
                              entera de texto.
                            */}
                            <details className="group rounded-md border px-3 py-2">
                              <summary
                                className={cn(
                                  "flex items-center gap-2",
                                  tieneDetalle
                                    ? "cursor-pointer"
                                    : "cursor-default list-none",
                                )}
                              >
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
                                {tieneDetalle && (
                                  <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
                                    Ver detalle
                                  </span>
                                )}
                              </summary>
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
                            </details>
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

                </TabsContent>
              </Tabs>
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
