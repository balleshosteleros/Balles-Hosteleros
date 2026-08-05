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

import { useEffect, useMemo, useState } from "react";
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
import {
  buscarProductosCompra,
  type LineaEmparejada,
  type SugerenciaCandidato,
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
  /** El motivo es obligatorio (PRP-074 F4): nada queda fuera en silencio. */
  onIgnorar: (motivo: string) => Promise<void> | void;
  busy?: boolean;
}

type Modo = "elegir" | "crear";

/**
 * Motivos por los que una línea puede quedar fuera del albarán (PRP-074 F4).
 * Lista cerrada + "otro" con texto: así se puede saber DESPUÉS por qué faltaba algo,
 * en vez de encontrarse un hueco sin explicación.
 */
const MOTIVOS_IGNORAR = [
  { clave: "no_mercancia", etiqueta: "No es mercancía" },
  { clave: "regalo", etiqueta: "Es un regalo" },
  { clave: "error_proveedor", etiqueta: "Error del proveedor" },
  { clave: "ya_recibido", etiqueta: "Ya recibido antes" },
  { clave: "otro", etiqueta: "Otro motivo" },
] as const;

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

  // PRP-074 F4 — búsqueda sobre TODO el catálogo, no solo los ≤6 candidatos del
  // matcher. Antes, si el producto existía pero el matcher no lo proponía, era
  // inalcanzable desde aquí y había que ignorar la línea (le pasó a Fernando con
  // "Gyozas pollo y verduras", "Alcachofa confitada" y "Oreja de cerdo en adobo").
  const [resultados, setResultados] = useState<SugerenciaCandidato[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const termino = busqueda.trim();
    if (termino.length < 2) {
      setResultados([]);
      return;
    }
    // Se espera a que pare de teclear: una consulta por búsqueda, no por letra.
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await buscarProductosCompra({ query: termino, pageSize: 20 });
        if (res.ok) {
          // Los candidatos del matcher ya traen precio vigente; los de búsqueda libre
          // no (la action no lo devuelve), así que el indicador de precio se omite.
          setResultados(
            res.productos.map((p) => ({
              productoId: p.id,
              nombre: p.nombre,
              nombreProveedor: p.nombreProveedor ?? null,
              score: 0,
              via: "nombre" as const,
              precioVigente: null,
            })),
          );
        }
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Formulario de crear (prerelleno con lo leído del albarán).
  const [nombre, setNombre] = useState(linea.nombre);
  const [categoria, setCategoria] = useState(categorias[0] ?? "");
  const [proveedor, setProveedor] = useState(proveedorAlbaran);
  const [iva, setIva] = useState<string>(IVA_OPCIONES[IVA_OPCIONES.length - 1]);
  const [precio, setPrecio] = useState(
    linea.precioUnitario != null ? String(linea.precioUnitario).replace(".", ",") : "",
  );
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  // Ignorar con motivo (PRP-074 F4).
  const [ignorando, setIgnorando] = useState(false);
  const [motivoIgnorar, setMotivoIgnorar] = useState<string | null>(null);
  const [motivoTexto, setMotivoTexto] = useState("");
  const motivoIgnorarValido =
    motivoIgnorar !== null && (motivoIgnorar !== "otro" || motivoTexto.trim() !== "");

  const candidatos = useMemo(
    () => [...linea.candidatos].sort((a, b) => b.score - a.score),
    [linea.candidatos],
  );

  /** Los encontrados por búsqueda que no estén ya arriba en "Sugeridos". */
  const resultadosNuevos = useMemo(() => {
    const yaSugeridos = new Set(candidatos.map((c) => c.productoId));
    return resultados.filter((r) => !yaSugeridos.has(r.productoId));
  }, [resultados, candidatos]);

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
                {buscando ? (
                  "Buscando en el catálogo…"
                ) : busqueda.trim().length === 1 ? (
                  "Escribe al menos dos letras para buscar."
                ) : (
                  <>
                    Sin coincidencias. Prueba a{" "}
                    <button
                      className="underline text-foreground"
                      onClick={() => setModo("crear")}
                    >
                      crear el producto
                    </button>
                    .
                  </>
                )}
              </CommandEmpty>

              {/* Búsqueda libre: cualquier producto del catálogo, no solo los sugeridos. */}
              {resultadosNuevos.length > 0 && (
                <CommandGroup heading="Encontrados en el catálogo">
                  {resultadosNuevos.map((c) => (
                    <CommandItem
                      key={`buscado-${c.productoId}`}
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
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
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

        {/* PRP-074 F4 — ignorar EXIGE motivo: nada queda fuera del albarán en silencio. */}
        <div className="border-t pt-3">
          {!ignorando ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => setIgnorando(true)}
              disabled={busy}
            >
              <EyeOff className="h-3.5 w-3.5" /> Ignorar esta línea (no es un producto)
            </Button>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground block">
                ¿Por qué se deja fuera? (queda registrado)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_IGNORAR.map((m) => (
                  <Button
                    key={m.clave}
                    size="sm"
                    variant={motivoIgnorar === m.clave ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setMotivoIgnorar(m.clave)}
                  >
                    {m.etiqueta}
                  </Button>
                ))}
              </div>
              {motivoIgnorar === "otro" && (
                <Input
                  value={motivoTexto}
                  onChange={(e) => setMotivoTexto(e.target.value)}
                  placeholder="Explica por qué"
                  className="h-8 text-xs"
                  autoFocus
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIgnorando(false);
                    setMotivoIgnorar(null);
                    setMotivoTexto("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={busy || !motivoIgnorarValido}
                  onClick={() => {
                    const etiqueta =
                      MOTIVOS_IGNORAR.find((m) => m.clave === motivoIgnorar)?.etiqueta ?? "";
                    void onIgnorar(
                      motivoIgnorar === "otro" ? motivoTexto.trim() : etiqueta,
                    );
                  }}
                >
                  <EyeOff className="h-3.5 w-3.5" /> Ignorar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
