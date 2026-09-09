"use client";

/**
 * Marketing → Automatizaciones.
 *
 * Cada automatización se enseña como lo que es: una frase. La tarjeta dice
 * cuándo salta y qué hace, sin abrir nada. Lo que el usuario tiene que decidir
 * —encenderla, dejarla en pruebas, ver qué ha hecho— está a un clic.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Zap, Pencil, Trash2, History, Play, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  fraseAutomatizacion,
  RECETAS,
  type Automatizacion,
} from "@/features/marketing/data/automatizaciones";
import {
  listarAutomatizacionesAction,
  listarDepartamentosAction,
  cambiarEstadoAction,
  cambiarModoPruebaAction,
  borrarAutomatizacionAction,
  crearDesdeRecetaAction,
  probarAhoraAction,
} from "@/features/marketing/actions/automatizaciones-actions";
import { AutomatizacionEditorSheet } from "./AutomatizacionEditorSheet";
import { HistorialSheet } from "./HistorialSheet";

export function AutomatizacionesView() {
  const { empresaActual } = useEmpresa();
  const tz = empresaActual?.zonaHoraria ?? "Europe/Madrid";

  const [lista, setLista] = useState<Automatizacion[]>([]);
  const [departamentos, setDepartamentos] = useState<{ id: string; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Automatizacion | null>(null);
  const [editorAbierto, setEditorAbierto] = useState(false);
  const [historialDe, setHistorialDe] = useState<Automatizacion | null>(null);
  const { confirm, dialog } = useConfirmDelete();

  const refrescar = useCallback(async () => {
    const r = await listarAutomatizacionesAction();
    if (r.ok) setLista(r.data);
    else toast.error(r.error);
    setCargando(false);
  }, []);

  useEffect(() => {
    refrescar();
    listarDepartamentosAction().then((r) => {
      if (r.ok) setDepartamentos(r.data);
    });
  }, [refrescar, empresaActual?.id]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (a) => a.nombre.toLowerCase().includes(q) || fraseAutomatizacion(a).toLowerCase().includes(q),
    );
  }, [lista, busqueda]);

  async function alternar(a: Automatizacion, activar: boolean) {
    const r = await cambiarEstadoAction(a.id, activar);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setLista((prev) => prev.map((x) => (x.id === a.id ? r.data : x)));
    toast.success(activar ? "Encendida" : "Apagada");
  }

  async function alternarPruebas(a: Automatizacion) {
    const r = await cambiarModoPruebaAction(a.id, !a.modoPrueba);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setLista((prev) => prev.map((x) => (x.id === a.id ? r.data : x)));
    toast.success(r.data.modoPrueba ? "Vuelve a modo pruebas" : "Ya envía de verdad");
  }

  async function borrar(a: Automatizacion) {
    const ok = await confirm({
      title: `Borrar "${a.nombre}"`,
      description: "Se borra también su historial. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    const r = await borrarAutomatizacionAction(a.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setLista((prev) => prev.filter((x) => x.id !== a.id));
    toast.success("Borrada");
  }

  async function probar(a: Automatizacion) {
    const r = await probarAhoraAction(a.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(r.data);
    refrescar();
  }

  async function usarReceta(clave: string) {
    const r = await crearDesdeRecetaAction(clave, departamentos[0]?.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Creada. Revísala y enciéndela cuando quieras");
    setEditando(r.data);
    setEditorAbierto(true);
    refrescar();
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1000px] mx-auto pb-28">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        textoNuevo="Nueva"
        onNuevo={() => {
          setEditando(null);
          setEditorAbierto(true);
        }}
      />

      {cargando ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {visibles.length === 0 && (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aquí se automatiza lo que hoy se hace a mano: un correo el día después
              de la visita, la felicitación de cumpleaños, un aviso al equipo cuando
              alguien puntúa bajo. Empieza por una de las de abajo.
            </p>
          )}

          <div className="space-y-3">
            {visibles.map((a) => (
              <div key={a.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Zap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.nombre}</span>
                      <Badge
                        variant="outline"
                        className={
                          a.estado === "Activo"
                            ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30"
                            : "bg-muted text-muted-foreground border-border"
                        }
                      >
                        {a.estado}
                      </Badge>
                      {a.modoPrueba && (
                        <Badge variant="outline" className="bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/30">
                          En pruebas
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{fraseAutomatizacion(a)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.ejecucionesTotal === 0
                        ? "Todavía no se ha disparado"
                        : `Se ha disparado ${a.ejecucionesTotal} ${a.ejecucionesTotal === 1 ? "vez" : "veces"}`}
                      {a.ultimaEjecucion && ` · última el ${formatFechaHoraEnZona(a.ultimaEjecucion, tz)}`}
                    </p>
                  </div>
                  <Switch
                    checked={a.estado === "Activo"}
                    onCheckedChange={(v) => alternar(a, v)}
                    aria-label="Encender"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" onClick={() => { setEditando(a); setEditorAbierto(true); }}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setHistorialDe(a)}>
                    <History className="mr-1.5 h-3.5 w-3.5" /> Historial
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => probar(a)} disabled={a.estado !== "Activo"}>
                    <Play className="mr-1.5 h-3.5 w-3.5" /> Probar ahora
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alternarPruebas(a)}>
                    <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                    {a.modoPrueba ? "Enviar de verdad" : "Volver a pruebas"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-destructive"
                    onClick={() => borrar(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Plantillas ─────────────────────────────────── */}
          <div className="space-y-3 pt-2">
            <p className="text-sm font-semibold">Empieza con una hecha</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {RECETAS.map((r) => (
                <button
                  key={r.clave}
                  type="button"
                  onClick={() => usarReceta(r.clave)}
                  className="rounded-xl border border-dashed bg-card p-4 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="font-medium">{r.nombre}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.descripcion}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Todas nacen apagadas y en modo pruebas: se disparan y dejan constancia en
              el historial, pero no sale ni un correo hasta que tú lo digas.
            </p>
          </div>
        </>
      )}

      <AutomatizacionEditorSheet
        open={editorAbierto}
        onOpenChange={setEditorAbierto}
        automatizacion={editando}
        departamentos={departamentos}
        onGuardada={refrescar}
      />

      <HistorialSheet
        automatizacion={historialDe}
        onOpenChange={(open) => !open && setHistorialDe(null)}
        tz={tz}
      />

      {dialog}
    </div>
  );
}
