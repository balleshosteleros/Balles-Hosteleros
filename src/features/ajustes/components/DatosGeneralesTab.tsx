import { useRef, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { DatosGenerales } from "@/features/ajustes/data/ajustes";
import { Upload, Trash2, Info, ImageIcon, Loader2 } from "lucide-react";
import { uploadLogo, deleteLogo } from "@/features/empresa/actions/logo-actions";

function Field({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs font-bold uppercase">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1" />
    </div>
  );
}

export function DatosGeneralesTab() {
  const { ajustes, setAjustes, empresaActual, getLogoUrl, setLogoUrl } = useEmpresa();
  const d = ajustes.datosGenerales;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const logoUrl = getLogoUrl(empresaActual.id);

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
          <Field label="Dirección del local" value={d.direccionLocal} onChange={(v) => set("direccionLocal", v)} />
          <Field label="Ciudad" value={d.ciudad} onChange={(v) => set("ciudad", v)} />
          <Field label="Provincia" value={d.provincia} onChange={(v) => set("provincia", v)} />
          <Field label="País" value={d.pais} onChange={(v) => set("pais", v)} />
          <Field label="Código postal" value={d.codigoPostal} onChange={(v) => set("codigoPostal", v)} />
          <Field label="Gerente" value={d.gerente} onChange={(v) => set("gerente", v)} />
          <Field label="Horario general" value={d.horarioGeneral} onChange={(v) => set("horarioGeneral", v)} />
          <div>
            <Label className="text-xs font-bold uppercase">Estado de la empresa</Label>
            <Select value={d.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activa">Activa</SelectItem>
                <SelectItem value="Inactiva">Inactiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Contacto y correos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Teléfono principal" value={d.telefonoPrincipal} onChange={(v) => set("telefonoPrincipal", v)} />
          <Field label="Teléfono secundario" value={d.telefonoSecundario} onChange={(v) => set("telefonoSecundario", v)} />
          <Field label="Correo general" value={d.correoGeneral} onChange={(v) => set("correoGeneral", v)} type="email" />
          <Field label="Correo administración" value={d.correoAdmin} onChange={(v) => set("correoAdmin", v)} type="email" />
          <Field label="Correo RRHH" value={d.correoRrhh} onChange={(v) => set("correoRrhh", v)} type="email" />
          <Field label="Correo contabilidad" value={d.correoContabilidad} onChange={(v) => set("correoContabilidad", v)} type="email" />
          <Field label="Correo marketing" value={d.correoMarketing} onChange={(v) => set("correoMarketing", v)} type="email" />
          <Field label="Correo jurídico" value={d.correoJuridico} onChange={(v) => set("correoJuridico", v)} type="email" />
          <Field label="Correo reservas" value={d.correoReservas} onChange={(v) => set("correoReservas", v)} type="email" />
          <Field label="Correo incidencias" value={d.correoIncidencias} onChange={(v) => set("correoIncidencias", v)} type="email" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Web y redes sociales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Web" value={d.web} onChange={(v) => set("web", v)} />
          <Field label="WhatsApp empresa" value={d.whatsapp} onChange={(v) => set("whatsapp", v)} />
          <Field label="Instagram" value={d.instagram} onChange={(v) => set("instagram", v)} />
          <Field label="Facebook" value={d.facebook} onChange={(v) => set("facebook", v)} />
          <Field label="TikTok" value={d.tiktok} onChange={(v) => set("tiktok", v)} />
        </CardContent>
      </Card>

      {/* Logo upload */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Logotipo de la empresa</CardTitle></CardHeader>
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
              <div className="flex gap-2">
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
              <p className="text-xs text-muted-foreground">Formatos aceptados: PNG, JPG, SVG, WEBP. Tamaño máximo: 2 MB. Guardado en Supabase Storage.</p>
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

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Observaciones internas</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={d.observaciones} onChange={(e) => set("observaciones", e.target.value)} rows={4} placeholder="Notas internas sobre la empresa..." />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>GUARDAR DATOS GENERALES</Button>
      </div>
    </div>
  );
}
