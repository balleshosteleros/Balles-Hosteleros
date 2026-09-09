"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2, Check, ChevronRight, ChevronLeft, User, Home,
  Heart, Shirt, Sparkles, ShieldCheck, FileText, Upload, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  guardarPerfilCompleto,
  subirYLeerDocumentoPropio,
  confirmarDatosDocumentacion,
  type PerfilCompletoInput,
  type TipoDocPropio,
} from "@/features/primer-acceso/actions/perfil-actions";
import type { ModoPrimerAcceso } from "@/features/primer-acceso/data/empleado-status";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";

interface Prefilled {
  doc_dni_anverso_path?: string | null;
  doc_dni_reverso_path?: string | null;
  doc_iban_path?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
  email?: string | null;
  telefono?: string | null;
  dni_nie?: string | null;
  fecha_nacimiento?: string | null;
  nacionalidad?: string | null;
  direccion?: string | null;
  iban?: string | null;
  numero_ss?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  contacto_emergencia_relacion?: string | null;
  talla_uniforme?: string | null;
  avatar_url?: string | null;
  dni_archivo_url?: string | null;
  // Mismos campos que la ficha del empleado: lo que se pide aquí es exactamente
  // lo que allí se puede editar, para que no haya datos en un sitio y en otro no.
  tipo_documento?: string | null;
  genero?: string | null;
  estado_civil?: string | null;
  codigo_postal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
}

/**
 * Los pasos dependen de por qué entra la persona:
 *
 * - `alta` (onboarding entero): se le pide todo, contacto de emergencia incluido.
 * - `documentos` (repesca): ya completó su perfil hace tiempo, así que NO se le
 *   vuelve a pedir emergencia ni datos que ya dio — solo los papeles que faltan.
 */
const PASO_DOCUMENTOS = { id: "documentos", label: "Documentos", icon: FileText } as const;

const PASOS_ALTA = [
  { id: "identidad", label: "Identidad", icon: User },
  { id: "domicilio", label: "Domicilio", icon: Home },
  { id: "emergencia", label: "Emergencia", icon: Heart },
  { id: "ropa", label: "Uniforme", icon: Shirt },
  PASO_DOCUMENTOS,
] as const;

const PASOS_DOCUMENTOS = [PASO_DOCUMENTOS] as const;

/** De la S a la XXXL, pasando por todas. Es la talla del UNIFORME de trabajo. */
const TALLAS = ["S", "M", "L", "XL", "XXL", "XXXL"];

/** Los tres documentos que solo puede aportar el propio empleado. */
const DOCUMENTOS: { tipo: TipoDocPropio; label: string; ayuda: string }[] = [
  {
    tipo: "dni_anverso",
    label: "DNI o NIE — cara delantera",
    ayuda: "La cara de la foto. Que se lean todos los datos.",
  },
  {
    tipo: "dni_reverso",
    label: "DNI o NIE — cara trasera",
    ayuda: "La cara del domicilio.",
  },
  {
    tipo: "iban",
    label: "Certificado bancario",
    ayuda:
      "El documento que emite tu banco y puedes descargar desde su app. Tiene que verse tu nombre como titular y el IBAN completo. No vale el número escrito a mano.",
  },
];

const ACEPTADOS = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

/** Lo que la IA propone de cada documento, pendiente de que la persona lo apruebe. */
interface DatosLeidos {
  dni_nie: string;
  fecha_nacimiento: string;
  direccion: string;
  iban: string;
}

type FormState = PerfilCompletoInput & { nacionalidad?: string | null };

export function WizardPrimerAcceso({
  prefilled,
  modo,
}: {
  prefilled: Prefilled;
  modo: ModoPrimerAcceso;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paso, setPaso] = useState(0);

  const PASOS = modo === "alta" ? PASOS_ALTA : PASOS_DOCUMENTOS;

  // Documentos ya subidos (los que ya estuvieran en su ficha salen marcados).
  const [subidos, setSubidos] = useState<Record<string, boolean>>({
    dni_anverso: Boolean(prefilled.doc_dni_anverso_path),
    dni_reverso: Boolean(prefilled.doc_dni_reverso_path),
    iban: Boolean(prefilled.doc_iban_path),
  });

  // Lo que YA tenía entregado al abrir. Estado sin setter: se calcula una vez y
  // se queda fijo, para que un documento que suba ahora no desaparezca de la
  // lista a media pantalla. Solo se le piden los que le faltan: a quien ya mandó
  // su certificado bancario no se le vuelve a poner delante, que parecería que
  // se ha perdido.
  const [yaEntregado] = useState<Record<string, boolean>>(() => ({
    dni_anverso: Boolean(prefilled.doc_dni_anverso_path),
    dni_reverso: Boolean(prefilled.doc_dni_reverso_path),
    iban: Boolean(prefilled.doc_iban_path),
  }));
  const documentosQueFaltan = DOCUMENTOS.filter((d) => !yaEntregado[d.tipo]);
  const documentosEntregados = DOCUMENTOS.filter((d) => yaEntregado[d.tipo]);
  const [analizando, setAnalizando] = useState<TipoDocPropio | null>(null);
  const [avisoIA, setAvisoIA] = useState<string | null>(null);
  const inputsDoc = useRef<Partial<Record<TipoDocPropio, HTMLInputElement | null>>>({});

  // Lo leído por la IA: se muestra en campos EDITABLES para que la persona lo
  // revise. Nada de esto se guarda en su ficha hasta que pulsa el botón final.
  const [leidos, setLeidos] = useState<DatosLeidos>({
    dni_nie: prefilled.dni_nie ?? "",
    fecha_nacimiento: prefilled.fecha_nacimiento ?? "",
    direccion: prefilled.direccion ?? "",
    iban: prefilled.iban ?? "",
  });

  const [form, setForm] = useState<FormState>({
    dni_nie: prefilled.dni_nie ?? "",
    fecha_nacimiento: prefilled.fecha_nacimiento ?? "",
    nacionalidad: prefilled.nacionalidad ?? "Española",
    telefono: prefilled.telefono ?? "",
    direccion: prefilled.direccion ?? "",
    iban: prefilled.iban ?? "",
    numero_ss: prefilled.numero_ss ?? "",
    contacto_emergencia_nombre: prefilled.contacto_emergencia_nombre ?? "",
    contacto_emergencia_telefono: prefilled.contacto_emergencia_telefono ?? "",
    contacto_emergencia_relacion: prefilled.contacto_emergencia_relacion ?? "",
    talla_uniforme: prefilled.talla_uniforme ?? "",
    tipo_documento: prefilled.tipo_documento ?? "",
    genero: prefilled.genero ?? "",
    estado_civil: prefilled.estado_civil ?? "",
    codigo_postal: prefilled.codigo_postal ?? "",
    ciudad: prefilled.ciudad ?? "",
    provincia: prefilled.provincia ?? "",
    pais: prefilled.pais ?? "España",
    avatar_url: prefilled.avatar_url ?? null,
    dni_archivo_url: prefilled.dni_archivo_url ?? null,
  });

  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setError(null);
  }

  // Se valida por ID de paso, no por número: los pasos cambian según el modo y
  // con índices fijos la validación se aplicaría al paso equivocado.
  function validarPaso(p: number): string | null {
    const id = PASOS[p]?.id;

    if (id === "identidad") {
      if (!form.tipo_documento?.trim()) return "Elige el tipo de documento";
      if (!form.genero?.trim()) return "Elige el género";
      if (!form.estado_civil?.trim()) return "Elige el estado civil";
    }
    if (id === "domicilio") {
      if (!form.direccion?.trim()) return "La dirección es obligatoria";
      if (!form.codigo_postal?.trim()) return "El código postal es obligatorio";
      if (!form.ciudad?.trim()) return "La ciudad es obligatoria";
      if (!form.provincia?.trim()) return "La provincia es obligatoria";
      if (!form.pais?.trim()) return "El país es obligatorio";
    }
    // El contacto de emergencia solo se exige en un alta nueva. A quien ya
    // estaba se le reabre esto SOLO por los documentos, y pedirle de paso un
    // dato que nunca se le pidió lo dejaría fuera del sistema sin poder entrar.
    if (id === "emergencia") {
      if (!form.contacto_emergencia_nombre?.trim() || !form.contacto_emergencia_telefono?.trim()) {
        return "El contacto de emergencia es obligatorio";
      }
    }
    if (id === "documentos") {
      const falta = DOCUMENTOS.find((d) => !subidos[d.tipo]);
      if (falta) return `Falta subir: ${falta.label}`;
      if (!leidos.dni_nie.trim()) return "Revisa el número de tu DNI o NIE";
      if (!leidos.iban.trim()) return "Revisa tu número de cuenta (IBAN)";
    }
    return null;
  }

  /** Sube el documento (queda guardado) y muestra lo que la IA propone. */
  function elegirDoc(tipo: TipoDocPropio, file: File | undefined) {
    if (!file) return;
    setAnalizando(tipo);
    setAvisoIA(null);
    setError(null);
    startTransition(async () => {
      const res = await subirYLeerDocumentoPropio({ tipo, file });
      setAnalizando(null);
      const el = inputsDoc.current[tipo];
      if (el) el.value = "";

      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar el documento");
        toast.error(res.error ?? "No se pudo guardar el documento");
        return;
      }

      setSubidos((s) => ({ ...s, [tipo]: true }));
      toast.success("Documento guardado");

      const l = res.lectura;
      if (l.menor_de_edad) {
        setError(
          `El documento indica ${l.edad} años. No se puede completar el alta: avisa a la empresa.`,
        );
        return;
      }
      // La IA rellena, la persona revisa. Solo se pisa lo que venga con valor.
      setLeidos((prev) => ({
        dni_nie: tipo === "dni_anverso" && l.valor ? l.valor : prev.dni_nie,
        iban: tipo === "iban" && l.valor ? l.valor : prev.iban,
        fecha_nacimiento: l.fecha_nacimiento ?? prev.fecha_nacimiento,
        direccion: l.direccion ?? prev.direccion,
      }));

      if (l.motivo || (!l.valor && tipo !== "dni_reverso")) {
        setAvisoIA(
          "No hemos podido leer el documento automáticamente. Escribe los datos a mano, por favor.",
        );
      }
    });
  }

  function next() {
    const err = validarPaso(paso);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
  }
  function prev() {
    setError(null);
    setPaso((p) => Math.max(p - 1, 0));
  }

  function finalizar() {
    // Validar todos los pasos
    for (let i = 0; i <= PASOS.length - 1; i++) {
      const e = validarPaso(i);
      if (e) {
        setError(e);
        setPaso(i);
        return;
      }
    }
    startTransition(async () => {
      // Los datos que la persona ha revisado y aprobado del documento van
      // siempre; el perfil entero solo en un alta nueva (en la repesca ya está
      // completo y reescribirlo borraría lo que tiene).
      const resDocs = await confirmarDatosDocumentacion(leidos);
      if (!resDocs.ok) {
        setError(resDocs.error ?? "Error al guardar tus datos");
        toast.error(resDocs.error ?? "Error al guardar tus datos");
        return;
      }

      const res = modo === "alta" ? await guardarPerfilCompleto(form) : { ok: true as const };
      if (res.ok) {
        toast.success(modo === "alta" ? "¡Perfil completado!" : "¡Documentación entregada!");
        router.push("/mi-panel");
        router.refresh();
      } else {
        setError(res.error ?? "Error al guardar");
        toast.error(res.error ?? "Error al guardar");
      }
    });
  }

  const PasoIcon = PASOS[paso].icon;
  const pasoId = PASOS[paso].id;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <div>
            <h1 className="text-base font-semibold">
              {modo === "alta"
                ? `Bienvenido/a, ${prefilled.nombre ?? "compañero/a"}`
                : `${prefilled.nombre ?? "Hola"}, nos falta tu documentación`}
            </h1>
            <p className="text-xs text-muted-foreground">
              {modo === "alta"
                ? "Completa tu perfil antes de empezar a usar el sistema"
                : "Son dos minutos y no hay que volver a pedírtelo"}
            </p>
          </div>
        </div>
      </header>

      {/* Progress steps */}
      <div className="max-w-2xl mx-auto w-full px-4 py-6">
        <div className="flex items-center gap-1 mb-6">
          {PASOS.map((p, i) => {
            const Icon = p.icon;
            const completado = i < paso;
            const activo = i === paso;
            return (
              <div key={p.id} className="flex-1 flex items-center gap-1">
                <div
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-md transition-colors ${
                    activo ? "bg-emerald-50 text-emerald-700" :
                    completado ? "text-emerald-600" :
                    "text-muted-foreground"
                  }`}
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    completado ? "bg-emerald-600 text-white" :
                    activo ? "bg-emerald-100 ring-2 ring-emerald-600" :
                    "bg-muted"
                  }`}>
                    {completado ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className="text-[10px] font-medium hidden sm:block">{p.label}</span>
                </div>
                {i < PASOS.length - 1 && (
                  <div className={`h-0.5 w-2 ${i < paso ? "bg-emerald-600" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Este asistente es SOLO para los empleados que ya estaban en el
            sistema antes de que la documentación se pidiera entera en el proceso
            de selección. Quien entra hoy por reclutamiento llega con la ficha
            completa y no lo ve nunca (`perfil_completado` ya viene a true). */}
        {pasoId === "identidad" && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
              <p className="font-medium">Solo te lo pedimos una vez</p>
              <p className="mt-0.5">
                Son los datos que la empresa necesita para tu contrato y tu nómina. Se guardan en
                tu ficha y solo los ve el equipo de RRHH.
              </p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="rounded-lg border bg-card p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <PasoIcon className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">{PASOS[paso].label}</h2>
          </div>

          {/* PASO 0 — Identidad */}
          {pasoId === "identidad" && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de documento *</Label>
                  <Select
                    value={form.tipo_documento || undefined}
                    onValueChange={(v) => update("tipo_documento", v)}
                  >
                    <SelectTrigger><SelectValue placeholder="DNI / NIE / Pasaporte" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DNI">DNI</SelectItem>
                      <SelectItem value="NIE">NIE</SelectItem>
                      <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Género *</Label>
                  <Select
                    value={form.genero || undefined}
                    onValueChange={(v) => update("genero", v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mujer">Mujer</SelectItem>
                      <SelectItem value="hombre">Hombre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Estado civil *</Label>
                  <Select
                    value={form.estado_civil || undefined}
                    onValueChange={(v) => update("estado_civil", v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soltero">Soltero/a</SelectItem>
                      <SelectItem value="casado">Casado/a</SelectItem>
                      <SelectItem value="pareja_hecho">Pareja de hecho</SelectItem>
                      <SelectItem value="divorciado">Divorciado/a</SelectItem>
                      <SelectItem value="viudo">Viudo/a</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Nacionalidad</Label>
                <Input
                  value={form.nacionalidad ?? ""}
                  onChange={(e) => update("nacionalidad", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* PASO 1 — Domicilio */}
          {pasoId === "domicilio" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Dirección *</Label>
                <Input
                  value={form.direccion ?? ""}
                  onChange={(e) => update("direccion", e.target.value)}
                  placeholder="Calle, número, piso…"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Código postal *</Label>
                  <Input
                    value={form.codigo_postal ?? ""}
                    onChange={(e) => update("codigo_postal", e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ciudad *</Label>
                  <Input
                    value={form.ciudad ?? ""}
                    onChange={(e) => update("ciudad", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Provincia *</Label>
                  <Input
                    value={form.provincia ?? ""}
                    onChange={(e) => update("provincia", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>País *</Label>
                  <Input
                    value={form.pais ?? ""}
                    onChange={(e) => update("pais", e.target.value)}
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Esta dirección se usará para el contrato y nóminas.
              </p>
            </div>
          )}


          {/* PASO 2 — Contacto emergencia */}
          {pasoId === "emergencia" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Persona a contactar en caso de emergencia (familiar, pareja, amigo cercano).
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre completo *</Label>
                  <Input
                    value={form.contacto_emergencia_nombre}
                    onChange={(e) => update("contacto_emergencia_nombre", e.target.value)}
                    onBlur={() =>
                      update(
                        "contacto_emergencia_nombre",
                        normalizarNombre(form.contacto_emergencia_nombre),
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono *</Label>
                  <Input
                    type="tel"
                    value={form.contacto_emergencia_telefono}
                    onChange={(e) => update("contacto_emergencia_telefono", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Relación</Label>
                <Input
                  value={form.contacto_emergencia_relacion}
                  onChange={(e) => update("contacto_emergencia_relacion", e.target.value)}
                  placeholder="Madre, pareja, hermano/a…"
                />
              </div>
            </div>
          )}

          {/* PASO 3 — Talla de ropa de trabajo */}
          {pasoId === "ropa" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Talla de uniforme</Label>
                <Select
                  value={form.talla_uniforme ?? ""}
                  onValueChange={(v) => update("talla_uniforme", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona tu talla…" /></SelectTrigger>
                  <SelectContent>
                    {TALLAS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Es la talla del uniforme de trabajo. Puedes cambiarla más adelante.
                </p>
              </div>
            </div>
          )}

          {/* PASO — Documentos: se suben, la IA los lee y la persona aprueba */}
          {pasoId === "documentos" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Haz una foto de cada documento. Los leemos automáticamente y después
                compruebas tú que los datos son correctos.
              </p>

              {documentosEntregados.length > 0 && (
                <p className="flex items-start gap-2 rounded-md bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Ya tenemos: {documentosEntregados.map((d) => d.label).join(", ")}. No hace
                    falta que lo vuelvas a mandar.
                  </span>
                </p>
              )}

              <ul className="space-y-2">
                {documentosQueFaltan.map((d) => {
                  const hecho = subidos[d.tipo];
                  const cargando = analizando === d.tipo;
                  return (
                    <li
                      key={d.tipo}
                      className={`rounded-lg border p-3 ${
                        hecho ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-dashed"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium flex items-center gap-1.5">
                            {hecho && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                            {d.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{d.ayuda}</p>
                        </div>
                        <input
                          ref={(el) => {
                            inputsDoc.current[d.tipo] = el;
                          }}
                          type="file"
                          accept={ACEPTADOS}
                          className="hidden"
                          onChange={(e) => elegirDoc(d.tipo, e.target.files?.[0])}
                        />
                        <Button
                          type="button"
                          variant={hecho ? "outline" : "default"}
                          size="sm"
                          disabled={pending}
                          onClick={() => inputsDoc.current[d.tipo]?.click()}
                          className="shrink-0"
                        >
                          {cargando ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1.5">{hecho ? "Cambiar" : "Subir"}</span>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {analizando && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wand2 className="h-3.5 w-3.5 animate-pulse" />
                  Leyendo el documento…
                </p>
              )}

              {/* Lo que ha leído la IA, en campos editables: la persona APRUEBA. */}
              <div className="rounded-lg border bg-muted/30 p-3.5 space-y-3">
                <p className="text-[13px] font-medium">Comprueba que estos datos son correctos</p>

                {avisoIA && (
                  <p className="rounded-md bg-amber-100 px-2.5 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {avisoIA}
                  </p>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Número de DNI o NIE *</Label>
                    <Input
                      value={leidos.dni_nie}
                      onChange={(e) => {
                        setLeidos((p) => ({ ...p, dni_nie: e.target.value }));
                        setError(null);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fecha de nacimiento</Label>
                    <Input
                      type="date"
                      value={leidos.fecha_nacimiento}
                      onChange={(e) => {
                        setLeidos((p) => ({ ...p, fecha_nacimiento: e.target.value }));
                        setError(null);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Número de cuenta (IBAN) *</Label>
                  <Input
                    value={leidos.iban}
                    onChange={(e) => {
                      setLeidos((p) => ({ ...p, iban: e.target.value }));
                      setError(null);
                    }}
                    placeholder="ES00 0000 0000 0000 0000 0000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Domicilio</Label>
                  <Input
                    value={leidos.direccion}
                    onChange={(e) => {
                      setLeidos((p) => ({ ...p, direccion: e.target.value }));
                      setError(null);
                    }}
                  />
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Los rellenamos leyendo tus documentos. Si algo no cuadra, corrígelo aquí antes
                  de continuar.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 border border-destructive/20">
              {error}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" onClick={prev} disabled={paso === 0 || pending}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>

          {paso < PASOS.length - 1 ? (
            <Button onClick={next} disabled={pending}>
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={finalizar}
              disabled={pending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Finalizar y entrar
            </Button>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-3">
          No podrás acceder al sistema hasta completar este formulario.
        </p>
      </div>
    </div>
  );
}
