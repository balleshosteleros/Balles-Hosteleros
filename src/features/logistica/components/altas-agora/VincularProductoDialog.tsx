"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link2, Search } from "lucide-react";
import { buscarProductosParaVincular } from "@/features/logistica/actions/altas-agora-actions";

/**
 * Elegir a qué producto de Balles corresponde algo que Ágora vende.
 *
 * Se buscan también los productos de COMPRA a propósito: el tabaco de una shisha o la
 * cápsula de un café se consumen 1:1 contra su producto de compra, y esa es la ficha
 * correcta a la que enlazarlos.
 */

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onVincular: (productoId: string) => void;
  /** Lo que Ágora vende y no se reconoce. */
  nombreAgora: string;
  veces: number;
  desde: string;
  guardando?: boolean;
}

function formatearDia(dia: string): string {
  if (!dia) return "";
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

export default function VincularProductoDialog({
  abierto,
  onCerrar,
  onVincular,
  nombreAgora,
  veces,
  desde,
  guardando = false,
}: Props) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<
    { id: string; nombre: string; tipo: string; agoraId: string | null }[]
  >([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setTexto(nombreAgora);
    setElegido(null);
  }, [abierto, nombreAgora]);

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(() => {
      buscarProductosParaVincular(texto).then((r) => {
        if (!vivo) return;
        setResultados(r.data);
        setBuscando(false);
      });
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [abierto, texto]);

  const productoElegido = resultados.find((r) => r.id === elegido);

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onCerrar(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>¿A qué producto corresponde «{nombreAgora}»?</DialogTitle>
          <DialogDescription>
            Al elegirlo se enlazan de golpe las <strong>{veces}</strong>{" "}
            {veces === 1 ? "venta" : "ventas"} que Ágora lleva registrando desde el{" "}
            {formatearDia(desde)}. No se crea ningún producto nuevo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar producto por nombre…"
              className="pl-8"
            />
          </div>

          <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
            {buscando && resultados.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Buscando…</p>
            ) : resultados.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Ningún producto con ese nombre. Si de verdad no existe, ciérralo y usa
                «Crear producto».
              </p>
            ) : (
              resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setElegido(r.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50 ${
                    elegido === r.id ? "bg-primary/10" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {r.nombre}
                    <Badge variant="outline" className="text-[10px] capitalize">{r.tipo}</Badge>
                  </span>
                  {r.agoraId && (
                    <span className="text-xs text-muted-foreground">
                      ya tiene el ID {r.agoraId}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {productoElegido?.agoraId && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              «{productoElegido.nombre}» ya tiene el ID {productoElegido.agoraId} de Ágora.
              Se le añadirá este otro como <strong>segundo identificador</strong>: en Ágora
              el mismo artículo está dado de alta dos veces y los dos apuntan aquí.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={() => elegido && onVincular(elegido)}
            disabled={!elegido || guardando}
            className="gap-1.5"
          >
            <Link2 className="h-4 w-4" />
            {guardando ? "Enlazando…" : "Enlazar las ventas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
