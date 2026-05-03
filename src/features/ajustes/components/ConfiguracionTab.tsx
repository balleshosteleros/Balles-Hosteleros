import { useRef, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { type DatosGenerales, type ConfigOperativa } from "@/features/ajustes/data/ajustes";
import { Upload, Trash2, Info, ImageIcon } from "lucide-react";
import { EmailConfigCard } from "@/features/ajustes/components/EmailConfigCard";
import { saveEmpresaAjustes } from "@/features/empresa/actions/empresas-actions";

function Field({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-bold uppercase">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1" />
    </div>
  );
}

export function ConfiguracionTab() {
  const { ajustes, setAjustes, empresaActual } = useEmpresa();
  const d = ajustes.datosGenerales;
  const c = ajustes.configOperativa;
  const fileRef = useRef<HTMLInputElement>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const setD = (k: keyof DatosGenerales, v: string) =>
    setAjustes((prev) => ({ ...prev, datosGenerales: { ...prev.datosGenerales, [k]: v } }));

  const setC = (k: keyof ConfigOperativa, v: string) =>
    setAjustes((prev) => ({ ...prev, configOperativa: { ...prev.configOperativa, [k]: v } }));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setD("logoUrl", reader.result as string); toast.success("Logotipo actualizado"); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!empresaActual.dbId) {
      toast.error("Empresa no sincronizada con la base de datos");
      return;
    }
    setSavingConfig(true);
    try {
      const res = await saveEmpresaAjustes({
        id: empresaActual.dbId,
        datosGenerales: d,
        configOperativa: c,
      });
      if (!res.ok) throw new Error(res.error ?? "Error al guardar");
      toast.success("Configuración guardada correctamente");
    } catch (e: unknown) {
      console.error("[ConfiguracionTab] save:", e);
      toast.error(e instanceof Error ? e.message : "Error al guardar configuración");
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-2">

      {/* ── DATOS GENERALES ─────────────────────────────── */}
      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Información de la empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
          <Field label="Nombre comercial"   value={d.nombreComercial}   onChange={(v) => setD("nombreComercial", v)} />
          <Field label="Razón social"        value={d.razonSocial}        onChange={(v) => setD("razonSocial", v)} />
          <Field label="CIF"                 value={d.cif}                onChange={(v) => setD("cif", v)} />
          <Field label="Dirección"           value={d.direccionFiscal}    onChange={(v) => setD("direccionFiscal", v)} />
          <Field label="Ciudad"              value={d.ciudad}             onChange={(v) => setD("ciudad", v)} />
          <Field label="Provincia"           value={d.provincia}          onChange={(v) => setD("provincia", v)} />
          <Field label="País"                value={d.pais}               onChange={(v) => setD("pais", v)} />
          <Field label="Código postal"       value={d.codigoPostal}       onChange={(v) => setD("codigoPostal", v)} />
          <div>
            <Label className="text-xs font-bold uppercase">Estado de la empresa</Label>
            <Select value={d.estado} onValueChange={(v) => setD("estado", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activa">Activa</SelectItem>
                <SelectItem value="Inactiva">Inactiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <EmailConfigCard />

      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Web y redes sociales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
          <Field label="Web"             value={d.web}       onChange={(v) => setD("web", v)} />
          <Field label="WhatsApp" value={d.whatsapp} onChange={(v) => setD("whatsapp", v)} />
          <Field label="Instagram"        value={d.instagram} onChange={(v) => setD("instagram", v)} />
          <Field label="Facebook"         value={d.facebook}  onChange={(v) => setD("facebook", v)} />
          <Field label="TikTok"           value={d.tiktok}    onChange={(v) => setD("tiktok", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Logotipo de la empresa</CardTitle></CardHeader>
        <CardContent className="space-y-3 px-4 pb-3 pt-0">
          <div className="flex items-start gap-6">
            <div className="shrink-0 w-32 h-32 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex items-center justify-center overflow-hidden">
              {d.logoUrl ? (
                <img src={d.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> {d.logoUrl ? "CAMBIAR LOGOTIPO" : "SUBIR LOGOTIPO"}
                </Button>
                {d.logoUrl && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => { setD("logoUrl", ""); toast.success("Logotipo eliminado"); }}>
                    <Trash2 className="h-3.5 w-3.5" /> ELIMINAR
                  </Button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              <p className="text-xs text-muted-foreground">Formatos aceptados: PNG, JPG, SVG. Tamaño máximo recomendado: 1 MB.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Recomendación:</strong> se aconseja utilizar el isotipo o una versión simple del logotipo para una mejor visualización dentro del sistema.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── CONFIG OPERATIVA ────────────────────────────── */}
      <Card>
        <CardHeader className="px-4 pt-3 pb-2"><CardTitle className="text-base">Configuración regional</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-3 pt-0">
          <div>
            <Label className="text-xs font-bold uppercase">Moneda</Label>
            <Select value={c.moneda} onValueChange={(v) => setC("moneda", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR (€)">EUR (€)</SelectItem>
                <SelectItem value="USD ($)">USD ($)</SelectItem>
                <SelectItem value="GBP (£)">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Idioma</Label>
            <Select value={c.idioma} onValueChange={(v) => setC("idioma", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Español">Español</SelectItem>
                <SelectItem value="English">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Zona horaria</Label>
            <Select value={c.zonaHoraria} onValueChange={(v) => setC("zonaHoraria", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Madrid">Europe/Madrid</SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
                <SelectItem value="America/New_York">America/New_York</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Formato de fecha</Label>
            <Select value={c.formatoFecha} onValueChange={(v) => setC("formatoFecha", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/AAAA">DD/MM/AAAA</SelectItem>
                <SelectItem value="MM/DD/AAAA">MM/DD/AAAA</SelectItem>
                <SelectItem value="AAAA-MM-DD">AAAA-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Primer día de la semana</Label>
            <Select value={c.primerDiaSemana} onValueChange={(v) => setC("primerDiaSemana", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Lunes">Lunes</SelectItem>
                <SelectItem value="Domingo">Domingo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={savingConfig}>
          {savingConfig ? "GUARDANDO…" : "GUARDAR CONFIGURACIÓN"}
        </Button>
      </div>
    </div>
  );
}
