"use server";

/**
 * PRP-081 — Importador de Google Drive → Archivos.
 *
 * Trae el contenido de una unidad compartida de Drive a R2 replicando la
 * estructura TAL CUAL: mismos nombres, mismo árbol, todo el contenido.
 *
 * Reglas (decisión de Iván, 27-ago-2026):
 *  · Cada carpeta de primer nivel de Drive entra DENTRO de su departamento del
 *    software, para que los permisos por rol funcionen desde el primer día.
 *  · La empresa destino se elige explícitamente: BACANAL y HABANA no comparten
 *    ningún dato.
 *  · Los Google Docs se exportan a Office editable (.docx/.xlsx/.pptx).
 *  · Cualquier tipo y tamaño; el único tope es la cuota de la empresa.
 *
 * La copia es servidor a servidor y en streaming: el archivo no pasa por el
 * navegador ni se carga entero en memoria, así que un vídeo de 1 GB no tumba
 * la función.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getR2 } from "@/shared/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  descargarArchivo,
  formatoDestino,
  listarUnidadCompleta,
  listarUnidadesCompartidas,
  type DriveArchivo,
  type UnidadCompartida,
} from "@/lib/google/drive";
import { cookies } from "next/headers";
// Los tipos viven aparte: un fichero "use server" solo puede exportar
// funciones async, y exportar interfaces desde aquí rompe el componente.
import type {
  EstadoImportacion,
  Mapeo,
} from "@/features/archivos/types/paneles";

type Res<T> = { ok: true; data: T } | { ok: false; error: string };
const fallo = (error: string): { ok: false; error: string } => ({ ok: false, error });

function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string };
    const partes = [e.message, e.details].filter(Boolean);
    if (partes.length) return partes.join(" · ");
  }
  return "Error desconocido";
}

/** Token de Google de la cuenta conectada. */
async function getAccessToken(): Promise<string | null> {
  const c = await cookies();
  return c.get("g_access_token")?.value ?? null;
}

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return null;
  return { supabase, userId: user.id, empresaId };
}

/* ─────────────────────────────────────────────────────────────────────────
 * 1 · ELEGIR UNIDAD
 * ────────────────────────────────────────────────────────────────────────*/

export async function listarUnidades(): Promise<Res<UnidadCompartida[]>> {
  try {
    const token = await getAccessToken();
    if (!token) {
      return fallo("Conecta primero la cuenta de Google que ve las unidades compartidas.");
    }
    return { ok: true, data: await listarUnidadesCompartidas(token) };
  } catch (err) {
    const msg = mensajeError(err);
    console.error("[importar-drive] listarUnidades:", msg);

    // El permiso de Drive se añadió DESPUÉS de que muchas cuentas se
    // conectaran: sus tokens no lo llevan y Google responde 403. El error
    // crudo no dice qué hacer, así que se traduce a la acción concreta.
    if (msg.includes("SCOPE_INSUFFICIENT") || msg.includes("insufficient")) {
      return fallo(
        "Tu conexión con Google es anterior al permiso de Drive. Desconecta y vuelve a conectar la cuenta de Google (Ajustes → Correo) y acepta el acceso a Drive.",
      );
    }
    return fallo(msg);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2 · INVENTARIO
 * ────────────────────────────────────────────────────────────────────────*/

/* ─────────────────────────────────────────────────────────────────────────
 * 3 · IMPORTAR
 * ────────────────────────────────────────────────────────────────────────*/

/** Crea (o reutiliza) una subcarpeta dentro de otra. */
async function asegurarCarpeta(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  padreId: string,
  departamento: string,
  nombre: string,
  userId: string,
): Promise<string> {
  const { data: existente } = await admin
    .from("carpetas_documentos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("parent_id", padreId)
    .ilike("nombre", nombre)
    .maybeSingle();
  if (existente) return existente.id as string;

  const { data, error } = await admin
    .from("carpetas_documentos")
    .insert({
      empresa_id: empresaId,
      parent_id: padreId,
      nombre,
      departamento,
      es_raiz: false,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Lanza la importación. Devuelve el id para seguir el progreso.
 *
 * Corre hasta agotar el tiempo de la función; si queda trabajo, se vuelve a
 * llamar y continúa donde lo dejó (por `drive_file_id` ya importados). Por eso
 * la pantalla reintenta sola hasta que el estado es "terminada".
 */
export async function importarUnidad(
  unidadId: string,
  unidadNombre: string,
  mapeo: Mapeo,
  importacionId?: string,
): Promise<Res<{ importacionId: string; terminada: boolean }>> {
  try {
    const ctx = await getCtx();
    if (!ctx) return fallo("No autenticado");
    const token = await getAccessToken();
    if (!token) return fallo("Conecta primero la cuenta de Google.");
    if (!Object.keys(mapeo).length) {
      return fallo("Asigna al menos una carpeta a un departamento.");
    }

    const admin = createAdminClient();

    // Reanudar la importación en curso, o abrir una nueva.
    let impId = importacionId ?? "";
    if (!impId) {
      const { data, error } = await admin
        .from("archivos_importaciones")
        .insert({
          empresa_id: ctx.empresaId,
          unidad_id: unidadId,
          unidad_nombre: unidadNombre,
          mapeo,
          estado: "en_curso",
          creado_por: ctx.userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      impId = data.id as string;
    } else {
      await admin
        .from("archivos_importaciones")
        .update({ estado: "en_curso", updated_at: new Date().toISOString() })
        .eq("id", impId)
        .eq("empresa_id", ctx.empresaId);
    }

    // Lo ya importado se salta: hace la operación repetible sin duplicar.
    const { data: previos } = await admin
      .from("documentos")
      .select("drive_file_id")
      .eq("empresa_id", ctx.empresaId)
      .not("drive_file_id", "is", null);
    const yaImportados = new Set((previos ?? []).map((p) => p.drive_file_id as string));

    const { client, bucket } = getR2();

    let copiados = 0;
    let copiadosBytes = 0;
    let omitidos = 0;
    const errores: Array<{ archivo: string; motivo: string }> = [];

    // Margen de seguridad: se para antes de que la función se corte sola, para
    // poder guardar el progreso. La pantalla vuelve a llamar y sigue.
    const limite = Date.now() + 4 * 60 * 1000;
    let terminada = true;

    // La unidad se lee ENTERA una vez, no carpeta por carpeta: con cientos de
    // carpetas eran cientos de llamadas en serie y no avanzaba.
    const todos = await listarUnidadCompleta(token, unidadId);
    const hijosDe = new Map<string, typeof todos>();
    for (const f of todos) {
      const padre = f.padreId ?? unidadId;
      const lista = hijosDe.get(padre) ?? [];
      lista.push(f);
      hijosDe.set(padre, lista);
    }

    // Cada rama arranca en la carpeta de departamento que se le asignó.
    const pendientes: Array<{ driveId: string; destinoId: string; depto: string }> = [];
    for (const [driveCarpetaId, destinoId] of Object.entries(mapeo)) {
      const { data: destino } = await admin
        .from("carpetas_documentos")
        .select("id, departamento")
        .eq("empresa_id", ctx.empresaId)
        .eq("id", destinoId)
        .maybeSingle();
      if (!destino) continue;
      pendientes.push({
        driveId: driveCarpetaId,
        destinoId,
        depto: (destino.departamento as string) ?? "",
      });
    }

    while (pendientes.length) {
      if (Date.now() > limite) {
        terminada = false;
        break;
      }
      const rama = pendientes.pop()!;
      const hijos = hijosDe.get(rama.driveId) ?? [];

      for (const hijo of hijos) {
        if (Date.now() > limite) {
          terminada = false;
          break;
        }

        if (hijo.esCarpeta) {
          // La estructura se replica: misma carpeta, mismo nombre.
          const subId = await asegurarCarpeta(
            admin,
            ctx.empresaId,
            rama.destinoId,
            rama.depto,
            hijo.nombre,
            ctx.userId,
          );
          pendientes.push({ driveId: hijo.id, destinoId: subId, depto: rama.depto });
          continue;
        }

        if (yaImportados.has(hijo.id)) {
          omitidos++;
          continue;
        }

        try {
          const bytes = await copiarArchivo(
            token,
            hijo,
            ctx.empresaId,
            rama.destinoId,
            rama.depto,
            ctx.userId,
            admin,
            client,
            bucket,
          );
          yaImportados.add(hijo.id);
          copiados++;
          copiadosBytes += bytes;
        } catch (err) {
          errores.push({ archivo: hijo.nombre, motivo: mensajeError(err) });
        }
      }
    }

    // Se acumula sobre lo que ya hubiera: esta función puede correr varias veces.
    const { data: previa } = await admin
      .from("archivos_importaciones")
      .select("copiados, copiados_bytes, omitidos, fallidos, errores")
      .eq("id", impId)
      .single();

    await admin
      .from("archivos_importaciones")
      .update({
        estado: terminada ? "terminada" : "en_curso",
        copiados: Number(previa?.copiados ?? 0) + copiados,
        copiados_bytes: Number(previa?.copiados_bytes ?? 0) + copiadosBytes,
        omitidos: Number(previa?.omitidos ?? 0) + omitidos,
        fallidos: Number(previa?.fallidos ?? 0) + errores.length,
        errores: [
          ...((previa?.errores as Array<unknown>) ?? []),
          ...errores,
        ].slice(-200),
        updated_at: new Date().toISOString(),
      })
      .eq("id", impId);

    return { ok: true, data: { importacionId: impId, terminada } };
  } catch (err) {
    const msg = mensajeError(err);
    console.error("[importar-drive] importarUnidad:", msg);
    return fallo(msg);
  }
}

/** Copia un archivo de Drive a R2 y lo registra. Devuelve los bytes copiados. */
async function copiarArchivo(
  token: string,
  archivo: DriveArchivo,
  empresaId: string,
  carpetaId: string,
  departamento: string,
  userId: string,
  admin: ReturnType<typeof createAdminClient>,
  client: ReturnType<typeof getR2>["client"],
  bucket: string,
): Promise<number> {
  const { mime, nombre } = formatoDestino(archivo.mime, archivo.nombre);
  const { body, tamano } = await descargarArchivo(token, archivo.id, archivo.mime);

  const archivoId = crypto.randomUUID();
  const carpetaFisica =
    departamento.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_") ||
    "_sin_departamento";
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "bin";
  const r2Key = `empresa_${empresaId}/archivos/${carpetaFisica}/${archivoId}.${ext}`;

  // El SDK acepta el stream directamente: el archivo no se carga en memoria.
  // ContentLength es obligatorio para R2, así que si Drive no lo dice (pasa al
  // exportar Google Docs) se materializa el buffer — son documentos pequeños.
  let cuerpo: Buffer | ReadableStream<Uint8Array> = body;
  let tamanoFinal = tamano ?? archivo.tamano;
  if (!tamanoFinal) {
    cuerpo = Buffer.from(await new Response(body).arrayBuffer());
    tamanoFinal = cuerpo.length;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: cuerpo as never,
      ContentType: mime,
      ContentLength: tamanoFinal,
    }),
  );

  const { error } = await admin.from("documentos").insert({
    empresa_id: empresaId,
    carpeta_id: carpetaId,
    departamento,
    nombre,
    r2_key: r2Key,
    tipo_mime: mime,
    tamano_bytes: tamanoFinal,
    subido_por: userId,
    created_by: userId,
    drive_file_id: archivo.id,
  });
  if (error) throw error;

  return tamanoFinal;
}

/* ─────────────────────────────────────────────────────────────────────────
 * 4 · SEGUIMIENTO
 * ────────────────────────────────────────────────────────────────────────*/

export async function getImportaciones(): Promise<Res<EstadoImportacion[]>> {
  try {
    const ctx = await getCtx();
    if (!ctx) return fallo("No autenticado");

    const { data, error } = await ctx.supabase
      .from("archivos_importaciones")
      .select(
        "id, unidad_nombre, estado, copiados, copiados_bytes, omitidos, fallidos, errores, created_at",
      )
      .eq("empresa_id", ctx.empresaId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;

    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        id: r.id as string,
        unidadNombre: r.unidad_nombre as string,
        estado: r.estado as string,
        copiados: Number(r.copiados ?? 0),
        copiadosBytes: Number(r.copiados_bytes ?? 0),
        omitidos: Number(r.omitidos ?? 0),
        fallidos: Number(r.fallidos ?? 0),
        errores: (r.errores as Array<{ archivo: string; motivo: string }>) ?? [],
        createdAt: r.created_at as string,
      })),
    };
  } catch (err) {
    const msg = mensajeError(err);
    console.error("[importar-drive] getImportaciones:", msg);
    return fallo(msg);
  }
}

/** Marca una importación como parada. La reanuda `importarUnidad` con su id. */
export async function pararImportacion(id: string): Promise<Res<null>> {
  try {
    const ctx = await getCtx();
    if (!ctx) return fallo("No autenticado");

    const { error } = await ctx.supabase
      .from("archivos_importaciones")
      .update({ estado: "parada", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", ctx.empresaId);
    if (error) throw error;

    return { ok: true, data: null };
  } catch (err) {
    return fallo(mensajeError(err));
  }
}
