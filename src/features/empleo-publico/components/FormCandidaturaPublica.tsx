"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
  genero: string;
  ubicacion: string;
  disponibilidad: string;
  cv: File | null;
  carta_presentacion: string;
}

const VACIO: FormState = {
  nombre: "",
  apellidos: "",
  email: "",
  telefono: "",
  genero: "",
  ubicacion: "",
  disponibilidad: "",
  cv: null,
  carta_presentacion: "",
};

/** Opciones del desplegable «¿Desde cuándo puedes empezar?». */
const DISPONIBILIDAD_OPCIONES = [
  { value: "inmediato", label: "Inmediato" },
  { value: "15_dias", label: "En 15 días" },
] as const;

const MAX_CV_BYTES = 5 * 1024 * 1024;

type Paso = "datos" | "cuestionario";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * Buscador de localidad con autocompletado mundial (pueblos / barrios) vía OSM.
 * El candidato escribe y elige una sugerencia; también puede dejar el texto que
 * escribió a mano. El valor guardado es siempre `value` (texto de la localidad).
 */
function BuscadorLocalidad({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  // Evita pisar el valor con respuestas de peticiones antiguas (carrera).
  const ultimaRef = useRef("");

  useEffect(() => {
    const q = value.trim();
    ultimaRef.current = q;
    if (q.length < 3) {
      setSugerencias([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/empleo/localidades?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { localidades?: string[] };
        if (ultimaRef.current === q) {
          setSugerencias(data.localidades ?? []);
        }
      } catch {
        if (ultimaRef.current === q) setSugerencias([]);
      } finally {
        if (ultimaRef.current === q) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="relative">
      <Input
        id="ubicacion"
        required
        value={value}
        autoComplete="off"
        placeholder="Escribe tu localidad o barrio…"
        onChange={(e) => {
          onChange(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        // Pequeño retardo para permitir el click en una sugerencia.
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
      />
      {abierto && value.trim().length >= 3 && (sugerencias.length > 0 || buscando) && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border border-input bg-popover shadow-md text-sm">
          {buscando && sugerencias.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">Buscando…</li>
          )}
          {sugerencias.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="block w-full text-left px-3 py-2 hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s);
                  setAbierto(false);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FormCandidaturaPublica({
  empresaSlug, empresaId, ofertaId, ofertaTitulo, canalCodigo = null, cuestionario = null,
}: Props) {
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
    if (!form.genero) return "El género es obligatorio";
    if (!form.ubicacion.trim()) return "La ubicación es obligatoria";
    if (!form.disponibilidad) return "La disponibilidad es obligatoria";
    if (!form.cv) return "El currículum es obligatorio";
    if (form.cv.size > MAX_CV_BYTES) return "El CV no puede superar 5MB";
    if (form.cv.type !== "application/pdf") return "El CV debe ser un PDF";
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
        fd.set("genero", form.genero);
        fd.set("ubicacion", form.ubicacion.trim());
        fd.set("disponibilidad", form.disponibilidad);
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
          <p className="text-sm text-muted-foreground mt-1.5">
            Para terminar, necesitamos que respondas estas breves preguntas para conocerte un poco más.
          </p>
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

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="genero">Género *</Label>
          <select
            id="genero"
            required
            value={form.genero}
            onChange={(e) => update("genero", e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Selecciona…</option>
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="disponibilidad">¿Desde cuándo puedes empezar? *</Label>
          <select
            id="disponibilidad"
            required
            value={form.disponibilidad}
            onChange={(e) => update("disponibilidad", e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Selecciona…</option>
            {DISPONIBILIDAD_OPCIONES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ubicacion">Ubicación *</Label>
        <BuscadorLocalidad value={form.ubicacion} onChange={(v) => update("ubicacion", v)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cv">Currículum *</Label>
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
          {tieneCuestionario ? "Siguiente" : "Enviar candidatura"}
        </Button>
      </div>
    </form>
  );
}
