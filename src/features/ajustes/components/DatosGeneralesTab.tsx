import { useRef, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { DatosGenerales } from "@/features/ajustes/data/ajustes";
import { Upload, Trash2, Info, ImageIcon, Loader2, ChevronDown, Check } from "lucide-react";
import { uploadLogo, deleteLogo, saveEmpresaColor } from "@/features/empresa/actions/logo-actions";

const BRAND_COLORS = [
  { hex: "#EF4444", nombre: "Rojo" },
  { hex: "#F97316", nombre: "Naranja" },
  { hex: "#F59E0B", nombre: "Ámbar" },
  { hex: "#EAB308", nombre: "Amarillo" },
  { hex: "#84CC16", nombre: "Lima" },
  { hex: "#22C55E", nombre: "Verde" },
  { hex: "#10B981", nombre: "Esmeralda" },
  { hex: "#14B8A6", nombre: "Turquesa" },
  { hex: "#06B6D4", nombre: "Cian" },
  { hex: "#3B82F6", nombre: "Azul" },
  { hex: "#6366F1", nombre: "Índigo" },
  { hex: "#8B5CF6", nombre: "Violeta" },
  { hex: "#A855F7", nombre: "Púrpura" },
  { hex: "#EC4899", nombre: "Rosa" },
  { hex: "#F43F5E", nombre: "Carmín" },
  { hex: "#64748B", nombre: "Pizarra" },
  { hex: "#374151", nombre: "Gris" },
  { hex: "#1E293B", nombre: "Marino" },
];

function Field({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs font-bold uppercase">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1" />
    </div>
  );
}

export function DatosGeneralesTab() {
  const { ajustes, setAjustes, empresaActual, getLogoUrl, setLogoUrl, updateEmpresa } = useEmpresa();
  const d = ajustes.datosGenerales;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [savingColor, setSavingColor] = useState(false);

  const logoUrl = getLogoUrl(empresaActual.id);
  const currentColor = empresaActual.color ?? "#3B82F6";

  const set = (k: keyof DatosGenerales, v: string) => {
    setAjustes((prev) => ({ ...prev, datosGenerales: { ...prev.datosGenerales, [k]: v } }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const publicUrl = await uploadLogo(empresaActual.id, formData);
      setLogoUrl(empresaActual.id, publicUrl);
      toast.success("Logotipo guardado en Supabase");
    } catch (err) {
      toast.error("Error al subir el logotipo. Inténtalo de nuevo.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    setUploading(true);
    try {
      await deleteLogo(empresaActual.id);
      setLogoUrl(empresaActual.id, "");
      toast.success("Logotipo eliminado");
    } catch {
      toast.error("Error al eliminar el logotipo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectColor = async (hex: string) => {
    setColorOpen(false);
    updateEmpresa(empresaActual.id, { color: hex });
    setSavingColor(true);
    try {
      await saveEmpresaColor(empresaActual.id, hex);
      toast.success("Color guardado");
    } catch {
      toast.error("Error al guardar el color");
    } finally {
      setSavingColor(false);
    }
  };

  const save = () => {
    toast.success("Datos generales guardados correctamente");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Información de la empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Nombre comercial" value={d.nombreComercial} onChange={(v) => set("nombreComercial", v)} />
          <Field label="Razón social" value={d.razonSocial} onChange={(v) => set("razonSocial", v)} />
          <Field label="CIF" value={d.cif} onChange={(v) => set("cif", v)} />
          <Field label="Dirección fiscal" value={d.direccionFiscal} onChange={(v) => set("direccionFiscal", v)} />
          <Field label="Ciudad" value={d.ciudad} onChange={(v) => set("ciudad", v)} />
          <Field label="Provincia" value={d.provincia} onChange={(v) => set("provincia", v)} />
          <Field label="País" value={d.pais} onChange={(v) => set("pais", v)} />
          <Field label="Código postal" value={d.codigoPostal} onChange={(v) => set("codigoPostal", v)} />
          <Field label="Teléfono principal" value={d.telefonoPrincipal} onChange={(v) => set("telefonoPrincipal", v)} />
          <Field label="Correo general" value={d.correoGeneral} onChange={(v) => set("correoGeneral", v)} type="email" />
        </CardContent>
      </Card>

      {/* Logo + Color */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Logotipo y color de la empresa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            {/* Preview */}
            <div className="shrink-0 w-32 h-32 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
              )}
            </div>

            {/* Actions */}
            <div className="flex-1 space-y-3">
              {/* Logo buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {logoUrl ? "CAMBIAR LOGOTIPO" : "SUBIR LOGOTIPO"}
                </Button>
                {logoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={handleDeleteLogo}
                    disabled={uploading}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> ELIMINAR
                  </Button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

              {/* Color selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Color de la empresa</Label>
                <Popover open={colorOpen} onOpenChange={setColorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 h-9 min-w-[160px]"
                      disabled={savingColor}
                    >
                      {savingColor
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <span className="h-4 w-4 rounded-full border border-white/20 shadow-sm shrink-0" style={{ backgroundColor: currentColor }} />
                      }
                      <span className="font-mono text-xs">{currentColor.toUpperCase()}</span>
                      <ChevronDown className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Selecciona un color</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {BRAND_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          title={`${c.nombre} — ${c.hex}`}
                          onClick={() => handleSelectColor(c.hex)}
                          className="relative h-8 w-8 rounded-md border border-transparent hover:border-foreground/30 transition-all focus:outline-none focus:ring-2 focus:ring-ring"
                          style={{ backgroundColor: c.hex }}
                        >
                          {currentColor.toUpperCase() === c.hex.toUpperCase() && (
                            <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t space-y-1.5">
                      <p className="text-xs text-muted-foreground">O introduce un código hex:</p>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-7 w-7 rounded shrink-0 border"
                          style={{ backgroundColor: currentColor }}
                        />
                        <Input
                          value={currentColor}
                          onChange={(e) => updateEmpresa(empresaActual.id, { color: e.target.value })}
                          onBlur={(e) => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) handleSelectColor(e.target.value); }}
                          className="h-7 text-xs font-mono"
                          placeholder="#3B82F6"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Recommendation box */}
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Recomendación:</strong> se aconseja utilizar el isotipo o una versión simple del logotipo para una mejor visualización dentro del sistema.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>GUARDAR DATOS GENERALES</Button>
      </div>
    </div>
  );
}
