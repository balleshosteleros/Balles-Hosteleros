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
  TIPOS_COMUNICADO_ELEGIBLES,
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
  pararRepeticionComunicado,
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
  Trash2, Users, ArrowLeft, Send, Upload, X, Bell, Mail, Paperclip,
  ChevronLeft, ChevronRight, ChevronDown, Settings, ShieldAlert, Link as LinkIcon, Copy,
  Table2, Download, RefreshCw, Ban,
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
import {
  GRAVEDAD_OPCIONES,
  AvisoAcuseRecibo,
  PrototipoSancion,
  EstadoFirmaBadge,
  estadoFirmaLabel,
  gravedadLabel,
  avisoPrescripcion,
  datosSancionVacios,
  type DatosSancion,
  type EmpresaSancion,
} from "@/features/gerencia/components/sancion-disciplinaria-piezas";
import {
  crearSancionDisciplinaria,
  programarSancion,
  listSancionesDisciplinarias,
  getEmpresaDeLaSancion,
  type SancionResumen,
} from "@/features/gerencia/actions/sancion-disciplinaria-actions";
import { leerSancionProgramada } from "@/features/gerencia/data/sancion-programada";
import {
  getVisorOriginalUrl,
  getVisorFirmadoUrl,
  getDescargaFirmadoUrl,
  reenviarFirma,
  cancelarFirma,
} from "@/features/rrhh/actions/firmas-actions";
import { NumberInput } from "@/shared/components/NumberInput";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { getOpcionesSegmento } from "@/features/notificaciones/actions/aviso-manual-actions";
import { ComunicadoTarjeta } from "@/features/gerencia/components/ComunicadoTarjeta";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import { SelectorHora } from "@/components/ui/selector-hora";

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
          {/* A una sola persona no se le habla en plural: una sanción va a una,
              y "lo han abierto 0 de 1" no es castellano (Iván, 12-09-2026). */}
          {lecturas.length === 1
            ? abiertos.length === 1 ? "Lo ha abierto" : "Todavía no lo ha abierto"
            : `Lo han abierto ${abiertos.length} de ${lecturas.length}`}
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
  /**
   * Lo que la sanción pide de más. Solo cuenta cuando el tipo es «Sanción»:
   * en cualquier otro comunicado se queda tal cual y no se mira.
   */
  sancion: DatosSancion;
}

const emptyForm: EditorForm = {
  titulo: "", cuerpo: "", creadorId: "", estado: "borrador",
  recurrencia: "sin_repeticion", tipo: "informativo", todaEmpresa: true,
  rolesDestinatarios: [], departamentosDestinatarios: [], empleadosDestinatarios: [], programado: false,
  envioFecha: "", envioHora: "", adjuntos: [],
  archivosNuevos: [], enviarEmail: false, observaciones: "",
  enlace: "", enlaceTexto: "",
  sancion: datosSancionVacios,
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
    // Una sanción que todavía espera se puede volver a abrir y cambiar: sus
    // datos salen de donde estaban guardados. La que ya se emitió no se reabre.
    sancion: sancionDelComunicado(c),
  };
}

/** Lo que una sanción programada dejó guardado, listo para su ficha. */
function sancionDelComunicado(c: Comunicado): DatosSancion {
  const datos = leerSancionProgramada(c.sancion);
  if (!datos) return datosSancionVacios;
  return {
    ...datosSancionVacios,
    empleadoId: c.empleadosDestinatarios[0] ?? "",
    gravedad: datos.gravedad,
    fechaHechos: datos.fechaHechos,
    plazoDias: datos.plazoDias,
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
  comunicado, onBack, onSave, onEmitirSancion, empleadosReales, departamentosReales,
  empresaNombre, empresaColor, empresaIsotipo, empresaSancion, puedeSancionar, tz,
}: {
  comunicado: Comunicado | null;
  onBack: () => void;
  /** `publicar` lo manda a la plantilla; `borrador` solo lo deja guardado. */
  onSave: (form: EditorForm, intencion: IntencionGuardado) => void | Promise<void>;
  /** La sanción no se publica: se emite, genera su documento y se firma. */
  onEmitirSancion: (form: EditorForm) => Promise<boolean>;
  empleadosReales: EmpleadoSelector[];
  departamentosReales: { id: string; nombre: string }[];
  empresaNombre: string;
  /** Color de marca de la empresa (Ajustes → Imagen de marca). La cabecera del
   *  comunicado se monta sola con él, igual que el correo: nada que configurar. */
  empresaColor: string;
  /** Isotipo de la empresa: es el que sale en el comunicado del trabajador. */
  empresaIsotipo: string;
  /** Razón social, NIF y domicilio: lo que sale IMPRESO en la sanción. */
  empresaSancion: EmpresaSancion | null;
  /** Sin Recursos Humanos, el tipo «Sanción» ni se ofrece. */
  puedeSancionar: boolean;
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
  /**
   * LA SANCIÓN ES UN TIPO DE COMUNICADO. La ficha es la misma —la hoja, el
   * título, el mensaje—, pero por dentro deja de ser un aviso: va a UNA sola
   * persona, pide la falta y los hechos, y al enviarla se genera el documento
   * que el trabajador firma. Ni se programa, ni se archiva, ni se duplica.
   */
  const esSancion = form.tipo === "sancion";
  const empleadoSancionado = useMemo(
    () => empleadosReales.find(e => e.userId === form.sancion.empleadoId) ?? null,
    [empleadosReales, form.sancion.empleadoId],
  );
  const uSancion = (patch: Partial<DatosSancion>) =>
    setForm(f => ({ ...f, sancion: { ...f.sancion, ...patch } }));
  const prescripcion = useMemo(
    () => avisoPrescripcion(form.sancion.fechaHechos, form.sancion.gravedad),
    [form.sancion.fechaHechos, form.sancion.gravedad],
  );
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

  /** Emitir la sanción: genera el documento y se lo manda a firmar. */
  const emitirSancion = async () => {
    if (enMarcha) return;
    setEnMarcha("publicar");
    try {
      await onEmitirSancion({ ...form, creadorId: form.creadorId || user?.id || "" });
    } finally {
      setEnMarcha(null);
    }
  };

  /** Hasta que no esté todo, el botón de enviar se queda apagado. */
  const sancionCompleta =
    !!form.sancion.empleadoId &&
    !!form.cuerpo.trim() &&
    !!form.sancion.fechaHechos &&
    (!form.programado || !!form.envioFecha);


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
    // Una sanción sin emitir NO se guarda: no existe la sanción a medias. O se
    // manda entera o no se ha escrito nunca.
    if (esSancion) {
      onBack();
      return;
    }
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
            <h2 className="text-base font-semibold tracking-tight">
              {esSancion ? "Así la firmará el trabajador" : "Así lo verá el equipo"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {esSancion ? "Es el documento que se le manda." : "Es la misma vista de Mi panel."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPreview(false)}>
            <ArrowLeft className="h-4 w-4 mr-1" />Volver al editor
          </Button>
        </div>
        {esSancion ? (
          <PrototipoSancion
            datos={{
              ...form.sancion,
              fechaEmision: form.programado && form.envioFecha
                ? form.envioFecha
                : claveDiaEnZona(new Date().toISOString(), tz),
              horaEmision: form.programado && form.envioFecha
                ? form.envioHora || "00:00"
                : formatHoraEnZona(new Date().toISOString(), tz),
            }}
            hechos={form.cuerpo}
            empleado={empleadoSancionado}
            empresa={empresaSancion}
          />
        ) : (
        <>
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
        </>
        )}
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
          <h2 className="text-sm font-bold">
            {esSancion
              ? "Sanción disciplinaria"
              : isEdit ? "Editar comunicado" : "Crear comunicado"}
          </h2>
          {!esSancion && <EstadoBadge estado={form.estado} />}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(true)} disabled={!!enMarcha}><Eye className="h-4 w-4 mr-1" />Previsualizar</Button>
          {esSancion ? (
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={emitirSancion}
              disabled={!!enMarcha || !sancionCompleta}
            >
              {enMarcha ? (
                <LoadingSpinner size="sm" className="py-0 mr-1" iconClassName="text-current" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              {enMarcha
                ? vaProgramado ? "Programando…" : "Enviando…"
                : vaProgramado ? "Programar" : "Enviar"}
            </Button>
          ) : (
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
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-5 max-w-3xl space-y-4">
            {/* El comunicado se escribe sobre la hoja tal y como se recibe: la
                franja de marca de la empresa arriba y el texto dentro. No hay
                nada que montar ni colores que elegir. */}
            {esSancion && <AvisoAcuseRecibo />}

            <Card className="overflow-hidden shadow-sm">
              <div className="h-2" style={{ background: empresaColor }} />
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1">
                  {/* El encabezamiento de una sanción no se escribe: lo fija la
                      ley y es el que sale impreso en el documento. */}
                  {esSancion ? (
                    <p className="py-1 text-xl font-bold">Comunicación de sanción disciplinaria</p>
                  ) : (
                    <>
                      <Label className="text-xs font-medium text-muted-foreground">Título</Label>
                      <Input
                        value={form.titulo}
                        onChange={e => u({ titulo: e.target.value })}
                        placeholder="Cambio de horario de invierno"
                        className="text-xl font-bold border-0 rounded-none px-0 h-auto py-1 focus-visible:ring-0 shadow-none placeholder:text-muted-foreground/40 placeholder:font-normal"
                      />
                    </>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {esSancion ? "Hechos que motivan la sanción" : "Mensaje"}
                  </Label>
                  <Textarea
                    value={form.cuerpo}
                    onChange={e => u({ cuerpo: e.target.value })}
                    placeholder={esSancion
                      ? "Describe con detalle los hechos, fechas y circunstancias que motivan la sanción…"
                      : "Escribe aquí lo que quieres contarle al equipo…"}
                    className="border-0 px-0 focus-visible:ring-0 shadow-none min-h-[200px] resize-y text-base leading-7 placeholder:text-muted-foreground/40"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Un enlace no se pega dentro del texto: ahí no se puede pulsar
                desde el aviso y se pierde entre el mensaje. Puesto aquí, sale
                como un botón en el aviso, en el comunicado y en el correo.
                En la sanción no hay enlace ni notas: el documento es el que es. */}
            {!esSancion && (
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
            )}

            {/* Las notas no salen en el comunicado, así que van plegadas: no
                tienen por qué robar sitio a lo que sí se manda. */}
            {!esSancion && (
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
            )}
          </div>
        </ScrollArea>

        {/* AJUSTES DEL ENVÍO. Toda la columna tiene que caber de una sola
            mirada: lo que es una lista larga (departamentos, empleados,
            documentos) va plegado y dice cuántos llevas elegidos. */}
        <ScrollArea className="w-80 xl:w-96 border-l bg-muted/20 shrink-0">
          <div className="p-4 space-y-3">
            {/* EL TIPO MANDA. Pinta el recuadro del comunicado y, si se elige
                «Sanción», cambia la ficha entera: deja de ser un aviso y pasa a
                ser el documento disciplinario que firma el trabajador. Solo se
                ofrece sancionar a quien puede editar Recursos Humanos, que es
                el permiso que exige el servidor al emitirla.
                El creador NO se elige: es quien lo escribe, y solo se deja ver. */}
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-normal">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => u({ tipo: v as TipoComunicado })}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_COMUNICADO_ELEGIBLES.map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_COMUNICADO_LABEL[t]}</SelectItem>
                  ))}
                  {/* Se puede elegir al crearla, y sigue ahí al reabrir una que
                      quedó programada. Una ya emitida no se reedita nunca. */}
                  {puedeSancionar && (!isEdit || esSancion) && (
                    <SelectItem value="sancion">{TIPO_COMUNICADO_LABEL.sancion}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {esSancion ? (
              /* LA PARTE TÉCNICA DE LA SANCIÓN. Aquí no hay destinatarios que
                 elegir ni día en que sale: una sanción va a UNA persona y se
                 manda en cuanto se emite. Lo que se pide es lo que la ley exige
                 que conste (arts. 58 y 60.2 del Estatuto de los Trabajadores). */
              <>
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />Trabajador sancionado
                  </Label>
                  <Select value={form.sancion.empleadoId} onValueChange={v => uSancion({ empleadoId: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecciona al trabajador…" /></SelectTrigger>
                    <SelectContent>
                      {empleadosReales.map(e => {
                        const extra = [e.puesto ?? e.rolLabel, e.departamento].filter(Boolean).join(" · ");
                        return (
                          <SelectItem key={e.userId} value={e.userId}>
                            {e.nombre} {e.apellidos}
                            {extra && <span className="text-muted-foreground">{" — "}{extra}</span>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Una sanción se dirige a una sola persona: no se manda en bloque.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" />La falta
                  </Label>
                  <div>
                    <Label className="text-xs text-muted-foreground">Calificación</Label>
                    <Select value={form.sancion.gravedad} onValueChange={v => uSancion({ gravedad: v as DatosSancion["gravedad"] })}>
                      <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GRAVEDAD_OPCIONES.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Fecha de los hechos</Label>
                    <SelectorFecha className="mt-1 h-9 text-xs"
                      value={form.sancion.fechaHechos}
                      onChange={(valor) => uSancion({ fechaHechos: valor })}
                    />
                  </div>
                  {prescripcion && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                      {prescripcion}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />Firma
                  </Label>
                  <div>
                    <Label className="text-xs text-muted-foreground">Días para firmarla</Label>
                    <NumberInput
                      min={1}
                      max={60}
                      decimales={false}
                      emptyValue={15}
                      value={form.sancion.plazoDias}
                      onValueChange={v => uSancion({ plazoDias: v })}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Cuando salga se genera el documento, le llega por correo y aviso, y lo firma
                    dentro del software. Pasados esos días el enlace caduca.
                  </p>
                </div>

                <Separator />

                {/* Se puede dejar para otro día, igual que un comunicado. Hasta
                    que llega ese día no se genera nada: el documento se monta
                    cuando sale, y el plazo de firma empieza a contar ahí. */}
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />Cuándo sale
                  </Label>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="sw-prog-sancion" className="text-sm font-normal">Dejarla programada</Label>
                    <Switch checked={form.programado} onCheckedChange={v => u({ programado: v })} id="sw-prog-sancion" />
                  </div>
                  {form.programado ? (
                    <div className="grid grid-cols-2 gap-2">
                      <SelectorFecha className="h-8 text-xs" value={form.envioFecha} onChange={(valor) => u({ envioFecha: valor })} />
                      <SelectorHora className="h-8 text-xs" value={form.envioHora} onChange={(valor) => u({ envioHora: valor })} />
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Sale en cuanto pulses «Enviar».</p>
                  )}
                </div>

              </>
            ) : (
              <>
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
                  <SelectorFecha className="h-8 text-xs" value={form.envioFecha} onChange={(valor) => u({ envioFecha: valor })} />
                  <SelectorHora className="h-8 text-xs" value={form.envioHora} onChange={(valor) => u({ envioHora: valor })} />
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
              </>
            )}

            {creadorNombre && !esSancion && (
              <p className="text-[11px] text-muted-foreground">Lo firma {creadorNombre}.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ComunicadoCalendario({ comunicados, vista, setVista, mesOffset, setMesOffset, onSelect }: {
  comunicados: FilaComunicado[];
  vista: "mensual" | "anual";
  setVista: (v: "mensual" | "anual") => void;
  mesOffset: number;
  setMesOffset: (fn: (p: number) => number) => void;
  onSelect: (c: FilaComunicado) => void;
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
    sancion: fila.sancion ?? null,
    origenId: typeof fila.origen_id === "string" ? fila.origen_id : null,
    repeticionParadaAt:
      typeof fila.repeticion_parada_at === "string" ? fila.repeticion_parada_at : null,
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

/**
 * Fila del listado. Es un comunicado, y si lleva `firma` es una sanción ya
 * EMITIDA: los datos de la lista se leen igual (título, tipo, cuándo salió, a
 * quién) y lo que cambia es el estado —el de su firma— y lo que se puede hacer
 * con ella. Una sanción todavía programada no la lleva: hasta que sale es un
 * comunicado más, y se edita y se borra como tal.
 */
type FilaComunicado = Comunicado & { firma?: SancionResumen };

/** Una sanción emitida, contada como lo que es en la lista de comunicados. */
function sancionAFila(s: SancionResumen): FilaComunicado {
  return {
    id: `sancion-${s.id}`,
    titulo: `Sanción disciplinaria — ${s.empleadoNombre}`,
    cuerpo: s.resumen,
    // El estado de verdad es el de la firma y se pinta aparte; este solo sirve
    // para que los filtros y el orden de la barra no se queden sin valor.
    estado: "publicado",
    creadorId: "",
    creadoEl: s.enviadoEn,
    envio: s.enviadoEn,
    recurrencia: "sin_repeticion",
    // Una sanción va a UNA persona: su alcance es 0 % o 100 %, y se persigue
    // igual que cualquier comunicado (Iván, 12-09-2026). La ruleta y el nombre
    // salen de lo mismo: si consta que la abrió y cuándo.
    alcancePct: s.vistoEl ? 100 : 0,
    lecturas: [{ nombre: s.empleadoNombre, vistaAt: s.vistoEl }],
    rolesDestinatarios: [],
    todaEmpresa: false,
    departamentosDestinatarios: s.departamento && s.departamento !== "—" ? [s.departamento] : [],
    empleadosDestinatarios: [],
    destinatarios: { empresas: 0, departamentos: 0, empleados: 1 },
    tipo: "sancion",
    observaciones: "",
    adjuntos: [],
    enviarEmail: true,
    enlace: "",
    enlaceTexto: "",
    sancion: null,
    origenId: null,
    repeticionParadaAt: null,
    firma: s,
  };
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
  /**
   * Las sanciones NO se guardan en `comunicados`: son documentos firmables y
   * viven en el circuito de firmas, con su PDF, su acta y su carpeta. Pero se
   * escriben y se consultan aquí, así que se traen y se enseñan en la misma
   * lista, marcadas con su tipo.
   */
  const [sanciones, setSanciones] = useState<SancionResumen[]>([]);
  const [empresaSancion, setEmpresaSancion] = useState<EmpresaSancion | null>(null);
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

  const loadSanciones = useCallback(async () => {
    if (!puedeSancionar) {
      setSanciones([]);
      return;
    }
    const [lista, empresa] = await Promise.all([
      listSancionesDisciplinarias(),
      getEmpresaDeLaSancion(),
    ]);
    if (lista.ok) setSanciones(lista.data);
    if (empresa.ok) setEmpresaSancion(empresa.data);
  }, [puedeSancionar]);

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

  useEffect(() => { void loadSanciones(); }, [loadSanciones]);

  /** El calendario ya no es una pestaña: es otra forma de ver la misma lista. */
  const [vistaCalendario, setVistaCalendario] = useState(false);
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
  // Una sanción que el trabajador acaba de firmar cambia de estado sin recargar.
  useSincronizacionEnVivo({
    tablas: ["firmas_documentos"],
    onCambio: () => void loadSanciones(),
    pausado: editorMode !== "list",
  });
  const [faltantesComunicado, setFaltantesComunicado] = useState<string[]>([]);
  /** Comunicado a punto de publicarse desde el listado, y si sale por correo. */
  const [publicando, setPublicando] = useState<Comunicado | null>(null);
  const [publicarConEmail, setPublicarConEmail] = useState(false);
  const [publicandoBusy, setPublicandoBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const { validar: validarComunicado } = useReglasSubmodulo("gerencia", "comunicados");

  /**
   * TODO lo que hay en esta pantalla, en una sola lista: los comunicados y las
   * sanciones emitidas, ordenado por lo último que salió.
   */
  const listaCompleta = useMemo<FilaComunicado[]>(() => {
    // Una sanción YA EMITIDA sale por su documento, que es donde se ve si la ha
    // firmado; el comunicado que le queda al trabajador no se repite aquí. La
    // que todavía está programada sí sale: aún no existe como documento.
    const filas: FilaComunicado[] = [
      ...comunicados.filter(c => c.tipo !== "sancion" || c.estado !== "publicado"),
      ...sanciones.map(sancionAFila),
    ];
    /**
     * Arriba, LO ÚLTIMO QUE HA SALIDO. Un comunicado que se manda hoy sube al
     * primer puesto aunque se escribiera hace un año: lo que se mira es cuándo
     * salió, no cuándo se redactó (Iván, 12-09-2026). Lo que todavía no ha
     * salido se ordena por cuándo se escribió, porque su fecha de envío está en
     * el futuro y no dice nada de lo ocurrido.
     */
    const cuando = (c: FilaComunicado) =>
      (c.estado === "publicado" || c.estado === "archivado"
        ? c.envio ?? c.creadoEl
        : c.creadoEl) ?? "";
    return filas.sort((a, b) => cuando(b).localeCompare(cuando(a)));
  }, [comunicados, sanciones]);

  /**
   * El alcance medio de TODO lo que ha salido, sanciones incluidas.
   *
   * Cuenta cada comunicado con destinatarios de verdad, también los que están
   * al 0 % y los que van a una sola persona: antes solo entraban los que ya
   * tenían alguna lectura, así que la cifra siempre salía bonita y no decía la
   * verdad (Iván, 12-09-2026). Lo que no ha salido todavía —borradores y
   * programados— no tiene alcance que medir y no entra.
   */
  const alcanceMedio = useMemo(() => {
    const medibles = listaCompleta.filter(c => c.lecturas.length > 0);
    if (medibles.length === 0) return 0;
    return Math.round(medibles.reduce((s, c) => s + c.alcancePct, 0) / medibles.length);
  }, [listaCompleta]);

  /**
   * LA PLANTILLA Y SUS SALIDAS.
   *
   * Una línea con `origenId` es una salida: nació de la plantilla el día que le
   * tocaba. La repetición vive SOLO en la plantilla, así que para saber si está
   * parada —o para pararla— hay que mirar allí, se pulse desde donde se pulse.
   */
  const plantillaDe = (c: FilaComunicado): Comunicado | null =>
    c.origenId ? comunicados.find(x => x.id === c.origenId) ?? null : null;

  /** Cada cuánto se repite la línea, sea plantilla o salida de una. */
  const recurrenciaDe = (c: FilaComunicado): Recurrencia =>
    (c.origenId ? comunicados.find(x => x.id === c.origenId)?.recurrencia : null) ??
    c.recurrencia;

  /** `true` si esa línea pertenece a un comunicado que se repite. */
  const esDeLosQueSeRepiten = (c: FilaComunicado): boolean =>
    recurrenciaDe(c) !== "sin_repeticion";

  /** Cuándo se paró su repetición. Null = sigue viva. */
  const paradaDe = (c: FilaComunicado): string | null =>
    (c.origenId ? plantillaDe(c)?.repeticionParadaAt : c.repeticionParadaAt) ?? null;

  /** `true` si esa plantilla ya ha dejado alguna salida: no se puede borrar. */
  const yaHaSalido = (c: FilaComunicado): boolean =>
    comunicados.some(x => x.origenId === c.id);

  const accesoComunicado = useCallback((c: Comunicado, campo: string): unknown => {
    if (campo === "estado") return c.estado;
    if (campo === "recurrencia") {
      // Una salida filtra y ordena por la recurrencia de SU plantilla, que es
      // la que se lee en su línea.
      const f = c as FilaComunicado;
      return (
        (f.origenId ? comunicados.find(x => x.id === f.origenId)?.recurrencia : null) ??
        f.recurrencia
      );
    }
    if (campo === "tipo") return c.tipo;
    if (campo === "titulo") return c.titulo;
    if (campo === "creadoEl") return c.creadoEl;
    if (campo === "envio") return c.envio ?? "";
    if (campo === "alcancePct") return c.alcancePct;
    return (c as unknown as Record<string, unknown>)[campo];
    // `comunicados` entra porque la recurrencia de una salida se lee de su
    // plantilla, y la plantilla está en esa lista.
  }, [comunicados]);

  const filtered = useMemo(() => {
    let lista: FilaComunicado[] = listaCompleta.filter(c => {
      const q = search.toLowerCase();
      if (!q) return true;
      if (c.titulo.toLowerCase().includes(q)) return true;
      // De una sanción se busca por el trabajador o por cómo está la firma.
      return !!c.firma && (
        c.firma.empleadoNombre.toLowerCase().includes(q) ||
        estadoFirmaLabel(c.firma.estado).toLowerCase().includes(q)
      );
    });
    const accesoGenerico = accesoComunicado as unknown as (
      c: Record<string, unknown>,
      campo: string,
    ) => unknown;
    lista = aplicarFiltrosToolbar(
      lista as unknown as Record<string, unknown>[],
      filtros,
      accesoGenerico,
    ) as unknown as FilaComunicado[];
    lista = aplicarOrdenToolbar(
      lista as unknown as Record<string, unknown>[],
      orden,
      accesoGenerico,
    ) as unknown as FilaComunicado[];
    return lista;
  }, [listaCompleta, search, filtros, orden, accesoComunicado]);


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

  /**
   * PARAR (o volver a arrancar) LA REPETICIÓN.
   *
   * Se puede pulsar desde cualquiera de sus líneas: la repetición vive solo en
   * la plantilla, así que no hay nada que copiar en las demás. Parada, no sale
   * NUNCA más; las salidas de antes se quedan como están, porque ya ocurrieron.
   */
  const pararRepeticion = async (c: FilaComunicado, parar: boolean) => {
    const cada = RECURRENCIA_LABELS[recurrenciaDe(c)].toLowerCase();
    const ok = await confirm({
      title: parar ? "¿Parar la repetición?" : "¿Volver a repetirlo?",
      description: parar
        ? `«${c.titulo}» no volverá a salir. Lo que ya se envió se queda como está, y el comunicado sigue escrito para poder arrancarlo otro día.`
        : `«${c.titulo}» volverá a salir con su repetición ${cada}.`,
      confirmLabel: "Aceptar",
    });
    if (!ok) return;
    const res = await pararRepeticionComunicado(c.id, parar);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cambiar la repetición");
      return;
    }
    toast.success(parar ? "Repetición parada" : "Vuelve a repetirse");
    await loadComunicados();
  };

  const eliminar = async (c: Comunicado) => {
    const esSancionProgramada = c.tipo === "sancion";
    const ok = await confirm({
      title: esSancionProgramada ? "¿Eliminar esta sanción?" : "¿Eliminar este comunicado?",
      description: esSancionProgramada
        ? `Se borrará la sanción de «${c.titulo}», que aún no ha salido. Esta acción no se puede deshacer.`
        : `Se borrará «${c.titulo}». Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const res = await deleteComunicado(c.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar");
      return;
    }
    toast.success(esSancionProgramada ? "Sanción eliminada" : "Comunicado eliminado");
    await loadComunicados();
  };

  /**
   * EMITIR LA SANCIÓN. No se crea ningún comunicado: se genera el documento
   * oficial, se registra para firma y le llega al trabajador por correo y
   * aviso. A partir de ahí sigue el mismo circuito de siempre —firmada o no
   * firmada, con su acta— y acaba en su carpeta «Sanciones».
   */
  const emitirSancion = async (form: EditorForm): Promise<boolean> => {
    // Con día puesto no se emite nada todavía: se deja programada y el cron la
    // saca ese día, que es cuando se monta el documento.
    if (form.programado && form.envioFecha) {
      const res = await programarSancion({
        comunicadoId: editingComunicado?.id,
        empleadoId: form.sancion.empleadoId,
        gravedad: form.sancion.gravedad,
        fechaHechos: form.sancion.fechaHechos,
        hechos: form.cuerpo,
        plazoDias: form.sancion.plazoDias,
        envio: zonaLocalAUtcISO(form.envioFecha, form.envioHora || "00:00", tz),
      });
      if (!res.ok) {
        toast.error(res.error || "No se pudo programar la sanción");
        return false;
      }
      toast.success("Sanción programada");
      await loadComunicados();
      closeEditor();
      return true;
    }

    const res = await crearSancionDisciplinaria({
      empleadoId: form.sancion.empleadoId,
      gravedad: form.sancion.gravedad,
      fechaHechos: form.sancion.fechaHechos,
      hechos: form.cuerpo,
      plazoDias: form.sancion.plazoDias,
    });
    if (!res.ok) {
      toast.error(res.error || "No se pudo emitir la sanción");
      return false;
    }
    // Si venía de una programada y se ha decidido mandarla ya, el comunicado que
    // estaba esperando sobra: la emisión ha dejado el suyo publicado.
    if (editingComunicado?.id) await deleteComunicado(editingComunicado.id);
    toast.success(
      res.emailEnviado
        ? "Sanción enviada al trabajador para firma"
        : "Sanción creada (revisa el email del trabajador)",
    );
    await Promise.all([loadSanciones(), loadComunicados()]);
    closeEditor();
    return true;
  };

  /** Abrir un PDF de la sanción (el original, el firmado o su descarga). */
  const abrirDocumentoSancion = async (
    accion: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>,
  ) => {
    const res = await accion();
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  };

  /**
   * Pulsar una fila. Un comunicado se abre para leerlo o editarlo; una sanción
   * ya emitida no se toca: lo que se abre es el documento que se mandó.
   */
  const abrirFila = (c: FilaComunicado) => {
    if (c.firma) {
      void abrirDocumentoSancion(() => getVisorOriginalUrl(c.firma!.id));
      return;
    }
    openEdit(c);
  };

  const reenviarSancion = async (s: SancionResumen) => {
    const ok = await confirm({
      title: "Reenviar la sanción",
      description: `Se vuelve a mandar a ${s.empleadoNombre} el correo con el enlace para firmarla.`,
      confirmLabel: "Aceptar",
      tono: "normal",
    });
    if (!ok) return;
    const res = await reenviarFirma(s.id);
    if (res.ok) {
      toast.success(res.emailEnviado ? "Sanción reenviada" : "Reenviada (revisa el email del trabajador)");
      await loadSanciones();
    } else {
      toast.error(res.error);
    }
  };

  const cancelarSancion = async (s: SancionResumen) => {
    const ok = await confirm({
      title: "Cancelar la sanción",
      description: `La sanción de ${s.empleadoNombre} quedará anulada y el enlace de firma dejará de funcionar.`,
      confirmLabel: "Cancelar sanción",
    });
    if (!ok) return;
    const res = await cancelarFirma(s.id);
    if (res.ok) {
      toast.success("Sanción cancelada");
      await loadSanciones();
    } else {
      toast.error(res.error);
    }
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

    /**
     * MANDAR AHORA UNO QUE SE REPITE no lo convierte en «publicado»: deja su
     * salida de hoy y la plantilla sigue esperando la siguiente vez. Por eso se
     * guarda como programado y se manda por el camino de siempre, que es el que
     * saca la salida (Iván, 12-09-2026).
     */
    const publicarRepetido =
      form.recurrencia !== "sin_repeticion" &&
      estadoFinal === "publicado" &&
      editorMode !== "create";
    const estadoAGuardar: EstadoComunicado = publicarRepetido ? "programado" : estadoFinal;

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
      estado: estadoAGuardar,
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
      // Uno que se repite se manda por su camino: deja la salida de hoy y la
      // plantilla se queda esperando la próxima vez.
      let avisos: { emailEnviados?: number; emailError?: string } = res;
      if (publicarRepetido && editingComunicado) {
        const salida = await cambiarEstadoComunicado(
          editingComunicado.id,
          "publicado",
          form.enviarEmail,
        );
        if (!salida.ok) {
          toast.error(salida.error ?? "No se pudo mandar el comunicado");
          await loadComunicados();
          closeEditor();
          return;
        }
        avisos = salida;
      }
      toast.success(
        estadoFinal === "publicado"
          ? "Comunicado publicado"
          : estadoFinal === "programado"
            ? "Comunicado programado"
            : "Guardado como borrador",
      );
      // El correo se dice aparte: que salga el comunicado y no salga el correo
      // es exactamente lo que nadie se entera de que ha pasado.
      const enviados = avisos.emailEnviados ?? 0;
      const errorEmail = avisos.emailError;
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
          onEmitirSancion={emitirSancion}
          empleadosReales={empleadosReales}
          departamentosReales={departamentosReales}
          empresaNombre={empresaResuelta ? empresaActual?.nombre ?? "" : ""}
          empresaColor={empresaActual?.color ?? "hsl(var(--primary))"}
          empresaIsotipo={empresaActual ? getIsotipoUrl(empresaActual.id) : ""}
          empresaSancion={empresaSancion}
          puedeSancionar={puedeSancionar}
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

  const columnDefs: Record<string, { th: ReactNode; td: (c: FilaComunicado) => ReactNode }> = {
    titulo: {
      th: <TableHead key="titulo">Título</TableHead>,
      td: (c) => (
        <TableCell key="titulo">
          <p className="font-semibold text-sm">{c.titulo}</p>
          {/* En una sanción, la calificación de la falta se lee aquí mismo:
              es lo primero que se busca y estaba dentro del PDF. */}
          {c.firma && (
            <p className="text-[11px] text-muted-foreground">{gravedadLabel(c.firma.gravedad)}</p>
          )}
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
        <TableCell key="estado" className="whitespace-nowrap">
          {/* En una sanción lo que importa es si la ha firmado, no si está
              publicada: publicada lo está desde que se emite. */}
          {c.firma ? <EstadoFirmaBadge estado={c.firma.estado} /> : <EstadoBadge estado={c.estado} />}
        </TableCell>
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
        <TableCell key="envio" className="text-sm text-muted-foreground whitespace-nowrap">
          {/* En lo que ya salió, el día que salió. En lo que está esperando, el
              día que le toca: son dos cosas distintas y se leen distinto. */}
          {!c.envio
            ? "—"
            : c.estado === "programado"
              ? `Próximo: ${formatFechaHoraEnZona(c.envio, tz)}`
              : formatFechaHoraEnZona(c.envio, tz)}
        </TableCell>
      ),
    },
    recurrencia: {
      th: <TableHead key="recurrencia">Recurrencia</TableHead>,
      td: (c) => (
        <TableCell key="recurrencia" className="whitespace-nowrap">
          {/* La sanción no se repite NUNCA y no se puede cambiar: pone "No",
              como cualquier comunicado que sale una sola vez. Un guion dejaba
              la duda de si faltaba el dato (Iván, 12-09-2026).
              Una salida dice de qué repetición viene —la de su plantilla—, y si
              esa repetición está parada se lee aquí mismo. */}
          <Badge variant="outline" className="text-xs">
            {RECURRENCIA_LABELS[recurrenciaDe(c)]}
            {esDeLosQueSeRepiten(c) && paradaDe(c) ? " · parada" : ""}
          </Badge>
        </TableCell>
      ),
    },
    alcance: {
      th: <TableHead key="alcance">Alcance</TableHead>,
      td: (c) => (
        <TableCell key="alcance">
          {/* TODO lo que sale de aquí se persigue igual, aunque vaya a una sola
              persona: sanciones incluidas (Iván, 12-09-2026). */}
          <AlcanceCircle pct={c.alcancePct} lecturas={c.lecturas} tz={tz} />
        </TableCell>
      ),
    },
    destinatarios: {
      th: <TableHead key="destinatarios">Destinatarios</TableHead>,
      td: (c) => (
        <TableCell key="destinatarios">
          <div className="flex flex-wrap gap-1">
            {c.firma ? (
              <Badge variant="outline" className="text-[11px] gap-1">
                <Users className="h-3 w-3" />{c.firma.empleadoNombre}
              </Badge>
            ) : c.todaEmpresa ? (
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
      {/* Lo primero que se mira no es cuántos llevas, es lo que te queda por
          mandar: los borradores son lo único que pide una acción. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{comunicados.filter(c => c.estado === "borrador").length}</p><p className="text-xs text-muted-foreground">Borradores</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{comunicados.filter(c => c.estado === "publicado").length}</p><p className="text-xs text-muted-foreground">Publicados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{comunicados.filter(c => c.estado === "programado").length}</p><p className="text-xs text-muted-foreground">Programados</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center"><p className="text-2xl font-bold">{alcanceMedio}%</p><p className="text-xs text-muted-foreground">Alcance medio</p></CardContent></Card>
      </div>

      <>
          <div className="mb-4">
            <SubmoduleToolbar
              busqueda={search}
              onBusquedaChange={setSearch}
              placeholderBusqueda="Buscar"
              onNuevo={openCreate}
              /* El calendario no es otra pantalla: es la misma lista vista por
                 días, así que se enciende desde aquí, al lado de «Nuevo». */
              extraIzquierda={
                <Button
                  size="icon"
                  variant={vistaCalendario ? "default" : "outline"}
                  className="h-9 w-9"
                  onClick={() => setVistaCalendario(v => !v)}
                  title={vistaCalendario ? "Ver la lista" : "Ver el calendario"}
                  aria-label={vistaCalendario ? "Ver la lista" : "Ver el calendario"}
                >
                  {vistaCalendario
                    ? <Table2 className="h-4 w-4" strokeWidth={1.75} />
                    : <CalendarDays className="h-4 w-4" strokeWidth={1.75} />}
                </Button>
              }
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

          {vistaCalendario ? (
            <ComunicadoCalendario
              comunicados={filtered}
              vista={calVista}
              setVista={setCalVista}
              mesOffset={mesOffset}
              setMesOffset={setMesOffset}
              onSelect={abrirFila}
            />
          ) : (
          <Card>
            <Table data-tabla-consulta>
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
                      {c.firma ? (
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-lg">
                              <DropdownMenuItem className={ITEM_MENU} onClick={() => void abrirDocumentoSancion(() => getVisorOriginalUrl(c.firma!.id))}>
                                <Eye className={ICONO_MENU} strokeWidth={1.75} />Ver la sanción
                              </DropdownMenuItem>
                              {/* «leido» = la cerró sin firmarla: ese PDF también
                                  existe, con el NO FIRMADO en rojo y su acta detrás. */}
                              {(c.firma.estado === "firmado" || c.firma.estado === "leido") && (
                                <>
                                  <DropdownMenuItem className={ITEM_MENU} onClick={() => void abrirDocumentoSancion(() => getVisorFirmadoUrl(c.firma!.id))}>
                                    <Eye className={ICONO_MENU} strokeWidth={1.75} />
                                    {c.firma.estado === "firmado" ? "Ver la firmada" : "Ver la no firmada"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className={ITEM_MENU} onClick={() => void abrirDocumentoSancion(() => getDescargaFirmadoUrl(c.firma!.id))}>
                                    <Download className={ICONO_MENU} strokeWidth={1.75} />Descargar con el acta
                                  </DropdownMenuItem>
                                </>
                              )}
                              {c.firma.estado === "pendiente" && (
                                <>
                                  <DropdownMenuItem className={ITEM_MENU} onClick={() => void reenviarSancion(c.firma!)}>
                                    <RefreshCw className={ICONO_MENU} strokeWidth={1.75} />Reenviar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className={`${ITEM_MENU} text-destructive focus:text-destructive`}
                                    onClick={() => void cancelarSancion(c.firma!)}
                                  >
                                    <Ban className={ICONO_MENU} strokeWidth={1.75} />Cancelar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : (
                      <div className="flex items-center justify-end gap-1">
                        {/* Lo que estaba escrito y sin mandar se publica desde
                            aquí, a la vista, sin tener que abrir la ficha. Una
                            sanción no: publicarla es emitir su documento, y eso
                            se hace desde su ficha o el día que le toca. */}
                        {c.estado !== "publicado" && c.tipo !== "sancion" && (
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
                          {c.tipo !== "sancion" && (
                            <DropdownMenuItem className={ITEM_MENU} onClick={() => duplicar(c)}>
                              <Copy className={ICONO_MENU} strokeWidth={1.75} />Duplicar
                            </DropdownMenuItem>
                          )}
                          {c.estado === "publicado" && c.tipo !== "sancion" && (
                            <DropdownMenuItem className={ITEM_MENU} onClick={() => mandarPorCorreo(c)}>
                              <Mail className={ICONO_MENU} strokeWidth={1.75} />Mandar por correo
                            </DropdownMenuItem>
                          )}
                          {c.estado !== "archivado" && c.tipo !== "sancion" && (
                            <DropdownMenuItem className={ITEM_MENU} onClick={() => archivar(c)}>
                              <Archive className={ICONO_MENU} strokeWidth={1.75} />Archivar
                            </DropdownMenuItem>
                          )}
                          {/* PARAR LA REPETICIÓN, desde cualquiera de sus
                              líneas: la plantilla o cualquier salida. Actúa
                              siempre sobre la plantilla, que es donde vive
                              (Iván, 12-09-2026). */}
                          {esDeLosQueSeRepiten(c) && c.tipo !== "sancion" && (
                            <DropdownMenuItem
                              className={ITEM_MENU}
                              onClick={() => void pararRepeticion(c, !paradaDe(c))}
                            >
                              {paradaDe(c) ? (
                                <>
                                  <RefreshCw className={ICONO_MENU} strokeWidth={1.75} />Volver a repetirlo
                                </>
                              ) : (
                                <>
                                  <Ban className={ICONO_MENU} strokeWidth={1.75} />Parar la repetición
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          {/* UN COMUNICADO ENVIADO NO SE BORRA. La plantilla ya
                              lo tiene y quedan sus lecturas: lo que se hace con
                              uno viejo es archivarlo (Iván, 12-09-2026). Solo
                              se puede borrar lo que aún no ha salido, y una
                              plantilla que ya ha dejado salidas tampoco: esa se
                              para. */}
                          {(c.estado === "borrador" || c.estado === "programado") && !yaHaSalido(c) && (
                            <>
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuItem
                                className={`${ITEM_MENU} text-destructive focus:text-destructive`}
                                onClick={() => eliminar(c)}
                              >
                                <Trash2 className={ICONO_MENU} strokeWidth={1.75} />Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={columnasRender.length + 1} className="text-center text-muted-foreground py-8">{cargando ? "Cargando…" : "No se encontraron comunicados"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
          )}
      </>
      {publicando && (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) setPublicando(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>¿Publicar este comunicado?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              «{publicando.titulo}» se enviará{" "}
              {publicando.todaEmpresa ? "a toda la plantilla" : "a sus destinatarios"}.
              {/* Mandar ahora uno que se repite no rompe su repetición: deja su
                  línea de hoy y sigue saliendo cuando le toque. */}
              {publicando.recurrencia !== "sin_repeticion"
                ? " Se queda su línea con la salida de hoy y seguirá saliendo cuando le toque."
                : ""}
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
