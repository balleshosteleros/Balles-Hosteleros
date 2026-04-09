import { useEmpresa, Empresa } from "@/contexts/EmpresaContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function EmpresaAvatar({ empresa, logoUrl }: { empresa: Empresa; logoUrl?: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={empresa.nombre} className="h-7 w-7 rounded-md object-contain shrink-0" />;
  }
  return (
    <div
      className="h-7 w-7 text-[10px] rounded-md flex items-center justify-center font-bold text-white shrink-0"
      style={{ backgroundColor: empresa.color }}
    >
      {empresa.iniciales}
    </div>
  );
}

export function EmpresaSelector() {
  const { empresas, empresaActual, setEmpresaId, getLogoUrl } = useEmpresa();

  return (
    <Select value={empresaActual.id} onValueChange={setEmpresaId}>
      <SelectTrigger className="w-full h-10 bg-sidebar-accent/30 border-sidebar-border/30 hover:bg-sidebar-accent/50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <EmpresaAvatar empresa={empresaActual} logoUrl={getLogoUrl(empresaActual.id)} />
          <span className="text-xs font-bold text-sidebar-foreground truncate">{empresaActual.nombre}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground tracking-widest">SELECCIONAR EMPRESA</div>
        {empresas.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            <div className="flex items-center gap-2">
              <EmpresaAvatar empresa={e} logoUrl={getLogoUrl(e.id)} />
              <span className="font-semibold text-sm">{e.nombre}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
