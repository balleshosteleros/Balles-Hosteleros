import { useState, useEffect, useTransition, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FileText, Pencil, ArrowLeft, Loader2, Variable } from "lucide-react";
import {
  getReclutamientoConfigOnboarding,
  saveReclutamientoConfigOnboarding,
  type ReclutamientoConfigOnboarding,
} from "@/features/rrhh/actions/gestoria-actions";
import { toast } from "sonner";
import { CONTRATO_INTERNO_DEFAULT } from "@/features/rrhh/services/firmas/contrato-interno-texto";

// Placeholders admitidos en el cuerpo del contrato interno.
const PLACEHOLDERS: { codigo: string; descripcion: string }[] = [
  { codigo: "{nombre}", descripcion: "Nombre completo del empleado" },
  { codigo: "{dni}", descripcion: "DNI o NIE del empleado" },
  { codigo: "{puesto}", descripcion: "Puesto de trabajo" },
  { codigo: "{empresa}", descripcion: "Nombre de la empresa" },
  { codigo: "{ciudad}", descripcion: "Ciudad" },
  { codigo: "{fecha}", descripcion: "Fecha del documento" },
  { codigo: "{dni_clausula}", descripcion: "Inserta «, con DNI/NIE X,» o nada si no hay DNI" },
];

// ─── Editor del contrato interno ────────────────────────────────
function ContratoInternoEditor({ onBack }: { onBack: () => void }) {
  const [config, setConfig] = useState<ReclutamientoConfigOnboarding | null>(null);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const res = await getReclutamientoConfigOnboarding();
    setConfig(res.data);
    // Si aún no hay texto guardado, precarga el del sistema (Contrato privado de
    // trabajo) para que se vea y se pueda editar directamente.
    setTexto(res.data.contrato_interno_plantilla?.trim() || CONTRATO_INTERNO_DEFAULT);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const insertPlaceholder = (codigo: string) => {
    setTexto((prev) => (prev.endsWith(" ") || prev === "" ? prev : prev + " ") + codigo);
  };

  const handleSave = () => {
    if (!config) return;
    startTransition(async () => {
      // Preserva el resto de campos: solo se modifica el cuerpo del contrato.
      const res = await saveReclutamientoConfigOnboarding({
        ...config,
        contrato_interno_plantilla: texto,
      });
      if (res.ok) {
        toast.success("Contrato interno guardado");
        setConfig({ ...config, contrato_interno_plantilla: texto });
      } else {
        toast.error(res.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando contrato interno…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onBack} title="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-foreground">Contrato interno</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Texto que se entrega al empleado al darle de alta. Usa los códigos para insertar datos reales.
            </p>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs">Cuerpo del contrato interno</Label>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="mt-1 min-h-[320px] text-sm"
          placeholder="Escribe aquí el cuerpo del contrato interno. Si lo dejas vacío, se usa el texto por defecto del sistema."
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Si lo dejas vacío, se usa el texto por defecto del sistema.
        </p>
      </div>

      <Separator />

      <div>
        <Label className="text-xs flex items-center gap-1.5 mb-1">
          <Variable className="h-3.5 w-3.5 text-primary" /> Códigos disponibles
        </Label>
        <p className="text-xs text-muted-foreground mb-3">
          Haz clic en un código para insertarlo. Al generar el contrato se sustituye automáticamente por el dato real.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.codigo}
              onClick={() => insertPlaceholder(p.codigo)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-muted/50 text-[11px] font-mono text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors"
              title={p.descripcion}
            >
              {p.codigo}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={pending} className="gap-1.5">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

// ─── Pestaña de Documentos (lista con un documento) ─────────────
export function DocumentosPlantillaTab() {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return <ContratoInternoEditor onBack={() => setEditando(false)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Documentos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Plantillas de documentos del proceso de alta. Edítalas para personalizar su contenido.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">Contrato privado de trabajo</div>
                <div className="text-xs text-muted-foreground truncate">
                  Documento interno que firma el trabajador al darle de alta (compromiso con el Manual Operativo).
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditando(true)} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
