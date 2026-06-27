import { type ResultadoLinea } from "@/features/logistica/data/inventarios";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEur, formatNumero } from "@/shared/lib/numero";

interface Props {
  resultados: ResultadoLinea[];
}

export default function ResultadoInventario({ resultados }: Props) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"producto" | "diferencia">("producto");
  const [filterDif, setFilterDif] = useState<"todos" | "positivo" | "negativo" | "cero">("todos");

  const filtered = resultados
    .filter((r) => {
      if (search && !r.producto.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterDif === "positivo" && r.diferenciaCantidad <= 0) return false;
      if (filterDif === "negativo" && r.diferenciaCantidad >= 0) return false;
      if (filterDif === "cero" && r.diferenciaCantidad !== 0) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "diferencia") return Math.abs(b.diferenciaCoste) - Math.abs(a.diferenciaCoste);
      return a.producto.localeCompare(b.producto);
    });

  const totalCosteTeorico = filtered.reduce((s, r) => s + r.costeTeorico, 0);
  const totalCosteReal = filtered.reduce((s, r) => s + r.costeReal, 0);
  const totalDiferencia = filtered.reduce((s, r) => s + r.diferenciaCoste, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Resultado del inventario</h3>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterDif} onValueChange={(v) => setFilterDif(v as typeof filterDif)}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las diferencias</SelectItem>
            <SelectItem value="positivo">Sobrante (+)</SelectItem>
            <SelectItem value="negativo">Faltante (−)</SelectItem>
            <SelectItem value="cero">Cuadrado (0)</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => setSortBy(sortBy === "diferencia" ? "producto" : "diferencia")}>
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortBy === "diferencia" ? "Por diferencia" : "Por producto"}
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              {["Producto", "Ud.", "Stock teórico", "Coste teórico", "Stock real", "Coste real", "Pr. coste", "Dif. cantidad", "Dif. coste"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-bold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.productoId} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2 font-semibold text-foreground">{r.producto}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.unidad}</td>
                <td className="px-3 py-2 font-medium">{r.stockTeorico}</td>
                <td className="px-3 py-2">{formatEur(r.costeTeorico)}</td>
                <td className="px-3 py-2 font-bold">{r.stockReal}</td>
                <td className="px-3 py-2">{formatEur(r.costeReal)}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatEur(r.precioCoste)}</td>
                <td className="px-3 py-2">
                  <DifBadge value={r.diferenciaCantidad} />
                </td>
                <td className="px-3 py-2">
                  <DifBadge value={r.diferenciaCoste} suffix=" €" />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Sin resultados</td></tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30 font-bold text-xs">
                <td className="px-3 py-2.5" colSpan={3}>TOTALES</td>
                <td className="px-3 py-2.5">{formatEur(totalCosteTeorico)}</td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5">{formatEur(totalCosteReal)}</td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5">
                  <DifBadge value={totalDiferencia} suffix=" €" />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function DifBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value > 0)
    return <span className="text-emerald-700 dark:text-emerald-400 font-semibold">+{formatNumero(value, { min: 2, max: 2 })}{suffix}</span>;
  if (value < 0)
    return <span className="text-red-700 dark:text-red-400 font-semibold">{formatNumero(value, { min: 2, max: 2 })}{suffix}</span>;
  return <span className="text-muted-foreground font-medium">0{suffix}</span>;
}
