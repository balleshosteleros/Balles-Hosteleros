"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Camera, Rocket, Send, Utensils } from "lucide-react";
import { toast } from "sonner";
import { publicarOficial, anadirACartaDigital } from "../actions/publicar-oficial-actions";
import type { RecetaConExtras } from "../actions/recetas-actions";
import { ComunicadoRecetaDialog } from "./ComunicadoRecetaDialog";

interface Props {
  receta: RecetaConExtras;
  onChanged: () => void;
}

const CHECKLIST = [
  { key: "fotos_marketing", label: "Fotos de marketing" },
  { key: "contenido_redes", label: "Contenido para redes sociales" },
  { key: "cartela_carta", label: "Cartela para carta" },
  { key: "descripcion_carta", label: "Descripción para carta escrita" },
];

export function MarketingTab({ receta, onChanged }: Props) {
  // Estado local del checklist (se persiste en datos_gatekeeper jsonb)
  const datos = (receta as unknown as { datos_gatekeeper?: Record<string, boolean> }).datos_gatekeeper ?? {};
  const [checks, setChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(CHECKLIST.map((c) => [c.key, datos[c.key] ?? false])),
  );
  const [publishing, setPublishing] = useState(false);
  const [showComunicado, setShowComunicado] = useState(false);

  const publicada = Boolean(receta.ficha_tecnica_id);

  async function publicar() {
    if (publicada) {
      if (!confirm("Esta receta ya está publicada. ¿Actualizar la ficha técnica oficial y productos de compra?")) {
        return;
      }
    }
    setPublishing(true);
    const res = await publicarOficial(receta.id);
    if (!res.ok) {
      toast.error(res.error);
    } else {
      toast.success(
        `Publicada oficial. ${res.data.productos_creados} producto(s) de compra creado(s).`,
      );
      onChanged();
    }
    setPublishing(false);
  }

  async function aCartaDigital() {
    const res = await anadirACartaDigital(receta.id);
    if (!res.ok) toast.error(res.error);
    else toast.success("Añadida a Carta Digital");
  }

  function abrirComunicado() {
    setShowComunicado(true);
  }

  return (
    <div className="space-y-4">
      {/* Checklist */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Checklist de marketing
        </p>
        <div className="space-y-1.5">
          {CHECKLIST.map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer"
            >
              <Checkbox
                checked={checks[item.key] ?? false}
                onCheckedChange={(v) => setChecks({ ...checks, [item.key]: Boolean(v) })}
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Estado de publicación */}
      <Card className={publicada ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}>
        <CardContent className="p-3 flex items-start gap-2">
          {publicada ? (
            <Rocket className="h-5 w-5 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {publicada ? "Receta publicada oficialmente" : "Receta sin publicar"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {publicada
                ? "Ya existe en Fichas Técnicas. Las ediciones aquí sobrescriben la ficha oficial."
                : "Al publicar se creará en Fichas Técnicas + productos de compra en Logística."}
            </p>
            {publicada && receta.ficha_tecnica_id && (
              <Badge variant="outline" className="text-[10px] mt-1">
                Ficha #{receta.ficha_tecnica_id.slice(0, 8)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Acciones principales */}
      <div className="grid gap-2">
        <Button onClick={publicar} disabled={publishing} className="justify-start gap-2">
          <Rocket className="h-4 w-4" />
          {publishing
            ? "Publicando..."
            : publicada
              ? "Actualizar ficha técnica oficial"
              : "Publicar oficial (crea ficha técnica + productos)"}
        </Button>

        <Button
          variant="outline"
          onClick={aCartaDigital}
          disabled={!publicada}
          className="justify-start gap-2"
        >
          <Utensils className="h-4 w-4" />
          Añadir a Carta Digital
        </Button>

        <Button
          variant="outline"
          onClick={abrirComunicado}
          disabled={!publicada}
          className="justify-start gap-2"
        >
          <Send className="h-4 w-4" />
          Enviar comunicado al equipo
        </Button>
      </div>

      {!publicada && (
        <p className="text-[11px] text-muted-foreground italic flex items-start gap-1.5">
          <Camera className="h-3 w-3 mt-0.5 shrink-0" />
          Los botones de Carta Digital y Comunicado se activan al publicar oficialmente.
        </p>
      )}

      <ComunicadoRecetaDialog
        open={showComunicado}
        onOpenChange={setShowComunicado}
        receta={receta}
      />
    </div>
  );
}
