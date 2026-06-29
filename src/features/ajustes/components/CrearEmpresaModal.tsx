"use client";

import { useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Info } from "lucide-react";
import { toast } from "sonner";
import { createEmpresa } from "@/features/empresa/actions/empresas-actions";
import { setEmpresaActiva } from "@/features/empresa/actions/empresa-activa-actions";
import { useRouter } from "next/navigation";
import type { DatosGenerales, ConfigOperativa } from "@/features/ajustes/data/ajustes";

// El alta replica EXACTAMENTE la vista de Ajustes → Empresa (ConfiguracionTab):
// mismas tarjetas, mismos campos y mismo layout. Las iniciales y el color del
// chip se derivan del nombre comercial (no son campos visibles), y el logo y el
// resto de datos se completan luego en Ajustes → Empresa.
type FormState = {
  // Información de la empresa
  nombreComercial: string;
  razonSocial: string;
  cif: string;
  direccionFiscal: string;
  ciudad: string;
  provincia: string;
  pais: string;
  codigoPostal: string;
  estado: "Activa" | "Inactiva";
  // Web y redes sociales
  web: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  // Configuración regional
  moneda: string;
  idioma: string;
  zonaHoraria: string;
  formatoFecha: string;
  primerDiaSemana: string;
};

const EMPTY: FormState = {
  nombreComercial: "",
  razonSocial: "",
  cif: "",
  direccionFiscal: "",
  ciudad: "",
  provincia: "",
  pais: "España",
  codigoPostal: "",
  estado: "Activa",
  web: "",
  whatsapp: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  moneda: "EUR (€)",
  idioma: "Español",
  zonaHoraria: "Europe/Madrid",
  formatoFecha: "DD/MM/AAAA",
  primerDiaSemana: "Lunes",
};

// Campos obligatorios (regla "datos completos obligatorio"): la identidad fiscal.
// Web/redes son opcionales (no toda empresa tiene TikTok) y la config regional
// ya trae valores por defecto.
const REQUERIDOS: (keyof FormState)[] = [
  "nombreComercial", "razonSocial", "cif",
  "direccionFiscal", "ciudad", "provincia", "pais", "codigoPostal",
];

// Iniciales del chip: primeras letras de hasta 2 palabras del nombre.
function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const ini = palabras.slice(0, 2).map((p) => p[0]).join("");
  return (ini || nombre.trim().slice(0, 2)).toUpperCase().slice(0, 2);
}

// Color del chip: tono determinista derivado del nombre (cada empresa distinta).
function colorDe(nombre: string): string {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 50%)`;
}

// Mismo Field que ConfiguracionTab para que la visual sea idéntica.
function Field({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-bold">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1" />
    </div>
  );
}

export function CrearEmpresaModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addEmpresa, setEmpresaId } = useEmpresa();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const faltan = REQUERIDOS.filter((k) => !String(form[k]).trim());
    if (faltan.length > 0) {
      toast.error("Rellena todos los datos de la empresa antes de crearla");
      return;
    }

    setSaving(true);
    try {
      const nombre = form.nombreComercial.trim();
      const iniciales = inicialesDe(nombre);
      const color = colorDe(nombre);

      const datosGenerales: Partial<DatosGenerales> = {
        nombreComercial: nombre,
        razonSocial: form.razonSocial.trim(),
        cif: form.cif.trim().toUpperCase(),
        direccionFiscal: form.direccionFiscal.trim(),
        ciudad: form.ciudad.trim(),
        provincia: form.provincia.trim(),
        pais: form.pais.trim(),
        codigoPostal: form.codigoPostal.trim(),
        web: form.web.trim(),
        whatsapp: form.whatsapp.trim(),
        instagram: form.instagram.trim(),
        facebook: form.facebook.trim(),
        tiktok: form.tiktok.trim(),
        estado: form.estado,
      };

      const configOperativa: Partial<ConfigOperativa> = {
        moneda: form.moneda,
        idioma: form.idioma,
        zonaHoraria: form.zonaHoraria,
        formatoFecha: form.formatoFecha,
        primerDiaSemana: form.primerDiaSemana,
        colorPrimario: color,
      };

      const res = await createEmpresa({ nombre, iniciales, color, datosGenerales, configOperativa });
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "No se pudo crear la empresa");
        return;
      }
      addEmpresa({
        id: res.data.slug,
        dbId: res.data.id,
        nombre: res.data.nombre,
        iniciales: res.data.iniciales ?? iniciales,
        color: res.data.color ?? color,
        zonaHoraria: configOperativa.zonaHoraria || "Europe/Madrid",
      });
      toast.success("Empresa creada con toda la estructura base (departamentos, roles, organigrama, plantillas…)");
      setEmpresaId(res.data.slug);
      // Activar la empresa nueva (cookie) ANTES de navegar para que el onboarding
      // lea su empresa correcta, y auto-lanzar el asistente de volcado de datos.
      await setEmpresaActiva(res.data.id);
      setForm(EMPTY);
      onOpenChange(false);
      router.push("/onboarding");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Nueva empresa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {/* ── INFORMACIÓN DE LA EMPRESA ───────────────────── */}
          <Card>
            <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Información de la empresa</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
              <Field label="Nombre comercial" value={form.nombreComercial} onChange={(v) => set("nombreComercial", v)} />
              <Field label="Razón social"     value={form.razonSocial}     onChange={(v) => set("razonSocial", v)} />
              <Field label="CIF"              value={form.cif}             onChange={(v) => set("cif", v)} />
              <Field label="Dirección"        value={form.direccionFiscal} onChange={(v) => set("direccionFiscal", v)} />
              <Field label="Ciudad"           value={form.ciudad}          onChange={(v) => set("ciudad", v)} />
              <Field label="Provincia"        value={form.provincia}       onChange={(v) => set("provincia", v)} />
              <Field label="País"             value={form.pais}            onChange={(v) => set("pais", v)} />
              <Field label="Código postal"    value={form.codigoPostal}    onChange={(v) => set("codigoPostal", v)} />
              <div>
                <Label className="text-xs font-bold">Estado de la empresa</Label>
                <Select value={form.estado} onValueChange={(v) => set("estado", v as FormState["estado"])}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activa">Activa</SelectItem>
                    <SelectItem value="Inactiva">Inactiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ── WEB Y REDES SOCIALES ────────────────────────── */}
          <Card>
            <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Web y redes sociales</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
              <Field label="Web"       value={form.web}       onChange={(v) => set("web", v)} />
              <Field label="WhatsApp"  value={form.whatsapp}  onChange={(v) => set("whatsapp", v)} />
              <Field label="Instagram" value={form.instagram} onChange={(v) => set("instagram", v)} />
              <Field label="Facebook"  value={form.facebook}  onChange={(v) => set("facebook", v)} />
              <Field label="TikTok"    value={form.tiktok}    onChange={(v) => set("tiktok", v)} />
            </CardContent>
          </Card>

          <Separator />

          {/* ── CONFIGURACIÓN REGIONAL ──────────────────────── */}
          <Card>
            <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Configuración regional</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
              <div>
                <Label className="text-xs font-bold">Moneda</Label>
                <Select value={form.moneda} onValueChange={(v) => set("moneda", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR (€)">EUR (€)</SelectItem>
                    <SelectItem value="USD ($)">USD ($)</SelectItem>
                    <SelectItem value="GBP (£)">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold">Idioma</Label>
                <Select value={form.idioma} onValueChange={(v) => set("idioma", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Español">Español</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold">Zona horaria</Label>
                <Select value={form.zonaHoraria} onValueChange={(v) => set("zonaHoraria", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold">Formato de fecha</Label>
                <Select value={form.formatoFecha} onValueChange={(v) => set("formatoFecha", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/AAAA">DD/MM/AAAA</SelectItem>
                    <SelectItem value="MM/DD/AAAA">MM/DD/AAAA</SelectItem>
                    <SelectItem value="AAAA-MM-DD">AAAA-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold">Primer día de la semana</Label>
                <Select value={form.primerDiaSemana} onValueChange={(v) => set("primerDiaSemana", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lunes">Lunes</SelectItem>
                    <SelectItem value="Domingo">Domingo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Al crearla se genera de cero toda la estructura estándar del software (departamentos, roles,
              organigrama, plantillas de correo, configuraciones base…), igual que el resto de empresas. El logo y
              el resto de datos se completan después en Ajustes → Empresa.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Creando…" : "Crear empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
