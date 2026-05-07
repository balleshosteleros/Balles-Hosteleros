"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { toast } from "sonner";
import {
  listCategoriasProveedor,
  createCategoriaProveedor,
  updateCategoriaProveedor,
  deleteCategoriaProveedor,
  getProveedoresConfig,
  saveProveedoresConfig,
  type CategoriaProveedorRow,
  type ProveedoresConfig,
} from "@/features/logistica/actions/categorias-proveedor-actions";

const DEFAULT_CONFIG: ProveedoresConfig = {
  mostrar_solo_productos_proveedor: true,
  avisar_doc_existente: true,
  ocultar_precios_compra_impresion: false,
};

export function ProveedoresTab() {
  const [categorias, setCategorias] = useState<CategoriaProveedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [config, setConfig] = useState<ProveedoresConfig>(DEFAULT_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [cat, cfg] = await Promise.all([listCategoriasProveedor(), getProveedoresConfig()]);
    if (cat.ok) setCategorias(cat.data);
    if (cfg.ok) setConfig(cfg.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleCrear = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const res = await createCategoriaProveedor({ nombre });
    if (!res.ok) {
      toast.error(res.error ?? "Error al crear");
      return;
    }
    setNuevoNombre("");
    toast.success("Categoría creada");
    cargar();
  };

  const handleGuardarEdicion = async (id: string) => {
    const nombre = editNombre.trim();
    if (!nombre) {
      setEditId(null);
      return;
    }
    const res = await updateCategoriaProveedor(id, { nombre });
    if (!res.ok) {
      toast.error(res.error ?? "Error al actualizar");
      return;
    }
    setEditId(null);
    toast.success("Categoría actualizada");
    cargar();
  };

  const handleToggleActiva = async (cat: CategoriaProveedorRow) => {
    const res = await updateCategoriaProveedor(cat.id, { activa: !cat.activa });
    if (!res.ok) {
      toast.error(res.error ?? "Error al actualizar");
      return;
    }
    cargar();
  };

  const handleBorrar = async (cat: CategoriaProveedorRow) => {
    if (!confirm(`¿Borrar la categoría "${cat.nombre}"?`)) return;
    const res = await deleteCategoriaProveedor(cat.id);
    if (!res.ok) {
      toast.error(res.error ?? "Error al borrar");
      return;
    }
    toast.success("Categoría borrada");
    cargar();
  };

  const handleGuardarConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await saveProveedoresConfig(config);
      if (!res.ok) {
        toast.error(res.error ?? "Error al guardar configuración");
        return;
      }
      toast.success("Configuración guardada");
    } finally {
      setSavingConfig(false);
    }
  };

  const setConfigField = (k: keyof ProveedoresConfig, v: boolean) =>
    setConfig((prev) => ({ ...prev, [k]: v }));

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Categorías de proveedor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Categorías de proveedor</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Categorías disponibles para clasificar a tus proveedores. Se usan al crear o editar la
            ficha del proveedor.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCrear();
                }
              }}
              placeholder="Nueva categoría…"
              className="max-w-sm"
            />
            <Button onClick={handleCrear} disabled={!nuevoNombre.trim()} className="gap-1">
              <Plus className="h-4 w-4" /> Añadir
            </Button>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            {categorias.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay categorías. Añade la primera arriba.
              </p>
            ) : (
              <ul className="divide-y">
                {categorias.map((cat) => {
                  const enEdicion = editId === cat.id;
                  return (
                    <li
                      key={cat.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      <Checkbox
                        checked={cat.activa}
                        onCheckedChange={() => handleToggleActiva(cat)}
                        title={cat.activa ? "Activa" : "Inactiva"}
                      />
                      {enEdicion ? (
                        <Input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          onBlur={() => handleGuardarEdicion(cat.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleGuardarEdicion(cat.id);
                            }
                            if (e.key === "Escape") setEditId(null);
                          }}
                          autoFocus
                          className="h-8 max-w-sm"
                        />
                      ) : (
                        <button
                          type="button"
                          className={`flex-1 text-left text-sm ${cat.activa ? "" : "text-muted-foreground line-through"}`}
                          onClick={() => {
                            setEditId(cat.id);
                            setEditNombre(cat.nombre);
                          }}
                        >
                          {cat.nombre}
                        </button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleBorrar(cat)}
                        title="Borrar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Operativa de compra */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operativa de Compra</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Estas configuraciones afectan a todos los proveedores.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={config.mostrar_solo_productos_proveedor}
              onCheckedChange={(v) => setConfigField("mostrar_solo_productos_proveedor", !!v)}
              className="mt-0.5"
            />
            <span className="text-sm font-normal">
              Mostrar solo productos de este proveedor en documentos de compra.
            </span>
          </Label>

          <Label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={config.avisar_doc_existente}
              onCheckedChange={(v) => setConfigField("avisar_doc_existente", !!v)}
              className="mt-0.5"
            />
            <span className="text-sm font-normal">
              Avisar al crear un documento de compra con un número de documento existente.
            </span>
          </Label>

          <Label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={config.ocultar_precios_compra_impresion}
              onCheckedChange={(v) => setConfigField("ocultar_precios_compra_impresion", !!v)}
              className="mt-0.5"
            />
            <span className="text-sm font-normal">
              Ocultar precios de compra al imprimir pedidos de compra.
            </span>
          </Label>

          <div className="flex justify-end pt-2">
            <Button onClick={handleGuardarConfig} disabled={savingConfig} className="gap-1">
              <Save className="h-4 w-4" /> {savingConfig ? "Guardando…" : "Guardar configuración"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
