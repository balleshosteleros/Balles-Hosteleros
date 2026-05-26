"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/shared/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getEnvioCompleto,
  updateReunion,
  crearPunto,
  updatePunto,
  deletePunto,
} from "@/features/calidad/cuestionarios/actions";
import type {
  EnvioCompleto,
  EstadoReunion,
  EstadoPunto,
} from "@/features/calidad/cuestionarios/types";
import { getPlantilla } from "@/features/calidad/cuestionarios/actions";
import type { PlantillaCuestionario } from "@/features/calidad/cuestionarios/types";

interface Props {
  envioId: string | null;
  campanaPlantillaId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCambio: () => void;
}

export function EmpleadoPanelLateral({
  envioId,
  campanaPlantillaId,
  open,
  onOpenChange,
  onCambio,
}: Props) {
  const [envio, setEnvio] = useState<EnvioCompleto | null>(null);
  const [plantilla, setPlantilla] = useState<PlantillaCuestionario | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !envioId) {
      setEnvio(null);
      return;
    }
    setLoading(true);
    Promise.all([getEnvioCompleto(envioId), getPlantilla(campanaPlantillaId)]).then(
      ([e, p]) => {
        setEnvio(e);
        setPlantilla(p);
        setLoading(false);
      },
    );
  }, [open, envioId, campanaPlantillaId]);

  function recargar() {
    if (!envioId) return;
    getEnvioCompleto(envioId).then(setEnvio);
    onCambio();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{envio?.empleadoNombre ?? "Cargando..."}</SheetTitle>
          {envio?.empleadoPuesto && (
            <SheetDescription>{envio.empleadoPuesto}</SheetDescription>
          )}
        </SheetHeader>

        {loading || !envio ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="reunion" className="mt-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="reunion">Reunión</TabsTrigger>
              <TabsTrigger value="respuestas">Respuestas</TabsTrigger>
            </TabsList>

            <TabsContent value="reunion" className="space-y-4 mt-4">
              <ReunionTab
                envio={envio}
                onCambio={() => startTransition(recargar)}
              />
            </TabsContent>

            <TabsContent value="respuestas" className="mt-4">
              <RespuestasTab envio={envio} plantilla={plantilla} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Tab Reunión ─────────────────────────────────────────────

function ReunionTab({
  envio,
  onCambio,
}: {
  envio: EnvioCompleto;
  onCambio: () => void;
}) {
  const [fecha, setFecha] = useState(envio.reunionFecha ?? "");
  const [estado, setEstado] = useState<EstadoReunion>(envio.reunionEstado);
  const [notas, setNotas] = useState(envio.reunionNotas ?? "");
  const [puntoTexto, setPuntoTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPunto, setSavingPunto] = useState(false);

  useEffect(() => {
    setFecha(envio.reunionFecha ?? "");
    setEstado(envio.reunionEstado);
    setNotas(envio.reunionNotas ?? "");
  }, [envio]);

  async function guardar() {
    setSaving(true);
    const res = await updateReunion({
      envioId: envio.id,
      fecha: fecha || null,
      estado,
      notas: notas || null,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Reunión guardada");
    onCambio();
  }

  async function añadirPunto() {
    const texto = puntoTexto.trim();
    if (!texto) return;
    setSavingPunto(true);
    const res = await crearPunto({ envioId: envio.id, texto });
    setSavingPunto(false);
    if (!res.ok) return toast.error(res.error);
    setPuntoTexto("");
    onCambio();
  }

  async function togglePunto(id: string, nuevoEstado: EstadoPunto) {
    const res = await updatePunto({ id, estado: nuevoEstado });
    if (!res.ok) return toast.error(res.error);
    onCambio();
  }

  async function eliminarPunto(id: string) {
    const res = await deletePunto(id);
    if (!res.ok) return toast.error(res.error);
    onCambio();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoReunion)}
            className="w-full h-9 px-3 rounded-md border bg-background text-sm"
          >
            <option value="pendiente">Pendiente</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
            <option value="no_aplica">No aplica</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notas de la reunión</Label>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={6}
          placeholder="Lo que se habló: ánimo del equipo, peticiones, contexto..."
        />
      </div>

      <Button onClick={guardar} disabled={saving} size="sm">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar reunión
      </Button>

      <div className="pt-4 border-t space-y-3">
        <Label className="text-sm font-medium">Puntos clave</Label>
        <p className="text-xs text-muted-foreground">
          Marca como cerrado lo que ya esté resuelto. Lo demás aparece en el timeline general.
        </p>

        <div className="space-y-1.5">
          {envio.puntos.length === 0 && (
            <div className="text-xs text-muted-foreground italic py-2">
              Aún no hay puntos.
            </div>
          )}
          {envio.puntos.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-muted/40 group"
            >
              <input
                type="checkbox"
                checked={p.estado === "cerrado"}
                onChange={(e) =>
                  togglePunto(p.id, e.target.checked ? "cerrado" : "pendiente")
                }
                className="mt-1"
              />
              <div className="flex-1 text-sm">
                <div className={p.estado === "cerrado" ? "line-through text-muted-foreground" : ""}>
                  {p.texto}
                </div>
                {p.estado === "en_curso" && (
                  <Badge variant="outline" className="text-[10px] mt-1">
                    En curso
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => eliminarPunto(p.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={puntoTexto}
            onChange={(e) => setPuntoTexto(e.target.value)}
            placeholder="Añadir un punto..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                añadirPunto();
              }
            }}
          />
          <Button
            size="sm"
            onClick={añadirPunto}
            disabled={savingPunto || !puntoTexto.trim()}
          >
            {savingPunto ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Respuestas (read-only) ──────────────────────────────

function RespuestasTab({
  envio,
  plantilla,
}: {
  envio: EnvioCompleto;
  plantilla: PlantillaCuestionario | null;
}) {
  if (!envio.respondido) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Aún no ha respondido al cuestionario.
      </div>
    );
  }
  if (!plantilla) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Plantilla no disponible.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {envio.aprobado !== null && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Badge
            variant="outline"
            className={
              envio.aprobado
                ? "bg-emerald-500/15 text-emerald-700 border-emerald-200"
                : "bg-red-500/15 text-red-700 border-red-200"
            }
          >
            {envio.aprobado ? "Aprobado" : "No aprobado"}
          </Badge>
          {envio.puntuacion !== null && envio.notaSobre !== null && (
            <span className="text-sm tabular-nums">
              {envio.puntuacion} / {envio.notaSobre}
            </span>
          )}
        </div>
      )}

      {plantilla.bloques.map((bloque) => (
        <div key={bloque.id} className="space-y-3">
          <h4 className="text-sm font-semibold">{bloque.titulo}</h4>
          {bloque.preguntas.map((preg) => {
            const r = envio.respuestas?.[preg.id];
            return (
              <div key={preg.id} className="space-y-1 pl-2 border-l-2 border-muted">
                <div className="text-sm font-medium">{preg.titulo}</div>
                <div className="text-sm text-muted-foreground">
                  {renderRespuesta(r, preg.opciones, preg.tipo)}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function renderRespuesta(
  r: string | string[] | undefined,
  opciones: { id: string; texto: string }[],
  tipo: string,
): string {
  if (r === undefined || r === null || (Array.isArray(r) && r.length === 0)) {
    return "—";
  }
  if (tipo === "texto") return typeof r === "string" ? r : "—";
  const ids = Array.isArray(r) ? r : [r];
  const labels = ids
    .map((id) => opciones.find((o) => o.id === id)?.texto)
    .filter(Boolean);
  return labels.length > 0 ? labels.join(" · ") : "—";
}
