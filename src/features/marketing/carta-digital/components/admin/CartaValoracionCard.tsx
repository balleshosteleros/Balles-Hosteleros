"use client";

/**
 * Ajustes de la valoración en mesa dentro de la carta digital.
 *
 * La ventana la ve el cliente sobre la carta que ya tiene abierta, así que se
 * configura aquí y no en otro módulo: quien cambia la carta es quien decide si
 * pregunta y cuándo.
 */

import { useEffect, useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
  getValoracionMesaConfig,
  guardarValoracionMesaConfig,
  type ValoracionMesaConfig,
} from "../../actions/valoracion-mesa-actions";

/** Los minutos se llevan como texto: así el campo puede quedarse vacío
 *  mientras se escribe, sin el cero colgado que obliga a borrarlo a mano. */
type Borrador = {
  activa: boolean;
  minutos: string;
  reintentoMinutos: string;
  margenMinutos: string;
  redirigir5EstrellasGoogle: boolean;
  googleReviewUrl: string;
};

const aBorrador = (c: ValoracionMesaConfig): Borrador => ({
  activa: c.activa,
  minutos: String(c.minutos),
  reintentoMinutos: String(c.reintentoMinutos),
  margenMinutos: String(c.margenMinutos),
  redirigir5EstrellasGoogle: c.redirigir5EstrellasGoogle,
  googleReviewUrl: c.googleReviewUrl ?? "",
});

export function CartaValoracionCard() {
  const [b, setB] = useState<Borrador | null>(null);
  const [guardando, startTransition] = useTransition();

  useEffect(() => {
    let vivo = true;
    getValoracionMesaConfig().then((c) => {
      if (vivo) setB(aBorrador(c));
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!b) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) =>
    setB({ ...b, [k]: v });

  const guardar = () => {
    startTransition(async () => {
      const res = await guardarValoracionMesaConfig({
        activa: b.activa,
        minutos: Number(b.minutos),
        reintentoMinutos: Number(b.reintentoMinutos),
        margenMinutos: Number(b.margenMinutos),
        redirigir5EstrellasGoogle: b.redirigir5EstrellasGoogle,
        googleReviewUrl: b.googleReviewUrl.trim() || null,
      });
      if (res.ok) toast.success("Ajustes guardados");
      else toast.error(res.error);
    });
  };

  const campoMinutos = (
    campo: "minutos" | "reintentoMinutos" | "margenMinutos",
    etiqueta: string,
    ayuda: string,
  ) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{etiqueta}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          className="w-24"
          disabled={!b.activa}
          value={b[campo]}
          onChange={(e) => set(campo, e.target.value.replace(/[^\d]/g, ""))}
        />
        <span className="text-sm text-muted-foreground">minutos</span>
      </div>
      <p className="text-xs text-muted-foreground">{ayuda}</p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          Valoración en mesa
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Label className="text-sm">Pedir valoración desde la carta</Label>
            <p className="mt-1 max-w-prose text-xs text-muted-foreground">
              Pasado un rato desde que el cliente escanea el QR, la carta le
              pregunta qué tal ha ido. Es la única forma de que valoren los que
              entran sin reserva.
            </p>
          </div>
          <Switch
            checked={b.activa}
            onCheckedChange={(v) => set("activa", v)}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {campoMinutos(
            "minutos",
            "Preguntar a los",
            "Desde el primer escaneo. Una cena larga pide más que un menú del día.",
          )}
          {campoMinutos(
            "reintentoMinutos",
            "Si la cierra, volver en",
            "Reaparece una segunda vez. Después queda solo el aviso de abajo.",
          )}
          {campoMinutos(
            "margenMinutos",
            "Guardar el sitio",
            "Tras puntuar, margen para dejar sus datos. Agotado, se cierra anónima.",
          )}
        </div>

        <div className="space-y-3 border-t pt-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <Label className="text-sm">Llevar a Google a los contentos</Label>
              <p className="mt-1 max-w-prose text-xs text-muted-foreground">
                Con 4 o 5 estrellas se le ofrece escribir la reseña en Google.
                Las notas más bajas se quedan dentro.
              </p>
            </div>
            <Switch
              checked={b.redirigir5EstrellasGoogle}
              onCheckedChange={(v) => set("redirigir5EstrellasGoogle", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Enlace de reseñas de Google</Label>
            <Input
              type="url"
              placeholder="https://g.page/r/..."
              disabled={!b.redirigir5EstrellasGoogle}
              value={b.googleReviewUrl}
              onChange={(e) => set("googleReviewUrl", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              En tu ficha de Google, «Pedir reseñas» te da este enlace.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
