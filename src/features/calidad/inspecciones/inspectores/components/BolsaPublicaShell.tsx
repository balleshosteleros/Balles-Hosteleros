"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Briefcase } from "lucide-react";
import { inscribirInspectorPublico } from "../public-actions";
import type { BolsaConfig, BolsaPublicaEmpresa } from "../types";

interface Props {
  data: BolsaPublicaEmpresa;
}

export function BolsaPublicaShell({ data }: Props) {
  const { empresa, config } = data;
  const bg = config.color_fondo ?? empresa.color ?? "hsl(210 50% 20%)";
  const accent =
    config.color_acento ??
    empresa.color_secundario ??
    empresa.color ??
    "#10b981";
  const textColor = config.color_texto ?? "#ffffff";

  return (
    <main className="min-h-screen" style={{ backgroundColor: bg }}>
      <div className="max-w-2xl mx-auto px-4 py-10 md:py-16 space-y-8">
        <header
          className="text-center space-y-3"
          style={{ color: textColor }}
        >
          {empresa.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logo_url}
              alt={empresa.nombre}
              className="h-14 mx-auto opacity-90"
            />
          )}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wider">
              <Briefcase className="h-3 w-3" />
              {config.titulo_seccion}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">
              {config.titulo_principal}
            </h1>
            <p className="text-sm md:text-base max-w-md mx-auto opacity-80">
              {config.descripcion}
            </p>
          </div>
        </header>

        <BolsaForm slug={empresa.slug} accent={accent} config={config} />
      </div>
    </main>
  );
}

function BolsaForm({
  slug,
  accent,
  config,
}: {
  slug: string;
  accent: string;
  config: BolsaConfig;
}) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await inscribirInspectorPublico({
      empresa_slug: slug,
      nombre,
      apellidos: apellidos || null,
      email: email || null,
      telefono,
      ciudad: ciudad || null,
      notas: notas || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="rounded-2xl bg-white text-foreground p-8 md:p-10 text-center space-y-3">
        <CheckCircle2
          className="h-12 w-12 mx-auto"
          style={{ color: accent }}
        />
        <h2 className="text-2xl font-bold">{config.mensaje_exito_titulo}</h2>
        <p className="text-muted-foreground">{config.mensaje_exito_texto}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white text-foreground p-6 md:p-8 shadow-xl space-y-5"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nombre *</Label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={2}
          />
        </div>
        <div>
          <Label className="text-xs">Apellidos</Label>
          <Input
            value={apellidos}
            onChange={(e) => setApellidos(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Teléfono *</Label>
        <Input
          type="tel"
          inputMode="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
          placeholder="+34 ..."
        />
      </div>
      <div>
        <Label className="text-xs">Email (opcional)</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs">Ciudad</Label>
        <Input
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs">¿Algo que debamos saber?</Label>
        <Textarea
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Disponibilidad, experiencia previa, etc."
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="w-full"
        style={{ backgroundColor: accent, color: "#0a0a0a" }}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {config.texto_boton}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Al enviar aceptas el tratamiento de tus datos para procesos de selección
        puntuales de la empresa.
      </p>
    </form>
  );
}
