"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useSincronizacionEnVivo } from "@/shared/hooks/useSincronizacionEnVivo";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  formatFechaHoraEnZona,
  formatHoraEnZona,
  claveDiaEnZona,
  zonaLocalAUtcISO,
  ZONA_HORARIA_FALLBACK,
} from "@/features/empresa/lib/zona-horaria";
import { useAuth } from "@/features/auth/contexts/auth-context";
import {
  type Comunicado,
  ESTADO_COMUNICADO_LABELS,
  RECURRENCIA_LABELS,
  type EstadoComunicado,
  type Recurrencia,
  TIPOS_COMUNICADO,
  TIPO_COMUNICADO_LABEL,
  TIPO_COMUNICADO_COLOR,
  tipoComunicado,
  type TipoComunicado,
} from "@/features/rrhh/data/comunicados";
import {
  listComunicados,
  createComunicado,
  updateComunicado,
  cambiarEstadoComunicado,
  enviarCorreoComunicado,
  duplicarComunicado,
  deleteComunicado,
  listEmpleadosParaComunicado,
  crearUrlsSubidaComunicado,
  type EmpleadoSelector,
  type LecturaComunicado,
} from "@/features/gerencia/actions/comunicados-actions";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/shared/components/ui/hover-card";
import { createClient as createSupabaseBrowser } from "@/lib/supabase/client";
import {
  BUCKET_COMUNICADOS,
  MAX_ADJUNTOS_COMUNICADO,
  tamanoLegible,
  urlAdjuntoComunicado,
  type ComunicadoAdjunto,
} from "@/features/gerencia/data/comunicados-adjuntos";
import {
  MAX_DOCUMENTO_BYTES,
  MAX_DOCUMENTO_MB,
  mensajeDocumentoDemasiadoGrande,
  traducirErrorSubida,
} from "@/shared/lib/documentos";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarDays, MoreHorizontal, Eye, Clock, Archive,
  Trash2, FileText, Users, ArrowLeft, Send, Upload, X, Bell, Mail, Paperclip,
  ChevronLeft, ChevronRight, ChevronDown, Settings, ShieldAlert, Link as LinkIcon, Copy,
} from "lucide-react";
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
import { IOActions } from "@/shared/io";
import { comunicadosIO } from "@/features/gerencia/io/comunicados.io";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { ValidacionFaltantesDialog } from "@/features/ajustes/components/ValidacionFaltantesDialog";
import { SancionDisciplinariaView } from "@/features/gerencia/components/SancionDisciplinariaView";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { getOpcionesSegmento } from "@/features/notificaciones/actions/aviso-manual-actions";
import { ComunicadoTarjeta } from "@/features/gerencia/components/ComunicadoTarjeta";

/** Letra y trazo del menú de acciones: los mismos en todas sus opciones. */
const ITEM_MENU = "cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold tracking-tight";
const ICONO_MENU = "h-4 w-4";

function EstadoBadge({ estado }: { estado: EstadoComunicado }) {
  const colors: Record<EstadoComunicado, string> = {
    borrador: "bg-muted text-muted-foreground",
    programado: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    publicado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    archivado: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };
  return <Badge className={`${colors[estado]} border-0 font-medium`}>{ESTADO_COMUNICADO_LABELS[estado]}</Badge>;
}

/**
 * El alcance del comunicado y, al ponerse delante, QUIÉN lo ha abierto y cuándo.
 *
 * El porcentaje solo decía "59 %" y no servía para perseguir a nadie: lo que
 * hace falta es el nombre y el día y la hora a la que lo abrió (Iván,
 * 11-09-2026). Los que aún no lo han abierto salen detrás, para verlos de un
 * vistazo sin abrir nada.
 */
function AlcanceCircle({
  pct,
  lecturas,
  tz,
}: {
  pct: number;
  lecturas: LecturaComunicado[];
  tz: string;
}) {
  const r = 16, c = 2 * Math.PI * r;
  const color = pct >= 80 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-muted-foreground";
  const rueda = (
    <div className="flex items-center gap-2">
      <svg width="40" height="40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="3" className={color}
          strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="text-sm font-medium">{pct}%</span>
    </div>
  );

  if (lecturas.length === 0) return rueda;

  const abiertos = lecturas.filter(l => l.vistaAt);
  const pendientes = lecturas.filter(l => !l.vistaAt);

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className="cursor-default">{rueda}</div>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-xs font-semibold">
          Lo han abierto {abiertos.length} de {lecturas.length}
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {abiertos.map((l, i) => (
            <div key={`v-${i}`} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs">
              <span className="truncate">{l.nombre}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatFechaHoraEnZona(l.vistaAt, tz)}
              </span>
            </div>
          ))}
          {pendientes.length > 0 && (
            <>
              <div className="border-t px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sin abrir
              </div>
              {pendientes.map((l, i) => (
                <div key={`p-${i}`} className="px-3 py-1.5 text-xs text-muted-foreground">
                  {l.nombre}
                </div>
              ))}
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Qué se quiere hacer al guardar.
 *
 * Un comunicado se escribe para MANDARLO: el botón de la ficha publica. El
 * borrador no es un botón, es la red de seguridad de irse de la pantalla sin
 * haber publicado: lo escrito se queda guardado y no se pierde.
 */
type IntencionGuardado = "publicar" | "borrador";

interface EditorForm {
  titulo: string;
  cuerpo: string;
  creadorId: string;
  estado: EstadoComunicado;
  recurrencia: Recurrencia;
  tipo: TipoComunicado;
  todaEmpresa: boolean;
  rolesDestinatarios: string[];
  departamentosDestinatarios: string[];
  empleadosDestinatarios: string[];
  programado: boolean;
  envioFecha: string;
  envioHora: string;
  /** Documentos YA subidos al almacén (los que trae un comunicado guardado). */
  adjuntos: ComunicadoAdjunto[];
  /** Archivos recién elegidos, todavía en el navegador. Se suben al guardar. */
  archivosNuevos: File[];
  /** Mandarlo también por correo, además del aviso dentro de la app. */
  enviarEmail: boolean;
  /** Dirección que se abre con un botón desde el aviso y desde el comunicado. */
  enlace: string;
  /** Lo que se lee en ese botón. Vacío = "Abrir enlace". */
  enlaceTexto: string;
  observaciones: string;
}

const emptyForm: EditorForm = {
  titulo: "", cuerpo: "", creadorId: "", estado: "borrador",
  recurrencia: "sin_repeticion", tipo: "informativo", todaEmpresa: true,
  rolesDestinatarios: [], departamentosDestinatarios: [], empleadosDestinatarios: [], programado: false,
  envioFecha: "", envioHora: "", adjuntos: [],
  archivosNuevos: [], enviarEmail: false, observaciones: "",
  enlace: "", enlaceTexto: "",
};

/**
 * `envio` viene en UTC. La fecha y la hora que se enseñan son las de la EMPRESA:
 * partir la cadena por un espacio no valía —un ISO no lleva espacios— y dejaba
 * la casilla de fecha con un valor imposible.
 *
 * `programado` sale del estado, no de que haya fecha: desde que se apunta
 * cuándo salió, TODO comunicado publicado tiene fecha de envío.
 */
function formFromComunicado(c: Comunicado, tz: string): EditorForm {
  const fecha = claveDiaEnZona(c.envio, tz);
  const hora = formatHoraEnZona(c.envio, tz);
  return {
    titulo: c.titulo, cuerpo: c.cuerpo, creadorId: c.creadorId,
    estado: c.estado, recurrencia: c.recurrencia, tipo: c.tipo,
    todaEmpresa: c.todaEmpresa, rolesDestinatarios: [...c.rolesDestinatarios],
    // Los elegidos se recuperan tal cual estaban guardados. Venían en blanco:
    // abrir un comunicado y salir dejaba el comunicado sin destinatarios.
    departamentosDestinatarios: [...c.departamentosDestinatarios],
    empleadosDestinatarios: [...c.empleadosDestinatarios],
    programado: c.estado === "programado", envioFecha: fecha, envioHora: hora,
    adjuntos: [...c.adjuntos], archivosNuevos: [], enviarEmail: c.enviarEmail,
    enlace: c.enlace, enlaceTexto: c.enlaceTexto,
    observaciones: c.observaciones,
  };
}

/**
 * Foto de lo que hay escrito en la ficha, para saber si se ha tocado algo.
 *
 * Abrir un comunicado para LEERLO y volver atrás no debe escribir nada: antes
 * cualquier salida lo guardaba otra vez y a un comunicado programado le quitaba
 * la fecha y lo bajaba a borrador, así que dejaba de salir el día que tocaba.
 *
 * Se queda fuera lo que no escribe el usuario (`creadorId`).
 */
function firmaForm(f: EditorForm): string {
  return JSON.stringify({
    titulo: f.titulo,
    cuerpo: f.cuerpo,
    estado: f.estado,
    tipo: f.tipo,
    recurrencia: f.recurrencia,
    todaEmpresa: f.todaEmpresa,
    departamentos: [...f.departamentosDestinatarios].sort(),
    empleados: [...f.empleadosDestinatarios].sort(),
    programado: f.programado,
    envioFecha: f.envioFecha,
    envioHora: f.envioHora,
    adjuntos: f.adjuntos.map(a => a.path).sort(),
    archivosNuevos: f.archivosNuevos.map(a => `${a.name}:${a.size}`),
    enviarEmail: f.enviarEmail,
    enlace: f.enlace,
    enlaceTexto: f.enlaceTexto,
    observaciones: f.observaciones,
  });
}

function ComunicadoEditor({
  comunicado, onBack, onSave, empleadosReales, departamentosReales, empresaNombre, empresaColor, empresaIsotipo, tz,
}: {
  comunicado: Comunicado | null;
  onBack: () => void;
  /** `publicar` lo manda a la plantilla; `borrador` solo lo deja guardado. */
  onSave: (form: EditorForm, intencion: IntencionGuardado) => void | Promise<void>;
  empleadosReales: EmpleadoSelector[];
  departamentosReales: { id: string; nombre: string }[];
  empresaNombre: string;
  /** Color de marca de la empresa (Ajustes → Imagen de marca). La cabecera del
   *  comunicado se monta sola con él, igual que el correo: nada que configurar. */
  empresaColor: string;
  /** Isotipo de la empresa: es el que sale en el comunicado del trabajador. */
  empresaIsotipo: string;
  /** Zona horaria de la empresa: la fecha de envío se elige en SU hora. */
  tz: string;
}) {
  const isEdit = !!comunicado;
  const { user, profile } = useAuth();
  const formInicial = useMemo(
    () => (comunicado ? formFromComunicado(comunicado, tz) : emptyForm),
    [comunicado, tz],
  );
  const [form, setForm] = useState<EditorForm>(formInicial);
  /** Cómo estaba la ficha al abrirla. Sirve para no guardar lo que no se ha tocado. */
  const firmaInicial = useMemo(() => firmaForm(formInicial), [formInicial]);
  const [preview, setPreview] = useState(false);
  const [empleadoFilter, setEmpleadoFilter] = useState("");
  const inputArchivos = useRef<HTMLInputElement>(null);
  const u = (patch: Partial<EditorForm>) => setForm(f => ({ ...f, ...patch }));

  /**
   * Añade los archivos elegidos. Se valida AQUÍ el tamaño, antes de subir: si
   * se dejara para el almacén, el usuario esperaría la subida entera de un
   * archivo que iba a ser rechazado igualmente.
   */
  const anadirArchivos = (lista: FileList | null) => {
    const nuevos = Array.from(lista ?? []);
    if (nuevos.length === 0) return;

    const grande = nuevos.find(f => f.size > MAX_DOCUMENTO_BYTES);
    if (grande) {
      toast.error(mensajeDocumentoDemasiadoGrande(grande.name));
      return;
    }

    const yaHay = form.adjuntos.length + form.archivosNuevos.length;
    const hueco = MAX_ADJUNTOS_COMUNICADO - yaHay;
    if (hueco <= 0) {
      toast.error(`Un comunicado admite como máximo ${MAX_ADJUNTOS_COMUNICADO} documentos`);
      return;
    }
    if (nuevos.length > hueco) {
      toast.error(`Solo caben ${hueco} documento${hueco === 1 ? "" : "s"} más en este comunicado`);
    }
    u({ archivosNuevos: [...form.archivosNuevos, ...nuevos.slice(0, hueco)] });
  };

  /**
   * EL CREADOR ES QUIEN LO ESCRIBE. No se elige —no había nada que elegir— y
   * se resuelve al guardar con el usuario de la sesión. No se exige tener ficha
   * de empleado: dirección puede no tenerla y el comunicado quedaba sin autor.
   */
  /**
   * Publicar TARDA: sube los documentos y manda los correos uno a uno. Pulsar y
   * que no pase nada hasta que salta el aviso abajo parece que el botón está
   * roto (Iván, 11-09-2026), así que el botón se queda en marcha y no admite un
   * segundo clic —que además publicaría dos veces—.
   */
  const [enMarcha, setEnMarcha] = useState<IntencionGuardado | null>(null);

  const guardar = async (intencion: IntencionGuardado) => {
    if (enMarcha) return;
    setEnMarcha(intencion);
    try {
      await onSave({ ...form, creadorId: form.creadorId || user?.id || "" }, intencion);
    } finally {
      setEnMarcha(null);
    }
  };


  /** ¿Hay algo escrito? Salir de una ficha en blanco no debe dejar borradores vacíos. */
  const tieneContenido =
    !!form.titulo.trim() ||
    !!form.cuerpo.trim() ||
    form.adjuntos.length > 0 ||
    form.archivosNuevos.length > 0;

  /**
   * Salir de la ficha sin publicar.
   *
   * · Si no se ha tocado nada, volver NO guarda: el comunicado se queda tal
   *   cual estaba. Entrar a leerlo y salir no lo cambia.
   * · Si se ha escrito algo, lo escrito NO se pierde: se guarda y se puede
   *   publicar más tarde desde el listado.
   */
  const salir = async () => {
    if (enMarcha) return;
    const hayCambios = firmaForm(form) !== firmaInicial;
    if (!hayCambios) {
      onBack();
      return;
    }
    if (isEdit || tieneContenido) await guardar("borrador");
    else onBack();
  };

  /** Con fecha de envío puesta, el botón programa; si no, publica ya. */
  const vaProgramado = form.programado && !!form.envioFecha;

  const toggleDepartamento = (nombre: string) => {
    u({
      departamentosDestinatarios: form.departamentosDestinatarios.includes(nombre)
        ? form.departamentosDestinatarios.filter(x => x !== nombre)
        : [...form.departamentosDestinatarios, nombre],
    });
  };

  const toggleEmpleado = (userId: string) => {
    u({
      empleadosDestinatarios: form.empleadosDestinatarios.includes(userId)
        ? form.empleadosDestinatarios.filter(x => x !== userId)
        : [...form.empleadosDestinatarios, userId],
    });
  };

  const empleadosFiltrados = empleadosReales.filter(e => {
    const q = empleadoFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      `${e.nombre} ${e.apellidos}`.toLowerCase().includes(q) ||
      (e.puesto ?? "").toLowerCase().includes(q) ||
      (e.rolLabel ?? "").toLowerCase().includes(q) ||
      (e.departamento ?? "").toLowerCase().includes(q)
    );
  });

  /**
   * LA PREVISUALIZACIÓN ES LO QUE VE EL TRABAJADOR, no una maqueta aparte.
   * Se pinta con la misma pieza que Mi panel: si cambia allí, cambia aquí.
   */
  if (preview) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Así lo verá el equipo</h2>
            <p className="text-xs text-muted-foreground">Es la misma vista de Mi panel.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPreview(false)}>
            <ArrowLeft className="h-4 w-4 mr-1" />Volver al editor
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hoy</h3>
          <span className="h-px flex-1 bg-border" />
        </div>
        <ComunicadoTarjeta
          datos={{
            titulo: form.titulo,
            tipo: form.tipo,
            contenido: form.cuerpo,
            enlace: form.enlace.trim(),
            enlaceTexto: form.enlaceTexto,
            adjuntos: form.adjuntos,
            adjuntosPendientes: form.archivosNuevos.map(f => ({ name: f.name, size: f.size })),
            empresaNombre,
            isotipoUrl: empresaIsotipo,
            fechaTexto: formatFechaHoraEnZona(new Date().toISOString(), tz, { month: "long" }),
            nuevo: true,
          }}
        />
      </div>
    );
  }

  const creador =
    empleadosReales.find(e => e.userId === (form.creadorId || user?.id)) ?? null;
  const creadorNombre = creador
    ? `${creador.nombre} ${creador.apellidos}`.trim()
    : [profile?.nombre, profile?.apellidos].filter(Boolean).join(" ").trim();

  const totalDocumentos = form.adjuntos.length + form.archivosNuevos.length;

  return (
    /* `h-[calc(100%+7rem)] -mb-28` anula el aire que el armazón del software
       deja debajo de toda pantalla para el botón "Guardar": aquí se publica
       desde arriba, así que esos 7rem solo eran una franja muerta que se comía
       el final de la ficha (Iván, 11-09-2026). */
    <div className="flex flex-col h-[calc(100%+7rem)] -mb-28">
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={salir} disabled={!!enMarcha}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
          <Separator orientation="vertical" className="h-5" />
          <h2 className="text-sm font-bold">{isEdit ? "Editar comunicado" : "Crear comunicado"}</h2>
          <EstadoBadge estado={form.estado} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(true)} disabled={!!enMarcha}><Eye className="h-4 w-4 mr-1" />Previsualizar</Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => guardar("publicar")}
            disabled={!!enMarcha}
          >
            {enMarcha === "publicar" ? (
              <LoadingSpinner size="sm" className="py-0 mr-1" iconClassName="text-current" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            {enMarcha === "publicar"
              ? vaProgramado ? "Programando…" : "Publicando…"
              : vaProgramado ? "Programar" : "Publicar"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-5 max-w-3xl space-y-4">
            {/* El comunicado se escribe sobre la hoja tal y como se recibe: la
                franja de marca de la empresa arriba y el texto dentro. No hay
                nada que montar ni colores que elegir. */}
            <Card className="overflow-hidden shadow-sm">
              <div className="h-2" style={{ background: empresaColor }} />
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Título</Label>
                  <Input
                    value={form.titulo}
                    onChange={e => u({ titulo: e.target.value })}
                    placeholder="Cambio de horario de invierno"
                    className="text-xl font-bold border-0 rounded-none px-0 h-auto py-1 focus-visible:ring-0 shadow-none placeholder:text-muted-foreground/40 placeholder:font-normal"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Mensaje</Label>
                  <Textarea
                    value={form.cuerpo}
                    onChange={e => u({ cuerpo: e.target.value })}
                    placeholder="Escribe aquí lo que quieres contarle al equipo…"
                    className="border-0 px-0 focus-visible:ring-0 shadow-none min-h-[200px] resize-y text-base leading-7 placeholder:text-muted-foreground/40"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Un enlace no se pega dentro del texto: ahí no se puede pulsar
                desde el aviso y se pierde entre el mensaje. Puesto aquí, sale
                como un botón en el aviso, en el comunicado y en el correo. */}
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Enlace
                </Label>
                <span className="text-[11px] text-muted-foreground/70">
                  Sale como un botón al final del comunicado.
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={form.enlace}
                  onChange={e => u({ enlace: e.target.value })}
                  placeholder="www.ejemplo.com/carta"
                  inputMode="url"
                  className="h-9"
                />
                <Input
                  value={form.enlaceTexto}
                  onChange={e => u({ enlaceTexto: e.target.value })}
                  placeholder="Texto del botón"
                  className="h-9"
                />
              </div>
            </div>

            {/* Las notas no salen en el comunicado, así que van plegadas: no
                tienen por qué robar sitio a lo que sí se manda. */}
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left hover:bg-muted/40">
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notas internas
                </span>
                <span className="text-[11px] text-muted-foreground/70">Solo las ves tú.</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Textarea value={form.observaciones} onChange={e => u({ observaciones: e.target.value })} rows={3} className="resize-y" />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        {/* AJUSTES DEL ENVÍO. Toda la columna tiene que caber de una sola
            mirada: lo que es una lista larga (departamentos, empleados,
            documentos) va plegado y dice cuántos llevas elegidos. */}
        <ScrollArea className="w-80 xl:w-96 border-l bg-muted/20 shrink-0">
          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />Destinatarios
              </Label>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sw-toda" className="text-sm font-normal">Toda la empresa</Label>
                <Switch checked={form.todaEmpresa} onCheckedChange={v => u({ todaEmpresa: v })} id="sw-toda" />
              </div>
              {!form.todaEmpresa && (
                <div className="space-y-2">
                  <Collapsible>
                    <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-left hover:bg-muted/40">
                      <span className="text-sm">Departamentos</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          {form.departamentosDestinatarios.length || "ninguno"}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1.5">
                      {departamentosReales.length === 0 ? (
                        <p className="px-1 text-xs text-muted-foreground">
                          Esta empresa no tiene departamentos activos.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-2">
                          {departamentosReales.map(d => (
                            <label key={d.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={form.departamentosDestinatarios.includes(d.nombre)}
                                onCheckedChange={() => toggleDepartamento(d.nombre)}
                              />
                              <span className="truncate">{d.nombre}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible>
                    <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-left hover:bg-muted/40">
                      <span className="text-sm">Empleados</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          {form.empleadosDestinatarios.length || "ninguno"}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1.5 pt-1.5">
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={empleadoFilter}
                          onChange={e => setEmpleadoFilter(e.target.value)}
                          placeholder="Buscar empleado…"
                          className="h-8 text-xs"
                        />
                        {form.empleadosDestinatarios.length > 0 && (
                          <button
                            type="button"
                            className="shrink-0 text-[11px] text-muted-foreground underline hover:text-foreground"
                            onClick={() => u({ empleadosDestinatarios: [] })}
                          >
                            Quitar todos
                          </button>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-lg border bg-card">
                        {empleadosFiltrados.length === 0 ? (
                          <p className="p-2 text-center text-[11px] text-muted-foreground">
                            {empleadosReales.length === 0 ? "Sin empleados en BD" : "Sin resultados"}
                          </p>
                        ) : (
                          empleadosFiltrados.map(emp => (
                            <label
                              key={emp.userId}
                              className="flex cursor-pointer items-center gap-2 border-b px-2 py-1.5 text-xs last:border-b-0 hover:bg-muted/40"
                            >
                              <Checkbox
                                checked={form.empleadosDestinatarios.includes(emp.userId)}
                                onCheckedChange={() => toggleEmpleado(emp.userId)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{emp.nombre} {emp.apellidos}</p>
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {[emp.puesto ?? emp.rolLabel, emp.departamento].filter(Boolean).join(" · ") || "Sin rol"}
                                </p>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>

            <Separator />

            {/* CUÁNDO SE MANDA. Un solo botón: apagado sale al publicar,
                encendido pide día y hora. La recurrencia sobraba —un
                comunicado se manda una vez— y solo añadía un desplegable. */}
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />Cuándo se manda
              </Label>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sw-prog" className="text-sm font-normal">Dejarlo programado</Label>
                <Switch checked={form.programado} onCheckedChange={v => u({ programado: v })} id="sw-prog" />
              </div>
              {form.programado ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" className="h-8 text-xs" value={form.envioFecha} onChange={e => u({ envioFecha: e.target.value })} />
                  <Input type="time" className="h-8 text-xs" value={form.envioHora} onChange={e => u({ envioHora: e.target.value })} />
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Sale en cuanto pulses «Publicar».</p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5" />Aviso en el móvil
              </Label>
              {/* Lo que le salta al equipo es EL TÍTULO del comunicado, tal cual.
                  Aquí había una casilla que se podía escribir y no guardaba nada,
                  y encima enseñaba un "Nuevo comunicado:" por delante que no sale
                  en ningún sitio. Se enseña el aviso de verdad y punto. */}
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                {form.titulo.trim() || "Nuevo comunicado"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Es el título del comunicado: cámbialo arriba y cambia el aviso.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />Correo
              </Label>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sw-email" className="text-sm font-normal">Mandarlo también por correo</Label>
                <Switch checked={form.enviarEmail} onCheckedChange={v => u({ enviarEmail: v })} id="sw-email" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {form.enviarEmail
                  ? "Al publicarlo sale un correo con el comunicado y sus documentos."
                  : "Llega al móvil y a Mi panel, pero no al correo."}
              </p>
            </div>

            <Separator />

            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" />Documentos
                </Label>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{totalDocumentos || "ninguno"}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1.5 pt-2">
                {form.adjuntos.map(a => (
                  <div key={a.path} className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
                    <a
                      href={urlAdjuntoComunicado(a.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-2 hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{a.name}</span>
                      {a.size > 0 && <span className="shrink-0 text-[10px] text-muted-foreground">{tamanoLegible(a.size)}</span>}
                    </a>
                    <button
                      type="button"
                      aria-label={`Quitar ${a.name}`}
                      onClick={() => u({ adjuntos: form.adjuntos.filter(x => x.path !== a.path) })}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    ><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {form.archivosNuevos.map((f, i) => (
                  <div key={`nuevo-${i}-${f.name}`} className="flex items-center justify-between gap-2 rounded-md border border-dashed bg-card px-2.5 py-1.5 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{tamanoLegible(f.size)}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Quitar ${f.name}`}
                      onClick={() => u({ archivosNuevos: form.archivosNuevos.filter((_, idx) => idx !== i) })}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    ><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <input
                  ref={inputArchivos}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => { anadirArchivos(e.target.files); e.target.value = ""; }}
                />
                <Button variant="outline" size="sm" className="h-8 w-full text-xs" onClick={() => inputArchivos.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1" />Adjuntar documento
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Hasta {MAX_ADJUNTOS_COMUNICADO} documentos, máx. {MAX_DOCUMENTO_MB} MB cada uno.
                </p>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* El tipo pinta el recuadro del comunicado. El creador NO se
                elige: es quien lo escribe, y solo se deja ver. */}
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-normal">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => u({ tipo: v as TipoComunicado })}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_COMUNICADO.map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_COMUNICADO_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {creadorNombre && (
              <p className="text-[11px] text-muted-foreground">Lo firma {creadorNombre}.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ComunicadoCalendario({ comunicados, vista, setVista, mesOffset, setMesOffset, onSelect }: {
  comunicados: Comunicado[];
  vista: "mensual" | "anual";
  setVista: (v: "mensual" | "anual") => void;
  mesOffset: number;
  setMesOffset: (fn: (p: number) => number) => void;
  onSelect: (c: Comunicado) => void;
}) {
  const hoy = new Date();
  const mesBase = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1);
  const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const conFecha = comunicados.filter(c => c.envio);
  const getForDate = (dateStr: string) => conFecha.filter(c => c.envio?.startsWith(dateStr));

  const estadoColor = (e: EstadoComunicado) => {
    const m: Record<EstadoComunicado, string> = {
      borrador: "border-l-muted-foreground/50 bg-muted/40",
      programado: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
      publicado: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
      archivado: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
    };
    return m[e] || "";
  };

  const renderMiniItem = (c: Comunicado) => (
    <button key={c.id} onClick={() => onSelect(c)}
      className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate border-l-2 hover:opacity-80 transition-opacity ${estadoColor(c.estado)}`}>
      {c.titulo}
    </button>
  );

  const renderMensual = () => {
    const diasMes = new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 0).getDate();
    const primerDia = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1).getDay();
    const offset = primerDia === 0 ? 6 : primerDia - 1;
    const mesLabel = mesBase.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h3 className="text-sm font-semibold capitalize">{mesLabel}</h3>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
            <div key={d} className="bg-muted/50 p-2 text-center text-[10px] font-bold text-muted-foreground uppercase">{d}</div>
          ))}
          {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} className="bg-card min-h-[90px] p-1" />)}
          {Array.from({ length: diasMes }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDate(new Date(mesBase.getFullYear(), mesBase.getMonth(), day));
            const items = getForDate(dateStr);
            const isToday = dateStr === formatDate(hoy);
            return (
              <div key={day} className={`bg-card min-h-[90px] p-1 ${isToday ? "ring-2 ring-primary/30 ring-inset" : ""}`}>
                <span className={`text-[11px] font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{day}</span>
                <div className="space-y-0.5 mt-0.5">
                  {items.slice(0, 3).map(c => renderMiniItem(c))}
                  {items.length > 3 && <span className="text-[9px] text-muted-foreground">+{items.length - 3} más</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAnual = () => {
    const year = mesBase.getFullYear();
    const meses = Array.from({ length: 12 }, (_, i) => i);
    const nombresMes = meses.map(m => new Date(year, m, 1).toLocaleDateString("es-ES", { month: "short" }));
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset(p => p - 12)}><ChevronLeft className="h-4 w-4" /></Button>
          <h3 className="text-sm font-semibold">{year}</h3>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMesOffset(p => p + 12)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {meses.map(m => {
            const diasEnMes = new Date(year, m + 1, 0).getDate();
            const primerDiaSemana = new Date(year, m, 1).getDay();
            const off = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;
            const monthStr = `${year}-${String(m + 1).padStart(2, "0")}`;
            const itemsMes = conFecha.filter(c => c.envio?.startsWith(monthStr));
            const isCurrentMonth = m === hoy.getMonth() && year === hoy.getFullYear();
            return (
              <Card key={m} className={`overflow-hidden ${isCurrentMonth ? "ring-2 ring-primary/30" : ""}`}>
                <CardHeader className="p-2 pb-1"><CardTitle className="text-xs capitalize text-center">{nombresMes[m]}</CardTitle></CardHeader>
                <CardContent className="p-1.5 pt-0">
                  <div className="grid grid-cols-7 gap-px mb-1">
                    {["L", "M", "X", "J", "V", "S", "D"].map(d => <div key={d} className="text-[7px] text-center text-muted-foreground font-medium">{d}</div>)}
                    {Array.from({ length: off }).map((_, i) => <div key={`eo-${i}`} className="h-3" />)}
                    {Array.from({ length: diasEnMes }).map((_, i) => {
                      const day = i + 1;
                      const ds = `${monthStr}-${String(day).padStart(2, "0")}`;
                      const has = conFecha.some(c => c.envio?.startsWith(ds));
                      const isT = ds === formatDate(hoy);
                      return (
                        <div key={day} className={`h-3 flex items-center justify-center text-[7px] rounded-sm ${isT ? "bg-primary text-primary-foreground font-bold" : has ? "bg-primary/20 font-semibold" : "text-muted-foreground"}`}>{day}</div>
                      );
                    })}
                  </div>
                  {itemsMes.length > 0 ? (
                    <div className="space-y-0.5 border-t pt-1">
                      {itemsMes.slice(0, 4).map(c => (
                        <button key={c.id} onClick={() => onSelect(c)} className={`w-full text-left text-[9px] truncate rounded px-1 py-0.5 border-l-2 hover:opacity-80 ${estadoColor(c.estado)}`}>{c.titulo}</button>
                      ))}
                      {itemsMes.length > 4 && <p className="text-[8px] text-muted-foreground text-center">+{itemsMes.length - 4} más</p>}
                    </div>
                  ) : <p className="text-[8px] text-muted-foreground text-center pt-1 border-t">Sin comunicados</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <Badge variant={vista === "mensual" ? "default" : "outline"} className="cursor-pointer" onClick={() => setVista("mensual")}>Mensual</Badge>
          <Badge variant={vista === "anual" ? "default" : "outline"} className="cursor-pointer" onClick={() => setVista("anual")}>Anual</Badge>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Publicado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Programado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Archivado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/50" />Borrador</span>
        </div>
      </div>
      {vista === "mensual" ? renderMensual() : renderAnual()}
    </div>
  );
}

/**
 * Enseña QUIÉNES son al pasar el ratón por encima de la píldora.
 *
 * Antes había que entrar en la ficha para saber a qué departamentos o a qué
 * personas iba el comunicado; el listado solo decía cuántos eran.
 */
function ConQuienes({
  titulo,
  nombres,
  children,
}: {
  titulo: string;
  nombres: string[];
  children: ReactNode;
}) {
  const lista = nombres.filter(Boolean);
  if (lista.length === 0) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{children}</span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-70">{titulo}</p>
          <ul className="space-y-0.5 text-xs">
            {lista.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Fila de `comunicados` (BD) → comunicado de pantalla.
 *
 * Los destinatarios se cuentan de lo que hay guardado: `toda_empresa` significa
 * la empresa entera, y si no, se cuentan los departamentos y empleados elegidos.
 * No se inventa ningún número: lo que no está guardado se queda a cero.
 */
function filaAComunicado(fila: Record<string, unknown>): Comunicado {
  const texto = (v: unknown): string => (typeof v === "string" ? v : "");
  const lista = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const todaEmpresa = fila.toda_empresa === true;
  const departamentos = lista(fila.departamentos_destinatarios);
  const empleados = lista(fila.empleados_destinatarios);

  return {
    id: texto(fila.id),
    titulo: texto(fila.titulo),
    cuerpo: texto(fila.cuerpo),
    estado: (texto(fila.estado) || "borrador") as EstadoComunicado,
    creadorId: texto(fila.creador_id),
    creadoEl: texto(fila.created_at),
    envio: typeof fila.envio === "string" ? fila.envio : null,
    recurrencia: (texto(fila.recurrencia) || "sin_repeticion") as Recurrencia,
    alcancePct: Number(fila.alcance_pct ?? 0) || 0,
    lecturas: Array.isArray(fila.lecturas) ? (fila.lecturas as LecturaComunicado[]) : [],
    rolesDestinatarios: lista(fila.roles_destinatarios),
    todaEmpresa,
    departamentosDestinatarios: departamentos,
    empleadosDestinatarios: empleados,
    destinatarios: {
      empresas: todaEmpresa ? 1 : 0,
      departamentos: departamentos.length,
      empleados: empleados.length,
    },
    tipo: tipoComunicado(fila.tipo),
    observaciones: texto(fila.observaciones),
    adjuntos: normalizarAdjuntosFila(fila.adjuntos),
    enviarEmail: fila.enviar_email === true,
    enlace: texto(fila.enlace),
    enlaceTexto: texto(fila.enlace_texto),
  };
}

/** El JSONB `adjuntos` puede venir de cualquier forma: solo pasan los completos. */
function normalizarAdjuntosFila(raw: unknown): ComunicadoAdjunto[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const path = typeof r.path === "string" ? r.path : "";
    const name = typeof r.name === "string" ? r.name : "";
    if (!path || !name) return [];
    return [{
      path,
      name,
      size: typeof r.size === "number" ? r.size : 0,
      mime: typeof r.mime === "string" ? r.mime : null,
    }];
  });
}

export function ComunicadosView() {
  // `empresaResuelta` evita enseñar el nombre de la empresa por defecto mientras
  // aún se está resolviendo cuál es la activa del usuario.
  const { empresaActual, empresaResuelta, getIsotipoUrl } = useEmpresa();
  // La sanción disciplinaria no es un comunicado: es un documento laboral que
  // firma el trabajador, y solo lo emite quien puede editar Recursos Humanos
  // (es el permiso que exige el servidor). Sin él, ni se enseña la pestaña.
  const { puedeEditar, permisosLoaded } = useAuth();
  const puedeSancionar = permisosLoaded && puedeEditar("RECURSOS HUMANOS");
  const { confirm, dialog: dialogoConfirmar } = useConfirmDelete();
  // Las fechas guardadas son instantes: se leen en la hora de la EMPRESA, no en
  // la del navegador de quien mira la pantalla.
  const tz = empresaActual?.zonaHoraria ?? ZONA_HORARIA_FALLBACK;
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [empleadosReales, setEmpleadosReales] = useState<EmpleadoSelector[]>([]);
  // Departamentos REALES de la empresa: los mismos que usa el resto del
  // software para segmentar avisos. Una lista escrita a mano se desincroniza y
  // deja comunicados sin destinatario.
  const [departamentosReales, setDepartamentosReales] = useState<{ id: string; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);

  const loadComunicados = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listComunicados();
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron cargar los comunicados");
        setComunicados([]);
        return;
      }
      setComunicados((res.data ?? []).map(filaAComunicado));
    } finally {
      setCargando(false);
    }
  }, []);

  const loadEmpleadosReales = useCallback(async () => {
    const res = await listEmpleadosParaComunicado();
    if (res.ok) setEmpleadosReales(res.data);
    const opciones = await getOpcionesSegmento();
    setDepartamentosReales(opciones.departamentos);
  }, []);

  useEffect(() => {
    loadComunicados();
    loadEmpleadosReales();
  }, [loadComunicados, loadEmpleadosReales]);

  const [mainTab, setMainTab] = useState<"listado" | "calendario" | "sancion">("listado");
  const [calVista, setCalVista] = useState<"mensual" | "anual">("mensual");
  const [mesOffset, setMesOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [editorMode, setEditorMode] = useState<"list" | "create" | "edit">("list");
  const [editingComunicado, setEditingComunicado] = useState<Comunicado | null>(null);

  // Sincronizacion en vivo: un comunicado publicado por otro responsable
  // aparece sin recargar. Se pausa mientras se redacta o edita uno.
  useSincronizacionEnVivo({
    tablas: ["comunicados"],
    onCambio: () => void loadComunicados(),
    pausado: !!editingComunicado,
  });
  const [faltantesComunicado, setFaltantesComunicado] = useState<string[]>([]);
  /** Comunicado a punto de publicarse desde el listado, y si sale por correo. */
  const [publicando, setPublicando] = useState<Comunicado | null>(null);
  const [publicarConEmail, setPublicarConEmail] = useState(false);
  const [publicandoBusy, setPublicandoBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const { validar: validarComunicado } = useReglasSubmodulo("gerencia", "comunicados");

  const accesoComunicado = (c: Comunicado, campo: string): unknown => {
    if (campo === "estado") return c.estado;
    if (campo === "recurrencia") return c.recurrencia;
    if (campo === "tipo") return c.tipo;
    if (campo === "titulo") return c.titulo;
    if (campo === "creadoEl") return c.creadoEl;
    if (campo === "envio") return c.envio ?? "";
    if (campo === "alcancePct") return c.alcancePct;
    return (c as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = comunicados.filter(c => {
      const q = search.toLowerCase();
      return !q || c.titulo.toLowerCase().includes(q);
    });
    const accesoGenerico = accesoComunicado as unknown as (
      c: Record<string, unknown>,
      campo: string,
    ) => unknown;
    lista = aplicarFiltrosToolbar(
      lista as unknown as Record<string, unknown>[],
      filtros,
      accesoGenerico,
    ) as unknown as Comunicado[];
    lista = aplicarOrdenToolbar(
      lista as unknown as Record<string, unknown>[],
      orden,
      accesoGenerico,
    ) as unknown as Comunicado[];
    return lista;
  }, [comunicados, search, filtros, orden]);


  const openEdit = (c: Comunicado) => { setEditingComunicado(c); setEditorMode("edit"); };
  const openCreate = () => { setEditingComunicado(null); setEditorMode("create"); };
  const closeEditor = () => { setEditorMode("list"); setEditingComunicado(null); };

  /**
   * Archiva el comunicado: deja de estar en circulación pero se conserva.
   * Solo se toca el estado; sus documentos y destinatarios se quedan igual.
   */
  const archivar = async (c: Comunicado) => {
    const res = await cambiarEstadoComunicado(c.id, "archivado");
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo archivar");
      return;
    }
    toast.success("Comunicado archivado");
    await loadComunicados();
  };

  /**
   * Publicar desde el listado, sin entrar en la ficha: es lo normal cuando se
   * dejó escrito en borrador y ya toca mandarlo.
   *
   * Se pregunta antes, y en esa misma pregunta se decide si sale además por
   * correo. Antes esa decisión estaba escondida en un interruptor dentro de la
   * ficha: se publicaba creyendo que el correo salía y no salía.
   */
  const pedirPublicar = (c: Comunicado) => {
    setPublicando(c);
    setPublicarConEmail(c.enviarEmail);
  };

  /** Avisa de cómo fue el correo. Un correo que no sale tiene que decirse. */
  const contarCorreo = (res: { emailEnviados?: number; emailError?: string }) => {
    const enviados = res.emailEnviados ?? 0;
    if (enviados > 0) {
      toast.success(`Correo enviado a ${enviados} ${enviados === 1 ? "persona" : "personas"}`);
    } else if (res.emailError) {
      toast.error(`El correo no salió: ${res.emailError}`);
    }
  };

  const confirmarPublicar = async () => {
    if (!publicando) return;
    setPublicandoBusy(true);
    const res = await cambiarEstadoComunicado(publicando.id, "publicado", publicarConEmail);
    setPublicandoBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo publicar");
      return;
    }
    setPublicando(null);
    toast.success("Comunicado publicado");
    if (publicarConEmail) contarCorreo(res);
    await loadComunicados();
  };

  /** Mandar por correo uno que ya está publicado (o reintentarlo si falló). */
  const mandarPorCorreo = async (c: Comunicado) => {
    const ok = await confirm({
      title: "¿Mandarlo por correo?",
      description: `«${c.titulo}» saldrá por correo a sus destinatarios, con sus documentos.`,
      confirmLabel: "Mandar",
      tono: "normal",
    });
    if (!ok) return;
    const res = await enviarCorreoComunicado(c.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo mandar el correo");
      return;
    }
    contarCorreo(res);
    await loadComunicados();
  };

  /** Copiar un comunicado para reaprovecharlo: la copia nace en borrador. */
  const duplicar = async (c: Comunicado) => {
    const res = await duplicarComunicado(c.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo duplicar");
      return;
    }
    toast.success("Copia creada en borrador");
    await loadComunicados();
  };

  const eliminar = async (c: Comunicado) => {
    const ok = await confirm({
      title: "¿Eliminar este comunicado?",
      description: `Se borrará «${c.titulo}». Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const res = await deleteComunicado(c.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar");
      return;
    }
    toast.success("Comunicado eliminado");
    await loadComunicados();
  };

  const saveEditor = async (form: EditorForm, intencion: IntencionGuardado) => {
    /**
     * El estado no se elige a mano: lo dice lo que se acaba de pulsar.
     * · Publicar con fecha puesta → queda programado y sale solo ese día.
     * · Publicar sin fecha → sale ahora.
     * · Salir sin publicar → borrador, para no perder lo escrito. Un comunicado
     *   que YA tiene estado (programado, publicado o archivado) no se degrada a
     *   borrador por irse de la ficha: a un programado eso le quitaba la fecha y
     *   dejaba de salir el día que tocaba.
     */
    const estadoFinal: EstadoComunicado =
      intencion === "publicar"
        ? form.programado && form.envioFecha
          ? "programado"
          : "publicado"
        : form.estado === "borrador"
          ? "borrador"
          : form.estado;

    // Los campos obligatorios se exigen al publicar. Un borrador a medias es
    // justo lo que se guarda al salir, así que ahí no se valida nada.
    if (intencion === "publicar") {
      const { labelsFaltantes } = validarComunicado({
        titulo: form.titulo,
        cuerpo: form.cuerpo,
        tipo: form.tipo,
        estado: estadoFinal,
        envioFecha: form.envioFecha,
      });
      if (labelsFaltantes.length > 0) {
        setFaltantesComunicado(labelsFaltantes);
        return;
      }
    }
    // Con fecha puesta, `envio` es cuándo TIENE que salir. Al publicar ahora se
    // apunta el momento del envío, que es lo que se lee en la columna «Envío»:
    // un comunicado publicado sin fecha salía con un guion.
    // En los que se repiten no se toca: ahí `envio` es la próxima vez y
    // pisarla haría que el cron lo volviera a mandar.
    const envioGuardado = editingComunicado?.envio ?? null;
    const envio = form.programado && form.envioFecha
      ? zonaLocalAUtcISO(form.envioFecha, form.envioHora || "00:00", tz)
      : form.recurrencia !== "sin_repeticion" || estadoFinal === "programado"
        // Los que se repiten llevan en `envio` la PRÓXIMA vez que salen, y un
        // programado sin fecha no sale nunca: en los dos casos se respeta la
        // fecha que ya tenía. Vaciarla los dejaba mudos para siempre.
        ? envioGuardado
        : estadoFinal === "publicado"
          // El que ya salió conserva el día que salió: volver a guardarlo le
          // ponía la fecha de hoy y parecía recién enviado.
          ? (envioGuardado ?? new Date().toISOString())
          : null;

    // Los documentos suben DIRECTOS al almacén con una URL firmada. Si pasaran
    // por la acción de guardado, cualquier PDF de más de 4,5 MB fallaría.
    const adjuntos: ComunicadoAdjunto[] = [...form.adjuntos];
    if (form.archivosNuevos.length > 0) {
      const urls = await crearUrlsSubidaComunicado(
        form.archivosNuevos.map(f => ({ name: f.name, type: f.type })),
      );
      if (!urls.ok) {
        toast.error(urls.error ?? "No se pudieron preparar los documentos");
        return;
      }
      const supabase = createSupabaseBrowser();
      for (let i = 0; i < form.archivosNuevos.length; i++) {
        const file = form.archivosNuevos[i];
        const destino = urls.data[i];
        const { error } = await supabase.storage
          .from(BUCKET_COMUNICADOS)
          .uploadToSignedUrl(destino.path, destino.token, file, {
            contentType: file.type || "application/octet-stream",
          });
        if (error) {
          console.error("[comunicados] subida:", error.message);
          toast.error(traducirErrorSubida(error, `No se pudo subir "${file.name}"`));
          return;
        }
        adjuntos.push({
          path: destino.path,
          name: file.name,
          size: file.size,
          mime: file.type || null,
        });
      }
    }

    const payload = {
      titulo: form.titulo,
      cuerpo: form.cuerpo,
      estado: estadoFinal,
      tipo: form.tipo,
      recurrencia: form.recurrencia,
      todaEmpresa: form.todaEmpresa,
      rolesDestinatarios: [],
      empleadosDestinatarios: form.todaEmpresa ? [] : form.empleadosDestinatarios,
      departamentosDestinatarios: form.todaEmpresa ? [] : form.departamentosDestinatarios,
      envio,
      observaciones: form.observaciones,
      adjuntos,
      enviarEmail: form.enviarEmail,
      enlace: form.enlace,
      enlaceTexto: form.enlaceTexto,
    };
    const res = editorMode === "create"
      ? await createComunicado(payload)
      : editingComunicado
        ? await updateComunicado(editingComunicado.id, payload)
        : { ok: false, error: "Sin contexto" };

    if (res.ok) {
      toast.success(
        estadoFinal === "publicado"
          ? "Comunicado publicado"
          : estadoFinal === "programado"
            ? "Comunicado programado"
            : "Guardado como borrador",
      );
      // El correo se dice aparte: que salga el comunicado y no salga el correo
      // es exactamente lo que nadie se entera de que ha pasado.
      const enviados = res.emailEnviados ?? 0;
      const errorEmail = res.emailError;
      if (enviados > 0) {
        toast.success(`Correo enviado a ${enviados} ${enviados === 1 ? "persona" : "personas"}`);
      } else if (errorEmail) {
        toast.error(`El comunicado se publicó, pero el correo no salió: ${errorEmail}`);
      }
    } else {
      toast.error(res.error || "Error al guardar comunicado");
    }
    await loadComunicados();
    closeEditor();
  };

  if (editorMode !== "list") {
    return (
      <>
        <ComunicadoEditor
          comunicado={editingComunicado}
          onBack={closeEditor}
          onSave={saveEditor}
          empleadosReales={empleadosReales}
          departamentosReales={departamentosReales}
          empresaNombre={empresaResuelta ? empresaActual?.nombre ?? "" : ""}
          empresaColor={empresaActual?.color ?? "hsl(var(--primary))"}
          empresaIsotipo={empresaActual ? getIsotipoUrl(empresaActual.id) : ""}
          tz={tz}
        />
        <ValidacionFaltantesDialog
          open={faltantesComunicado.length > 0}
          onClose={() => setFaltantesComunicado([])}
          campos={faltantesComunicado}
          submoduloLabel="Comunicados"
        />
      </>
    );
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "titulo", label: "Título" },
    { campo: "tipo", label: "Tipo" },
    { campo: "estado", label: "Estado" },
    { campo: "creadoEl", label: "Creado el" },
    { campo: "envio", label: "Envío" },
    { campo: "recurrencia", label: "Recurrencia" },
    { campo: "alcance", label: "Alcance" },
    { campo: "destinatarios", label: "Destinatarios" },
  ];

  /** Del login al nombre de la persona, para poder decir QUIÉNES son. */
  const nombreDeEmpleado = (userId: string): string => {
    const e = empleadosReales.find((x) => x.userId === userId);
    return e ? `${e.nombre} ${e.apellidos}`.trim() : "";
  };

  const columnDefs: Record<string, { th: ReactNode; td: (c: Comunicado) => ReactNode }> = {
    titulo: {
      th: <TableHead key="titulo">Título</TableHead>,
      td: (c) => (
        <TableCell key="titulo">
          <p className="font-semibold text-sm">{c.titulo}</p>
        </TableCell>
      ),
    },
    tipo: {
      th: <TableHead key="tipo">Tipo</TableHead>,
      td: (c) => (
        <TableCell key="tipo">
          <Badge variant="outline" className={`text-[11px] ${TIPO_COMUNICADO_COLOR[c.tipo]}`}>
            {TIPO_COMUNICADO_LABEL[c.tipo]}
          </Badge>
        </TableCell>
      ),
    },
    estado: {
      th: <TableHead key="estado">Estado</TableHead>,
      td: (c) => (
        <TableCell key="estado"><EstadoBadge estado={c.estado} /></TableCell>
      ),
    },
    creadoEl: {
      th: <TableHead key="creadoEl">Creado el</TableHead>,
      td: (c) => (
        <TableCell key="creadoEl" className="text-sm text-muted-foreground whitespace-nowrap">{formatFechaHoraEnZona(c.creadoEl, tz)}</TableCell>
      ),
    },
    envio: {
      th: <TableHead key="envio">Envío</TableHead>,
      td: (c) => (
        <TableCell key="envio" className="text-sm text-muted-foreground whitespace-nowrap">{c.envio ? formatFechaHoraEnZona(c.envio, tz) : "—"}</TableCell>
      ),
    },
    recurrencia: {
      th: <TableHead key="recurrencia">Recurrencia</TableHead>,
      td: (c) => (
        <TableCell key="recurrencia"><Badge variant="outline" className="text-xs">{RECURRENCIA_LABELS[c.recurrencia]}</Badge></TableCell>
      ),
    },
    alcance: {
      th: <TableHead key="alcance">Alcance</TableHead>,
      td: (c) => (
        <TableCell key="alcance"><AlcanceCircle pct={c.alcancePct} lecturas={c.lecturas} tz={tz} /></TableCell>
      ),
    },
    destinatarios: {
      th: <TableHead key="destinatarios">Destinatarios</TableHead>,
      td: (c) => (
        <TableCell key="destinatarios">
          <div className="flex flex-wrap gap-1">
            {c.todaEmpresa ? (
              <Badge variant="secondary" className="text-[11px] gap-1"><Users className="h-3 w-3" />Todos</Badge>
            ) : (
              <>
                <ConQuienes titulo="Departamentos" nombres={c.departamentosDestinatarios}>
                  <Badge variant="secondary" className="text-[11px] gap-1 cursor-default"><Users className="h-3 w-3" />{c.destinatarios.departamentos} dptos</Badge>
                </ConQuienes>
                <ConQuienes titulo="Empleados" nombres={c.empleadosDestinatarios.map(nombreDeEmpleado)}>
                  <Badge variant="outline" className="text-[11px] gap-1 cursor-default">{c.destinatarios.empleados} empleados</Badge>
                </ConQuienes>
              </>
            )}
          </div>
        </TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{comunicados.length}</p><p className="text-xs text-muted-foreground">Total comunicados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{comunicados.filter(c => c.estado === "publicado").length}</p><p className="text-xs text-muted-foreground">Publicados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{comunicados.filter(c => c.estado === "programado").length}</p><p className="text-xs text-muted-foreground">Programados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{Math.round(comunicados.filter(c => c.alcancePct > 0).reduce((s, c) => s + c.alcancePct, 0) / Math.max(comunicados.filter(c => c.alcancePct > 0).length, 1))}%</p><p className="text-xs text-muted-foreground">Alcance medio</p></CardContent></Card>
      </div>

      <Tabs value={mainTab} onValueChange={v => setMainTab(v as "listado" | "calendario" | "sancion")}>
        <TabsList>
          <TabsTrigger value="listado"><FileText className="h-4 w-4 mr-1" />Comunicados</TabsTrigger>
          <TabsTrigger value="calendario"><CalendarDays className="h-4 w-4 mr-1" />Calendario</TabsTrigger>
          {puedeSancionar && (
            <TabsTrigger value="sancion"><ShieldAlert className="h-4 w-4 mr-1" />Sanción disciplinaria</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="listado">
          <div className="mb-4">
            <SubmoduleToolbar
              busqueda={search}
              onBusquedaChange={setSearch}
              placeholderBusqueda="Buscar"
              onNuevo={openCreate}
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
                  <IOActions config={comunicadosIO} onSuccess={() => window.location.reload()} />
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
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    {columnasRender.map((col) => columnDefs[col.campo]?.td(c))}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {/* Lo que estaba escrito y sin mandar se publica desde
                            aquí, a la vista, sin tener que abrir la ficha. */}
                        {c.estado !== "publicado" && (
                          <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => pedirPublicar(c)}>
                            <Send className="h-3.5 w-3.5 mr-1" />Publicar
                          </Button>
                        )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                          </Button>
                        </DropdownMenuTrigger>
                        {/* Menú con la letra del software: 13 px, semibold y
                            trazo fino en los iconos. Con la tipografía por
                            defecto cantaba frente al resto de la pantalla. */}
                        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 shadow-lg">
                          <DropdownMenuItem className={ITEM_MENU} onClick={() => openEdit(c)}>
                            <Eye className={ICONO_MENU} strokeWidth={1.75} />Ver / editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className={ITEM_MENU} onClick={() => duplicar(c)}>
                            <Copy className={ICONO_MENU} strokeWidth={1.75} />Duplicar
                          </DropdownMenuItem>
                          {c.estado === "publicado" && (
                            <DropdownMenuItem className={ITEM_MENU} onClick={() => mandarPorCorreo(c)}>
                              <Mail className={ICONO_MENU} strokeWidth={1.75} />Mandar por correo
                            </DropdownMenuItem>
                          )}
                          {c.estado !== "archivado" && (
                            <DropdownMenuItem className={ITEM_MENU} onClick={() => archivar(c)}>
                              <Archive className={ICONO_MENU} strokeWidth={1.75} />Archivar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem
                            className={`${ITEM_MENU} text-destructive focus:text-destructive`}
                            onClick={() => eliminar(c)}
                          >
                            <Trash2 className={ICONO_MENU} strokeWidth={1.75} />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={columnasRender.length + 1} className="text-center text-muted-foreground py-8">{cargando ? "Cargando…" : "No se encontraron comunicados"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="calendario">
          <ComunicadoCalendario
            comunicados={comunicados}
            vista={calVista}
            setVista={setCalVista}
            mesOffset={mesOffset}
            setMesOffset={setMesOffset}
            onSelect={openEdit}
          />
        </TabsContent>

        <TabsContent value="sancion">
          {puedeSancionar && <SancionDisciplinariaView />}
        </TabsContent>
      </Tabs>
      {publicando && (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) setPublicando(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>¿Publicar este comunicado?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              «{publicando.titulo}» se enviará{" "}
              {publicando.todaEmpresa ? "a toda la plantilla" : "a sus destinatarios"}.
            </p>
            <div className="space-y-1 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pub-email" className="text-sm font-normal">
                  Mandarlo también por correo
                </Label>
                <Switch
                  id="pub-email"
                  checked={publicarConEmail}
                  onCheckedChange={setPublicarConEmail}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {publicarConEmail
                  ? "Sale un correo con el comunicado y sus documentos."
                  : "Llega al móvil y a Mi panel, pero no al correo."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublicando(null)} disabled={publicandoBusy}>
                Cancelar
              </Button>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={confirmarPublicar} disabled={publicandoBusy}>
                <Send className="h-4 w-4 mr-1" />
                {publicandoBusy ? "Publicando…" : "Publicar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {dialogoConfirmar}
    </div>
  );
}
