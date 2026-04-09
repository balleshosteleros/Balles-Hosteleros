import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useMarketing } from "@/features/marketing/contexts/marketing-context";
import { REDES_SOCIALES } from "@/features/marketing/data/marketing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link2, Unlink, RefreshCw } from "lucide-react";

export function CuentasConectadas() {
  const { empresaActual } = useEmpresa();
  const { getCuentas, setCuentas } = useMarketing();
  const cuentas = getCuentas(empresaActual.id);

  const conectar = (id: string, nombre: string) => {
    if (!nombre.trim()) { toast.error("Introduce el nombre de la cuenta"); return; }
    setCuentas(empresaActual.id, (prev) =>
      prev.map((c) => c.id === id ? { ...c, conectada: true, nombreCuenta: nombre, ultimaSincronizacion: new Date().toISOString().slice(0, 16).replace("T", " ") } : c)
    );
    toast.success("Cuenta conectada (simulado)");
  };

  const desconectar = (id: string) => {
    setCuentas(empresaActual.id, (prev) =>
      prev.map((c) => c.id === id ? { ...c, conectada: false, nombreCuenta: "", ultimaSincronizacion: "" } : c)
    );
    toast.info("Cuenta desconectada");
  };

  return (
    <div className="space-y-4">
      <div className="bg-accent/30 border rounded-lg p-4">
        <p className="text-sm text-foreground font-medium">Conexión de redes sociales</p>
        <p className="text-xs text-muted-foreground mt-1">
          Conecta las cuentas de redes sociales de <span className="font-semibold">{empresaActual.nombre}</span> para poder publicar directamente desde el sistema.
          En este MVP las conexiones son simuladas — en producción se integrarán las APIs oficiales de cada plataforma.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {REDES_SOCIALES.map((red) => {
          const cuenta = cuentas.find((c) => c.redSocial === red.id);
          return (
            <Card key={red.id} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: red.color }} />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center text-white" style={{ backgroundColor: red.color }}>
                      {red.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{red.label}</p>
                      {cuenta?.conectada && (
                        <p className="text-xs text-muted-foreground">{cuenta.nombreCuenta}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={cuenta?.conectada ? "default" : "outline"} className="text-[10px]">
                    {cuenta?.conectada ? "Conectada" : "No conectada"}
                  </Badge>
                </div>

                {cuenta?.conectada ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" /> Última sincronización: {cuenta.ultimaSincronizacion}
                    </p>
                    <Button size="sm" variant="outline" className="w-full text-xs gap-1 text-destructive hover:text-destructive" onClick={() => desconectar(cuenta.id)}>
                      <Unlink className="h-3.5 w-3.5" /> Desconectar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder={`@cuenta_${red.id}`}
                      className="text-xs"
                      id={`cuenta-${red.id}`}
                    />
                    <Button
                      size="sm" className="w-full text-xs gap-1"
                      onClick={() => {
                        const input = document.getElementById(`cuenta-${red.id}`) as HTMLInputElement;
                        conectar(cuenta?.id ?? "", input?.value ?? "");
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" /> Conectar con {red.label}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
