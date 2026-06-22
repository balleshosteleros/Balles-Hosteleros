"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Send, CheckCircle2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";
import type { CuestionarioPublico } from "@/features/empleo-publico/services/empleo-fetch";
import type { RespuestasCuestionario } from "@/features/rrhh/data/cuestionario-vacante";

interface Props {
  empresaSlug: string;
  empresaId: string;
  ofertaId: string;
  ofertaTitulo: string;
  canalCodigo?: string | null;
  cuestionario?: CuestionarioPublico | null;
}

interface FormState {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  cv: File | null;
  carta_presentacion: string;
}

const VACIO: FormState = {
  nombre: "",
  apellidos: "",
  email: "",
  telefono: "",
  cv: null,
  carta_presentacion: "",
};

const MAX_CV_BYTES = 5 * 1024 * 1024;

type Paso = "datos" | "cuestionario";

export function FormCandidaturaPublica({
  empresaSlug, empresaId, ofertaId, ofertaTitulo, canalCodigo = null, cuestionario = null,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(VACIO);
  const [respuestas, setRespuestas] = useState<RespuestasCuestionario>({});
  const [paso, setPaso] = useState<Paso>("datos");
  const [enviado, setEnviado] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tieneCuestionario = !!cuestionario && cuestionario.preguntas.length > 0;

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function validarDatos(): string | null {
    if (!form.nombre.trim()) return "El nombre es obligatorio";
    if (!form.apellidos.trim()) return "Los apellidos son obligatorios";
    if (!form.email.trim()) return "El email es obligatorio";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Email no válido";
    if (!form.telefono.trim()) return "El teléfono es obligatorio";
    if (form.cv && form.cv.size > MAX_CV_BYTES) return "El CV no puede superar 5MB";
    if (form.cv && form.cv.type !== "application/pdf") return "El CV debe ser un PDF";
    return null;
  }

  function validarCuestionario(): string | null {
    if (!cuestionario) return null;
    for (const p of cuestionario.preguntas) {
      if (p.obligatoria && !respuestas[p.id]) return "Responde todas las preguntas del cuestionario";
    }
    return null;
  }

  function continuar() {
    setError(null);
    const err = validarDatos();
    if (err) { setError(err); return; }
    setPaso("cuestionario");
  }

  function enviar() {
    setError(null);
    const errDatos = validarDatos();
    if (errDatos) { setError(errDatos); setPaso("datos"); return; }
    const errCuest = validarCuestionario();
    if (errCuest) { setError(errCuest); return; }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("empresa_slug", empresaSlug);
        fd.set("empresa_id", empresaId);
        fd.set("oferta_id", ofertaId);
        fd.set("nombre", form.nombre.trim());
        fd.set("apellidos", form.apellidos.trim());
        fd.set("email", form.email.trim().toLowerCase());
        fd.set("telefono", form.telefono.trim());
        fd.set("carta_presentacion", form.carta_presentacion.trim());
        if (canalCodigo) fd.set("canal_codigo", canalCodigo);
        if (form.cv) fd.set("cv", form.cv);
        if (tieneCuestionario) fd.set("respuestas", JSON.stringify(respuestas));

        const res = await fetch("/api/empleo/candidatura", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Error al enviar la candidatura");
        }
        setEnviado(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function reiniciar() {
    setForm(VACIO);
    setRespuestas({});
    setPaso("datos");
    setEnviado(false);
    router.refresh();
  }

  if (enviado) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500" />
        <div>
          <h2 className="text-xl font-semibold">¡Candidatura enviada!</h2>
          <p className="text-muted-foreground mt-2">
            Hemos recibido tu candidatura para <b>{ofertaTitulo}</b>. Te contactaremos pronto.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Button asChild variant="outline">
            <Link href={`/empleo/${empresaSlug}`}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Ver más ofertas
            </Link>
          </Button>
          <Button onClick={reiniciar}>Enviar otra candidatura</Button>
        </div>
      </div>
    );
  }

  // ─── Paso 2: cuestionario ───────────────────────────────────────
  if (paso === "cuestionario" && cuestionario) {
    return (
      <div className="rounded-lg border bg-card p-5 md:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">{cuestionario.nombre}</h2>
          {cuestionario.descripcion && (
            <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-line">
              {cuestionario.descripcion}
            </p>
          )}
        </div>

        <div className="space-y-5">
          {cuestionario.preguntas.map((p, idx) => (
            <fieldset key={p.id} className="space-y-2.5">
              <legend className="text-sm font-medium text-foreground">
                {idx + 1}. {p.titulo}
                {p.obligatoria && <span className="text-destructive ml-0.5">*</span>}
              </legend>
              <div className="space-y-2">
                {p.opciones.map((o) => {
                  const checked = respuestas[p.id] === o.id;
                  return (
                    <label
                      key={o.id}
                      className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                        checked ? "border-primary bg-primary/5" : "border-input hover:bg-accent"
                      }`}
                    >
                      <input
                        type="radio"
                        name={p.id}
                        value={o.id}
                        checked={checked}
                        onChange={() => setRespuestas((prev) => ({ ...prev, [p.id]: o.id }))}
                        className="mt-0.5 accent-primary"
                      />
                      <span className="text-foreground/90">{o.texto}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 border border-destructive/20">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <Button variant="outline" onClick={() => { setError(null); setPaso("datos"); }} disabled={pending}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver
          </Button>
          <Button onClick={enviar} disabled={pending} size="lg">
            {pending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
            Enviar candidatura
          </Button>
        </div>
      </div>
    );
  }

  // ─── Paso 1: datos ──────────────────────────────────────────────
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (tieneCuestionario) continuar(); else enviar(); }}
      className="rounded-lg border bg-card p-5 md:p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold">Postular a esta oferta</h2>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre *</Label>
          <Input
            id="nombre"
            required
            value={form.nombre}
            onChange={(e) => update("nombre", e.target.value)}
            onBlur={() => update("nombre", normalizarNombre(form.nombre))}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apellidos">Apellidos *</Label>
          <Input
            id="apellidos"
            required
            value={form.apellidos}
            onChange={(e) => update("apellidos", e.target.value)}
            onBlur={() => update("apellidos", normalizarNombre(form.apellidos))}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono *</Label>
          <Input
            id="telefono"
            type="tel"
            required
            value={form.telefono}
            onChange={(e) => update("telefono", e.target.value)}
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cv">Currículum vitae</Label>
        <label
          htmlFor="cv"
          className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent"
        >
          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={form.cv ? "truncate text-foreground" : "text-muted-foreground"}>
            {form.cv ? form.cv.name : "Adjuntar PDF"}
          </span>
        </label>
        <input
          id="cv"
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => update("cv", e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="carta">Carta de presentación (opcional)</Label>
        <Textarea
          id="carta"
          rows={4}
          value={form.carta_presentacion}
          onChange={(e) => update("carta_presentacion", e.target.value)}
          placeholder="Cuéntanos por qué te interesa esta oferta…"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 border border-destructive/20">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <p className="text-[11px] text-muted-foreground">
          Al enviar aceptas el tratamiento de tus datos para gestionar el proceso de selección.
        </p>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : tieneCuestionario ? (
            <ArrowRight className="h-4 w-4 mr-1.5" />
          ) : (
            <Send className="h-4 w-4 mr-1.5" />
          )}
          {tieneCuestionario ? "Continuar al cuestionario" : "Enviar candidatura"}
        </Button>
      </div>
    </form>
  );
}
