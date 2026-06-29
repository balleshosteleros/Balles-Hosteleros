import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { ConfigOperativa } from "@/features/ajustes/data/ajustes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TZ_DESTACADAS, offsetTZ } from "@/features/google-workspace/lib/timezones";

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
                {/* La zona horaria rige cómo se muestran TODAS las horas de la
                    empresa (PRP-069). Nombre + desfase UTC actual (incluye DST). */}
                {TZ_DESTACADAS.map((z) => {
                  const off = offsetTZ(z.value, new Date());
                  return (
                    <SelectItem key={z.value} value={z.value}>
                      {z.nombre}{off ? ` · ${off}` : ""}
                    </SelectItem>
                  );
                })}
                {/* Conserva el valor guardado aunque no esté en la lista. */}
                {c.zonaHoraria && !TZ_DESTACADAS.some((z) => z.value === c.zonaHoraria) && (
                  <SelectItem value={c.zonaHoraria}>{c.zonaHoraria}</SelectItem>
                )}
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

      <div className="flex justify-end">
        <Button onClick={() => toast.success("Configuración operativa guardada")}>GUARDAR CONFIGURACIÓN</Button>
      </div>
    </div>
  );
}
