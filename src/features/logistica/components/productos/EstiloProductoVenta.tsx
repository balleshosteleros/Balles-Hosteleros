"use client";

import * as React from "react";
import { Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COLORES_POS } from "@/features/logistica/data/productos";
import { subirFotoItem } from "@/features/marketing/carta-digital/services/foto-upload";
import { toast } from "sonner";

interface Props {
  productoId: string;
  empresaId: string;
  nombre: string;
  estiloColor: string | null;
  estiloImagenUrl: string | null;
  onChange: (next: { estiloColor: string | null; estiloImagenUrl: string | null }) => void;
}

const SIN_COLOR = "__none__";

export function EstiloProductoVenta({
  productoId,
  empresaId,
  nombre,
  estiloColor,
  estiloImagenUrl,
  onChange,
}: Props) {
  const inputFileRef = React.useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = React.useState(false);

  const tieneImagen = !!estiloImagenUrl;
  const colorActivo = estiloColor ?? null;

  function handleColor(hex: string) {
    if (hex === SIN_COLOR) {
      onChange({ estiloColor: null, estiloImagenUrl });
      return;
    }
    // Elegir color → quita imagen (mutuamente excluyente)
    onChange({ estiloColor: hex, estiloImagenUrl: null });
  }

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen válida");
      return;
    }
    setSubiendo(true);
    const res = await subirFotoItem(file, empresaId, productoId);
    setSubiendo(false);
    if (!res.ok) {
      toast.error(res.error || "Error al subir imagen");
      return;
    }
    // Elegir imagen → quita color (mutuamente excluyente)
    onChange({ estiloColor: null, estiloImagenUrl: res.url });
  }

  function handleQuitarImagen() {
    onChange({ estiloColor, estiloImagenUrl: null });
  }

  // Vista previa: imagen → título debajo; color → título centrado.
  const previewBg = tieneImagen
    ? undefined
    : colorActivo ?? "#f1f5f9"; // gris suave si no hay nada

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Texto para Punto de Venta</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
          <div className="space-y-4">
            {/* Texto = nombre del producto (solo lectura) */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-xs text-muted-foreground">Texto</Label>
              <Input value={nombre} readOnly className="bg-muted/40" />
            </div>

            {/* Color */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3">
              <Label className="text-xs text-muted-foreground">Color</Label>
              <Select
                value={colorActivo ?? SIN_COLOR}
                onValueChange={handleColor}
                disabled={tieneImagen}
              >
                <SelectTrigger>
                  <SelectValue>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded-sm border border-border"
                        style={{ background: colorActivo ?? "transparent" }}
                      />
                      {colorActivo
                        ? COLORES_POS.find((c) => c.hex === colorActivo)?.nombre ?? "Personalizado"
                        : "Sin color"}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_COLOR}>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded-sm border border-dashed border-muted-foreground/40" />
                      Sin color
                    </span>
                  </SelectItem>
                  {COLORES_POS.map((c) => (
                    <SelectItem key={c.hex} value={c.hex}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-sm border border-border"
                          style={{ background: c.hex }}
                        />
                        {c.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Imagen */}
            <div className="grid grid-cols-[110px_1fr] items-start gap-3">
              <Label className="text-xs text-muted-foreground pt-2">Imagen</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleArchivo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputFileRef.current?.click()}
                  disabled={subiendo}
                >
                  {subiendo ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Subiendo…
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-4 w-4 mr-1" />
                      {tieneImagen ? "Cambiar" : "Subir imagen"}
                    </>
                  )}
                </Button>
                {tieneImagen && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleQuitarImagen}
                    title="Quitar imagen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground pl-[122px]">
              Elige <strong>un color</strong> o <strong>una imagen</strong>. Si subes imagen, el título aparece debajo; si solo eliges color, el título se muestra centrado.
            </p>
          </div>

          {/* Vista previa estilo botón POS */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Vista previa</span>
            <div
              className="flex h-32 w-44 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-border shadow-sm"
              style={{ background: previewBg }}
            >
              {tieneImagen ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={estiloImagenUrl!}
                    alt={nombre}
                    className="h-20 w-full object-contain"
                  />
                  <div className="w-full px-1 pb-1 text-center text-xs font-semibold leading-tight line-clamp-2">
                    {nombre}
                  </div>
                </>
              ) : (
                <div className="px-2 text-center text-sm font-semibold leading-tight line-clamp-3">
                  {nombre}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
