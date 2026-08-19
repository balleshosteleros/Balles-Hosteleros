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
  adjuntarDocumentoDesdeImportacion,
} from "@/features/logistica/actions/importaciones-albaran-actions";
import {
  emparejarLineasAlbaran,
  type LineaEmparejada,
} from "@/features/logistica/actions/asistente-albaran-actions";
// Solo tipos: se borran en compilación, no arrastran el server-only de la lib.
import type {
  CabeceraOcrAlbaran,
  LineaOcrAlbaran,
} from "@/features/logistica/lib/albaranes/ocr-albaran";
import { CABECERA_OCR_VACIA } from "@/features/logistica/lib/albaranes/cabecera-vacia";
import {
  analizarIncidenciasAlbaran,
  decidirIncidencias,
  ligarIncidenciasAlAlbaran,
  type DecisionIncidencia,
  type IncidenciaPersistida,
} from "@/features/logistica/actions/incidencias-albaran-actions";
import type { FalloImportacion } from "@/features/logistica/lib/albaranes/importaciones";
import type { CandidatoDuplicado } from "@/features/logistica/lib/albaranes/duplicados";
import type { AvisoEmpresa } from "@/features/logistica/lib/albaranes/empresa-destinatario";
import { setEmpresaActiva } from "@/features/empresa/actions/empresa-activa-actions";
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
  const [duplicado, setDuplicado] = useState<CandidatoDuplicado | null>(null);
  const [cabecera, setCabecera] = useState<CabeceraOcrAlbaran>(CABECERA_OCR_VACIA);
  const [proveedor, setProveedor] = useState("");
  const [fecha, setFecha] = useState("");
  const [numeroProveedor, setNumeroProveedor] = useState("");
  const [almacen, setAlmacen] = useState("COCINA");
  const [lineas, setLineas] = useState<LineaOcrAlbaran[]>([]);
  const [ligadas, setLigadas] = useState<Map<string, LineaEmparejada>>(new Map());
  // PRP-074 — mesa de incidencias: lo que el sistema ha detectado que no cuadra.
  const [incidencias, setIncidencias] = useState<IncidenciaPersistida[]>([]);
  const [vinculosAutomaticos, setVinculosAutomaticos] = useState<
    Array<{ lineaId: string; productoId: string; motivo: string }>
  >([]);
  const [proveedorIdentificado, setProveedorIdentificado] = useState<string | null>(null);
  // Decisión "cargar solo esta parte" tomada en la mesa (escritorio): con motivo.
  const [parcialDecidido, setParcialDecidido] = useState<{ motivo: string } | null>(null);
  // Aviso de empresa equivocada (destinatario del papel ≠ empresa activa).
  const [avisoEmpresa, setAvisoEmpresa] = useState<AvisoEmpresa | null>(null);
  // "Seguir en esta empresa de todas formas": desbloquea el guardado tras el aviso.
  const [empresaConfirmada, setEmpresaConfirmada] = useState(false);
  const [cambiandoEmpresa, setCambiandoEmpresa] = useState(false);
  const [, startTransition] = useTransition();

  const reset = () => {
    setPaso("elegir");
    setFile(null);
    setPreview(null);
    setImportacionId(null);
    setFallo(null);
    setDuplicado(null);
    setCabecera(CABECERA_OCR_VACIA);
    setProveedor("");
    setFecha("");
    setNumeroProveedor("");
    setAlmacen("COCINA");
    setLineas([]);
    setLigadas(new Map());
    setIncidencias([]);
    setVinculosAutomaticos([]);
    setProveedorIdentificado(null);
    setParcialDecidido(null);
    setAvisoEmpresa(null);
    setEmpresaConfirmada(false);
    setCambiandoEmpresa(false);
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

  /** Emparejado + detección de incidencias + volcado al formulario de verificación. */
  const procesarResultado = async (
    cab: CabeceraOcrAlbaran,
    lin: LineaOcrAlbaran[],
    // OJO (fix Fernando 06-ago): el id llega por PARÁMETRO, no del estado — en el
    // primer análisis el setImportacionId acaba de ocurrir y este cierre aún ve
    // null, así que las incidencias nacían huérfanas de raíz (importacion_id null
    // → ligarIncidenciasAlAlbaran no encontraba nada que ligar).
    impId: string | null = importacionId,
  ) => {
    // Las dos lecturas son independientes: se lanzan a la vez.
    const [emp, mesa] = await Promise.all([
      emparejarLineasAlbaran(
        lin.map((l) => ({ id: l.id, nombre: l.nombre, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
        cab.proveedor, // activa el tramo de alias por proveedor (Etapa C)
      ),
      // PRP-074: qué NO cuadra en este documento, con la propuesta ya hecha.
      analizarIncidenciasAlbaran({ cabecera: cab, lineas: lin, importacionId: impId }),
    ]);

    const map = new Map<string, LineaEmparejada>();
    if (emp.ok) for (const le of emp.lineas) map.set(le.id, le);

    if (mesa.ok) {
      setIncidencias(mesa.incidencias);
      setVinculosAutomaticos(mesa.vinculosAutomaticos);
      setProveedorIdentificado(mesa.proveedorNombre);
      setAvisoEmpresa(mesa.avisoEmpresa);
      setEmpresaConfirmada(false);
    } else {
      // Que falle el análisis no puede impedir registrar el albarán: se avisa y se
      // sigue por el camino de siempre (verificación manual).
      console.error("[subir-albaran] incidencias:", mesa.error);
      setIncidencias([]);
      setVinculosAutomaticos([]);
      setAvisoEmpresa(null);
    }

    setCabecera(cab);
    setProveedor(cab.proveedor ?? "");
    setFecha(cab.fecha ?? fechaPorDefecto ?? hoyLocal());
    setNumeroProveedor(cab.numero ?? "");
    setLineas(lin);
    setLigadas(map);
    setFallo(null);
    setPaso("verificar");
  };

  /**
   * Registra las decisiones de la mesa, cierra las incidencias resueltas y APLICA
   * los efectos locales (fix Fernando 06-ago): un vínculo aceptado actualiza la
   * línea aquí mismo — antes la decisión se anotaba y la línea seguía "Sin
   * reconocer", así que la confirmación volvía a pedir lo ya decidido.
   * (Las equivalencias de formato las ejecuta el servidor escribiendo en
   * `formatos`, que es lo que lee la confirmación transaccional.)
   */
  const resolverIncidencias = async (decisiones: DecisionIncidencia[]) => {
    if (decisiones.length === 0) return;
    const res = await decidirIncidencias(decisiones);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const decididas = new Set(decisiones.map((d) => d.incidenciaId));
    const porId = new Map(incidencias.map((i) => [i.id, i]));
    // Documento incompleto decidido en la mesa: "cargar solo esta parte" (con motivo)
    // viaja al guardado; "descartar" vuelve al principio (hay que hacer la otra foto).
    for (const d of decisiones) {
      if (porId.get(d.incidenciaId)?.tipo !== "documento_incompleto") continue;
      if (d.accion === "cargar_parcial") setParcialDecidido({ motivo: d.motivo?.trim() || "" });
      if (d.accion === "descartar") {
        toast.info("Albarán descartado: hazle foto también a la página que falta y vuelve a subirlo.");
        reset();
        return;
      }
    }
    setLigadas((prev) => {
      const map = new Map(prev);
      for (const d of decisiones) {
        // Liga la línea si la decisión fue un vínculo O si el servidor creó el producto
        // por efecto de la decisión (crear_gasto: portes/punto verde como gasto sin stock).
        const efecto = res.efectos[d.incidenciaId];
        if (!d.accion.startsWith("vincular") && !efecto) continue;
        const productoId =
          (d.payload?.productoId as string | undefined) ?? efecto?.productoId ?? "";
        const lineaId = porId.get(d.incidenciaId)?.lineaId ?? null;
        if (!productoId || !lineaId) continue;
        const linea = lineas.find((l) => l.id === lineaId);
        map.set(lineaId, {
          id: lineaId,
          nombre: linea?.nombre ?? "",
          cantidad: linea?.cantidad ?? 0,
          precioUnitario: linea?.precioUnitario ?? null,
          ligadoAuto: {
            productoId,
            nombre:
              (d.payload?.productoNombre as string | undefined) ??
              res.efectos[d.incidenciaId]?.productoNombre ??
              "producto vinculado",
            nombreProveedor: null,
            score: 1,
            via: "nombre_proveedor",
            precioVigente: null,
          },
          candidatos: [],
        });
      }
      return map;
    });
    setIncidencias((prev) =>
      prev.map((i) => (decididas.has(i.id) ? { ...i, estado: "resuelta" as const } : i)),
    );
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
      await procesarResultado(res.cabecera, res.lineas, ini.importacionId);
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

  /**
   * Documento incompleto (encargo Iván 17-ago): el OCR vio "SUMA Y SIGUE" o
   * "pág. X de Y" con X < Y. Se caza AQUÍ, con el papel aún encima de la mesa —
   * dos semanas después la hoja ya no aparece (caso Belmon 15378).
   */
  const documentoIncompleto = useMemo(
    () =>
      cabecera.continuaEnOtraPagina
        ? {
            sumaYSigue: cabecera.sumaYSigue,
            paginaActual: cabecera.paginaActual,
            paginasTotales: cabecera.paginasTotales,
          }
        : null,
    [cabecera],
  );

  /** "Seguir en esta empresa de todas formas": desbloquea el guardado tras el aviso. */
  const confirmarEmpresa = () => setEmpresaConfirmada(true);

  /**
   * "Cambiar a la empresa correcta y volver a analizar": arma la empresa activa nueva
   * (cookie, validada en servidor) y reanaliza el MISMO documento contra su catálogo.
   * El OCR no se repite: solo cambian el emparejado y las incidencias.
   */
  const cambiarEmpresa = (empresaId: string) => {
    if (!importacionId) return;
    setCambiandoEmpresa(true);
    startTransition(async () => {
      const res = await setEmpresaActiva(empresaId);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo cambiar de empresa");
        setCambiandoEmpresa(false);
        return;
      }
      setPaso("analizando");
      try {
        await procesarResultado(cabecera, lineas, importacionId);
      } finally {
        setCambiandoEmpresa(false);
      }
    });
  };

  const guardar = (
    override?: { posibleDuplicadoDe: string; motivo: string },
    parcial?: { motivo: string },
  ) => {
    // Empresa equivocada sin resolver: no se guarda hasta cambiar de empresa o confirmar.
    if (avisoEmpresa?.veredicto === "otra_empresa" && !empresaConfirmada) {
      toast.error(
        `Este albarán parece de ${avisoEmpresa.empresaDetectada?.nombre ?? "otra empresa"}. ` +
          "Cambia de empresa o confirma que quieres seguir aquí.",
      );
      return;
    }
    if (!proveedor.trim()) {
      toast.error("Indica el proveedor del albarán");
      return;
    }
    if (!fecha) {
      toast.error("Indica la fecha del albarán");
      return;
    }
    // Móvil lo pasa explícito; escritorio lo decidió en la mesa ("cargar solo esta parte").
    const parcialEfectivo = parcial ?? parcialDecidido ?? undefined;
    if (documentoIncompleto && !parcialEfectivo?.motivo.trim()) {
      // Sin "insisto + motivo" no entra: la UI debe pedir la foto de la página que falta.
      toast.error("A este albarán le falta al menos una página. Añade la foto o indica por qué lo cargas incompleto.");
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
          // Referencia del artículo en el catálogo DEL PROVEEDOR (BB11, C13…): ancla fuerte
          // del matcher. Se persiste para que al crear/vincular quede memorizada y la próxima
          // tanda de ese proveedor case por referencia, sin volver a preguntar (regla Iván).
          referenciaProveedor: l.referenciaProveedor ?? null,
          formato: l.formato ?? null,
          // Desglose impreso en el papel ("SUBUNIDADES: 24"): trazabilidad de la
          // equivalencia; la cantidad de arriba es SIEMPRE el nº de envases.
          unidadesPorEnvase: l.unidadesPorEnvase ?? null,
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
        importacionId,
        duplicadoOverride: override ?? null,
        documentoParcial:
          documentoIncompleto && parcialEfectivo
            ? { motivo: parcialEfectivo.motivo.trim(), paginasEsperadas: documentoIncompleto.paginasTotales }
            : null,
      });
      if (!res.ok) {
        if ("duplicado" in res && res.duplicado) {
          // Posible duplicado de negocio: la persona decide en la pantalla de verificar.
          setDuplicado(res.duplicado);
          setPaso("verificar");
          return;
        }
        toast.error(res.error ?? "No se pudo guardar el albarán");
        setPaso("verificar");
        return;
      }
      setDuplicado(null);

      // Las incidencias se detectaron ANTES de que el albarán existiera (nacen con
      // `importacion_id` pero sin `albaran_id`). Aquí se les asigna: sin esto, al
      // abrir el albarán en Revisión no aparecería ninguna y todo el trabajo de la
      // mesa quedaría huérfano en la BD.
      // Con await y aviso (fix Fernando 06-ago): el fire-and-forget anterior ya
      // produjo incidencias huérfanas una vez, y en silencio.
      if (importacionId && incidencias.length > 0) {
        try {
          const lig = await ligarIncidenciasAlAlbaran(importacionId, res.id);
          if (!lig.ok) toast.warning("El albarán se guardó, pero sus incidencias no quedaron vinculadas.");
        } catch {
          toast.warning("El albarán se guardó, pero sus incidencias no quedaron vinculadas.");
        }
      }

      // El original ya vive en Storage (importación): se mueve al path del albarán
      // sin volver a viajar. No bloquea el flujo si falla.
      try {
        if (importacionId) {
          const adj = await adjuntarDocumentoDesdeImportacion({
            albaranId: res.id,
            importacionId,
            analisis: { cabecera, lineas },
            uploadedBy: creador ?? "",
          });
          if (!adj.ok) toast.warning(adj.message);
        } else {
          // Fallback legado (no debería darse: analizar siempre crea importación).
          const fd = new FormData();
          fd.set("albaranId", res.id);
          fd.set("file", file);
          fd.set("analisis", JSON.stringify({ cabecera, lineas }));
          fd.set("hayAlerta", "false");
          fd.set("uploadedBy", creador ?? "");
          const up = await subirDocumentoAlbaran(fd);
          if (!up.ok) toast.warning(`Albarán guardado, pero la foto no se pudo adjuntar: ${up.error}`);
        }
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
    duplicado,
    setDuplicado,
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
    // Documento incompleto (SUMA Y SIGUE / pág. X de Y): se caza en la subida.
    documentoIncompleto,
    parcialDecidido,
    // Empresa equivocada (destinatario del papel ≠ empresa activa).
    avisoEmpresa,
    empresaConfirmada,
    cambiandoEmpresa,
    confirmarEmpresa,
    cambiarEmpresa,
    // PRP-074 — mesa de incidencias
    incidencias,
    incidenciasAbiertas: incidencias.filter((i) => i.estado === "abierta"),
    vinculosAutomaticos,
    proveedorIdentificado,
    resolverIncidencias,
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
