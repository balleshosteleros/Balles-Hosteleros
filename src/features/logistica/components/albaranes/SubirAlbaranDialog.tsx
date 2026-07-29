"use client";

/**
 * Subir albarán por foto (la ENTRADA del asistente de albaranes — decisión Iván 29-jul).
 *
 * Flujo (P1 de Iván: SIEMPRE hay pantalla de verificación antes de guardar):
 *   1. elegir     → adjuntar archivo o hacer foto (mismo patrón que AlbaranUploadModal).
 *   2. analizando → OCR extractivo con Gemini (`analizarAlbaranFoto`) + emparejado contra
 *                   el catálogo (`emparejarLineasAlbaran`) para pre-ligar lo reconocido.
 *   3. verificar  → cabecera editable (proveedor/fecha/nº) + tabla de líneas con cantidad
 *                   y precio editables. Al guardar: `createAlbaran({estado:"Revisión"})`
 *                   (NO suma stock) + foto adjunta. La resolución fina (vincular/crear/
 *                   ignorar) se hace después en el detalle con AsistenteAlbaranPanel.
 */

import { useMemo, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Upload, FileImage, Loader2, X, CheckCircle2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { createAlbaran, subirDocumentoAlbaran } from "@/features/logistica/actions/albaranes-actions";
import {
  analizarAlbaranFoto,
  emparejarLineasAlbaran,
  type CabeceraOcrAlbaran,
  type LineaOcrAlbaran,
  type LineaEmparejada,
} from "@/features/logistica/actions/asistente-albaran-actions";
import { ESTADO_REVISION } from "@/features/logistica/data/albaranes";
import { ProveedorCombobox } from "@/features/logistica/components/productos/ProveedorCombobox";
import { formatNumero } from "@/shared/lib/numero";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama con el id del albarán recién creado (en estado Revisión). */
  onCreado: (albaranId: string) => void;
}

type Paso = "elegir" | "analizando" | "verificar" | "guardando";

const MAX_FILE_MB = 20;

export function SubirAlbaranDialog({ open, onOpenChange, onCreado }: Props) {
  const { empresaActual } = useEmpresa();
  const { profile } = useAuth();

  const [paso, setPaso] = useState<Paso>("elegir");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cabecera, setCabecera] = useState<CabeceraOcrAlbaran>({ proveedor: null, numero: null, fecha: null, total: null });
  const [proveedor, setProveedor] = useState("");
  const [fecha, setFecha] = useState("");
  const [numeroProveedor, setNumeroProveedor] = useState("");
  const [almacen, setAlmacen] = useState("COCINA");
  const [lineas, setLineas] = useState<LineaOcrAlbaran[]>([]);
  const [ligadas, setLigadas] = useState<Map<string, LineaEmparejada>>(new Map());
  const [, startTransition] = useTransition();

  const reset = () => {
    setPaso("elegir");
    setFile(null);
    setPreview(null);
    setCabecera({ proveedor: null, numero: null, fecha: null, total: null });
    setProveedor("");
    setFecha("");
    setNumeroProveedor("");
    setAlmacen("COCINA");
    setLineas([]);
    setLigadas(new Map());
  };

  const handleClose = (o: boolean) => {
    if (!o && paso !== "analizando" && paso !== "guardando") {
      reset();
      onOpenChange(false);
    }
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_FILE_MB} MB`);
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const analizar = () => {
    if (!file) return;
    setPaso("analizando");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      startTransition(async () => {
        const res = await analizarAlbaranFoto({ base64, mimeType: file.type || "image/jpeg" });
        if (!res.ok) {
          toast.error(res.error);
          setPaso("elegir");
          return;
        }
        // Emparejado contra catálogo: lo reconocido llega ya pre-ligado a la verificación.
        const emp = await emparejarLineasAlbaran(
          res.lineas.map((l) => ({ id: l.id, nombre: l.nombre, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
        );
        const map = new Map<string, LineaEmparejada>();
        if (emp.ok) for (const le of emp.lineas) map.set(le.id, le);

        setCabecera(res.cabecera);
        setProveedor(res.cabecera.proveedor ?? "");
        setFecha(res.cabecera.fecha ?? hoyEnZona(empresaActual.zonaHoraria));
        setNumeroProveedor(res.cabecera.numero ?? "");
        setLineas(res.lineas);
        setLigadas(map);
        setPaso("verificar");
      });
    };
    reader.onerror = () => {
      toast.error("No se pudo leer el archivo");
      setPaso("elegir");
    };
    reader.readAsDataURL(file);
  };

  const setLineaCampo = (id: string, campo: "cantidad" | "precioUnitario", valor: string) => {
    const num = parseFloat(valor.replace(",", "."));
    setLineas((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, [campo]: Number.isFinite(num) ? num : campo === "cantidad" ? 0 : null } : l,
      ),
    );
  };

  const totalLineas = useMemo(
    () => lineas.reduce((s, l) => s + (l.importe ?? (l.precioUnitario ?? 0) * l.cantidad), 0),
    [lineas],
  );
  const nReconocidas = useMemo(
    () => lineas.filter((l) => ligadas.get(l.id)?.ligadoAuto).length,
    [lineas, ligadas],
  );

  const guardar = () => {
    if (!proveedor.trim()) {
      toast.error("Indica el proveedor del albarán");
      return;
    }
    if (!fecha) {
      toast.error("Indica la fecha del albarán");
      return;
    }
    if (!file) return;
    setPaso("guardando");
    startTransition(async () => {
      const lineasJson = lineas.map((l) => {
        const ligado = ligadas.get(l.id)?.ligadoAuto ?? null;
        const precio = l.precioUnitario ?? 0;
        return {
          id: l.id,
          productoId: ligado?.productoId ?? "",
          // Ligada → nombre de catálogo; huérfana → el texto del proveedor hasta resolverla.
          producto: ligado?.nombre ?? l.nombre,
          cantidad: l.cantidad,
          unidad: l.unidad || "ud",
          precioUC: precio,
          impuesto: Number(l.iva ?? 0) || 0,
          dtoPct: 0,
          dtoEur: 0,
          total: l.importe ?? Math.round(precio * l.cantidad * 100) / 100,
          nombreProveedor: l.nombre,
          formato: l.formato ?? null,
        };
      });

      const res = await createAlbaran({
        pedidoId: null,
        proveedorNombre: proveedor.trim(),
        almacen: almacen.trim() || "COCINA",
        documento: numeroProveedor.trim(),
        fecha,
        dtoPct: 0,
        dtoEur: 0,
        notas: "",
        creador: profile?.nombre ?? "",
        lineas: lineasJson,
        numeroProveedor: numeroProveedor.trim() || null,
        estado: ESTADO_REVISION,
      });
      if (!res.ok) {
        toast.error(res.error);
        setPaso("verificar");
        return;
      }

      // La foto se adjunta al albarán recién creado (no bloquea el flujo si falla).
      try {
        const fd = new FormData();
        fd.set("albaranId", res.id);
        fd.set("file", file);
        fd.set("analisis", JSON.stringify({ cabecera, lineas }));
        fd.set("hayAlerta", "false");
        fd.set("uploadedBy", profile?.nombre ?? "");
        const up = await subirDocumentoAlbaran(fd);
        if (!up.ok) toast.warning(`Albarán guardado, pero la foto no se pudo adjuntar: ${up.error}`);
      } catch {
        toast.warning("Albarán guardado, pero la foto no se pudo adjuntar");
      }

      toast.success(`Albarán ${res.numero} guardado en Revisión`);
      const id = res.id;
      reset();
      onOpenChange(false);
      onCreado(id);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={paso === "verificar" ? "sm:max-w-3xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Subir albarán</DialogTitle>
        </DialogHeader>

        {paso === "elegir" && !preview && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
              <Upload className="h-10 w-10 text-primary" />
              <span className="text-sm font-semibold text-foreground">Adjuntar archivo</span>
              <span className="text-xs text-muted-foreground text-center">PDF o foto del albarán</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </label>
            <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
              <Camera className="h-10 w-10 text-primary" />
              <span className="text-sm font-semibold text-foreground">Abrir cámara</span>
              <span className="text-xs text-muted-foreground text-center">Hacer foto al albarán del proveedor</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        )}

        {paso === "elegir" && preview && (
          <div className="space-y-4 py-2">
            <div className="relative rounded-lg overflow-hidden border bg-muted/30">
              {file?.type.startsWith("image/") ? (
                <img src={preview} alt="Preview albarán" className="w-full max-h-[300px] object-contain" />
              ) : (
                <div className="flex items-center justify-center gap-3 p-8">
                  <FileImage className="h-10 w-10 text-primary" />
                  <div>
                    <p className="font-medium text-foreground text-sm">{file?.name}</p>
                    <p className="text-xs text-muted-foreground">{((file?.size || 0) / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-7 w-7 bg-background/80 hover:bg-background"
                onClick={() => { setFile(null); setPreview(null); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setFile(null); setPreview(null); }}>Cambiar archivo</Button>
              <Button onClick={analizar} className="gap-1">Analizar albarán</Button>
            </div>
          </div>
        )}

        {(paso === "analizando" || paso === "guardando") && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {paso === "analizando" ? "Leyendo el albarán con IA…" : "Guardando el albarán…"}
            </p>
          </div>
        )}

        {paso === "verificar" && (
          <div className="space-y-4">
            {/* Cabecera editable */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Proveedor</label>
                <ProveedorCombobox value={proveedor} onChange={setProveedor} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nº albarán proveedor</label>
                <Input value={numeroProveedor} onChange={(e) => setNumeroProveedor(e.target.value)} className="h-9" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {nReconocidas} de {lineas.length} líneas reconocidas automáticamente. Las demás se
              resuelven después en el asistente (vincular / crear / ignorar).
            </p>

            {/* Líneas: cantidad y precio editables (P1: siempre se verifica lo que leyó la IA) */}
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Producto (según proveedor)</th>
                    <th className="px-3 py-2 font-medium w-24 text-right">Cantidad</th>
                    <th className="px-3 py-2 font-medium w-28 text-right">Precio ud.</th>
                    <th className="px-3 py-2 font-medium w-24 text-right">Importe</th>
                    <th className="px-3 py-2 font-medium w-32">Catálogo</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const ligado = ligadas.get(l.id)?.ligadoAuto ?? null;
                    return (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{l.nombre}</td>
                        <td className="px-3 py-1.5">
                          <Input
                            className="h-8 text-right"
                            inputMode="decimal"
                            defaultValue={String(l.cantidad)}
                            onBlur={(e) => setLineaCampo(l.id, "cantidad", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            className="h-8 text-right"
                            inputMode="decimal"
                            defaultValue={l.precioUnitario != null ? String(l.precioUnitario) : ""}
                            onBlur={(e) => setLineaCampo(l.id, "precioUnitario", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatNumero(l.importe ?? (l.precioUnitario ?? 0) * l.cantidad)}
                        </td>
                        <td className="px-3 py-1.5">
                          {ligado ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> {ligado.nombre}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                              <HelpCircle className="h-3.5 w-3.5" /> Sin reconocer
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Suma de líneas: <span className="font-semibold tabular-nums">{formatNumero(totalLineas)} €</span>
                {cabecera.total != null && Math.abs(cabecera.total - totalLineas) > 0.05 && (
                  <span className="ml-2 text-orange-600">
                    (el documento dice {formatNumero(cabecera.total)} € — revisa cantidades/precios)
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { reset(); }}>Empezar de nuevo</Button>
                <Button onClick={guardar}>Guardar en Revisión</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
