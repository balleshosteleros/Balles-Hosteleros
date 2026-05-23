"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2, Check, ChevronRight, ChevronLeft, User, Home,
  CreditCard, Heart, Shirt, Upload, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  guardarPerfilCompleto,
  uploadDocumentoEmpleado,
  type PerfilCompletoInput,
} from "@/features/primer-acceso/actions/perfil-actions";

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
  alergias_medicas?: string | null;
  avatar_url?: string | null;
  dni_archivo_url?: string | null;
}

const PASOS = [
  { id: "identidad", label: "Identidad", icon: User },
  { id: "domicilio", label: "Domicilio", icon: Home },
  { id: "bancario", label: "Cuenta bancaria", icon: CreditCard },
  { id: "emergencia", label: "Emergencia", icon: Heart },
  { id: "extras", label: "Uniforme y salud", icon: Shirt },
] as const;

const TALLAS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

type FormState = PerfilCompletoInput & { nacionalidad?: string | null };

const ibanFormatoTolerante = (v: string): boolean => {
  // Tolerante: no marcar error mientras esté escribiendo prefijo válido (ES + dígitos)
  // (regla MEMORY.md de validaciones inline)
  const norm = v.toUpperCase().replace(/\s+/g, "");
  if (norm.length === 0) return true;
  if (!/^[A-Z]{0,2}/.test(norm)) return false;
  if (norm.length <= 2) return true;
  if (!/^[A-Z]{2}\d{0,2}/.test(norm)) return false;
  if (norm.length <= 4) return true;
  return /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(norm);
};

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
    alergias_medicas: prefilled.alergias_medicas ?? "",
    avatar_url: prefilled.avatar_url ?? null,
    dni_archivo_url: prefilled.dni_archivo_url ?? null,
  });

  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingDni, setUploadingDni] = useState(false);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setError(null);
  }

  async function uploadFile(tipo: "avatar" | "dni", file: File) {
    if (tipo === "avatar") setUploadingAvatar(true);
    else setUploadingDni(true);
    try {
      const res = await uploadDocumentoEmpleado({ tipo, file });
      if (res.ok && res.path) {
        if (tipo === "avatar") update("avatar_url", res.path);
        else update("dni_archivo_url", res.path);
        toast.success("Archivo subido");
      } else {
        toast.error(("error" in res && res.error) || "Error al subir el archivo");
      }
    } finally {
      if (tipo === "avatar") setUploadingAvatar(false);
      else setUploadingDni(false);
    }
  }

  function validarPaso(p: number): string | null {
    if (p === 0) {
      if (!form.dni_nie?.trim()) return "El DNI/NIE es obligatorio";
      if (!form.fecha_nacimiento) return "La fecha de nacimiento es obligatoria";
      if (!form.telefono?.trim()) return "El teléfono es obligatorio";
    }
    if (p === 1) {
      if (!form.direccion?.trim()) return "La dirección es obligatoria";
    }
    if (p === 2) {
      if (!form.iban?.trim()) return "El IBAN es obligatorio";
      const norm = form.iban.toUpperCase().replace(/\s+/g, "");
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(norm)) return "El IBAN no es válido";
      if (!form.numero_ss?.trim()) return "El número de la SS es obligatorio";
    }
    if (p === 3) {
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
                  <Label htmlFor="dni">DNI / NIE *</Label>
                  <Input
                    id="dni"
                    value={form.dni_nie}
                    onChange={(e) => update("dni_nie", e.target.value.toUpperCase())}
                    placeholder="00000000A"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nac">Fecha de nacimiento *</Label>
                  <Input
                    id="nac"
                    type="date"
                    value={form.fecha_nacimiento}
                    onChange={(e) => update("fecha_nacimiento", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nacionalidad</Label>
                  <Input
                    value={form.nacionalidad ?? ""}
                    onChange={(e) => update("nacionalidad", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono *</Label>
                  <Input
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => update("telefono", e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Foto de perfil (opcional)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploadingAvatar}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile("avatar", f);
                    }}
                  />
                  {uploadingAvatar && <p className="text-[11px] text-muted-foreground">Subiendo…</p>}
                  {form.avatar_url && <p className="text-[11px] text-emerald-600">✓ Foto subida</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Copia DNI/NIE (opcional)</Label>
                  <Input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={uploadingDni}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile("dni", f);
                    }}
                  />
                  {uploadingDni && <p className="text-[11px] text-muted-foreground">Subiendo…</p>}
                  {form.dni_archivo_url && <p className="text-[11px] text-emerald-600">✓ Documento subido</p>}
                </div>
              </div>
            </div>
          )}

          {/* PASO 1 — Domicilio */}
          {paso === 1 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Dirección completa *</Label>
                <Textarea
                  value={form.direccion}
                  onChange={(e) => update("direccion", e.target.value)}
                  rows={3}
                  placeholder="Calle, número, piso, código postal, ciudad, provincia, país"
                />
                <p className="text-[11px] text-muted-foreground">
                  Esta dirección se usará para el contrato y nóminas.
                </p>
              </div>
            </div>
          )}

          {/* PASO 2 — Bancario */}
          {paso === 2 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>IBAN *</Label>
                <Input
                  value={form.iban}
                  onChange={(e) => update("iban", e.target.value.toUpperCase())}
                  placeholder="ES00 0000 0000 0000 0000 0000"
                  autoComplete="off"
                  className={
                    form.iban && !ibanFormatoTolerante(form.iban) ? "border-destructive" : ""
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Cuenta donde recibirás tu nómina. Se valida en tiempo real.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Número de la Seguridad Social *</Label>
                <Input
                  value={form.numero_ss}
                  onChange={(e) => update("numero_ss", e.target.value)}
                  placeholder="00 0000000000"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {/* PASO 3 — Contacto emergencia */}
          {paso === 3 && (
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

          {/* PASO 4 — Uniforme + salud */}
          {paso === 4 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Talla de uniforme</Label>
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
              </div>

              <div className="space-y-1.5">
                <Label>Alergias o condiciones médicas relevantes</Label>
                <Textarea
                  value={form.alergias_medicas ?? ""}
                  onChange={(e) => update("alergias_medicas", e.target.value)}
                  rows={3}
                  placeholder="Alergias alimentarias, intolerancia al látex, asma, etc. (opcional)"
                />
                <p className="text-[11px] text-muted-foreground">
                  Esta información se mantiene confidencial y solo es accesible al equipo de RRHH.
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
