"use client";

import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2, FileText, Sparkles, Star,
  AlertTriangle, Inbox, Trash2, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CandidatoDetailModal } from "@/features/rrhh/components/reclutamiento/CandidatoDetailModal";
import {
  ESTADOS_CONFIG,
  type Candidato, type Vacante, type EstadoReclutamiento, type OrigenCandidatura,
} from "@/features/rrhh/data/reclutamiento";
import {
  listCandidatosReales,
  iniciarOffboarding,
  eliminarCandidato,
  actualizarDatosCandidato,
} from "@/features/rrhh/actions/candidatos-actions";
import { ContratarDialog } from "@/features/rrhh/components/reclutamiento/ContratarDialog";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

type Fase = "nuevo" | "en_progreso" | "oferta" | "seleccionado" | "descartado";
type Estado =
  | "nuevo" | "elegido" | "papelera" | "entrevista" | "documentacion" | "teorica"
  | "practica" | "prueba" | "empleado" | "no_se_presenta" | "suspenso_formacion";

interface CandidatoReal {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  telefono: string | null;
  cv_url: string | null;
  origen: string | null;
  genero: string | null;
  ubicacion: string | null;
  disponibilidad: string | null;
  experiencia_previa: string | null;
  carta_presentacion: string | null;
  como_nos_conocio: string | null;
  puntuacion: number | null;
  /** Nota final de las reseñas (media 0–5 de todas las estrellas), o null si no hay. */
  nota_resenas: number | null;
  fase: Fase;
  estado: Estado;
  promovido_at: string | null;
  empleado_id: string | null;
  activo: boolean | null;
  vacante_id: string | null;
  vacantes?: { id: string; titulo: string; departamento_id: string | null; puesto_id: string | null } | null;
  created_at: string;
}

function fmtFecha(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

const ORIGENES_VALIDOS = new Set<OrigenCandidatura>([
  "web", "formulario", "redes_sociales", "recomendacion", "base_datos", "portal_empleo", "otros",
]);

/** Mapea la fila real de BD a la forma `Candidato` que consume la ficha modal. */
function toCandidato(c: CandidatoReal): Candidato {
  const origen = (c.origen && ORIGENES_VALIDOS.has(c.origen as OrigenCandidatura)
    ? c.origen
    : "otros") as OrigenCandidatura;
  return {
    id: c.id,
    nombre: c.nombre,
    apellidos: c.apellidos ?? "",
    telefono: c.telefono ?? "",
    email: c.email,
    cvAdjunto: c.cv_url ?? undefined,
    fechaInscripcion: c.created_at?.slice(0, 10) ?? "",
    origen,
    notasInternas: "",
    fase: c.estado as EstadoReclutamiento,
    vacanteId: c.vacante_id ?? "",
    reclutadorAsignado: "",
    historial: [],
    ubicacion: c.ubicacion ?? undefined,
    genero: (c.genero === "masculino" || c.genero === "femenino" ? c.genero : undefined) as Candidato["genero"],
    disponibilidad: (c.disponibilidad === "inmediato" || c.disponibilidad === "15_dias" ? c.disponibilidad : undefined) as Candidato["disponibilidad"],
    experienciaPrevia: (["sin_experiencia", "menos_1", "de_1_a_5", "mas_5"].includes(c.experiencia_previa ?? "") ? c.experiencia_previa : undefined) as Candidato["experienciaPrevia"],
    // "Carta de presentación" en la ficha = lo que el candidato escribió
    // (opcional) en el formulario público; mismo dato, una sola columna.
    sobreTi: c.carta_presentacion ?? undefined,
    comoNosConocio: c.como_nos_conocio ?? null,
    activo: c.activo ?? true,
  };
}

/** Vacante mínima para la cabecera/cuestionario de la ficha. */
function vacanteParaModal(c: CandidatoReal | null): Vacante {
  return {
    id: c?.vacante_id ?? "",
    puesto: c?.vacantes?.titulo ?? "Candidatura",
    categoria: "",
    ubicacion: "",
    tipoJornada: "completa",
    estadoPublicacion: "publicada",
    fechaCreacion: "",
    cuestionario: true,
    reclutadores: [],
    favorita: false,
    candidatos: [],
    empresaId: "",
  };
}

// ─── Columnas configurables (BARRA HORIZONTAL 1) ────────────────
const COLUMNAS_DEF: ToolbarColumna[] = [
  { campo: "candidato", label: "Candidato", bloqueada: true },
  { campo: "vacante", label: "Vacante" },
  { campo: "estado", label: "Estado" },
  { campo: "telefono", label: "Teléfono" },
  { campo: "cuestionario", label: "Cuestionario" },
  { campo: "resenas", label: "Reseñas" },
  { campo: "cv", label: "CV" },
  { campo: "perfil_creado", label: "Perfil creado" },
];

/** Accesor para filtros/orden de la toolbar. */
function accesoCampo(c: CandidatoReal, campo: string): unknown {
  switch (campo) {
    case "candidato":
      return `${c.nombre} ${c.apellidos ?? ""}`.trim();
    case "vacante":
      return c.vacantes?.titulo ?? "";
    case "estado":
      return ESTADOS_CONFIG[c.estado as EstadoReclutamiento]?.label ?? c.estado;
    case "telefono":
      return c.telefono ?? "";
    case "cuestionario":
      return c.puntuacion;
    case "resenas":
      return c.nota_resenas;
    case "perfil_creado":
      return c.created_at?.slice(0, 10) ?? "";
    default:
      return "";
  }
}

export function CandidatosRealesTab() {
  const [items, setItems] = useState<CandidatoReal[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog: confirmDialog } = useConfirmDelete();

  // Dialog de contratación (wizard 2 pasos)
  const [contratarCand, setContratarCand] = useState<CandidatoReal | null>(null);

  // Aviso post-contratación → offboarding
  const [offboardingDe, setOffboardingDe] = useState<{ empleadoId: string; nombre: string } | null>(null);

  // Ficha del candidato (modal completo: actividad, notas, reseñas, cuestionario, CV).
  const [selected, setSelected] = useState<CandidatoReal | null>(null);

  // ── Toolbar (BARRA HORIZONTAL 1): búsqueda + filtros/orden por columna ──
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);

  const esVisible = useCallback(
    (campo: string) => columnasVisibles[campo] !== false,
    [columnasVisibles],
  );

  // Opciones del filtro de columna "Estado" = estados presentes en los datos.
  const opcionesEstado = useMemo(() => {
    const set = new Set<string>();
    for (const c of items) {
      set.add(ESTADOS_CONFIG[c.estado as EstadoReclutamiento]?.label ?? c.estado);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  // Opciones del filtro de columna "Vacante".
  const opcionesVacante = useMemo(() => {
    const set = new Set<string>();
    for (const c of items) set.add(c.vacantes?.titulo ?? "—");
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  // Lista final: búsqueda + filtros de columna + orden.
  const itemsFiltrados = useMemo(() => {
    let lista = items;
    if (busqueda.trim()) {
      lista = lista.filter((c) =>
        coincideBusquedaUniversal(
          {
            nombre: c.nombre,
            apellidos: c.apellidos,
            email: c.email,
            telefono: c.telefono,
            vacante: c.vacantes?.titulo,
          },
          busqueda,
        ),
      );
    }
    lista = aplicarFiltrosToolbar(lista, filtros, accesoCampo);
    lista = aplicarOrdenToolbar(lista, orden, accesoCampo);
    return lista;
  }, [items, busqueda, filtros, orden]);

  // Toast informativo de "ya es empleado, movimiento solo organizativo"
  const cargar = useCallback(async () => {
    setLoading(true);
    const c = await listCandidatosReales();
    setItems(((c.data ?? []) as unknown) as CandidatoReal[]);
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  function handleEliminar(c: CandidatoReal) {
    void (async () => {
      const nombre = `${c.nombre} ${c.apellidos ?? ""}`.trim();
      const ok = await confirm({
        title: "Borrar candidato",
        description: c.promovido_at
          ? `Se eliminará la candidatura de ${nombre} (notas, reseñas y actividad). Su ficha de empleado NO se borra. Esta acción no se puede deshacer.`
          : `Se eliminará a ${nombre} junto con sus notas, reseñas y actividad. Esta acción no se puede deshacer.`,
        confirmLabel: "Borrar candidato",
      });
      if (!ok) return;
      startTransition(async () => {
        const res = await eliminarCandidato(c.id);
        if (res.ok) {
          setItems((prev) => prev.filter((x) => x.id !== c.id));
          setSelected((prev) => (prev && prev.id === c.id ? null : prev));
          toast.success("Candidato borrado");
        } else {
          toast.error(("error" in res && res.error) || "No se pudo borrar el candidato");
        }
      });
    })();
  }

  function ejecutarOffboarding() {
    if (!offboardingDe) return;
    startTransition(async () => {
      const res = await iniciarOffboarding(offboardingDe.empleadoId);
      if (res.ok) {
        toast.success("Proceso de offboarding iniciado");
        setOffboardingDe(null);
        // Tras iniciar offboarding, marcar candidato como descartado/no_se_presenta
        // (el original moverCandidatoFase fue rechazado)
        void cargar();
      } else {
        toast.error(res.error ?? "Error al iniciar offboarding");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cargando candidatos…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground space-y-3">
          <Inbox className="h-10 w-10 mx-auto opacity-40" />
          <div>
            <p className="font-medium">Aún no hay candidaturas reales</p>
            <p className="text-sm">
              Las candidaturas aparecerán aquí cuando alguien postule a una de tus ofertas públicas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        ocultarNuevo
        columnas={COLUMNAS_DEF}
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {esVisible("candidato") && (
                <TableColumnHeader
                  label="Candidato"
                  campo="candidato"
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {esVisible("vacante") && (
                <TableColumnHeader
                  label="Vacante"
                  campo="vacante"
                  filtroTipo="lista"
                  opciones={opcionesVacante}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {esVisible("estado") && (
                <TableColumnHeader
                  label="Estado"
                  campo="estado"
                  filtroTipo="lista"
                  opciones={opcionesEstado}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                />
              )}
              {esVisible("telefono") && (
                <TableColumnHeader label="Teléfono" campo="telefono" />
              )}
              {esVisible("cuestionario") && (
                <TableColumnHeader
                  label="Cuestionario"
                  campo="cuestionario"
                  align="center"
                  filtroTipo="numero"
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                  ordenLabelAsc="Menor"
                  ordenLabelDesc="Mayor"
                />
              )}
              {esVisible("resenas") && (
                <TableColumnHeader
                  label="Reseñas"
                  campo="resenas"
                  align="center"
                  filtroTipo="numero"
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                  ordenLabelAsc="Menor"
                  ordenLabelDesc="Mayor"
                />
              )}
              {esVisible("cv") && <TableColumnHeader label="CV" campo="cv" />}
              {esVisible("perfil_creado") && (
                <TableColumnHeader
                  label="Perfil creado"
                  campo="perfil_creado"
                  filtroTipo="fecha"
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                  ordenLabelAsc="Más antiguo"
                  ordenLabelDesc="Más reciente"
                />
              )}
              <TableColumnHeader label="Opciones" align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemsFiltrados.map((c) => {
              const cfgEstado = ESTADOS_CONFIG[c.estado as EstadoReclutamiento];
              const mostrarBoton =
                (c.estado === "prueba" || c.estado === "empleado") && c.promovido_at === null;
              const yaPromovido = !!c.promovido_at;
              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(c)}
                >
                  {esVisible("candidato") && (
                  <TableCell>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{c.nombre} {c.apellidos}</span>
                        {yaPromovido && (
                          <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700 shrink-0">
                            Empleado
                          </Badge>
                        )}
                        {c.activo === false && (
                          <Badge variant="outline" className="text-[9px] bg-muted border-border text-muted-foreground shrink-0">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{c.email}</span>
                    </div>
                  </TableCell>
                  )}
                  {esVisible("vacante") && (
                    <TableCell className="text-muted-foreground">{c.vacantes?.titulo ?? "—"}</TableCell>
                  )}
                  {esVisible("estado") && (
                  <TableCell>
                    {cfgEstado ? (
                      <Badge variant="outline" className="text-[11px]" style={{ borderColor: cfgEstado.color, color: cfgEstado.color }}>
                        {cfgEstado.label}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  )}
                  {esVisible("telefono") && (
                    <TableCell className="text-muted-foreground tabular-nums">{c.telefono ?? "—"}</TableCell>
                  )}
                  {esVisible("cuestionario") && (
                  <TableCell className="text-center">
                    {c.puntuacion == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={`font-semibold tabular-nums ${c.puntuacion >= 5 ? "text-emerald-600" : "text-rose-600"}`}>
                        {c.puntuacion}/10
                      </span>
                    )}
                  </TableCell>
                  )}
                  {esVisible("resenas") && (
                  <TableCell className="text-center">
                    {c.nota_resenas == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1 font-semibold tabular-nums text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {c.nota_resenas.toFixed(1)}
                        <span className="text-xs font-medium text-muted-foreground">/ 5</span>
                      </span>
                    )}
                  </TableCell>
                  )}
                  {esVisible("cv") && (
                  <TableCell>
                    {c.cv_url ? (
                      <a
                        href={`/api/empleo/cv?path=${encodeURIComponent(c.cv_url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> Ver CV
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  )}
                  {esVisible("perfil_creado") && (
                    <TableCell className="text-muted-foreground tabular-nums">{fmtFecha(c.created_at)}</TableCell>
                  )}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {mostrarBoton ? (
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setContratarCand(c)}
                          disabled={pending}
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Contratar
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelected(c)}>
                          Ver ficha
                        </Button>
                      )}
                      {/* Un candidato ya contratado no puede borrarse: su
                          candidatura perdura en la base de datos. */}
                      {!yaPromovido && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleEliminar(c)}
                          disabled={pending}
                          title="Borrar candidato"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {itemsFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNAS_DEF.length + 1} className="py-10 text-center text-sm text-muted-foreground">
                  No hay candidatos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Ficha del candidato ──────────────────── */}
      <CandidatoDetailModal
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        candidato={selected ? toCandidato(selected) : null}
        candidatos={items.map(toCandidato)}
        vacante={vacanteParaModal(selected)}
        onSelectCandidato={(c) => setSelected(c ? items.find((x) => x.id === c.id) ?? null : null)}
        onUpdateCandidato={(updated) => {
          // El toggle Activo/Inactivo de la ficha ya persiste en BD; aquí
          // reflejamos el cambio en la fila para que el badge se actualice al
          // instante.
          setItems((prev) =>
            prev.map((x) =>
              x.id === updated.id
                ? {
                    ...x,
                    activo: updated.activo ?? true,
                    genero: updated.genero ?? x.genero,
                    ubicacion: updated.ubicacion ?? x.ubicacion,
                    disponibilidad: updated.disponibilidad ?? x.disponibilidad,
                    experiencia_previa: updated.experienciaPrevia ?? x.experiencia_previa,
                    como_nos_conocio: updated.comoNosConocio ?? x.como_nos_conocio,
                    carta_presentacion: updated.sobreTi ?? null,
                  }
                : x,
            ),
          );
          setSelected((prev) => (prev && prev.id === updated.id ? { ...prev, activo: updated.activo ?? true } : prev));
          // Persiste género/ubicación/disponibilidad editados en la ficha.
          void actualizarDatosCandidato(updated.id, {
            genero: updated.genero ?? null,
            ubicacion: updated.ubicacion ?? null,
            disponibilidad: updated.disponibilidad ?? null,
            experiencia_previa: updated.experienciaPrevia ?? null,
            como_nos_conocio: updated.comoNosConocio ?? null,
            carta_presentacion: updated.sobreTi ?? null,
          });
        }}
        onEliminar={(c) => {
          const real = items.find((x) => x.id === c.id);
          if (real) handleEliminar(real);
        }}
      />

      {/* ── Wizard de contratación (2 pasos) ──────────────────── */}
      <ContratarDialog
        open={!!contratarCand}
        onOpenChange={(o) => !o && setContratarCand(null)}
        candidato={contratarCand ? {
          id: contratarCand.id,
          nombre: contratarCand.nombre,
          apellidos: contratarCand.apellidos,
          email: contratarCand.email,
          vacantePuestoId: contratarCand.vacantes?.puesto_id ?? null,
        } : null}
        onDone={() => void cargar()}
      />

      {/* ── Aviso offboarding obligatorio ──────────────────── */}
      <AlertDialog open={!!offboardingDe} onOpenChange={(o) => !o && setOffboardingDe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Este trabajador ya está contratado
            </AlertDialogTitle>
            <AlertDialogDescription>
              <b>{offboardingDe?.nombre}</b> ya es empleado. Para descartarlo o darlo de baja debes iniciar el proceso de <b>Offboarding</b> (Boarding &gt; OFF).
              Al confirmar se creará un proceso de offboarding usando la plantilla por defecto y podrás seguir los pasos de la baja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={ejecutarOffboarding}
              disabled={pending}
            >
              Iniciar offboarding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmación de borrado de candidato ──────────────────── */}
      {confirmDialog}
    </div>
  );
}
