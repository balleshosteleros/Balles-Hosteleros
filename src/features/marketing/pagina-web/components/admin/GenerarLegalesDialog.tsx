"use client";

/**
 * Diálogo "Páginas legales".
 *
 * Genera política de privacidad, aviso legal y política de cookies a partir de
 * los datos fiscales de la empresa (Ajustes → Datos generales). Si faltan datos
 * obligatorios se avisa antes de generar, porque un documento legal sin CIF o
 * sin correo de contacto no cumple el RGPD.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, TriangleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  generarPaginasLegales,
  previsualizarTextosLegales,
} from "../../actions/legales-actions";
import type { TipoPaginaLegal } from "../../services/textos-legales";

const OPCIONES: Array<{ tipo: TipoPaginaLegal; nombre: string; descripcion: string }> = [
  {
    tipo: "privacidad",
    nombre: "Política de privacidad",
    descripcion: "Qué datos se recogen, para qué, cuánto se guardan y cómo ejercer derechos.",
  },
  {
    tipo: "aviso_legal",
    nombre: "Aviso legal",
    descripcion: "Datos identificativos del titular exigidos por la LSSI.",
  },
  {
    tipo: "cookies",
    nombre: "Política de cookies",
    descripcion: "Tipos de cookies, finalidad y cómo retirar el consentimiento.",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
}

export function GenerarLegalesDialog({ open, onOpenChange, onGenerated }: Props) {
  const [seleccion, setSeleccion] = useState<TipoPaginaLegal[]>(OPCIONES.map((o) => o.tipo));
  const [avisos, setAvisos] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);

  const comprobar = useCallback(async () => {
    setCargando(true);
    const res = await previsualizarTextosLegales();
    if (res.ok) setAvisos(res.data.avisos);
    else toast.error(res.error);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (open) comprobar();
  }, [open, comprobar]);

  const alternar = (tipo: TipoPaginaLegal) => {
    setSeleccion((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo],
    );
  };

  const onGenerar = async () => {
    if (seleccion.length === 0) {
      toast.error("Selecciona al menos una página.");
      return;
    }
    setGenerando(true);
    const res = await generarPaginasLegales(seleccion);
    setGenerando(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    const creadas = res.data.paginas.filter((p) => p.creada).length;
    const actualizadas = res.data.paginas.length - creadas;
    const partes: string[] = [];
    if (creadas) partes.push(`${creadas} creada${creadas === 1 ? "" : "s"}`);
    if (actualizadas) partes.push(`${actualizadas} actualizada${actualizadas === 1 ? "" : "s"}`);
    toast.success(`Páginas legales: ${partes.join(" y ")}.`);

    onGenerated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" strokeWidth={1.75} />
            Páginas legales
          </DialogTitle>
          <DialogDescription>
            Se redactan solas con los datos fiscales de la empresa. Se crean como borrador; tú
            decides cuándo publicarlas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {OPCIONES.map((o) => (
            <label
              key={o.tipo}
              className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40"
            >
              <Checkbox
                checked={seleccion.includes(o.tipo)}
                onCheckedChange={() => alternar(o.tipo)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{o.nombre}</span>
                <span className="block text-xs text-muted-foreground">{o.descripcion}</span>
              </span>
            </label>
          ))}
        </div>

        {cargando && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Comprobando los datos de la empresa…
          </p>
        )}

        {!cargando && avisos.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
              <TriangleAlert className="h-4 w-4" strokeWidth={1.75} />
              Faltan datos obligatorios
            </p>
            <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-amber-800 list-disc dark:text-amber-300">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              Complétalos en Ajustes → Datos generales y vuelve a generar. Si generas ahora,
              esos huecos quedarán marcados como pendientes en el texto.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Estos textos cubren los mínimos del RGPD y la LSSI, pero no sustituyen la revisión de
          un abogado.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onGenerar} disabled={generando || cargando}>
            {generando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
