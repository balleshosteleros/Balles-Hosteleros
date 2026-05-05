"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, QrCode, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listCatas, upsertCata, procesarValoracion } from "../actions/catas-actions";
import type { Cata, ValoracionCata } from "../types";
import { VALORACION_LABELS } from "../types";
import { QrFotoDialog } from "./QrFotoDialog";
import { subirFotoCataDirecto } from "../actions/qr-foto-actions";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

interface Props {
  recetaId: string;
  numero: 1 | 2;
  escandallo: {
    ft_coste_estimado: number | null;
    ft_pvp_propuesto: number | null;
  };
  onChanged?: () => void;
}

const VALORACION_COLOR: Record<ValoracionCata, string> = {
  pendiente:      "bg-gray-100 text-gray-700",
  rehacer_entera: "bg-red-100 text-red-700",
  rehacer_media:  "bg-orange-100 text-orange-700",
  semi_aprobada:  "bg-amber-100 text-amber-700",
  aprobada:       "bg-emerald-100 text-emerald-700",
};

export function CataTab({ recetaId, numero, escandallo, onChanged }: Props) {
  const [cata, setCata] = useState<Cata | null>(null);
  const [catas, setCatas] = useState<Cata[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [aciertos, setAciertos] = useState("");
  const [mejoras, setMejoras] = useState("");
  const [costeReal, setCosteReal] = useState("");
  const [pvpSugerido, setPvpSugerido] = useState("");
  const [valoracion, setValoracion] = useState<ValoracionCata>("pendiente");

  const cargar = async () => {
    setLoading(true);
    const res = await listCatas(recetaId);
    if (res.ok) {
      setCatas(res.data);
      const c = res.data.find((x) => x.numero === numero) ?? null;
      setCata(c);
      setAciertos(c?.aciertos ?? "");
      setMejoras(c?.mejoras ?? "");
      setCosteReal(c?.coste_real?.toString() ?? "");
      setPvpSugerido(c?.pvp_sugerido?.toString() ?? "");
      setValoracion(c?.valoracion ?? "pendiente");
    }
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recetaId, numero]);

  async function guardar() {
    const res = await upsertCata({
      id: cata?.id,
      receta_id: recetaId,
      numero,
      aciertos: aciertos || undefined,
      mejoras: mejoras || undefined,
      coste_real: costeReal ? parseFloat(costeReal) : undefined,
      pvp_sugerido: pvpSugerido ? parseFloat(pvpSugerido) : undefined,
      valoracion,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Cata guardada");

    // Si valoración cambió a rehacer_entera, procesar el movimiento
    if (cata && cata.valoracion !== valoracion && valoracion !== "pendiente") {
      await procesarValoracion({
        cataId: res.data.id,
        recetaId,
        valoracion,
      });
    }
    await cargar();
    onChanged?.();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !cata?.id) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await subirFotoCataDirecto({
        recetaId,
        cataId: cata.id,
        fileBase64: base64,
        fileName: file.name,
        mime: file.type,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Foto subida");
      await cargar();
    };
    reader.readAsDataURL(file);
  }

  const catasAnteriores = catas.filter((c) => c.numero < numero);

  if (loading) {
    return <LoadingSpinner className="p-4" />;
  }

  return (
    <div className="space-y-4">
      {/* Histórico de catas anteriores (solo en cata 2) */}
      {catasAnteriores.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Histórico de catas anteriores
            </p>
            {catasAnteriores.map((c) => (
              <div key={c.id} className="border-l-2 border-primary/30 pl-3 py-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Cata {c.numero}</span>
                  <span className="text-xs text-muted-foreground">{c.fecha}</span>
                  {c.valoracion && (
                    <Badge className={cn("text-[10px] border-0", VALORACION_COLOR[c.valoracion])}>
                      {VALORACION_LABELS[c.valoracion]}
                    </Badge>
                  )}
                </div>
                {c.aciertos && (
                  <p className="text-xs"><span className="font-medium text-emerald-700">Aciertos:</span> {c.aciertos}</p>
                )}
                {c.mejoras && (
                  <p className="text-xs"><span className="font-medium text-amber-700">Mejoras:</span> {c.mejoras}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Escandallo visible */}
      <Card className="bg-primary/5">
        <CardContent className="p-3 grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Coste estimado</p>
            <p className="text-lg font-bold">{escandallo.ft_coste_estimado?.toFixed(2) ?? "—"} €</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">PVP propuesto</p>
            <p className="text-lg font-bold">{escandallo.ft_pvp_propuesto?.toFixed(2) ?? "—"} €</p>
          </div>
        </CardContent>
      </Card>

      {/* Foto + QR */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide">Foto de la cata</Label>
        <div className="flex gap-2 items-start">
          {cata?.foto_url ? (
            <img src={cata.foto_url} alt="Foto cata" className="h-32 w-32 object-cover rounded-lg border" />
          ) : (
            <div className="h-32 w-32 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground">
              <Camera className="h-8 w-8" />
            </div>
          )}
          <div className="flex flex-col gap-2 flex-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQrOpen(true)}
              disabled={!cata?.id}
              className="gap-1.5 justify-start"
            >
              <QrCode className="h-4 w-4" /> Subir desde móvil (QR)
            </Button>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={onFileChange} disabled={!cata?.id} />
              <Button variant="outline" size="sm" asChild className="w-full gap-1.5 justify-start">
                <span>
                  <Camera className="h-4 w-4" /> Subir desde ordenador
                </span>
              </Button>
            </label>
            {!cata?.id && (
              <p className="text-[10px] text-muted-foreground italic">
                Guarda primero la cata para habilitar fotos
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Aciertos / Mejoras */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wide text-emerald-700">Aciertos</Label>
          <textarea
            value={aciertos}
            onChange={(e) => setAciertos(e.target.value)}
            placeholder="Lo que funcionó bien..."
            className="mt-1 w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-amber-700">Mejoras</Label>
          <textarea
            value={mejoras}
            onChange={(e) => setMejoras(e.target.value)}
            placeholder="Ajustes a probar..."
            className="mt-1 w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Coste real + PVP sugerido */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Coste real (€)</Label>
          <Input type="number" step="0.01" value={costeReal} onChange={(e) => setCosteReal(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">PVP sugerido (€)</Label>
          <Input type="number" step="0.01" value={pvpSugerido} onChange={(e) => setPvpSugerido(e.target.value)} />
        </div>
      </div>

      {/* Valoración */}
      <div>
        <Label className="text-xs uppercase tracking-wide">Valoración</Label>
        <div className="flex gap-1.5 flex-wrap mt-2">
          {(["rehacer_entera", "rehacer_media", "semi_aprobada", "aprobada"] as ValoracionCata[]).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={valoracion === v ? "default" : "outline"}
              onClick={() => setValoracion(v)}
              className={cn("text-xs", valoracion === v && VALORACION_COLOR[v])}
            >
              {valoracion === v && <Check className="h-3 w-3 mr-1" />}
              {VALORACION_LABELS[v]}
            </Button>
          ))}
        </div>
        {valoracion === "rehacer_entera" && (
          <p className="text-[11px] text-red-700 mt-1">
            Al guardar, la receta volverá a la fase 1 (Propuesta).
          </p>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={guardar}>
          <Save className="h-4 w-4 mr-1.5" /> Guardar cata {numero}
        </Button>
      </div>

      {cata?.id && (
        <QrFotoDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          recetaId={recetaId}
          cataId={cata.id}
        />
      )}
    </div>
  );
}
