"use client";

/**
 * Máquina de estados de "Subir albarán por foto" (OCR → verificación → Revisión).
 * Extraído de SubirAlbaranDialog.tsx para compartirlo con la pantalla móvil
 * (que no tiene EmpresaProvider/AuthProvider: fechaPorDefecto y creador llegan
 * ya resueltos, o se dejan vacíos y el servidor los resuelve).
 *
 * PRP-073 Fase 1: el documento ya NO viaja en base64 por una Server Action.
 * Flujo: comprimir imagen en cliente → `iniciarImportacionAlbaran` (autoriza y
 * firma) → subida DIRECTA a Storage → `completarSubidaAlbaran` (valida + huella)
 * → `analizarImportacionAlbaran` (OCR desde Storage). Los fallos llegan con
 * código estable + traceId y, si son recuperables, se reintenta sobre la misma
 * importación sin repetir la foto.
 */

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { createAlbaran, subirDocumentoAlbaran } from "@/features/logistica/actions/albaranes-actions";
import {
  iniciarImportacionAlbaran,
  completarSubidaAlbaran,
  analizarImportacionAlbaran,
  reintentarImportacionAlbaran,
} from "@/features/logistica/actions/importaciones-albaran-actions";
import {
  emparejarLineasAlbaran,
  type CabeceraOcrAlbaran,
  type LineaOcrAlbaran,
  type LineaEmparejada,
} from "@/features/logistica/actions/asistente-albaran-actions";
import type { FalloImportacion } from "@/features/logistica/lib/albaranes/importaciones";
import { ESTADO_REVISION } from "@/features/logistica/data/albaranes";
import { MAX_DOCUMENTO_MB } from "@/shared/lib/documentos";

export type PasoSubirAlbaran = "elegir" | "subiendo" | "analizando" | "verificar" | "guardando";

export const MAX_FILE_MB = MAX_DOCUMENTO_MB; // 50 MB — real desde la subida directa a Storage

const BUCKET_ALBARANES = "logistica-albaranes";

/** Compresión en cliente: una foto de cámara (3-12 MB) baja a ~1-3 MB sin perder legibilidad OCR. */
const COMPRESSION_OPTS = {
  maxSizeMB: 3,
  maxWidthOrHeight: 2560,
  useWebWorker: true,
  fileType: "image/jpeg" as const, // normaliza también HEIC de iPhone cuando el navegador sabe decodificarlo
};

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
  const [importacionId, setImportacionId] = useState<string | null>(null);
  const [fallo, setFallo] = useState<FalloImportacion | null>(null);
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
    setImportacionId(null);
    setFallo(null);
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
    setFallo(null);
    setImportacionId(null);
    void (async () => {
      let elegido = f;
      // Solo imágenes con peso real: el PDF pasa tal cual, y comprimir 200 KB no aporta.
      if (f.type.startsWith("image/") && f.size > 300_000) {
        try {
          const comprimido = await imageCompression(f, COMPRESSION_OPTS);
          elegido = new File([comprimido], f.name.replace(/\.[^.]+$/, "") + ".jpg", { type: comprimido.type });
        } catch {
          // El navegador no supo decodificar (p.ej. HEIC en Chrome): se sube el original
          // y el servidor decide si el formato es analizable.
          elegido = f;
        }
      }
      setFile(elegido);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(elegido);
    })();
  };

  /** Emparejado + volcado del OCR al formulario de verificación. */
  const procesarResultado = async (cab: CabeceraOcrAlbaran, lin: LineaOcrAlbaran[]) => {
    const emp = await emparejarLineasAlbaran(
      lin.map((l) => ({ id: l.id, nombre: l.nombre, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
    );
    const map = new Map<string, LineaEmparejada>();
    if (emp.ok) for (const le of emp.lineas) map.set(le.id, le);

    setCabecera(cab);
    setProveedor(cab.proveedor ?? "");
    setFecha(cab.fecha ?? fechaPorDefecto ?? hoyLocal());
    setNumeroProveedor(cab.numero ?? "");
    setLineas(lin);
    setLigadas(map);
    setFallo(null);
    setPaso("verificar");
  };

  const manejarFallo = (f: FalloImportacion) => {
    setFallo(f);
    toast.error(f.message);
    setPaso("elegir"); // la preview sigue: se corrige/reintenta sin repetir la foto
  };

  const analizar = () => {
    if (!file) return;
    setFallo(null);
    setPaso("subiendo");
    startTransition(async () => {
      // 1. El servidor autoriza (sesión + empresa activa) y firma la subida.
      const ini = await iniciarImportacionAlbaran({
        flujo: "libre",
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        size: file.size,
      });
      if (!ini.ok) {
        manejarFallo(ini);
        return;
      }
      setImportacionId(ini.importacionId);

      // 2. El NAVEGADOR sube directo a Storage: sin base64, sin límite de Server Action.
      const supabase = createClient();
      const up = await supabase.storage
        .from(BUCKET_ALBARANES)
        .uploadToSignedUrl(ini.path, ini.token, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) {
        console.error("[subir-albaran] subida directa:", up.error.message);
        manejarFallo({
          ok: false,
          errorCode: "UPLOAD_FAILED",
          message: "La subida del archivo no llegó a completarse. Revisa la conexión y reintenta.",
          traceId: ini.traceId,
          retryable: false, // la credencial es de un solo uso: reintentar = volver a pulsar Analizar
        });
        return;
      }

      // 3. El servidor valida el objeto real (tamaño, cabecera mágica) y calcula la huella.
      const comp = await completarSubidaAlbaran({ importacionId: ini.importacionId });
      if (!comp.ok) {
        manejarFallo(comp);
        return;
      }

      // 4. OCR desde Storage.
      setPaso("analizando");
      const res = await analizarImportacionAlbaran({ importacionId: ini.importacionId });
      if (!res.ok) {
        manejarFallo(res);
        return;
      }
      await procesarResultado(res.cabecera, res.lineas);
    });
  };

  /**
   * Reintento tras un fallo: si la importación quedó subida, reusa el archivo
   * (sin repetir la foto); si la subida no llegó a cuajar, relanza todo el flujo.
   */
  const reintentar = () => {
    if (fallo?.retryable && importacionId) {
      setFallo(null);
      setPaso("analizando");
      startTransition(async () => {
        const res = await reintentarImportacionAlbaran({ importacionId });
        if (!res.ok) {
          manejarFallo(res);
          return;
        }
        await procesarResultado(res.cabecera, res.lineas);
      });
    } else {
      analizar();
    }
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
      // TASK-204: pasará a moverse desde la importación (el original ya vive en Storage).
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
    importacionId,
    fallo,
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
    reintentar,
    setLineaCampo,
    guardar,
    reset,
    setFile,
    setPreview,
  };
}
