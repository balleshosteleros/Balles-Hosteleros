"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Save,
  History,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AuditoriaPregunta,
  AuditoriaSeccion,
  AuditoriaTipoPregunta,
} from "@/features/calidad/types/auditorias";
import {
  getPlantillaConVersion,
  actualizarPlantilla,
  publicarVersion,
  crearBorradorNuevaVersion,
  crearSeccion,
  actualizarSeccion,
  eliminarSeccion,
  crearPregunta,
  actualizarPregunta,
  eliminarPregunta,
  reordenarSecciones,
  reordenarPreguntas,
  type PlantillaConVersion,
} from "@/features/calidad/actions/plantillas-actions";

const TIPO_OPTIONS: Array<{ value: AuditoriaTipoPregunta; label: string }> = [
  { value: "escala", label: "Escala 0–5" },
  { value: "si_no", label: "Sí / No" },
  { value: "texto_largo", label: "Texto libre" },
  { value: "opcion_unica", label: "Opción única" },
  { value: "opcion_multiple", label: "Opción múltiple" },
  { value: "observaciones", label: "Observaciones (sección)" },
];

const TIPO_LABEL: Record<AuditoriaTipoPregunta, string> = Object.fromEntries(
  TIPO_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AuditoriaTipoPregunta, string>;

export function PlantillaEditor({ plantillaId, versionIdInicial }: { plantillaId: string; versionIdInicial?: string }) {
  const router = useRouter();
  const [data, setData] = useState<PlantillaConVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const d = await getPlantillaConVersion(plantillaId, versionIdInicial);
    setData(d);
    setLoading(false);
  }, [plantillaId, versionIdInicial]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Cargando plantilla…</div>;
  }
  if (!data) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.push("/calidad/auditorias")}><ArrowLeft className="h-4 w-4 mr-2" /> Volver</Button>
        <p className="text-muted-foreground">No se ha encontrado la plantilla.</p>
      </div>
    );
  }

  const { plantilla, versionActual, secciones, versiones } = data;
  const esBorrador = versionActual.estado === "borrador";
  const esVigente = versionActual.vigente;

  async function onPublicar() {
    if (secciones.length === 0) {
      toast.error("Añade al menos una sección antes de publicar.");
      return;
    }
    if (!confirm(`¿Publicar versión ${versionActual.version}? La vigente actual quedará como histórica.`)) return;
    const res = await publicarVersion(versionActual.id);
    if (res.ok) {
      toast.success(`Versión ${versionActual.version} publicada y vigente`);
      reload();
    } else {
      toast.error(res.error ?? "Error al publicar");
    }
  }

  async function onNuevaVersion() {
    const vigente = versiones.find((v) => v.vigente);
    if (!vigente) {
      toast.error("No hay versión vigente para clonar.");
      return;
    }
    const res = await crearBorradorNuevaVersion(vigente.id);
    if (res.ok) {
      toast.success("Borrador creado");
      router.replace(`/calidad/auditorias/plantillas/${plantillaId}?v=${res.versionId}`);
      reload();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" onClick={() => router.push("/calidad/auditorias")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">v{versionActual.version}</Badge>
          {esVigente ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Vigente</Badge>
          ) : esBorrador ? (
            <Badge variant="outline">Borrador</Badge>
          ) : (
            <Badge variant="outline">Histórica</Badge>
          )}
          {versiones.length > 1 && (
            <VersionSwitcher
              versiones={versiones}
              actualId={versionActual.id}
              onChange={(vid) => router.push(`/calidad/auditorias/plantillas/${plantillaId}?v=${vid}`)}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {esBorrador ? (
            <Button onClick={onPublicar} className="gap-2">
              <Save className="h-4 w-4" /> Publicar v{versionActual.version}
            </Button>
          ) : esVigente ? (
            <Button onClick={onNuevaVersion} variant="outline" className="gap-2">
              <History className="h-4 w-4" /> Editar y publicar nueva versión
            </Button>
          ) : null}
        </div>
      </div>

      <CabeceraPlantilla
        plantilla={plantilla}
        readOnly={!esBorrador}
        onPatch={(patch) => {
          startTransition(async () => {
            await actualizarPlantilla(plantilla.id, patch);
            setData((d) => (d ? { ...d, plantilla: { ...d.plantilla, ...patch } } : d));
          });
        }}
      />

      <div className="space-y-3">
        {secciones.map((s, idx) => (
          <SeccionBloque
            key={s.id}
            seccion={s}
            preguntas={s.preguntas}
            readOnly={!esBorrador}
            indice={idx + 1}
            esPrimera={idx === 0}
            esUltima={idx === secciones.length - 1}
            onMover={async (dir) => {
              const otra = dir === "up" ? secciones[idx - 1] : secciones[idx + 1];
              if (!otra) return;
              const ids = secciones.map((x) => x.id);
              const i1 = ids.indexOf(s.id);
              const i2 = ids.indexOf(otra.id);
              [ids[i1], ids[i2]] = [ids[i2], ids[i1]];
              await reordenarSecciones(versionActual.id, ids);
              reload();
            }}
            onActualizarSeccion={async (patch) => {
              await actualizarSeccion(s.id, patch);
              reload();
            }}
            onEliminarSeccion={async () => {
              if (!confirm(`¿Eliminar la sección "${s.titulo}" y todas sus preguntas?`)) return;
              await eliminarSeccion(s.id);
              reload();
            }}
            onAnadirPregunta={async (tipo) => {
              await crearPregunta(s.id, tipo);
              reload();
            }}
            onActualizarPregunta={async (preguntaId, patch) => {
              await actualizarPregunta(preguntaId, patch);
              reload();
            }}
            onEliminarPregunta={async (preguntaId) => {
              if (!confirm("¿Eliminar esta pregunta?")) return;
              await eliminarPregunta(preguntaId);
              reload();
            }}
            onMoverPregunta={async (preguntaId, dir) => {
              const ids = s.preguntas.map((p) => p.id);
              const i = ids.indexOf(preguntaId);
              const j = dir === "up" ? i - 1 : i + 1;
              if (j < 0 || j >= ids.length) return;
              [ids[i], ids[j]] = [ids[j], ids[i]];
              await reordenarPreguntas(s.id, ids);
              reload();
            }}
          />
        ))}

        {esBorrador && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                const res = await crearSeccion(versionActual.id);
                if (res.ok) reload();
                else toast.error(res.error);
              }}
            >
              <Plus className="h-4 w-4" /> Añadir sección
            </Button>
          </div>
        )}

        {!esBorrador && secciones.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground">
            Esta versión no tiene secciones.
          </Card>
        )}
      </div>
    </div>
  );
}

function VersionSwitcher({
  versiones,
  actualId,
  onChange,
}: {
  versiones: PlantillaConVersion["versiones"];
  actualId: string;
  onChange: (vid: string) => void;
}) {
  return (
    <Select value={actualId} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-auto text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[...versiones]
          .sort((a, b) => b.version - a.version)
          .map((v) => (
            <SelectItem key={v.id} value={v.id} className="text-xs">
              v{v.version}{v.vigente ? " (vigente)" : v.estado === "borrador" ? " (borrador)" : " (histórica)"}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function CabeceraPlantilla({
  plantilla,
  readOnly,
  onPatch,
}: {
  plantilla: PlantillaConVersion["plantilla"];
  readOnly: boolean;
  onPatch: (patch: { nombre?: string; descripcion?: string | null }) => void;
}) {
  const [nombre, setNombre] = useState(plantilla.nombre);
  const [descripcion, setDescripcion] = useState(plantilla.descripcion ?? "");

  useEffect(() => {
    setNombre(plantilla.nombre);
    setDescripcion(plantilla.descripcion ?? "");
  }, [plantilla.id, plantilla.nombre, plantilla.descripcion]);

  return (
    <Card className="p-5 space-y-3 border-l-4 border-l-primary/60">
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Nombre</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => nombre !== plantilla.nombre && onPatch({ nombre })}
          disabled={readOnly}
          className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
        />
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Descripción</Label>
        <Textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          onBlur={() => descripcion !== (plantilla.descripcion ?? "") && onPatch({ descripcion: descripcion || null })}
          disabled={readOnly}
          placeholder="Para qué sirve esta auditoría…"
          rows={3}
          className="border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary resize-none"
        />
      </div>
    </Card>
  );
}

function SeccionBloque({
  seccion,
  preguntas,
  readOnly,
  indice,
  esPrimera,
  esUltima,
  onMover,
  onActualizarSeccion,
  onEliminarSeccion,
  onAnadirPregunta,
  onActualizarPregunta,
  onEliminarPregunta,
  onMoverPregunta,
}: {
  seccion: AuditoriaSeccion;
  preguntas: AuditoriaPregunta[];
  readOnly: boolean;
  indice: number;
  esPrimera: boolean;
  esUltima: boolean;
  onMover: (dir: "up" | "down") => void;
  onActualizarSeccion: (patch: { titulo?: string; descripcion?: string | null }) => void;
  onEliminarSeccion: () => void;
  onAnadirPregunta: (tipo: AuditoriaTipoPregunta) => void;
  onActualizarPregunta: (preguntaId: string, patch: Partial<AuditoriaPregunta>) => void;
  onEliminarPregunta: (preguntaId: string) => void;
  onMoverPregunta: (preguntaId: string, dir: "up" | "down") => void;
}) {
  const [abierta, setAbierta] = useState(true);
  const [titulo, setTitulo] = useState(seccion.titulo);
  const [descripcion, setDescripcion] = useState(seccion.descripcion ?? "");

  useEffect(() => {
    setTitulo(seccion.titulo);
    setDescripcion(seccion.descripcion ?? "");
  }, [seccion.id, seccion.titulo, seccion.descripcion]);

  return (
    <Card className="overflow-hidden border-l-4 border-l-muted-foreground/30">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAbierta((v) => !v)}>
          {abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <span className="text-xs text-muted-foreground font-mono">Sección {indice}</span>
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => titulo !== seccion.titulo && onActualizarSeccion({ titulo })}
          disabled={readOnly}
          className="border-0 bg-transparent flex-1 font-medium focus-visible:ring-0 focus-visible:border-primary border-b border-transparent focus-visible:border-primary/50 rounded-none px-1"
          placeholder="Título de la sección"
        />
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={esPrimera} onClick={() => onMover("up")} title="Subir">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={esUltima} onClick={() => onMover("down")} title="Bajar">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onEliminarSeccion} title="Eliminar sección">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {abierta && (
        <div className="p-3 space-y-3">
          {!readOnly && (
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              onBlur={() => descripcion !== (seccion.descripcion ?? "") && onActualizarSeccion({ descripcion: descripcion || null })}
              placeholder="Descripción opcional…"
              rows={2}
              className="text-sm"
            />
          )}
          {readOnly && seccion.descripcion && (
            <p className="text-sm text-muted-foreground">{seccion.descripcion}</p>
          )}

          {preguntas.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">Sin preguntas aún</p>
          ) : (
            <div className="space-y-2">
              {preguntas.map((p, i) => (
                <PreguntaBloque
                  key={p.id}
                  pregunta={p}
                  readOnly={readOnly}
                  esPrimera={i === 0}
                  esUltima={i === preguntas.length - 1}
                  onMover={(dir) => onMoverPregunta(p.id, dir)}
                  onActualizar={(patch) => onActualizarPregunta(p.id, patch)}
                  onEliminar={() => onEliminarPregunta(p.id)}
                />
              ))}
            </div>
          )}

          {!readOnly && (
            <div className="pt-2 border-t flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">+ añadir:</span>
              {TIPO_OPTIONS.map((t) => (
                <Button key={t.value} size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAnadirPregunta(t.value)}>
                  {t.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PreguntaBloque({
  pregunta,
  readOnly,
  esPrimera,
  esUltima,
  onMover,
  onActualizar,
  onEliminar,
}: {
  pregunta: AuditoriaPregunta;
  readOnly: boolean;
  esPrimera: boolean;
  esUltima: boolean;
  onMover: (dir: "up" | "down") => void;
  onActualizar: (patch: Partial<AuditoriaPregunta>) => void;
  onEliminar: () => void;
}) {
  const [texto, setTexto] = useState(pregunta.texto);

  useEffect(() => {
    setTexto(pregunta.texto);
  }, [pregunta.id, pregunta.texto]);

  return (
    <div className="border rounded-md p-3 bg-card space-y-2">
      <div className="flex items-start gap-2">
        {!readOnly && (
          <div className="flex flex-col items-center pt-1.5">
            <GripVertical className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono shrink-0">#{pregunta.numero_global}</span>
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={() => texto !== pregunta.texto && onActualizar({ texto })}
              disabled={readOnly}
              placeholder="Texto de la pregunta"
              className="border-0 bg-transparent focus-visible:ring-0 px-0 font-medium"
            />
          </div>
          <PreguntaVistaPreviaTipo pregunta={pregunta} />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!readOnly && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={esPrimera} onClick={() => onMover("up")}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={esUltima} onClick={() => onMover("down")}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onEliminar}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-3 flex-wrap pl-6 pt-1 border-t">
          <Select
            value={pregunta.tipo}
            onValueChange={(v) => onActualizar({ tipo: v as AuditoriaTipoPregunta })}
          >
            <SelectTrigger className="h-7 text-xs w-auto min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={pregunta.obligatoria}
              onCheckedChange={(v) => onActualizar({ obligatoria: !!v })}
            />
            Obligatoria
          </label>

          {pregunta.tipo !== "texto_largo" && pregunta.tipo !== "observaciones" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Peso:</span>
              <Input
                type="number"
                value={pregunta.peso}
                onChange={(e) => onActualizar({ peso: parseFloat(e.target.value) || 0 })}
                step="0.5"
                min="0"
                className="h-7 w-16 text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreguntaVistaPreviaTipo({ pregunta }: { pregunta: AuditoriaPregunta }) {
  if (pregunta.tipo === "escala") {
    const min = pregunta.escala_min ?? 0;
    const max = pregunta.escala_max ?? 5;
    const items = Array.from({ length: max - min + 1 }, (_, i) => i + min);
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{pregunta.etiqueta_min ?? "Muy mal"}</span>
        {items.map((n) => (
          <span key={n} className="inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px]">{n}</span>
        ))}
        <span>{pregunta.etiqueta_max ?? "Muy bien"}</span>
      </div>
    );
  }
  if (pregunta.tipo === "si_no") {
    return <div className="text-xs text-muted-foreground">◯ Sí &nbsp; ◯ No</div>;
  }
  if (pregunta.tipo === "texto_largo" || pregunta.tipo === "observaciones") {
    return <div className="text-xs text-muted-foreground italic">Respuesta de texto libre</div>;
  }
  return <div className="text-xs text-muted-foreground italic">{TIPO_LABEL[pregunta.tipo]}</div>;
}
