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
 * la función. La subida a R2 va por partes (multipart), de ahí que el tamaño
 * del archivo ya no imponga ningún límite.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getR2 } from "@/shared/lib/r2";
import { Upload } from "@aws-sdk/lib-storage";
import {
  descargarArchivo,
  formatoDestino,
  listarUnidadCompleta,
  listarCarpetasDeDrive,
  type DriveArchivo,
  type CarpetaDrive,
} from "@/lib/google/drive";
import { cookies } from "next/headers";
import { refreshAccessToken } from "@/lib/google/api";
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

/**
 * El permiso de Google caduca a la hora, y una importación de miles de
 * archivos dura más que eso.
 *
 * Cuando caducaba, cada archivo restante fallaba con "credenciales inválidas"
 * uno detrás de otro: cientos de fallos seguidos que en realidad eran el mismo
 * problema. Aquí se renueva y se reintenta una vez.
 */
async function conTokenVivo<T>(
  token: { valor: string },
  accion: (t: string) => Promise<T>,
): Promise<T> {
  try {
    return await accion(token.valor);
  } catch (err) {
    if (!String(err).includes("Drive 401")) throw err;
    const c = await cookies();
    const refresh = c.get("g_refresh_token")?.value;
    if (!refresh) throw err;
    const nuevo = await refreshAccessToken(refresh);
    if (!nuevo) throw err;
    token.valor = nuevo;
    return await accion(nuevo);
  }
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

export async function listarUnidades(): Promise<Res<CarpetaDrive[]>> {
  try {
    const token = await getAccessToken();
    if (!token) {
      return fallo("Conecta primero la cuenta de Google donde están las carpetas.");
    }
    return { ok: true, data: await listarCarpetasDeDrive(token) };
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
    const tokenInicial = await getAccessToken();
    if (!tokenInicial) return fallo("Conecta primero la cuenta de Google.");
    // Caja mutable: si el permiso caduca a mitad, se renueva aquí dentro y el
    // resto de la tanda sigue con el nuevo sin volver a empezar.
    const token = { valor: tokenInicial };
    if (!Object.keys(mapeo).length) {
      return fallo("Asigna al menos una carpeta a un departamento.");
    }

    const admin = createAdminClient();

    // Reanudar la importación en curso, o abrir una nueva.
    //
    // Si no viene id, se busca una anterior de la MISMA unidad y empresa antes
    // de crear otra: cada importación nueva empieza sin árbol y vuelve a leer
    // los 12.000 archivos de Drive, gastando la ventana entera en releer lo
    // que ya estaba guardado. Volver a darle al botón debe CONTINUAR, no
    // empezar de cero.
    let impId = importacionId ?? "";
    if (!impId) {
      const { data: previa } = await admin
        .from("archivos_importaciones")
        .select("id")
        .eq("empresa_id", ctx.empresaId)
        .eq("unidad_id", unidadId)
        .in("estado", ["en_curso", "parada"])
        .not("arbol", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (previa) impId = previa.id as string;
    }
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
    //
    // Se pide por tandas: Supabase devuelve 1.000 filas como mucho, así que
    // con más de mil copiados el importador creía que el resto faltaba y los
    // volvía a traer. El contador se quedaba clavado en "1000 ya copiados".
    const yaImportados = new Set<string>();
    for (let desde = 0; ; desde += 1000) {
      const { data: previos } = await admin
        .from("documentos")
        .select("drive_file_id")
        .eq("empresa_id", ctx.empresaId)
        .not("drive_file_id", "is", null)
        .range(desde, desde + 999);
      const tanda = previos ?? [];
      for (const p of tanda) yaImportados.add(p.drive_file_id as string);
      if (tanda.length < 1000) break;
    }

    const { client, bucket } = getR2();

    // Lo ya acumulado en tandas anteriores: los guardados parciales suman
    // sobre esto en vez de releerlo cada vez.
    const { data: acumulado } = await admin
      .from("archivos_importaciones")
      .select("copiados, copiados_bytes, omitidos")
      .eq("id", impId)
      .maybeSingle();
    const baseCopiados = Number(acumulado?.copiados ?? 0);
    const baseBytes = Number(acumulado?.copiados_bytes ?? 0);
    // Los omitidos NO se acumulan entre tandas.
    //
    // Cada vuelta recorre el árbol otra vez y se salta todo lo ya copiado, así
    // que sumarlos a lo anterior los contaba una vez por vuelta: con 5.263
    // archivos el contador llegó a marcar 9.422 omitidos. Es un recuento de
    // esta vuelta, no un total.

    let copiados = 0;
    let copiadosBytes = 0;
    let omitidos = 0;
    const errores: Array<{ archivo: string; motivo: string }> = [];

    // El árbol de la unidad se lee UNA sola vez y se guarda en la importación.
    //
    // Antes se releía en cada llamada, y con 12.000 archivos esa lectura tarda
    // más que la ventana de ejecución: el bucle salía por tiempo antes de
    // copiar el primer archivo, guardaba "0 copiados", y la llamada siguiente
    // empezaba de cero. Nunca avanzaba.
    const { data: guardado } = await admin
      .from("archivos_importaciones")
      .select("arbol")
      .eq("id", impId)
      .maybeSingle();

    let todos: Awaited<ReturnType<typeof listarUnidadCompleta>>;
    if (Array.isArray(guardado?.arbol) && guardado.arbol.length) {
      todos = guardado.arbol as typeof todos;
    } else {
      // Leer 12.000 archivos consume casi toda la ventana. Se guarda el árbol
      // y se DEVUELVE el control: copiar en esta misma llamada no daría tiempo
      // ni a un archivo, y el progreso se perdería. La pantalla vuelve a
      // llamar y esa segunda vuelta ya dedica su ventana entera a copiar.
      todos = await listarUnidadCompleta(token.valor, unidadId);
      await admin
        .from("archivos_importaciones")
        .update({
          arbol: todos,
          total_archivos: todos.filter((f) => !f.esCarpeta).length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", impId);

      return { ok: true, data: { importacionId: impId, terminada: false } };
    }

    const hijosDe = new Map<string, typeof todos>();
    for (const f of todos) {
      const padre = f.padreId ?? unidadId;
      const lista = hijosDe.get(padre) ?? [];
      lista.push(f);
      hijosDe.set(padre, lista);
    }

    // Margen de seguridad: se para antes de que la función se corte sola, para
    // poder guardar el progreso. La pantalla vuelve a llamar y sigue.
    //
    // El reloj arranca AQUÍ, ya con el árbol resuelto: si empezara antes, la
    // lectura de Drive se comería la ventana entera y no daría tiempo a copiar
    // ni un archivo.
    //
    // 3 min sobre los 5 de la ruta: un vídeo grande puede tardar en subir
    // DESPUÉS del último control de tiempo, y si la función muere antes de
    // guardar, el progreso de toda la tanda se pierde. Pasó: había archivos ya
    // copiados en R2 y el contador seguía a cero.
    const limite = Date.now() + 3 * 60 * 1000;
    let terminada = true;


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
          const bytes = await conTokenVivo(token, (t) =>
            copiarArchivo(
              t,
              hijo,
              ctx.empresaId,
              rama.destinoId,
              rama.depto,
              ctx.userId,
              admin,
              client,
              bucket,
            ),
          );
          yaImportados.add(hijo.id);
          copiados++;
          copiadosBytes += bytes;

          // Se guarda cada 25 archivos, no solo al final: si la función muere
          // a mitad de tanda, lo copiado hasta ese punto no se pierde y la
          // pantalla ve avanzar el contador.
          if (copiados % 25 === 0) {
            await admin
              .from("archivos_importaciones")
              .update({
                copiados: baseCopiados + copiados,
                copiados_bytes: baseBytes + copiadosBytes,
                omitidos,
                updated_at: new Date().toISOString(),
              })
              .eq("id", impId);
          }
        } catch (err) {
          errores.push({ archivo: hijo.nombre, motivo: mensajeError(err) });
        }
      }
    }

    // Se acumula sobre lo que ya hubiera: esta función puede correr varias veces.
    const { data: previa } = await admin
      .from("archivos_importaciones")
      .select("fallidos, errores")
      .eq("id", impId)
      .single();

    await admin
      .from("archivos_importaciones")
      .update({
        estado: terminada ? "terminada" : "en_curso",
        copiados: baseCopiados + copiados,
        copiados_bytes: baseBytes + copiadosBytes,
        omitidos,
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
  const { body, tamano: tamanoDescarga } = await descargarArchivo(
    token,
    archivo.id,
    archivo.mime,
  );

  const archivoId = crypto.randomUUID();
  const carpetaFisica =
    departamento.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_") ||
    "_sin_departamento";
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "bin";
  const r2Key = `empresa_${empresaId}/archivos/${carpetaFisica}/${archivoId}.${ext}`;

  // El archivo se sube por partes, no de una pieza.
  //
  // Con PutObject había que materializarlo entero en memoria para poder
  // firmar la petición (un stream solo se lee una vez), así que los vídeos
  // grandes agotaban la memoria de la función y había que apartarlos.
  //
  // Upload trocea el stream y firma cada parte por separado: la memoria que
  // consume es el tamaño de una parte, no el del archivo, así que entra
  // cualquier tamaño. Las partes van de 8 MB y sube 4 a la vez.
  const subida = new Upload({
    client,
    params: { Bucket: bucket, Key: r2Key, Body: body, ContentType: mime },
    partSize: 8 * 1024 * 1024,
    queueSize: 4,
  });
  await subida.done();

  // Upload no devuelve el tamaño. Preferimos el de la descarga (un Google Doc
  // exportado a Office no pesa lo mismo que el original) y, si no viene, el
  // que declara Drive.
  const tamanoFinal = tamanoDescarga ?? archivo.tamano;

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
  // 23505 = ya estaba importado. No es un fallo: se dio por copiado en una
  // tanda anterior cuyo contador se perdió. Contarlo como error llenaba la
  // lista de "duplicate key" que no significaban nada.
  if (error && error.code !== "23505") throw error;

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
