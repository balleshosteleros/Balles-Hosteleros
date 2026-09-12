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
import { Label } from "@/components/ui/label";
import { SelectorOpcion } from "@/components/ui/selector-opcion";
import { Plus, Link2 } from "lucide-react";

/**
 * Dar de alta en Balles un producto que Ágora ya está vendiendo.
 *
 * Se pide lo imprescindible y nada más: el nombre viene de Ágora y el identificador se
 * fija solo. Lo demás —escandallo, precios, alérgenos— se rellena luego en su ficha;
 * lo urgente es que las ventas dejen de perderse.
 */

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCrear: (datos: { nombre: string; tipo: string; categoria: string; medida: string }) => void;
  /** Si al guardar choca con un producto que ya existe, se ofrece enlazarlo. */
  duplicado: { id: string; nombre: string } | null;
  onVincularDuplicado: (productoId: string) => void;
  nombreAgora: string;
  origen: "venta" | "complemento";
  veces: number;
  guardando?: boolean;
}

const TIPOS = [
  { valor: "venta", etiqueta: "De venta (se vende en el TPV)" },
  { valor: "compra", etiqueta: "De compra (se consume, no se vende suelto)" },
  { valor: "elaboracion", etiqueta: "Elaboración (se hace en casa)" },
];

const MEDIDAS = [
  { valor: "Unidades", etiqueta: "Unidades" },
  { valor: "Kilogramos", etiqueta: "Kilogramos" },
  { valor: "Litros", etiqueta: "Litros" },
];

export default function AltaProductoDialog({
  abierto,
  onCerrar,
  onCrear,
  duplicado,
  onVincularDuplicado,
  nombreAgora,
  origen,
  veces,
  guardando = false,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("venta");
  const [categoria, setCategoria] = useState("");
  const [medida, setMedida] = useState("Unidades");

  useEffect(() => {
    if (!abierto) return;
    setNombre(nombreAgora);
    // Un complemento es mercancía que se gasta (el tabaco, la cápsula), no algo que se
    // venda suelto: nace como producto de compra.
    setTipo(origen === "complemento" ? "compra" : "venta");
    setCategoria("");
    setMedida("Unidades");
  }, [abierto, nombreAgora, origen]);

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onCerrar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar de alta «{nombreAgora}»</DialogTitle>
          <DialogDescription>
            Ágora lo lleva vendiendo <strong>{veces}</strong> {veces === 1 ? "vez" : "veces"} y
            Balles no lo conoce. Al crearlo se enlazan todas esas ventas de golpe. El
            escandallo y los precios se rellenan después en su ficha.
          </DialogDescription>
        </DialogHeader>

        {duplicado ? (
          <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-amber-900 dark:text-amber-300">
              Ya existe un producto llamado <strong>{duplicado.nombre}</strong>. Casi seguro
              es este mismo: en Ágora está dado de alta dos veces. En vez de crear un
              duplicado, enlázalo.
            </p>
            <Button
              onClick={() => onVincularDuplicado(duplicado.id)}
              disabled={guardando}
              className="gap-1.5"
              size="sm"
            >
              <Link2 className="h-4 w-4" /> Enlazar a «{duplicado.nombre}»
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="alta-nombre">Nombre</Label>
              <Input id="alta-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alta-tipo">Qué es</Label>
              <SelectorOpcion
                id="alta-tipo"
                value={tipo}
                onChange={setTipo}
                opciones={TIPOS.map((t) => ({ value: t.valor, label: t.etiqueta }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alta-categoria">Categoría</Label>
              <Input
                id="alta-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej.: Shishas, Cócteles, Menús"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alta-medida">Cómo se cuenta</Label>
              <SelectorOpcion
                id="alta-medida"
                value={medida}
                onChange={setMedida}
                opciones={MEDIDAS.map((m) => ({ value: m.valor, label: m.etiqueta }))}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          {!duplicado && (
            <Button
              onClick={() => onCrear({ nombre, tipo, categoria, medida })}
              disabled={guardando || !nombre.trim() || !categoria.trim()}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {guardando ? "Creando…" : "Crear y enlazar sus ventas"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
