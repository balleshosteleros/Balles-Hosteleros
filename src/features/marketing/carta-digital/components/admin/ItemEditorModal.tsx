"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ALERGENOS_UE, type CartaCategoria, type CartaItem, type Alergeno } from "../../types";
import { crearItem, actualizarItem, borrarItem, moverItemAPosicion } from "../../actions/carta-admin-actions";
import { cambiarEstadoItem, type EstadoCartaItem } from "../../actions/estado-item-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { FotoUploader } from "./FotoUploader";


/**
 * Los tres estados que puede tener un plato en la carta. Son excluyentes a
 * propósito: "agotado" no es una variante de invisible, es lo contrario —el
 * plato sigue a la vista para que nadie lo pida y para que se sepa que existe.
 */
function estadosDisponibles(horasApagado: number): Array<{
  valor: EstadoCartaItem;
  titulo: string;
  pie: string;
  claseActiva: string;
}> {
  return [
    {
      valor: "VISIBLE",
      titulo: "Visible",
      pie: "Se ve y se puede pedir.",
      claseActiva: "border-emerald-400 bg-emerald-50",
    },
    {
      valor: "AGOTADO",
      titulo: "Agotado",
      pie: `Se ve en gris, con la etiqueta. Vuelve solo a las ${horasApagado} h.`,
      claseActiva: "border-amber-400 bg-amber-50",
    },
    {
      valor: "INVISIBLE",
      titulo: "Invisible",
      pie: "Desaparece de la carta.",
      claseActiva: "border-stone-400 bg-stone-100",
    },
  ];
}

export function ItemEditorModal({
  open,
  empresaId,
  categorias,
  item,
  defaultCategoriaId,
  horasApagado,
  onClose,
}: {
  open: boolean;
  empresaId: string;
  categorias: CartaCategoria[];
  item: CartaItem | null;
  defaultCategoriaId: string | null;
  /** Cuánto dura el "agotado", para poder decirlo en el propio botón. */
  horasApagado: number;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("0");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [alergenos, setAlergenos] = useState<Set<Alergeno>>(new Set());
  const [ordenVisual, setOrdenVisual] = useState("");
  const [likesBase, setLikesBase] = useState("");
  const [estado, setEstado] = useState<EstadoCartaItem>("VISIBLE");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  /**
   * ¿El plato viene de un producto de venta? Entonces el precio y los
   * alérgenos son SUYOS y aquí solo se enseñan: cambiarlos desde marketing
   * dejaría la carta diciendo un precio y la caja cobrando otro.
   */
  const vinculado = !!item?.producto_id;

  useEffect(() => {
    if (item) {
      setNombre(item.nombre);
      setDescripcion(item.descripcion ?? "");
      setPrecio(String(item.precio ?? 0));
      setCategoriaId(item.categoria_id);
      setAlergenos(new Set(item.alergenos));
      setOrdenVisual(String(item.orden ?? ""));
      setLikesBase(String(item.likes_base ?? ""));
      setEstado(!item.visible ? "INVISIBLE" : item.agotado ? "AGOTADO" : "VISIBLE");
      setFotoUrl(item.foto_url);
    } else {
      setNombre("");
      setDescripcion("");
      setPrecio("0");
      setCategoriaId(defaultCategoriaId ?? categorias[0]?.id ?? "");
      setAlergenos(new Set());
      setEstado("VISIBLE");
      setFotoUrl(null);
    }
    setError(null);
  }, [item, open, defaultCategoriaId, categorias]);

  const toggleAlergeno = (a: Alergeno) => {
    setAlergenos((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const handleSave = () => {
    setError(null);
    const precioNum = parseFloat(precio.replace(",", "."));
    if (!nombre.trim()) return setError("El nombre es obligatorio.");
    if (!categoriaId) return setError("Selecciona una categoría.");
    // El precio solo se escribe aquí en los platos SIN producto detrás; en los
    // demás viene de la ficha de venta y este campo ni se enseña.
    if (!vinculado && (Number.isNaN(precioNum) || precioNum < 0))
      return setError("Precio inválido.");

    startTransition(async () => {
      // Lo que se puede tocar desde Marketing: el nombre que lee el comensal,
      // el texto y el estado. El precio y los alérgenos solo viajan cuando el
      // plato no tiene producto de venta detrás.
      const payload = vinculado
        ? { nombre, descripcion }
        : {
            nombre,
            descripcion,
            precio: precioNum,
            alergenos: Array.from(alergenos),
          };
      const base = parseInt(likesBase, 10);
      const res = item
        ? await actualizarItem({
            id: item.id,
            categoriaId,
            likesBase: Number.isFinite(base) && base >= 0 ? base : 0,
            ...payload,
          })
        : await crearItem({
            categoriaId,
            nombre,
            descripcion,
            precio: precioNum,
            alergenos: Array.from(alergenos),
          });

      // El estado se guarda aparte: cuando el plato está vinculado, "agotado"
      // tiene que llegar también al producto para que el TPV se entere.
      if (res.ok && item) {
        const estadoActual: EstadoCartaItem = !item.visible
          ? "INVISIBLE"
          : item.agotado
            ? "AGOTADO"
            : "VISIBLE";
        if (estado !== estadoActual) {
          const resEstado = await cambiarEstadoItem(item.id, estado);
          if (!resEstado.ok) {
            setError(resEstado.error);
            return;
          }
        }
      }

      // El orden se aplica aparte: mover uno recoloca a los demás, así que no
      // puede viajar en el mismo parche que el resto de campos.
      if (res.ok && item) {
        const pos = parseInt(ordenVisual, 10);
        if (Number.isFinite(pos) && pos >= 1 && pos !== item.orden) {
          await moverItemAPosicion(item.id, pos);
        }
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    });
  };

  const handleDelete = async () => {
    if (!item) return;
    const ok = await confirmDelete({
      title: "Borrar plato",
      description: `Se borrará "${item.nombre}". Esta acción no se puede deshacer.`,
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await borrarItem(item.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {confirmDeleteDialog}
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Editar plato" : "Nuevo plato"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          {item ? (
            <FotoUploader
              empresaId={empresaId}
              itemId={item.id}
              fotoUrl={fotoUrl}
              onUploaded={(url, path) => {
                setFotoUrl(url);
                actualizarItem({ id: item.id, fotoUrl: url, fotoStoragePath: path }).catch(() => {});
              }}
            />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-stone-100 text-center text-xs text-stone-500">
              Guarda primero el plato para poder añadir foto.
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="cat">Categoría</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger id="cat">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {vinculado ? (
              // Referencia de dónde sale el plato: en la carta puede llamarse
              // de otra forma, y hay que poder ver de qué producto se trata.
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Producto de venta
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{item?.producto_nombre ?? "—"}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {(item?.precio ?? 0).toFixed(2).replace(".", ",")} €
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  El precio, los alérgenos y la estrella se cambian en su ficha, en Logística →
                  Productos.
                </p>
              </div>
            ) : null}

            <div>
              <Label htmlFor="nom">Nombre en la carta</Label>
              <Input id="nom" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
              {vinculado ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Es lo que lee el cliente. Empieza siendo el del producto y puedes cambiarlo.
                </p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="desc">Texto</Label>
              <textarea
                id="desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                placeholder="Lo que va debajo del nombre en la carta"
              />
            </div>

            {item ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="orden">Orden visual</Label>
                  <Input
                    id="orden"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={ordenVisual}
                    onChange={(e) => setOrdenVisual(e.target.value)}
                  />
                  {/* La numeración se recoloca sola: si escribes 2, este pasa a
                      segundo y los demás corren. Nunca quedan huecos. */}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Posición en su categoría. El resto se recoloca solo.
                  </p>
                </div>
                <div>
                  <Label htmlFor="likesbase">Empezar «me gusta» con</Label>
                  <Input
                    id="likesbase"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={likesBase}
                    onChange={(e) => setLikesBase(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Suma al contador de la carta. No cuenta en las estadísticas.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Solo los platos escritos a mano en la carta llevan su precio
                aquí. Los que vienen de un producto lo heredan de su ficha. */}
            {!vinculado ? (
              <div className="w-40">
                <Label htmlFor="precio">Precio (€)</Label>
                <Input
                  id="precio"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                />
              </div>
            ) : null}

            {item ? (
              <div>
                <Label className="mb-1.5 block">Cómo se ve en la carta</Label>
                <div className="grid grid-cols-3 gap-2">
                  {estadosDisponibles(horasApagado).map((op) => (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => setEstado(op.valor)}
                      aria-pressed={estado === op.valor}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        estado === op.valor
                          ? op.claseActiva
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      <div className="text-sm font-medium">{op.titulo}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {op.pie}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {!vinculado ? (
        <div>
          <Label className="mb-2 block">Alérgenos</Label>
          <div className="flex flex-wrap gap-2">
            {ALERGENOS_UE.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAlergeno(a)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                  alergenos.has(a)
                    ? "bg-amber-500 text-white ring-amber-500"
                    : "bg-white text-stone-700 ring-stone-300 hover:bg-stone-50"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {item ? (
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              Borrar plato
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" size="lg" onClick={handleSave} disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

