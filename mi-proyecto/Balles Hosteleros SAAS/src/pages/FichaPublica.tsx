import { useParams } from "react-router-dom";
import { getSharedFicha, calcularMargen, type FichaTecnica } from "@/data/fichas-tecnicas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, ChefHat, Euro, Percent, ImageIcon } from "lucide-react";

export default function FichaPublica() {
  const { token } = useParams<{ token: string }>();
  const data = token ? getSharedFicha(token) : null;

  if (!data || !data.ficha.shareEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <ChefHat className="h-12 w-12 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">Ficha no disponible</h1>
            <p className="text-sm text-muted-foreground">
              Este enlace no es válido o la ficha técnica ya no está compartida.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { ficha: f, categoriaNombre } = data;
  const margen = calcularMargen(f.pvp, f.costeTotal);
  const costePct = f.pvp > 0 ? ((f.costeTotal / f.pvp) * 100).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-card border-b px-6 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground text-sm">FICHA TÉCNICA</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header + Photo */}
        <div className="flex gap-6">
          {f.foto ? (
            <div className="w-48 h-48 rounded-lg overflow-hidden border flex-shrink-0">
              <img src={f.foto} alt={f.nombre} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-48 h-48 rounded-lg border bg-muted/30 flex items-center justify-center flex-shrink-0">
              <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{f.nombre}</h1>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{categoriaNombre}</Badge>
              {f.delicatessen && <Badge className="bg-amber-100 text-amber-700 border-amber-200">★ Delicatessen</Badge>}
            </div>
            {f.partida && <p className="text-sm text-muted-foreground">Partida: {f.partida}</p>}
            {/* Economics */}
            <div className="grid grid-cols-4 gap-3 mt-3">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Coste</p>
                <p className="font-bold text-foreground">{f.costeTotal.toFixed(2)}€</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Coste %</p>
                <p className="font-bold text-foreground">{costePct}%</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">PVP</p>
                <p className="font-bold text-primary">{f.pvp.toFixed(2)}€</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Margen</p>
                <p className="font-bold text-emerald-600">{margen}%</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Ingredientes */}
        {f.ingredientes.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Ingredientes</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ingrediente</TableHead>
                  <TableHead className="text-xs w-20">Cantidad</TableHead>
                  <TableHead className="text-xs w-16">Unidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {f.ingredientes.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-sm">{i.ingrediente}</TableCell>
                    <TableCell className="text-sm">{i.cantidad}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{i.unidad}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {/* Elaboración */}
        {f.elaboracion && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Elaboración</h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{f.elaboracion}</p>
          </section>
        )}

        {/* Guarnición, Decoración, Menaje, Presentación */}
        <div className="grid grid-cols-2 gap-4">
          {f.guarnicion && <InfoBlock label="Guarnición" value={f.guarnicion} />}
          {f.decoracion && <InfoBlock label="Decoración" value={f.decoracion} />}
          {f.menaje && <InfoBlock label="Menaje" value={f.menaje} />}
          {f.presentacionMesa && <InfoBlock label="Presentación en mesa" value={f.presentacionMesa} />}
        </div>

        {/* Alérgenos */}
        {f.alergenos.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Alérgenos</h2>
            <div className="flex flex-wrap gap-2">
              {f.alergenos.map((a) => (
                <Badge key={a} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{a}</Badge>
              ))}
            </div>
          </section>
        )}

        {/* Recomendaciones */}
        {f.recomendaciones.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Recomendaciones</h2>
            <div className="flex flex-wrap gap-2">
              {f.recomendaciones.map((r) => (
                <Badge key={r} variant="secondary">{r}</Badge>
              ))}
            </div>
          </section>
        )}

        {/* Escandallo */}
        {f.desglose.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Escandallo</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ingrediente</TableHead>
                  <TableHead className="text-xs">Cant/Ud</TableHead>
                  <TableHead className="text-xs text-right">Coste bruto</TableHead>
                  <TableHead className="text-xs text-right">Merma %</TableHead>
                  <TableHead className="text-xs text-right">Coste neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {f.desglose.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{d.ingrediente}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.cantidadUnidad}</TableCell>
                    <TableCell className="text-sm text-right">{d.costeBruto.toFixed(2)}€</TableCell>
                    <TableCell className="text-sm text-right">{d.mermaPct}%</TableCell>
                    <TableCell className="text-sm text-right font-medium">{d.costeNeto.toFixed(2)}€</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        <div className="text-xs text-muted-foreground text-center pt-4 border-t print:mt-8">
          Ficha técnica generada por BALLES HOSTELEROS · {new Date().toLocaleDateString("es-ES")}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-bold text-muted-foreground uppercase">{label}</h3>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
