import { useEffect, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { type DatosGenerales, type ConfigOperativa } from "@/features/ajustes/data/ajustes";
import {
  saveEmpresaAjustes,
  getEmpresaEmailContacto,
} from "@/features/empresa/actions/empresas-actions";

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
  const { ajustes, setAjustes, empresaActual, updateEmpresa } = useEmpresa();
  const d = ajustes.datosGenerales;
  const c = ajustes.configOperativa;
  const [savingConfig, setSavingConfig] = useState(false);
  const [emailContacto, setEmailContacto] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!empresaActual.dbId) {
      setEmailContacto("");
      return;
    }
    getEmpresaEmailContacto(empresaActual.dbId).then((res) => {
      if (!cancelled && res.ok) setEmailContacto(res.email ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [empresaActual.dbId]);

  const setD = (k: keyof DatosGenerales, v: string) =>
    setAjustes((prev) => ({ ...prev, datosGenerales: { ...prev.datosGenerales, [k]: v } }));

  const setC = (k: keyof ConfigOperativa, v: string) =>
    setAjustes((prev) => ({ ...prev, configOperativa: { ...prev.configOperativa, [k]: v } }));

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
        emailContacto: emailContacto.trim() || null,
      });
      if (!res.ok) throw new Error(res.error ?? "Error al guardar");
      const nombreComercial = d.nombreComercial?.trim();
      if (nombreComercial && nombreComercial !== empresaActual.nombre) {
        updateEmpresa(empresaActual.id, { nombre: nombreComercial });
      }
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

      <Card>
        <CardHeader className="px-4 pt-3 pb-2">
          <CardTitle className="text-base">Correo de contacto</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0 space-y-2">
          <div>
            <Label className="text-xs font-bold uppercase">
              ¿A qué correo enviamos los avisos y las respuestas?
            </Label>
            <Input
              type="email"
              value={emailContacto}
              onChange={(e) => setEmailContacto(e.target.value)}
              placeholder="admin@tuempresa.com"
              className="mt-1"
            />
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Los correos del sistema (solicitudes de vacaciones, bajas,
              firmas, etc.) salen desde la plataforma. Cuando alguien responda
              a uno de esos correos, la respuesta llegará a esta dirección. Es
              también el buzón al que avisamos cuando hay algo pendiente para ti.
            </p>
          </div>
        </CardContent>
      </Card>

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
