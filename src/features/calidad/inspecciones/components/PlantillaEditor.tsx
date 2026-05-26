"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import {
  actualizarSeccion,
  actualizarPregunta,
  getPlantillaCompleta,
} from "../actions";
import type { Plantilla } from "../types";

interface PlantillaEditorProps {
  plantillaId: string;
}

const TIPO_LABEL: Record<string, string> = {
  texto_corto: "Texto corto",
  texto_largo: "Texto largo",
  fecha: "Fecha",
  telefono: "Teléfono",
  escala: "Escala 0-5",
  seleccion: "Selección",
  empleado_select: "Empleado (desplegable)",
};

export function PlantillaEditor({ plantillaId }: PlantillaEditorProps) {
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPlantillaCompleta(plantillaId).then((p) => {
      setPlantilla(p);
      setLoading(false);
    });
  }, [plantillaId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card py-16 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!plantilla || !plantilla.vigente_version) {
    return (
      <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
        No hay versión vigente de la plantilla.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{plantilla.nombre}</div>
          <div className="text-xs text-muted-foreground">
            Plantilla #{plantilla.numero_secuencial} · Versión {plantilla.vigente_version.version}
            {" · "}
            <Badge variant="outline" className="text-[10px]">{plantilla.vigente_version.estado}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {plantilla.vigente_version.secciones.map((sec) => (
          <SeccionCard key={sec.id} seccion={sec} />
        ))}
      </div>
    </div>
  );
}

function SeccionCard({
  seccion,
}: {
  seccion: NonNullable<Plantilla["vigente_version"]>["secciones"][number];
}) {
  const [titulo, setTitulo] = useState(seccion.titulo);
  const [descripcion, setDescripcion] = useState(seccion.descripcion ?? "");
  const [dirty, setDirty] = useState(false);
  const [isSaving, startSave] = useTransition();

  function handleSave() {
    startSave(async () => {
      const res = await actualizarSeccion(seccion.id, {
        titulo,
        descripcion: descripcion || null,
      });
      if (res.ok) {
        toast.success("Sección guardada");
        setDirty(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <Input
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                setDirty(true);
              }}
              className="text-base font-semibold border-0 px-0 shadow-none focus-visible:ring-0 h-auto"
            />
            <Textarea
              value={descripcion}
              onChange={(e) => {
                setDescripcion(e.target.value);
                setDirty(true);
              }}
              placeholder="Descripción (opcional)"
              rows={2}
              className="text-sm border-0 px-0 shadow-none focus-visible:ring-0 resize-none"
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={!dirty || isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {seccion.preguntas.map((p) => (
          <PreguntaRow key={p.id} pregunta={p} />
        ))}
      </CardContent>
    </Card>
  );
}

function PreguntaRow({
  pregunta,
}: {
  pregunta: NonNullable<Plantilla["vigente_version"]>["secciones"][number]["preguntas"][number];
}) {
  const [enunciado, setEnunciado] = useState(pregunta.enunciado);
  const [obligatoria, setObligatoria] = useState(pregunta.obligatoria);
  const [cuentaNota, setCuentaNota] = useState(pregunta.cuenta_para_nota);
  const [escalaLabelMin, setEscalaLabelMin] = useState(pregunta.escala_label_min ?? "");
  const [escalaLabelMax, setEscalaLabelMax] = useState(pregunta.escala_label_max ?? "");
  const [dirty, setDirty] = useState(false);
  const [isSaving, startSave] = useTransition();

  function handleSave() {
    startSave(async () => {
      const res = await actualizarPregunta(pregunta.id, {
        enunciado,
        obligatoria,
        cuenta_para_nota: cuentaNota,
        escala_label_min: escalaLabelMin || null,
        escala_label_max: escalaLabelMax || null,
      });
      if (res.ok) {
        toast.success("Pregunta guardada");
        setDirty(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Badge variant="outline" className="text-[10px] mt-0.5 shrink-0">
          {TIPO_LABEL[pregunta.tipo] ?? pregunta.tipo}
        </Badge>
        <Textarea
          value={enunciado}
          onChange={(e) => {
            setEnunciado(e.target.value);
            setDirty(true);
          }}
          rows={2}
          className="text-sm flex-1"
        />
        <Button size="sm" onClick={handleSave} disabled={!dirty || isSaving} className="shrink-0">
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <Switch checked={obligatoria} onCheckedChange={(v) => { setObligatoria(v); setDirty(true); }} />
          Obligatoria
        </label>
        {pregunta.tipo === "escala" && (
          <>
            <label className="flex items-center gap-1.5">
              <Switch checked={cuentaNota} onCheckedChange={(v) => { setCuentaNota(v); setDirty(true); }} />
              Cuenta para nota
            </label>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Min:</Label>
              <Input value={escalaLabelMin} onChange={(e) => { setEscalaLabelMin(e.target.value); setDirty(true); }} className="h-7 w-24 text-xs" />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Max:</Label>
              <Input value={escalaLabelMax} onChange={(e) => { setEscalaLabelMax(e.target.value); setDirty(true); }} className="h-7 w-24 text-xs" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
