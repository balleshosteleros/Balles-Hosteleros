"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { InspeccionPublica } from "../types";

interface PublicFormularioProps {
  token: string;
  data: InspeccionPublica;
}

type Respuestas = Record<string, string | number | null>;

export function PublicFormulario({ token, data }: PublicFormularioProps) {
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [localId, setLocalId] = useState<string | null>(
    data.locales.length === 1 ? data.locales[0].id : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ numero: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accent = data.empresa.color_secundario ?? data.empresa.color ?? "#10b981";

  function setResp(preguntaId: string, valor: string | number | null) {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Validaciones de los 4 datos cabecera + local
    const datosSec = data.plantilla.secciones[0];
    const preguntaNombre = datosSec?.preguntas.find((p) => p.enunciado.toLowerCase().includes("nombre inspect"));
    const preguntaFecha = datosSec?.preguntas.find((p) => p.tipo === "fecha");
    const preguntaTelefono = datosSec?.preguntas.find((p) => p.tipo === "telefono");
    const preguntaEncargado = datosSec?.preguntas.find((p) =>
      p.enunciado.toLowerCase().includes("encargado"),
    );

    const nombre_inspector = (respuestas[preguntaNombre?.id ?? ""] as string) ?? "";
    const fecha_inspeccion = (respuestas[preguntaFecha?.id ?? ""] as string) ?? "";
    const telefono_inspector = (respuestas[preguntaTelefono?.id ?? ""] as string) ?? "";
    const nombre_encargado = (respuestas[preguntaEncargado?.id ?? ""] as string) ?? "";

    if (!nombre_inspector.trim()) {
      setError("Pon tu nombre.");
      window.scrollTo({ top: document.getElementById("formulario")?.offsetTop ?? 0, behavior: "smooth" });
      return;
    }
    if (data.locales.length > 1 && !localId) {
      setError("Elige el local que inspeccionaste.");
      return;
    }

    // Comprobar obligatorias
    const faltan: string[] = [];
    for (const sec of data.plantilla.secciones) {
      for (const p of sec.preguntas) {
        if (!p.obligatoria) continue;
        const v = respuestas[p.id];
        if (v === undefined || v === null || v === "") faltan.push(p.enunciado);
      }
    }
    if (faltan.length) {
      setError(`Faltan ${faltan.length} respuestas obligatorias.`);
      return;
    }

    setSubmitting(true);
    try {
      const todasRespuestas = Object.entries(respuestas)
        .filter(([, v]) => v !== null && v !== "")
        .map(([pregunta_id, valor]) => ({ pregunta_id, valor }));

      const res = await fetch(`/api/inspectores/${token}/envio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          local_id: localId,
          nombre_inspector,
          telefono_inspector: telefono_inspector || null,
          fecha_inspeccion: fecha_inspeccion || null,
          nombre_encargado: nombre_encargado || null,
          respuestas: todasRespuestas,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; numero: number | null }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : "Error al enviar");
        setSubmitting(false);
        return;
      }
      setSuccess({ numero: json.numero });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl bg-white text-foreground p-8 md:p-12 text-center space-y-3 max-w-2xl mx-auto">
        <CheckCircle2 className="h-14 w-14 mx-auto" style={{ color: accent }} />
        <h2 className="text-2xl md:text-3xl font-bold">¡Inspección enviada!</h2>
        <p className="text-muted-foreground">
          Gracias por tu trabajo. El departamento de Calidad revisará tu informe
          {success.numero ? ` (referencia #${success.numero})` : ""}.
        </p>
      </div>
    );
  }

  return (
    <form
      id="formulario"
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white text-foreground p-6 md:p-10 shadow-xl space-y-8"
    >
      <div className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-bold">{data.plantilla.nombre}</h2>
        <p className="text-sm text-muted-foreground">
          Responde a todas las preguntas. Sé lo más específic@ posible.
        </p>
      </div>

      {data.locales.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Local inspeccionado *</Label>
          <div className="flex flex-wrap gap-2">
            {data.locales.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLocalId(l.id)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  localId === l.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted/50"
                }`}
              >
                {l.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {data.plantilla.secciones.map((sec) => (
        <div key={sec.id} className="space-y-4">
          <div className="space-y-1 pb-2 border-b">
            <h3 className="text-lg font-semibold">{sec.titulo}</h3>
            {sec.descripcion && (
              <p className="text-sm text-muted-foreground leading-relaxed">{sec.descripcion}</p>
            )}
          </div>
          {sec.preguntas.map((p) => (
            <div key={p.id} className="space-y-2">
              <Label className="text-sm leading-snug">
                {p.enunciado}
                {p.obligatoria && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
              <PreguntaInput pregunta={p} valor={respuestas[p.id]} onChange={(v) => setResp(p.id, v)} accent={accent} />
            </div>
          ))}
        </div>
      ))}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="w-full md:w-auto"
          style={{ backgroundColor: accent, color: "#0a0a0a" }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enviar inspección
        </Button>
      </div>
    </form>
  );
}

function PreguntaInput({
  pregunta,
  valor,
  onChange,
  accent,
}: {
  pregunta: InspeccionPublica["plantilla"]["secciones"][number]["preguntas"][number];
  valor: string | number | null | undefined;
  onChange: (v: string | number | null) => void;
  accent: string;
}) {
  switch (pregunta.tipo) {
    case "texto_corto":
      return <Input value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "texto_largo":
      return <Textarea value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} />;
    case "fecha":
      return <Input type="date" value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "telefono":
      return <Input type="tel" value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="+34 ..." />;
    case "escala": {
      const min = pregunta.escala_min ?? 0;
      const max = pregunta.escala_max ?? 5;
      const opciones: number[] = [];
      for (let i = min; i <= max; i++) opciones.push(i);
      const current = typeof valor === "number" ? valor : null;
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{pregunta.escala_label_min ?? "Muy mal"}</span>
            <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
              {opciones.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange(n)}
                  className={`rounded-md border py-2 text-sm font-medium transition-all ${
                    current === n ? "text-background border-transparent" : "hover:bg-muted/30"
                  }`}
                  style={current === n ? { backgroundColor: accent } : undefined}
                >
                  {n}
                </button>
              ))}
            </div>
            <span>{pregunta.escala_label_max ?? "Muy bien"}</span>
          </div>
        </div>
      );
    }
    case "seleccion":
      return (
        <div className="flex flex-wrap gap-2">
          {(pregunta.opciones ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`rounded-md border px-3 py-2 text-sm ${valor === opt ? "border-foreground bg-foreground text-background" : "hover:bg-muted/50"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
  }
}
