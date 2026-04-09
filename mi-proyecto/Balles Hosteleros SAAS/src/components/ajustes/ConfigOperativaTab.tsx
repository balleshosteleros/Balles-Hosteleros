import { useEmpresa } from "@/contexts/EmpresaContext";
import { ConfigOperativa } from "@/data/ajustes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function ConfigOperativaTab() {
  const { ajustes, setAjustes } = useEmpresa();
  const c = ajustes.configOperativa;

  const set = (k: keyof ConfigOperativa, v: string) => {
    setAjustes((prev) => ({ ...prev, configOperativa: { ...prev.configOperativa, [k]: v } }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Configuración regional</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-bold uppercase">Moneda</Label>
            <Select value={c.moneda} onValueChange={(v) => set("moneda", v)}>
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
            <Select value={c.idioma} onValueChange={(v) => set("idioma", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Español">Español</SelectItem>
                <SelectItem value="English">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Zona horaria</Label>
            <Select value={c.zonaHoraria} onValueChange={(v) => set("zonaHoraria", v)}>
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
            <Select value={c.formatoFecha} onValueChange={(v) => set("formatoFecha", v)}>
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
            <Select value={c.primerDiaSemana} onValueChange={(v) => set("primerDiaSemana", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Lunes">Lunes</SelectItem>
                <SelectItem value="Domingo">Domingo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Personalización</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold uppercase">Locales o sedes asociados</Label>
            <Input value={c.localesAsociados} onChange={(e) => set("localesAsociados", e.target.value)} placeholder="Ej: Local 1, Local 2..." className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Etiquetas internas</Label>
            <Input value={c.etiquetasInternas} onChange={(e) => set("etiquetasInternas", e.target.value)} placeholder="Ej: VIP, Franquicia..." className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Color primario de la empresa</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={c.colorPrimario} onChange={(e) => set("colorPrimario", e.target.value)} className="h-9 w-12 rounded cursor-pointer border" />
              <Input value={c.colorPrimario} onChange={(e) => set("colorPrimario", e.target.value)} className="flex-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => toast.success("Configuración operativa guardada")}>GUARDAR CONFIGURACIÓN</Button>
      </div>
    </div>
  );
}
