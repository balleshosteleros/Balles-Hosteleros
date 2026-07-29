"use client";

/**
 * Diálogo para resolver UNA línea de un albarán subido por foto que no casó con el
 * catálogo (asistente de albaranes, decisión de Iván 2026-07-29). Tres opciones:
 *   1. VINCULAR a un producto existente (con candidatos sugeridos + indicador de precio).
 *   2. CREAR un producto de compra nuevo desde el albarán (obliga campos; sugiere el
 *      precio del propio albarán).
 *   3. IGNORAR la línea (no cuenta como producto; no bloquea la confirmación).
 *
 * Combobox (Command) DENTRO de Dialog — regla de UI del proyecto.
 */

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EyeOff, Link2, Plus } from "lucide-react";
import { ProveedorCombobox } from "@/features/logistica/components/productos/ProveedorCombobox";
import { IndicadorPrecio } from "@/features/logistica/components/albaranes/IndicadorPrecio";
import { IVA_OPCIONES } from "@/features/logistica/data/productos";
import type {
  LineaEmparejada,
  SugerenciaCandidato,
} from "@/features/logistica/actions/asistente-albaran-actions";

export type ResolucionLinea =
  | { tipo: "vincular"; productoId: string; nombreProducto: string }
  | { tipo: "crear"; productoId: string; nombreProducto: string }
  | { tipo: "ignorar" };

interface Props {
  open: boolean;
  linea: LineaEmparejada;
  /** Proveedor del albarán (se sugiere al crear producto). */
  proveedorAlbaran: string;
  categorias: string[];
  onClose: () => void;
  onVincular: (candidato: SugerenciaCandidato) => Promise<void> | void;
  onCrear: (datos: {
    nombre: string;
    categoria: string;
    proveedor: string;
    iva: string;
    precio: number;
  }) => Promise<void> | void;
  onIgnorar: () => Promise<void> | void;
  busy?: boolean;
}

type Modo = "elegir" | "crear";

export function ResolverLineaDialog({
  open,
  linea,
  proveedorAlbaran,
  categorias,
  onClose,
  onVincular,
  onCrear,
  onIgnorar,
  busy,
}: Props) {
  const [modo, setModo] = useState<Modo>("elegir");
  const [busqueda, setBusqueda] = useState("");

  // Formulario de crear (prerelleno con lo leído del albarán).
  const [nombre, setNombre] = useState(linea.nombre);
  const [categoria, setCategoria] = useState(categorias[0] ?? "");
  const [proveedor, setProveedor] = useState(proveedorAlbaran);
  const [iva, setIva] = useState<string>(IVA_OPCIONES[IVA_OPCIONES.length - 1]);
  const [precio, setPrecio] = useState(
    linea.precioUnitario != null ? String(linea.precioUnitario).replace(".", ",") : "",
  );
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  const candidatos = useMemo(
    () => [...linea.candidatos].sort((a, b) => b.score - a.score),
    [linea.candidatos],
  );

  const parsePrecio = (v: string): number => {
    const n = parseFloat(v.replace(/[^0-9,.-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const handleCrear = () => {
    setErrorCrear(null);
    if (!nombre.trim()) return setErrorCrear("El nombre es obligatorio");
    if (!categoria.trim()) return setErrorCrear("Selecciona una categoría");
    if (!proveedor.trim()) return setErrorCrear("Selecciona un proveedor");
    if (!iva) return setErrorCrear("Selecciona un IVA");
    const p = parsePrecio(precio);
    if (!Number.isFinite(p) || p < 0) return setErrorCrear("Precio del albarán inválido");
    void onCrear({ nombre: nombre.trim(), categoria, proveedor: proveedor.trim(), iva, precio: p });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Resolver línea:{" "}
            <span className="font-normal">{linea.nombre}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground -mt-2">
          Leído del albarán: <b>{linea.cantidad}</b> ud ·{" "}
          {linea.precioUnitario != null ? (
            <b>{String(linea.precioUnitario).replace(".", ",")} €</b>
          ) : (
            <span className="italic">sin precio</span>
          )}
        </div>

        {/* Conmutador de modo */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={modo === "elegir" ? "default" : "outline"}
            className="gap-1"
            onClick={() => setModo("elegir")}
          >
            <Link2 className="h-3.5 w-3.5" /> Vincular a existente
          </Button>
          <Button
            size="sm"
            variant={modo === "crear" ? "default" : "outline"}
            className="gap-1"
            onClick={() => setModo("crear")}
          >
            <Plus className="h-3.5 w-3.5" /> Crear producto nuevo
          </Button>
        </div>

        {modo === "elegir" ? (
          <Command>
            <CommandInput
              placeholder="Buscar producto del catálogo…"
              value={busqueda}
              onValueChange={setBusqueda}
            />
            <CommandList>
              <CommandEmpty>
                Sin coincidencias. Prueba a{" "}
                <button
                  className="underline text-foreground"
                  onClick={() => setModo("crear")}
                >
                  crear el producto
                </button>
                .
              </CommandEmpty>
              {candidatos.length > 0 && (
                <CommandGroup heading="Sugeridos">
                  {candidatos.map((c) => (
                    <CommandItem
                      key={c.productoId}
                      value={`${c.nombre} ${c.nombreProveedor ?? ""}`}
                      onSelect={() => void onVincular(c)}
                      disabled={busy}
                    >
                      <span className="flex-1">
                        {c.nombre}
                        {c.nombreProveedor && (
                          <span className="block text-[10px] text-muted-foreground">
                            Proveedor: {c.nombreProveedor}
                          </span>
                        )}
                      </span>
                      <IndicadorPrecio
                        precioLeido={linea.precioUnitario}
                        precioVigente={c.precioVigente}
                        className="mr-2"
                      />
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round(c.score * 100)}%
                      </Badge>
                      {c.via === "nombre_proveedor" && (
                        <span className="ml-2 text-[10px] text-emerald-600">alias</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Categoría *</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">IVA *</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={iva}
                  onChange={(e) => setIva(e.target.value)}
                >
                  {IVA_OPCIONES.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Proveedor *</Label>
              <ProveedorCombobox value={proveedor} onChange={setProveedor} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">
                Precio del albarán *
              </Label>
              <Input
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="Ej: 9,86"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Sugerido del propio albarán. Se guardará como precio de compra vigente.
              </p>
            </div>
            {errorCrear && (
              <p className="text-xs text-rose-600">{errorCrear}</p>
            )}
            <Button className="w-full gap-1" onClick={handleCrear} disabled={busy}>
              <Plus className="h-4 w-4" /> Crear y vincular
            </Button>
          </div>
        )}

        <div className="border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() => void onIgnorar()}
            disabled={busy}
          >
            <EyeOff className="h-3.5 w-3.5" /> Ignorar esta línea (no es un producto)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
