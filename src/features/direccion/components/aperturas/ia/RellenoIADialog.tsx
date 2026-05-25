"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertCircle, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  analizarRellenoIA,
  generarAperturaCompletaIA,
} from "@/features/direccion/actions/aperturas-ia-actions";
import {
  BLOQUE_IA_LABELS,
  type BloqueIAKey,
  type BloqueIAAnyKey,
  type DraftIAEstudio,
} from "@/features/direccion/types/aperturas-ia";
import { RellenoIADropzone, type ArchivoCargado } from "./RellenoIADropzone";

type Modo =
  | { tipo: "bloque"; bloque: BloqueIAKey }
  | { tipo: "completa" };

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  modo: Modo;
  /** Callback con el draft completo devuelto por la IA y los bloques propuestos. */
  onDraft: (draft: DraftIAEstudio, bloques: BloqueIAAnyKey[]) => void;
}

const PLACEHOLDERS: Record<BloqueIAKey, string> = {
  datos: "Ej: nuevo gastrobar en Las Tablas, Madrid, 80 cubiertos, ticket 22€…",
  local: "Ej: bajo comercial en esquina, 140m², terraza de 30m², a reformar, alquiler 3.500€/mes…",
  marca: "Ej: marca cercana, mediterránea, valores familiares, tonos terracota y oliva…",
  gastronomia: "Ej: cocina mediterránea de mercado, 12 platos, ticket 35€, foco en pescado fresco…",
  ocupacion: "Ej: restaurante familiar con foco en comidas de fin de semana y cenas viernes/sábado…",
};

const PLACEHOLDER_COMPLETA =
  "Describe el proyecto en una o dos frases (concepto, ubicación, tipo de cliente, ticket). Si subes documentos, completarán el resto.";

export function RellenoIADialog({ open, onOpenChange, modo, onDraft }: Props) {
  const [prompt, setPrompt] = useState("");
  const [archivos, setArchivos] = useState<ArchivoCargado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [incluirCifras, setIncluirCifras] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Resetear estado al cerrar
  useEffect(() => {
    if (!open) {
      setPrompt("");
      setArchivos([]);
      setError(null);
      setIncluirCifras(false);
    }
  }, [open]);

  const titulo =
    modo.tipo === "bloque"
      ? `Rellenar ${BLOQUE_IA_LABELS[modo.bloque]} con IA`
      : "Generar apertura completa con IA";

  const descripcion =
    modo.tipo === "bloque"
      ? "Describe el bloque en lenguaje natural o adjunta documentos. La IA propondrá los campos y tú revisas antes de aceptar."
      : "Describe el proyecto y/o adjunta el dossier. La IA rellenará todas las pestañas como borrador. Nada se guarda hasta que aceptes.";

  const placeholderPrompt =
    modo.tipo === "bloque" ? PLACEHOLDERS[modo.bloque] : PLACEHOLDER_COMPLETA;

  const puedeGenerar =
    !isPending && (prompt.trim().length > 0 || archivos.length > 0);

  const onGenerar = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const payloads = archivos.map((a) => a.payload);

      if (modo.tipo === "bloque") {
        const res = await analizarRellenoIA({
          bloque: modo.bloque,
          prompt: prompt.trim(),
          payloads: payloads.length > 0 ? payloads : undefined,
        });
        if (!res.ok || !res.draft) {
          setError(res.error ?? "No se pudo generar el borrador.");
          return;
        }
        onDraft(res.draft, [modo.bloque]);
        toast.success(`Sugerencia de ${BLOQUE_IA_LABELS[modo.bloque]} generada. Revísala y acepta.`);
        onOpenChange(false);
        return;
      }

      // modo "completa"
      const res = await generarAperturaCompletaIA({
        prompt: prompt.trim(),
        payloads: payloads.length > 0 ? payloads : undefined,
        incluirCifrasFinancieras: incluirCifras,
      });
      if (!res.ok || !res.drafts) {
        setError(res.error ?? "No se pudo generar la apertura completa.");
        return;
      }
      onDraft(res.drafts, res.bloquesPropuestos ?? []);
      toast.success(
        `Borrador con ${res.bloquesPropuestos?.length ?? 0} bloque${
          (res.bloquesPropuestos?.length ?? 0) === 1 ? "" : "s"
        }. Revisa pestaña a pestaña.`,
      );
      onOpenChange(false);
    });
  }, [archivos, incluirCifras, modo, onDraft, onOpenChange, prompt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {titulo}
          </DialogTitle>
          <DialogDescription className="text-xs">{descripcion}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Prompt
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholderPrompt}
              rows={4}
              disabled={isPending}
              className="text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Documentos (opcional)
            </label>
            <RellenoIADropzone
              archivos={archivos}
              onChange={setArchivos}
              onError={(msg) => setError(msg)}
              disabled={isPending}
            />
          </div>

          {modo.tipo === "completa" && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs">
              <input
                type="checkbox"
                checked={incluirCifras}
                onChange={(e) => setIncluirCifras(e.target.checked)}
                disabled={isPending}
                className="mt-0.5 h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
              />
              <span>
                <span className="font-semibold text-amber-900">Incluir estimación de costes y facturación</span>
                <br />
                <span className="text-amber-800">
                  Solo si los documentos adjuntos contienen cifras explícitas (alquiler, salarios, ventas).
                  Sin documentos numéricos, este modo no inventa cifras.
                </span>
              </span>
            </label>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onGenerar}
            disabled={!puedeGenerar}
            className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generando…
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                Generar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
