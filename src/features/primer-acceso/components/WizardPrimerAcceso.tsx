"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2, Check, ChevronRight, ChevronLeft, User, Home,
  Heart, Shirt, Sparkles, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  guardarPerfilCompleto,
  type PerfilCompletoInput,
} from "@/features/primer-acceso/actions/perfil-actions";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";

interface Prefilled {
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
  genero?: string | null;
  estado_civil?: string | null;
  codigo_postal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
}

const PASOS = [
  { id: "identidad", label: "Identidad", icon: User },
  { id: "domicilio", label: "Domicilio", icon: Home },
  { id: "emergencia", label: "Emergencia", icon: Heart },
  { id: "ropa", label: "Tu talla", icon: Shirt },
] as const;

const TALLAS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

type FormState = PerfilCompletoInput & { nacionalidad?: string | null };

export function WizardPrimerAcceso({ prefilled }: { prefilled: Prefilled }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paso, setPaso] = useState(0);

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

  function validarPaso(p: number): string | null {
    // Solo se valida lo que este asistente pide. Lo que ya aportó en el proceso
    // de selección (documento, IBAN, SS, dirección, fecha de nacimiento) llega
    // relleno desde su candidatura y no se le vuelve a pedir.
    if (p === 0) {
      if (!form.estado_civil?.trim()) return "Elige el estado civil";
    }
    if (p === 1) {
      if (!form.codigo_postal?.trim()) return "El código postal es obligatorio";
      if (!form.ciudad?.trim()) return "La ciudad es obligatoria";
      if (!form.provincia?.trim()) return "La provincia es obligatoria";
      if (!form.pais?.trim()) return "El país es obligatorio";
    }
    if (p === 2) {
      if (!form.contacto_emergencia_nombre?.trim() || !form.contacto_emergencia_telefono?.trim()) {
        return "El contacto de emergencia es obligatorio";
      }
    }
    return null;
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
      const res = await guardarPerfilCompleto(form);
      if (res.ok) {
        toast.success("¡Perfil completado!");
        router.push("/mi-panel");
        router.refresh();
      } else {
        setError(res.error ?? "Error al guardar");
        toast.error(res.error ?? "Error al guardar");
      }
    });
  }

  const PasoIcon = PASOS[paso].icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <div>
            <h1 className="text-base font-semibold">Bienvenido/a, {prefilled.nombre ?? "compañero/a"}</h1>
            <p className="text-xs text-muted-foreground">
              Completa tu perfil antes de empezar a usar el sistema
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

        {/* Por qué se piden estos datos: se está pidiendo el IBAN y el DNI, así
            que conviene decir para qué se usan y quién los ve. */}
        {paso === 0 && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
              <p className="font-medium">Solo faltan estos datos</p>
              <p className="mt-0.5">
                Lo que ya aportaste durante el proceso de selección no te lo volvemos a pedir. Se
                guardan en tu ficha y solo los ve el equipo de RRHH.
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
          {paso === 0 && (
            <div className="space-y-3">
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
          {paso === 1 && (
            <div className="space-y-3">
              {form.direccion?.trim() && (
                <div className="rounded-md border bg-muted/40 px-3 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Tu dirección</p>
                  <p className="text-sm">{form.direccion}</p>
                </div>
              )}

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
          {paso === 2 && (
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
          {paso === 3 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Tu talla de ropa</Label>
                <Select
                  value={form.talla_uniforme ?? ""}
                  onValueChange={(v) => update("talla_uniforme", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {TALLAS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Para preparar la ropa de trabajo que te toque. Puedes cambiarla más adelante.
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
