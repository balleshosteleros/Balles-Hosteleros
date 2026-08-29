"use server";

/**
 * Nómina original adjunta a un pago (rrhh_pagos.nomina_path).
 *
 * Al subir nóminas, el cliente empareja cada una con su empleado y llama a
 * `guardarNominaArchivo` con el documento (base64) de ESA nómina. Se sube al
 * bucket privado `rrhh-nominas` (path <empresa>/<periodo>/<empleado>.<ext>) por
 * service-role y se guarda el path en la fila del pago.
 *
 * `getNominaArchivoUrl` devuelve una URL firmada temporal para abrir la nómina
 * original desde la columna "Nómina" de la tabla de pagos (mismo patrón que las
 * firmas). Bloqueado si la liquidación ya fue enviada (inmutable).
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  procesarNominasConAdmin,
  type NominaLeida,
  type ResultadoProceso,
} from "@/features/rrhh/services/nominas/procesar-nominas";
import { registrarSubidaHistorico } from "@/features/rrhh/services/nominas/nominas-gestoria";
import { friendlyError } from "@/shared/lib/friendly-errors";

const BUCKET = "rrhh-nominas";
const SIGNED_URL_TTL = 60 * 10; // 10 min para verla

const EXT_POR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * Sube el documento de la nómina de un empleado y persiste su path en el pago.
 * `archivoBase64` es el PDF/imagen de esa nómina (una página del PDF de la
 * gestoría, o el archivo suelto). Devuelve el path guardado.
 */
export async function guardarNominaArchivo(
  periodo: string,
  empleadoId: string,
  archivoBase64: string,
  mimeType: string,
  /** Si ya hay nómina ese mes y esto es false, NO sobrescribe: devuelve yaExistia. */
  permitirSobrescribir = false,
): Promise<{ ok: boolean; path?: string; locked?: boolean; yaExistia?: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || !empleadoId || empleadoId.startsWith("ext-")) {
      return { ok: false, error: "Empleado no válido" };
    }
    const ext = EXT_POR_MIME[mimeType];
    if (!ext) return { ok: false, error: "Formato no admitido" };

    // Bloqueo: liquidación ya enviada = inmutable (el trigger también lo impide).
    const { data: existente } = await supabase
      .from("rrhh_pagos")
      .select("id, confirmacion_enviada_at, nomina_path")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (existente?.confirmacion_enviada_at) return { ok: false, locked: true };
    // Ya tiene nómina adjunta ese mes: no regrabar salvo que se pida expresamente.
    if (existente?.nomina_path && !permitirSobrescribir) {
      return { ok: false, yaExistia: true };
    }

    const admin = createAdminClient();
    const path = `${empresaId}/${periodo}/${empleadoId}.${ext}`;
    const bytes = Buffer.from(archivoBase64, "base64");

    const up = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { upsert: true, contentType: mimeType });
    if (up.error) return { ok: false, error: up.error.message };

    // Guardar el path en la fila del pago. Si aún no existe la fila (empleado sin
    // liquidación tecleada), la creamos con lo mínimo para no perder la nómina.
    if (existente?.id) {
      const { error } = await admin
        .from("rrhh_pagos")
        .update({ nomina_path: path })
        .eq("id", existente.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin.from("rrhh_pagos").insert({
        empresa_id: empresaId,
        empleado_id: empleadoId,
        periodo,
        empleado_nombre: "",
        nomina_path: path,
      });
      // Si otro proceso creó la fila en paralelo, reintentar como update.
      if (error) {
        const { error: e2 } = await admin
          .from("rrhh_pagos")
          .update({ nomina_path: path })
          .eq("empresa_id", empresaId)
          .eq("empleado_id", empleadoId)
          .eq("periodo", periodo);
        if (e2) return { ok: false, error: e2.message };
      }
    }

    return { ok: true, path };
  } catch (err) {
    console.error("[rrhh] guardarNominaArchivo:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Guarda los DATOS leídos de la nómina (SS empleado/empresa + neto a percibir) en
 * el pago del empleado para ESE periodo, SIN tocar el resto de columnas (pago,
 * complemento, ajuste, total…). Update parcial idempotente: crea la fila si no existe.
 * Se usa al subir nóminas para no pisar datos de otros meses.
 */
export async function guardarDatosNomina(
  periodo: string,
  empleadoId: string,
  empleadoNombre: string,
  datos: { neto: number; ssEmpleado: number; ssEmpresa: number },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || !empleadoId || empleadoId.startsWith("ext-")) {
      return { ok: false, error: "Empleado no válido" };
    }
    const admin = createAdminClient();

    const { data: existente } = await supabase
      .from("rrhh_pagos")
      .select("id, confirmacion_enviada_at")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("periodo", periodo)
      .maybeSingle();
    if (existente?.confirmacion_enviada_at) return { ok: false, error: "Liquidación ya enviada" };

    const campos = {
      nomina: datos.neto,
      ss_empleado: datos.ssEmpleado,
      ss_empresa: datos.ssEmpresa,
    };
    if (existente?.id) {
      const { error } = await admin.from("rrhh_pagos").update(campos).eq("id", existente.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin.from("rrhh_pagos").insert({
        empresa_id: empresaId,
        empleado_id: empleadoId,
        empleado_nombre: empleadoNombre,
        periodo,
        ...campos,
      });
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] guardarDatosNomina:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Empareja y guarda un lote de nóminas leídas (flujo AUTENTICADO desde Pagos).
 * Toda la lógica vive en `procesarNominasConAdmin` (servicio compartido), que
 * reutiliza también el enlace público de la gestoría. Aquí solo resolvemos la
 * empresa activa y delegamos.
 */
export async function procesarNominasLeidas(
  nominas: NominaLeida[],
  periodoDefecto: string,
  archivoNombre?: string,
): Promise<{ ok: boolean; error?: string; yaSubidas?: boolean; resultado?: ResultadoProceso }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autorizado" };

    // Mes ya confirmado por RRHH: es inmutable, no admite más nóminas por ninguna
    // vía. Hay que reabrirlo antes de tocar nada.
    const { data: mesRow } = await supabase
      .from("rrhh_nominas_mes")
      .select("confirmado_en")
      .eq("empresa_id", empresaId)
      .eq("periodo", periodoDefecto)
      .maybeSingle();
    if (mesRow?.confirmado_en) {
      return { ok: false, error: "Las nóminas de ese mes ya están confirmadas: reabre el mes para poder cambiarlas." };
    }

    // La entrega de un mes se hace UNA vez. Con que ese mes ya tenga UN documento
    // subido, no se admiten más: mezclar entregas deja el mes descuadrado sin que
    // nadie sepa qué archivo manda. Para cambiarla hay que devolver el mes a la
    // gestoría (lo vacía) o reabrirlo. Se comprueba aquí, y no solo en pantalla,
    // porque esta acción también la puede llamar una pestaña con datos viejos.
    const { count } = await supabase
      .from("rrhh_pagos_nominas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("periodo", periodoDefecto);
    if ((count ?? 0) > 0) {
      return { ok: false, yaSubidas: true, error: "Las nóminas de ese mes ya están subidas." };
    }

    const admin = createAdminClient();
    const resultado = await procesarNominasConAdmin(admin, empresaId, nominas, periodoDefecto);
    // Histórico de la subida manual (auditoría, mismo registro que la gestoría).
    await registrarSubidaHistorico(admin, {
      empresaId,
      periodo: periodoDefecto,
      origen: "manual",
      archivoNombre: archivoNombre ?? null,
      creadoPor: userId ?? null,
      resultado,
    });
    return { ok: true, resultado };
  } catch (err) {
    console.error("[rrhh] procesarNominasLeidas:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * La MISMA nómina, pero pedida por el propio trabajador desde su portal. No
 * recibe `empleadoId` de fuera: se resuelve desde la sesión, así que nadie puede
 * pedir la de otro cambiando el parámetro. La RLS ya solo le deja ver las suyas
 * de un mes confirmado; esto lo hace explícito en el servidor.
 */
export async function getMiNominaUrl(
  periodo: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false, error: "No autorizado" };

    const { data: emp } = await supabase
      .from("empleados")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("user_id", userId)
      .maybeSingle();
    const empleadoId = emp?.id as string | undefined;
    if (!empleadoId) return { ok: false, error: "Sin ficha de empleado en esta empresa" };

    return await getNominaArchivoUrl(periodo, empleadoId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * URL firmada para VER la(s) nómina(s) de un empleado/mes. Si tiene UNA, devuelve
 * su URL directa. Si tiene VARIAS (finiquito + normal…), COMBINA los PDFs en uno
 * solo (una nómina seguida de la otra) y devuelve la URL del combinado.
 */
export async function getNominaArchivoUrl(
  periodo: string,
  empleadoId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autorizado" };
    const admin = createAdminClient();

    // Todas las nóminas individuales de ese empleado/mes, en orden.
    const { data: indiv } = await supabase
      .from("rrhh_pagos_nominas")
      .select("nomina_path, orden")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .eq("periodo", periodo)
      .order("orden", { ascending: true });
    let paths = (indiv ?? []).map((r) => r.nomina_path as string).filter(Boolean);

    // Respaldo: si aún no hay filas individuales (nóminas antiguas), usar el path
    // único de rrhh_pagos.
    if (paths.length === 0) {
      const { data: pago } = await supabase
        .from("rrhh_pagos")
        .select("nomina_path")
        .eq("empresa_id", empresaId).eq("empleado_id", empleadoId).eq("periodo", periodo)
        .maybeSingle();
      const p = pago?.nomina_path as string | null | undefined;
      if (p) paths = [p];
    }
    if (paths.length === 0) return { ok: false, error: "Sin nómina adjunta" };

    // Una sola: URL directa.
    if (paths.length === 1) {
      const signed = await admin.storage.from(BUCKET).createSignedUrl(paths[0], SIGNED_URL_TTL);
      if (signed.error || !signed.data?.signedUrl) {
        return { ok: false, error: signed.error?.message ?? "No se pudo generar el enlace" };
      }
      return { ok: true, url: signed.data.signedUrl };
    }

    // Varias: combinar los PDFs en uno (páginas de imágenes se incrustan también).
    const { PDFDocument } = await import("pdf-lib");
    const combinado = await PDFDocument.create();
    for (const path of paths) {
      const dl = await admin.storage.from(BUCKET).download(path);
      if (dl.error || !dl.data) continue;
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const esPdf = path.toLowerCase().endsWith(".pdf");
      try {
        if (esPdf) {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pgs = await combinado.copyPages(src, src.getPageIndices());
          pgs.forEach((pg) => combinado.addPage(pg));
        } else {
          // Imagen (jpg/png): una página con la imagen a tamaño A4.
          const img = path.toLowerCase().endsWith(".png")
            ? await combinado.embedPng(bytes)
            : await combinado.embedJpg(bytes);
          const page = combinado.addPage([595, 842]);
          const s = Math.min(595 / img.width, 842 / img.height);
          page.drawImage(img, {
            x: (595 - img.width * s) / 2,
            y: (842 - img.height * s) / 2,
            width: img.width * s,
            height: img.height * s,
          });
        }
      } catch (e) {
        console.error("[rrhh] combinar nómina:", path, e);
      }
    }
    const combinadoBytes = await combinado.save();
    // Subir el combinado con un nombre efímero y firmar su URL.
    const combinadoPath = `${empresaId}/${periodo}/${empleadoId}-combinado.pdf`;
    const up = await admin.storage
      .from(BUCKET)
      .upload(combinadoPath, Buffer.from(combinadoBytes), { upsert: true, contentType: "application/pdf" });
    if (up.error) return { ok: false, error: up.error.message };
    const signed = await admin.storage.from(BUCKET).createSignedUrl(combinadoPath, SIGNED_URL_TTL);
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, error: signed.error?.message ?? "No se pudo generar el enlace" };
    }
    return { ok: true, url: signed.data.signedUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * TODAS las nóminas de un mes en un solo PDF, para RRHH: el archivo que la
 * gestoría manda de una pieza, reconstruido desde lo que hay guardado. Las
 * páginas van por empleado (alfabético) y, dentro, por orden — así el finiquito
 * queda junto a la nómina de esa persona.
 */
export async function getNominasMesUrl(
  periodo: string,
): Promise<{ ok: true; url: string; nominas: number } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autorizado" };

    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    if (puede !== true) return { ok: false, error: "No tienes permiso para descargar las nóminas." };

    const { data: filas } = await supabase
      .from("rrhh_pagos_nominas")
      .select("nomina_path, orden, empleado_id, empleados(nombre, apellidos)")
      .eq("empresa_id", empresaId)
      .eq("periodo", periodo)
      .not("nomina_path", "is", null)
      .order("orden", { ascending: true });

    const ordenadas = (filas ?? [])
      .map((r) => {
        const e = r.empleados as { nombre?: string; apellidos?: string } | null;
        return {
          path: r.nomina_path as string,
          orden: Number(r.orden ?? 0),
          nombre: `${e?.apellidos ?? ""} ${e?.nombre ?? ""}`.trim().toLowerCase(),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre) || a.orden - b.orden);

    if (ordenadas.length === 0) return { ok: false, error: "Este mes no tiene nóminas adjuntas." };

    const admin = createAdminClient();
    const { PDFDocument } = await import("pdf-lib");
    const combinado = await PDFDocument.create();
    for (const { path } of ordenadas) {
      const dl = await admin.storage.from(BUCKET).download(path);
      if (dl.error || !dl.data) continue;
      try {
        const src = await PDFDocument.load(new Uint8Array(await dl.data.arrayBuffer()), {
          ignoreEncryption: true,
        });
        const pgs = await combinado.copyPages(src, src.getPageIndices());
        pgs.forEach((pg) => combinado.addPage(pg));
      } catch (e) {
        console.error("[rrhh] combinar nóminas del mes:", path, e);
      }
    }
    if (combinado.getPageCount() === 0) {
      return { ok: false, error: "No se pudo leer ninguna de las nóminas del mes." };
    }

    const bytes = await combinado.save();
    const destino = `${empresaId}/${periodo}/_mes-completo.pdf`;
    const up = await admin.storage
      .from(BUCKET)
      .upload(destino, Buffer.from(bytes), { upsert: true, contentType: "application/pdf" });
    if (up.error) return { ok: false, error: up.error.message };

    const signed = await admin.storage.from(BUCKET).createSignedUrl(destino, SIGNED_URL_TTL);
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, error: signed.error?.message ?? "No se pudo generar el enlace" };
    }
    return { ok: true, url: signed.data.signedUrl, nominas: ordenadas.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Las nóminas del trabajador para su carpeta de Documentos: una entrada por mes
 * confirmado, con la fecha y el nº de documentos de ese mes. La descarga de cada
 * una va por `getMiNominaUrl`.
 */
export async function listMisNominas(): Promise<{ ok: boolean; data: { periodo: string; periodoLabel: string; documentos: number }[]; error?: string }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false, data: [] };

    const { data: emp } = await supabase
      .from("empleados")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("user_id", userId)
      .maybeSingle();
    const empleadoId = emp?.id as string | undefined;
    if (!empleadoId) return { ok: true, data: [] };

    // La RLS ya limita a los meses confirmados: lo no publicado no sale.
    const { data: filas } = await supabase
      .from("rrhh_pagos_nominas")
      .select("periodo")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .not("nomina_path", "is", null);

    const porMes = new Map<string, number>();
    for (const f of filas ?? []) {
      const p = f.periodo as string;
      porMes.set(p, (porMes.get(p) ?? 0) + 1);
    }

    const data = [...porMes.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([periodo, documentos]) => ({
        periodo,
        periodoLabel: mesLargo(periodo),
        documentos,
      }));
    return { ok: true, data };
  } catch (err) {
    console.error("[rrhh] listMisNominas:", err);
    return { ok: false, data: [], error: friendlyError(err, "listMisNominas") };
  }
}

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function mesLargo(periodo: string): string {
  const [a, m] = periodo.split("-");
  const nombre = MESES_LARGOS[Number(m) - 1] ?? periodo;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${a}`;
}
