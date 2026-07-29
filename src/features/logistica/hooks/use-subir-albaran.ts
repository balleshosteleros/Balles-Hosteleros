"use client";

/**
 * Máquina de estados de "Subir albarán por foto" (OCR → verificación → Revisión).
 * Extraído de SubirAlbaranDialog.tsx para compartirlo con la pantalla móvil
 * (que no tiene EmpresaProvider/AuthProvider: fechaPorDefecto y creador llegan
 * ya resueltos, o se dejan vacíos y el servidor los resuelve).
 */

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createAlbaran, subirDocumentoAlbaran } from "@/features/logistica/actions/albaranes-actions";
import {
  analizarAlbaranFoto,
  emparejarLineasAlbaran,
  type CabeceraOcrAlbaran,
  type LineaOcrAlbaran,
  type LineaEmparejada,
} from "@/features/logistica/actions/asistente-albaran-actions";
import { ESTADO_REVISION } from "@/features/logistica/data/albaranes";

export type PasoSubirAlbaran = "elegir" | "analizando" | "verificar" | "guardando";

export const MAX_FILE_MB = 20;

interface UseSubirAlbaranOpts {
  /** Fecha ISO a usar si el OCR no detecta fecha. Si no se pasa, se usa la fecha local del dispositivo. */
  fechaPorDefecto?: string;
  /** Nombre del creador para createAlbaran/subirDocumentoAlbaran. Si no se pasa, el servidor lo resuelve. */
  creador?: string;
  /** Se llama con el id (y número) del albarán recién creado (en estado Revisión). */
  onCreado: (albaranId: string, numero?: string) => void;
}

function hoyLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function useSubirAlbaran({ fechaPorDefecto, creador, onCreado }: UseSubirAlbaranOpts) {
  const [paso, setPaso] = useState<PasoSubirAlbaran>("elegir");
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
        setFecha(res.cabecera.fecha ?? fechaPorDefecto ?? hoyLocal());
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
        creador: creador ?? "",
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
        fd.set("uploadedBy", creador ?? "");
        const up = await subirDocumentoAlbaran(fd);
        if (!up.ok) toast.warning(`Albarán guardado, pero la foto no se pudo adjuntar: ${up.error}`);
      } catch {
        toast.warning("Albarán guardado, pero la foto no se pudo adjuntar");
      }

      toast.success(`Albarán ${res.numero} guardado en Revisión`);
      const id = res.id;
      const numero = res.numero;
      reset();
      onCreado(id, numero);
    });
  };

  return {
    paso,
    file,
    preview,
    cabecera,
    proveedor,
    setProveedor,
    fecha,
    setFecha,
    numeroProveedor,
    setNumeroProveedor,
    almacen,
    setAlmacen,
    lineas,
    ligadas,
    totalLineas,
    nReconocidas,
    handleFile,
    analizar,
    setLineaCampo,
    guardar,
    reset,
    setFile,
    setPreview,
  };
}
