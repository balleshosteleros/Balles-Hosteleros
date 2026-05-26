"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  InspeccionPublica,
  EmpleadoPublico,
  EmpleadoSeleccionado,
  InspectorPublico,
  QrTokenPublic,
} from "../types";
import { QrViewerDialog } from "./QrViewerDialog";

// Limpia sufijos del nombre de la plantilla (" — versión 2", " — V3",
// " — 2023"...) para mostrar el título de forma neutra. El badge V# va aparte.
function limpiarNombrePlantilla(nombre: string): string {
  return nombre
    .replace(/\s*[—-]\s*versi[oó]n\s*\d+\s*$/i, "")
    .replace(/\s*[—-]\s*v\s*\d+\s*$/i, "")
    .replace(/\s*[—-]\s*\d{4}\s*$/, "")
    .trim();
}

type PreguntaPublica =
  InspeccionPublica["plantilla"]["secciones"][number]["preguntas"][number];

function esPreguntaNombreInspector(p: PreguntaPublica): boolean {
  return p.tipo === "texto_corto" && p.enunciado.toLowerCase().includes("inspector");
}
function esPreguntaTelefonoInspector(p: PreguntaPublica): boolean {
  return p.tipo === "telefono" && p.enunciado.toLowerCase().includes("inspector");
}

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
  const [inspectorId, setInspectorId] = useState<string | null>(null);
  const inspectorSeleccionado: InspectorPublico | null =
    data.inspectores.find((i) => i.id === inspectorId) ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    numero: number | null;
    envioId: string;
    qr: QrTokenPublic;
    nombreInspector: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const accent = data.empresa.color_secundario ?? data.empresa.color ?? "#10b981";

  function setResp(preguntaId: string, valor: string | number | null) {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  }

  // El submit del form solo lanza el diálogo de confirmación.
  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    // Validación previa para no abrir diálogo si faltan cosas
    if (!inspectorSeleccionado) {
      setError("Elígete en el desplegable de inspectores para continuar.");
      return;
    }
    if (data.locales.length > 1 && !localId) {
      setError("Elige el local que inspeccionaste.");
      return;
    }
    // Las preguntas de nombre/teléfono del inspector las cubrimos con el
    // desplegable, así que las saltamos en la comprobación de obligatorias.
    const faltan: string[] = [];
    for (const sec of data.plantilla.secciones) {
      for (const p of sec.preguntas) {
        if (!p.obligatoria) continue;
        if (esPreguntaNombreInspector(p)) continue;
        if (esPreguntaTelefonoInspector(p)) continue;
        const v = respuestas[p.id];
        if (v === undefined || v === null || v === "") faltan.push(p.enunciado);
      }
    }
    if (faltan.length) {
      setError(`Faltan ${faltan.length} respuestas obligatorias.`);
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmarYEnviar() {
    setConfirmOpen(false);
    setError(null);

    if (!inspectorSeleccionado) {
      setError("Elígete en el desplegable de inspectores para continuar.");
      return;
    }

    // Localizamos las preguntas clave por tipo recorriendo todas las secciones,
    // porque desde la reestructura "Datos del inspeccionado" vive en su propia sección.
    const todasPreguntas = data.plantilla.secciones.flatMap((s) => s.preguntas);
    const preguntaNombre = todasPreguntas.find(esPreguntaNombreInspector);
    const preguntaFecha = todasPreguntas.find((p) => p.tipo === "fecha");
    const preguntaTelefono = todasPreguntas.find(esPreguntaTelefonoInspector);
    const preguntaJefeSala = todasPreguntas.find((p) => p.tipo === "empleado_select");

    // Nombre y teléfono salen del inspector elegido en el desplegable,
    // no del input (ese ya no existe en la UI).
    const nombre_inspector = inspectorSeleccionado.nombre_completo;
    const telefono_inspector = inspectorSeleccionado.telefono || "";
    const fecha_inspeccion = (respuestas[preguntaFecha?.id ?? ""] as string) ?? "";

    // El valor de empleado_select se guarda como JSON serializado en respuestas.
    let nombre_jefe_sala = "";
    const jefeSalaRaw = respuestas[preguntaJefeSala?.id ?? ""];
    if (typeof jefeSalaRaw === "string" && jefeSalaRaw) {
      try {
        const parsed = JSON.parse(jefeSalaRaw) as EmpleadoSeleccionado;
        nombre_jefe_sala = parsed.nombre_completo ?? "";
      } catch {
        // valor inválido, lo trataremos como vacío y el validador hará su trabajo
      }
    }

    setSubmitting(true);
    try {
      // Inyectamos en `respuestas` el nombre/teléfono del inspector elegido,
      // así quedan guardados también en `inspeccion_respuestas` para conservar
      // el snapshot histórico de la inspección.
      const respuestasFinal: Respuestas = { ...respuestas };
      if (preguntaNombre) respuestasFinal[preguntaNombre.id] = nombre_inspector;
      if (preguntaTelefono) respuestasFinal[preguntaTelefono.id] = telefono_inspector;

      const todasRespuestas = Object.entries(respuestasFinal)
        .filter(([, v]) => v !== null && v !== "")
        .map(([pregunta_id, valor]) => ({ pregunta_id, valor }));

      // datetime-local llega como "YYYY-MM-DDTHH:mm" sin TZ.
      // Lo interpretamos en la hora local del navegador (asumimos inspector en España)
      // y lo enviamos como ISO UTC para que timestamptz lo guarde correctamente.
      const fechaInspeccionISO = fecha_inspeccion
        ? new Date(fecha_inspeccion).toISOString()
        : null;

      const res = await fetch(`/api/inspectores/${token}/envio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          local_id: localId,
          inspector_id: inspectorSeleccionado.id,
          nombre_inspector,
          telefono_inspector: telefono_inspector || null,
          fecha_inspeccion: fechaInspeccionISO,
          nombre_jefe_sala: nombre_jefe_sala || null,
          respuestas: todasRespuestas,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; numero: number | null; envioId: string; qr: QrTokenPublic }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : "Error al enviar");
        setSubmitting(false);
        return;
      }
      setSuccess({
        numero: json.numero,
        envioId: json.envioId,
        qr: json.qr,
        nombreInspector: nombre_inspector.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <>
        <div className="rounded-xl bg-white text-foreground p-8 md:p-12 text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold">¡Inspección enviada!</h2>
          <p className="text-muted-foreground">
            Gracias por tu trabajo. Tu inspección ha quedado registrada
            {success.numero ? ` con la referencia #${success.numero}` : ""}.
            Enseña el QR al jefe de sala para verificar la visita.
          </p>
        </div>
        <QrViewerDialog
          open
          publicToken={token}
          envioId={success.envioId}
          numero={success.numero}
          qr={success.qr}
          accent={accent}
          nombreInspector={success.nombreInspector}
          onQrUpdated={(qr) =>
            setSuccess((prev) => (prev ? { ...prev, qr } : prev))
          }
        />
      </>
    );
  }

  return (
    <>
    <form
      id="formulario"
      ref={formRef}
      onSubmit={handleFormSubmit}
      className="rounded-2xl bg-white text-foreground p-6 md:p-10 shadow-xl space-y-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-2xl md:text-3xl font-bold">
            {limpiarNombrePlantilla(data.plantilla.nombre)}
          </h2>
          <p className="text-sm text-muted-foreground">
            Responde a todas las preguntas. Sé lo más específico posible.
          </p>
        </div>
        {data.plantilla.numero_secuencial != null && (
          <span
            className="shrink-0 rounded-md border border-muted-foreground/30 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide text-muted-foreground"
            title={`Versión ${data.plantilla.numero_secuencial}`}
          >
            v{data.plantilla.numero_secuencial}
          </span>
        )}
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

      {data.plantilla.secciones.map((sec) => {
        const preguntasVisibles = sec.preguntas.filter(
          (p) => !esPreguntaNombreInspector(p) && !esPreguntaTelefonoInspector(p),
        );
        // Detectamos la sección "Datos del inspector" por contener la pregunta
        // oculta del nombre del inspector: ahí pintamos el selector + sus datos
        // (teléfono y email) DEBAJO del título, para que el título tenga sentido.
        const esSeccionDatosInspector = sec.preguntas.some(esPreguntaNombreInspector);
        // Si la sección queda sin preguntas tras ocultar nombre/teléfono y no es
        // la sección donde inyectamos el selector, no pintamos nada.
        if (preguntasVisibles.length === 0 && !esSeccionDatosInspector) return null;
        return (
          <div key={sec.id} className="space-y-4">
            <div className="space-y-1 pb-2 border-b">
              <h3 className="text-lg font-semibold">{sec.titulo}</h3>
              {sec.descripcion && (
                <p className="text-sm text-muted-foreground leading-relaxed">{sec.descripcion}</p>
              )}
            </div>
            {esSeccionDatosInspector && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Inspector <span className="text-red-500 ml-0.5">*</span>
                </Label>
                {data.inspectores.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
                    No hay inspectores en proceso de colaboración. Pide a calidad
                    que te active antes de rellenar el formulario.
                  </div>
                ) : (
                  <>
                    <select
                      value={inspectorId ?? ""}
                      onChange={(e) => setInspectorId(e.target.value || null)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Selecciona tu nombre…</option>
                      {data.inspectores.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre_completo}
                        </option>
                      ))}
                    </select>
                    {inspectorSeleccionado && (
                      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm space-y-1">
                        <div>
                          <span className="text-xs text-muted-foreground mr-2">Teléfono:</span>
                          {inspectorSeleccionado.telefono || "—"}
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground mr-2">Email:</span>
                          {inspectorSeleccionado.email || "—"}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {preguntasVisibles.map((p) => {
              const esObservaciones =
                p.tipo === "texto_largo" && p.enunciado.toLowerCase().startsWith("observaciones");
              return (
                <div key={p.id} className="space-y-2">
                  {!esObservaciones && (
                    <Label className="text-sm leading-snug">
                      {p.enunciado}
                      {p.obligatoria && <span className="text-red-500 ml-0.5">*</span>}
                    </Label>
                  )}
                  {esObservaciones && (
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Observaciones
                    </Label>
                  )}
                  <PreguntaInput
                    pregunta={p}
                    valor={respuestas[p.id]}
                    onChange={(v) => setResp(p.id, v)}
                    accent={accent}
                    empleados={data.empleados}
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          size="lg"
          disabled={submitting || !inspectorSeleccionado}
          className="w-full md:w-auto"
          style={{ backgroundColor: accent, color: "#0a0a0a" }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enviar inspección
        </Button>
      </div>
    </form>

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar la inspección?</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a enviar la inspección. Una vez confirmada,{" "}
            <strong>no podrás editar tus respuestas</strong>. Asegúrate de que
            todo lo que has escrito es correcto.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Revisar</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmarYEnviar}
            disabled={submitting}
            style={{ backgroundColor: accent, color: "#0a0a0a" }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Sí, finalizar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function PreguntaInput({
  pregunta,
  valor,
  onChange,
  accent,
  empleados,
}: {
  pregunta: InspeccionPublica["plantilla"]["secciones"][number]["preguntas"][number];
  valor: string | number | null | undefined;
  onChange: (v: string | number | null) => void;
  accent: string;
  empleados: EmpleadoPublico[];
}) {
  switch (pregunta.tipo) {
    case "texto_corto":
      return <Input value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "texto_largo": {
      const esObservaciones = pregunta.enunciado.toLowerCase().startsWith("observaciones");
      if (esObservaciones) {
        return (
          <div className="rounded-md border bg-muted/20 p-2">
            <Textarea
              value={(valor as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              rows={4}
              placeholder="Déjalo vacío si no hay observaciones."
              className="border-0 bg-transparent focus-visible:ring-0 shadow-none p-2"
            />
          </div>
        );
      }
      return <Textarea value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} />;
    }
    case "fecha":
      return <Input type="datetime-local" value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
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
    case "empleado_select": {
      // El valor es JSON serializado: { empleado_id, nombre_completo, puesto, departamento }
      let seleccionado: EmpleadoSeleccionado | null = null;
      if (typeof valor === "string" && valor) {
        try {
          seleccionado = JSON.parse(valor) as EmpleadoSeleccionado;
        } catch {
          seleccionado = null;
        }
      }
      return (
        <div className="space-y-2">
          <select
            value={seleccionado?.empleado_id ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                onChange(null);
                return;
              }
              const emp = empleados.find((x) => x.id === id);
              if (!emp) {
                onChange(null);
                return;
              }
              const next: EmpleadoSeleccionado = {
                empleado_id: emp.id,
                nombre_completo: emp.nombre_completo,
                puesto: emp.puesto,
                departamento: emp.departamento,
              };
              onChange(JSON.stringify(next));
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecciona un empleado…</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre_completo}
              </option>
            ))}
          </select>
          {seleccionado && (
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm space-y-1">
              <div>
                <span className="text-xs text-muted-foreground mr-2">Puesto:</span>
                {seleccionado.puesto ?? "—"}
              </div>
              <div>
                <span className="text-xs text-muted-foreground mr-2">Departamento:</span>
                {seleccionado.departamento ?? "—"}
              </div>
            </div>
          )}
        </div>
      );
    }
  }
}
