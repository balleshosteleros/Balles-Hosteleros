import { type Inventario, type PlantillaInventario, calcularResultados, validarPlantillaCompleta } from "@/features/logistica/data/inventarios";
import { type ProductoStock } from "@/features/logistica/data/stock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle2, Undo2, FileDown, Calendar, MapPin, FileText, User, AlertTriangle } from "lucide-react";
import ConteoSection from "./ConteoSection";
import ResultadoInventario from "./ResultadoInventario";
import { toast } from "sonner";

interface Props {
  inventario: Inventario;
  productos: ProductoStock[];
  plantilla?: PlantillaInventario;
  onBack: () => void;
  onUpdate: (inv: Inventario) => void;
  onConfirmar: (inv: Inventario) => void;
  onDeshacerConfirmacion: (inv: Inventario) => void;
}

export default function DetalleInventario({ inventario, productos, plantilla, onBack, onUpdate, onConfirmar, onDeshacerConfirmacion }: Props) {
  const isConfirmed = inventario.estado === "Confirmado";
  const resultados = calcularResultados(inventario, productos);
  const validacion = validarPlantillaCompleta(inventario, plantilla);

  const handleConteosChange = (conteos: typeof inventario.conteos) => {
    onUpdate({ ...inventario, conteos });
  };

  const handleConfirmarClick = () => {
    if (!validacion.completa) {
      const faltantesNombres = validacion.faltantes.map((pid) => {
        const p = productos.find((pr) => pr.id === pid);
        return p?.nombre || pid;
      });
      toast.error(`No se puede confirmar. Faltan productos obligatorios de la plantilla: ${faltantesNombres.join(", ")}`);
      return;
    }
    if (inventario.conteos.length === 0) {
      toast.error("No se puede confirmar un inventario sin conteos.");
      return;
    }
    onConfirmar(inventario);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">Inventario — {inventario.almacen}</h2>
            <Badge variant="outline" className={isConfirmed
              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300"}>
              {inventario.estado}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
            <FileDown className="h-4 w-4" /> Guardar PDF
          </Button>
          {!isConfirmed && (
            <Button size="sm" className="gap-1.5" onClick={handleConfirmarClick}>
              <CheckCircle2 className="h-4 w-4" /> Confirmar inventario
            </Button>
          )}
          {isConfirmed && (
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => onDeshacerConfirmacion(inventario)}>
              <Undo2 className="h-4 w-4" /> Deshacer confirmación
            </Button>
          )}
        </div>
      </div>

      {/* Info bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard icon={<Calendar className="h-4 w-4 text-primary" />} label="Fecha" value={inventario.fecha} />
        <InfoCard icon={<MapPin className="h-4 w-4 text-primary" />} label="Almacén" value={inventario.almacen} />
        <InfoCard icon={<FileText className="h-4 w-4 text-primary" />} label="Motivo" value={inventario.motivo} />
        <InfoCard icon={<User className="h-4 w-4 text-primary" />} label="Usuario" value={inventario.usuario} />
      </div>

      {/* Plantilla warning */}
      {plantilla && !isConfirmed && !validacion.completa && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Plantilla incompleta: {plantilla.nombre}</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
              Faltan {validacion.faltantes.length} producto(s) obligatorios por contar. No podrás confirmar hasta completarlos.
            </p>
          </div>
        </div>
      )}

      {plantilla && validacion.completa && !isConfirmed && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-xs text-emerald-800 dark:text-emerald-300">
          ✓ Plantilla «{plantilla.nombre}» completada. Puedes confirmar el inventario.
        </div>
      )}

      {isConfirmed && inventario.confirmadoAt && (
        <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-900/20 p-3 text-xs text-emerald-800 dark:text-emerald-300">
          ✓ Confirmado el {new Date(inventario.confirmadoAt).toLocaleString("es-ES")} por {inventario.confirmadoPor}
        </div>
      )}

      <Separator />

      {/* Conteos */}
      <ConteoSection
        conteos={inventario.conteos}
        onConteosChange={handleConteosChange}
        productos={productos}
        readOnly={isConfirmed}
      />

      <Separator />

      {/* Resultado */}
      <ResultadoInventario resultados={resultados} />
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center gap-2.5">
      {icon}
      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase">{label}</div>
        <div className="text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}
