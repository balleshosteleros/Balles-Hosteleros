import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Contacto } from "@/features/ajustes/data/ajustes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, Globe, Share2 } from "lucide-react";
import { toast } from "sonner";

function ContactField({ label, value, onChange, icon: Icon, type = "text" }: { label: string; value: string; onChange: (v: string) => void; icon: React.ElementType; type?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1">
        <Label className="text-[10px] font-bold uppercase text-muted-foreground">{label}</Label>
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
      </div>
    </div>
  );
}

export function ContactosTab() {
  const { ajustes, setAjustes } = useEmpresa();
  const c = ajustes.contactos;

  const set = (k: keyof Contacto, v: string) => {
    setAjustes((prev) => ({ ...prev, contactos: { ...prev.contactos, [k]: v } }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Correos electrónicos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ContactField label="Correo general" value={c.correoGeneral} onChange={(v) => set("correoGeneral", v)} icon={Mail} type="email" />
          <ContactField label="Correo reservas" value={c.correoReservas} onChange={(v) => set("correoReservas", v)} icon={Mail} type="email" />
          <ContactField label="Correo administración" value={c.correoAdmin} onChange={(v) => set("correoAdmin", v)} icon={Mail} type="email" />
          <ContactField label="Correo RRHH" value={c.correoRrhh} onChange={(v) => set("correoRrhh", v)} icon={Mail} type="email" />
          <ContactField label="Correo contabilidad" value={c.correoContabilidad} onChange={(v) => set("correoContabilidad", v)} icon={Mail} type="email" />
          <ContactField label="Correo marketing" value={c.correoMarketing} onChange={(v) => set("correoMarketing", v)} icon={Mail} type="email" />
          <ContactField label="Correo jurídico" value={c.correoJuridico} onChange={(v) => set("correoJuridico", v)} icon={Mail} type="email" />
          <ContactField label="Correo incidencias" value={c.correoIncidencias} onChange={(v) => set("correoIncidencias", v)} icon={Mail} type="email" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Teléfonos y redes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ContactField label="Teléfono general" value={c.telefonoGeneral} onChange={(v) => set("telefonoGeneral", v)} icon={Phone} />
          <ContactField label="WhatsApp empresa" value={c.whatsapp} onChange={(v) => set("whatsapp", v)} icon={Phone} />
          <ContactField label="Web" value={c.web} onChange={(v) => set("web", v)} icon={Globe} />
          <ContactField label="Instagram" value={c.instagram} onChange={(v) => set("instagram", v)} icon={Share2} />
          <ContactField label="Facebook" value={c.facebook} onChange={(v) => set("facebook", v)} icon={Share2} />
          <ContactField label="TikTok" value={c.tiktok} onChange={(v) => set("tiktok", v)} icon={Globe} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => toast.success("Contactos guardados correctamente")}>GUARDAR CONTACTOS</Button>
      </div>
    </div>
  );
}
