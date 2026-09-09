"use client";

/**
 * Pipeline de Producto — el embudo comercial del software.
 *
 * Arriba, en su propia fila: qué embudo se está mirando, cuántas oportunidades
 * tiene y cuánto suman, y si se ve en tablero o en lista. Debajo, la barra de
 * siempre (Nuevo · Buscar · filtros · columnas · configuración) y el tablero.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, List, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
  type ToolbarCampoFiltro,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { formatEur, formatNumero } from "@/shared/lib/numero";
import { archivarPipeline, cargarTablero, moverOportunidad } from "../actions/pipeline-actions";
import type { Oportunidad, PipelineFase, TableroPipeline } from "../types";
import { OPORTUNIDAD_ESTADOS, OPORTUNIDAD_ESTADO_LABEL } from "../types";
import { PipelineBoard } from "./PipelineBoard";
import { PipelineLista } from "./PipelineLista";
import { OportunidadDialog } from "./OportunidadDialog";
import { PipelineConfigDialog } from "./PipelineConfigDialog";

type Vista = "tablero" | "lista";

/**
 * Filas del desplegable que no son un pipeline sino una acción. Van con doble
 * guion bajo para que no puedan chocar nunca con un id.
 */
const ARCHIVAR = "__archivar__";
const VER_ARCHIVADOS = "__ver-archivados__";

const VACIO: TableroPipeline = { pipelines: [], pipeline: null, fases: [], oportunidades: [] };

/** Valor de un campo de la oportunidad para buscar, filtrar y ordenar. */
function acceso(
  o: Oportunidad,
  campo: string,
  fasePorId: Map<string, PipelineFase>,
): unknown {
  switch (campo) {
    case "fase":
      return fasePorId.get(o.fase_id)?.nombre ?? "";
    case "estado":
      return OPORTUNIDAD_ESTADO_LABEL[o.estado];
    case "nombre":
      return o.nombre;
    case "fuente":
      return o.fuente ?? "";
    case "asignado_a":
      return o.asignado_a ?? "";
    case "etiquetas":
      return o.etiquetas;
    case "valor":
      return Number(o.valor ?? 0);
    case "telefono":
      return o.telefono ?? "";
    case "email":
      return o.email ?? "";
    case "created_at":
      return o.created_at;
    default:
      return "";
  }
}

export function PipelineView() {
  const [tablero, setTablero] = useState<TableroPipeline>(VACIO);
  const [pipelineId, setPipelineId] = useState<string | undefined>();
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>("tablero");
  const [verArchivados, setVerArchivados] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);

  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [enFicha, setEnFicha] = useState<Oportunidad | null>(null);
  const [configAbierta, setConfigAbierta] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await cargarTablero(pipelineId);
    if (res.ok) setTablero(res.data);
    else toast.error(res.error);
    setCargando(false);
  }, [pipelineId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const fasePorId = useMemo(
    () => new Map(tablero.fases.map((f) => [f.id, f])),
    [tablero.fases],
  );

  const campos: ToolbarCampoFiltro[] = useMemo(
    () => [
      {
        campo: "fase",
        label: "Fase",
        tipo: "lista",
        opciones: tablero.fases.map((f) => f.nombre),
      },
      {
        campo: "estado",
        label: "Estado",
        tipo: "lista",
        opciones: OPORTUNIDAD_ESTADOS.map((e) => OPORTUNIDAD_ESTADO_LABEL[e]),
      },
      {
        campo: "fuente",
        label: "Fuente",
        tipo: "lista",
        opciones: [
          ...new Set(tablero.oportunidades.map((o) => o.fuente).filter((f): f is string => !!f)),
        ].sort((a, b) => a.localeCompare(b, "es")),
      },
      {
        campo: "asignado_a",
        label: "Asignada a",
        tipo: "lista",
        opciones: [
          ...new Set(
            tablero.oportunidades.map((o) => o.asignado_a).filter((a): a is string => !!a),
          ),
        ].sort((a, b) => a.localeCompare(b, "es")),
      },
      {
        campo: "etiquetas",
        label: "Etiquetas",
        tipo: "lista",
        opciones: [...new Set(tablero.oportunidades.flatMap((o) => o.etiquetas))].sort((a, b) =>
          a.localeCompare(b, "es"),
        ),
      },
      { campo: "valor", label: "Valor", tipo: "numero" },
    ],
    [tablero.fases, tablero.oportunidades],
  );

  const visibles = useMemo(() => {
    const conBusqueda = tablero.oportunidades.filter((o) =>
      coincideBusquedaUniversal(
        {
          nombre: o.nombre,
          telefono: o.telefono,
          email: o.email,
          fuente: o.fuente,
          asignado: o.asignado_a,
          etiquetas: o.etiquetas,
          notas: o.notas,
        },
        busqueda,
      ),
    );
    const filtradas = aplicarFiltrosToolbar(conBusqueda, filtros, (o, campo) =>
      acceso(o, campo, fasePorId),
    );
    return aplicarOrdenToolbar(filtradas, orden, (o, campo) => acceso(o, campo, fasePorId));
  }, [tablero.oportunidades, busqueda, filtros, orden, fasePorId]);

  const porFase = useMemo(() => {
    const mapa = new Map<string, Oportunidad[]>();
    for (const fase of tablero.fases) mapa.set(fase.id, []);
    for (const o of visibles) {
      const lista = mapa.get(o.fase_id);
      if (lista) lista.push(o);
      else mapa.set(o.fase_id, [o]);
    }
    return mapa;
  }, [visibles, tablero.fases]);

  const conteoPorFase = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const o of tablero.oportunidades) {
      mapa.set(o.fase_id, (mapa.get(o.fase_id) ?? 0) + 1);
    }
    return mapa;
  }, [tablero.oportunidades]);

  const totalValor = useMemo(
    () => visibles.reduce((s, o) => s + Number(o.valor ?? 0), 0),
    [visibles],
  );

  /**
   * Arrastrar una tarjeta a otra columna. Se mueve primero en pantalla y luego
   * se guarda: con mil seiscientas tarjetas, recargar el tablero entero en cada
   * arrastre haría que la tarjeta se quedase medio segundo donde estaba.
   */
  const onMover = async (oportunidad: Oportunidad, faseId: string) => {
    const antes = oportunidad.fase_id;
    const ahora = new Date().toISOString();
    setTablero((t) => ({
      ...t,
      oportunidades: t.oportunidades.map((o) =>
        o.id === oportunidad.id ? { ...o, fase_id: faseId, fase_at: ahora } : o,
      ),
    }));
    const res = await moverOportunidad(oportunidad.id, faseId);
    if (!res.ok) {
      toast.error(res.error);
      setTablero((t) => ({
        ...t,
        oportunidades: t.oportunidades.map((o) =>
          o.id === oportunidad.id ? { ...o, fase_id: antes, fase_at: oportunidad.fase_at } : o,
        ),
      }));
    }
  };

  const activos = useMemo(() => tablero.pipelines.filter((p) => p.activo), [tablero.pipelines]);
  const archivados = useMemo(() => tablero.pipelines.filter((p) => !p.activo), [tablero.pipelines]);

  /**
   * Lo que se ofrece en el desplegable: solo los activos, salvo que se pidan
   * los archivados o no quede ninguno activo. El que se está mirando va
   * siempre, aunque esté archivado, para que el selector no salga en blanco.
   */
  const enElDesplegable = useMemo(() => {
    const base = verArchivados || activos.length === 0 ? tablero.pipelines : activos;
    const actual = tablero.pipeline;
    return actual && !base.some((p) => p.id === actual.id) ? [actual, ...base] : base;
  }, [verArchivados, activos, tablero.pipelines, tablero.pipeline]);

  /**
   * Archivar el pipeline que se está mirando, o sacarlo del archivo. Al
   * archivarlo salta al siguiente activo: si se quedara delante, seguiría
   * viéndose justo lo que se acaba de esconder.
   */
  const alternarArchivo = async () => {
    const p = tablero.pipeline;
    if (!p) return;
    const res = await archivarPipeline(p.id, p.activo);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(p.activo ? `"${p.nombre}" archivado` : `"${p.nombre}" desarchivado`);
    const siguiente = p.activo
      ? tablero.pipelines.find((x) => x.activo && x.id !== p.id)?.id
      : pipelineId;
    if (siguiente === pipelineId) void cargar();
    else setPipelineId(siguiente);
  };

  const elegirEnDesplegable = (valor: string) => {
    if (valor === VER_ARCHIVADOS) {
      setVerArchivados((v) => !v);
      return;
    }
    if (valor === ARCHIVAR) {
      void alternarArchivo();
      return;
    }
    setPipelineId(valor);
  };

  const abrirFicha = (o: Oportunidad | null) => {
    setEnFicha(o);
    setFichaAbierta(true);
  };

  return (
    <div className="space-y-3">
      {/* Fila propia: el embudo, lo que suma y cómo se mira. Fuera de la barra,
          que solo lleva Nuevo, Buscar y los iconos de apoyo. */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={tablero.pipeline?.id ?? ""}
          onValueChange={elegirEnDesplegable}
          disabled={tablero.pipelines.length === 0}
        >
          <SelectTrigger className="h-9 w-64">
            <SelectValue placeholder="Sin pipelines" />
          </SelectTrigger>
          <SelectContent>
            {enElDesplegable.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.activo ? p.nombre : `${p.nombre} · archivado`}
              </SelectItem>
            ))}

            {/* Archivar y recuperar, en el mismo sitio donde se elige el
                embudo: es donde se mira cuando sobra uno. */}
            {tablero.pipeline && (
              <>
                <SelectSeparator />
                <SelectItem value={ARCHIVAR}>
                  {tablero.pipeline.activo
                    ? "Archivar este pipeline"
                    : "Desarchivar este pipeline"}
                </SelectItem>
              </>
            )}
            {archivados.length > 0 && (
              <SelectItem value={VER_ARCHIVADOS}>
                {verArchivados
                  ? "Ocultar los archivados"
                  : `Ver los archivados (${archivados.length})`}
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        <span className="text-sm tabular-nums text-muted-foreground">
          {formatNumero(visibles.length)} oportunidades · {formatEur(totalValor)}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant={vista === "tablero" ? "default" : "outline"}
            className="h-9 w-9"
            onClick={() => setVista("tablero")}
            title="Ver en tablero"
            aria-label="Ver en tablero"
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={vista === "lista" ? "default" : "outline"}
            className="h-9 w-9"
            onClick={() => setVista("lista")}
            title="Ver en lista"
            aria-label="Ver en lista"
          >
            <List className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={tablero.pipeline ? () => abrirFicha(null) : undefined}
        campos={campos}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        ordenOpciones={[
          { campo: "nombre", label: "Nombre" },
          { campo: "valor", label: "Valor" },
          { campo: "created_at", label: "Fecha de alta" },
          { campo: "fuente", label: "Fuente" },
        ]}
        orden={orden}
        onOrdenChange={setOrden}
        extraDerecha={
          <Button
            size="icon"
            variant={configAbierta ? "default" : "outline"}
            className="h-9 w-9"
            onClick={() => setConfigAbierta(true)}
            disabled={!tablero.pipeline}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      {cargando ? (
        <LoadingSpinner className="py-16" size="lg" />
      ) : !tablero.pipeline ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Todavía no hay ningún pipeline en esta empresa.
        </p>
      ) : vista === "tablero" ? (
        <PipelineBoard
          fases={tablero.fases.filter((f) => f.activa)}
          porFase={porFase}
          onMover={onMover}
          onAbrir={abrirFicha}
        />
      ) : (
        <PipelineLista
          oportunidades={visibles}
          fasePorId={fasePorId}
          opciones={{
            fase: campos.find((c) => c.campo === "fase")?.opciones ?? [],
            estado: campos.find((c) => c.campo === "estado")?.opciones ?? [],
            fuente: campos.find((c) => c.campo === "fuente")?.opciones ?? [],
            asignado: campos.find((c) => c.campo === "asignado_a")?.opciones ?? [],
          }}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          orden={orden}
          onOrdenChange={setOrden}
          onAbrir={abrirFicha}
        />
      )}

      {tablero.pipeline && (
        <OportunidadDialog
          abierto={fichaAbierta}
          onCerrar={() => setFichaAbierta(false)}
          oportunidad={enFicha}
          pipelineId={tablero.pipeline.id}
          fases={tablero.fases}
          onGuardado={() => void cargar()}
        />
      )}

      {tablero.pipeline && configAbierta && (
        <PipelineConfigDialog
          abierto={configAbierta}
          onCerrar={() => setConfigAbierta(false)}
          pipeline={tablero.pipeline}
          fases={tablero.fases}
          conteoPorFase={conteoPorFase}
          onCambios={() => void cargar()}
        />
      )}
    </div>
  );
}
