"use client";

/**
 * Subida de canciones a R2 desde el navegador.
 *
 * El archivo NO pasa por el servidor: se pide una URL firmada, se hace PUT
 * directo a R2 y solo entonces se registra la canción. Así no aplica el límite
 * de ~4.5 MB del body de las funciones y subir 200 temas no satura nada.
 *
 * De cada archivo se leen título, artista y duración automáticamente, para que
 * añadir música sea "arrastrar y soltar" y no rellenar 200 formularios.
 */

import { registrarCancion } from "@/features/sala/musica/actions/musica-actions";

export interface ResultadoSubida {
  subidas: number;
  errores: string[];
}

/**
 * Deduce título y artista del nombre del archivo.
 *
 * La convención casi universal en archivos de música es "Artista - Título.mp3".
 * Cuando no la sigue, se usa el nombre entero como título: es mejor un título
 * imperfecto que dejarlo vacío, y siempre se puede renombrar después.
 */
function deducirMetadatos(nombreArchivo: string): {
  titulo: string;
  artista: string | null;
} {
  const sinExtension = nombreArchivo.replace(/\.[^.]+$/, "").trim();
  // Se admite guion normal y guion largo, con o sin espacios alrededor.
  const partes = sinExtension.split(/\s+[-–—]\s+/);
  if (partes.length >= 2 && partes[0].trim() && partes[1].trim()) {
    return {
      artista: partes[0].trim(),
      titulo: partes.slice(1).join(" - ").trim(),
    };
  }
  return { titulo: sinExtension || nombreArchivo, artista: null };
}

/**
 * Duración real del archivo, leída por el propio navegador.
 * Si no se puede determinar, devuelve 0 en vez de fallar: la canción se sube
 * igual y simplemente no muestra duración.
 */
function leerDuracion(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    // Un archivo corrupto podría dejar la promesa colgada para siempre y con
    // ella toda la subida: a los 10 s se sigue adelante.
    const timeout = setTimeout(() => finalizar(0), 10_000);

    function finalizar(seg: number) {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(seg) && seg > 0 ? Math.round(seg) : 0);
    }

    audio.addEventListener("loadedmetadata", () => finalizar(audio.duration));
    audio.addEventListener("error", () => finalizar(0));
    audio.src = url;
  });
}

/**
 * Sube una tanda de archivos. Si `listaId` viene, además los añade a esa lista.
 *
 * Los archivos se procesan de uno en uno a propósito: 200 subidas simultáneas
 * saturarían la conexión del local y harían fallar la mitad.
 */
export async function subirCanciones(
  archivos: File[],
  listaId: string | null,
): Promise<ResultadoSubida> {
  let subidas = 0;
  const errores: string[] = [];

  for (const file of archivos) {
    try {
      const presignRes = await fetch("/api/musica/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileSize: file.size,
          mimeType: file.type || "audio/mpeg",
          nombreArchivo: file.name,
        }),
      });

      const presign = await presignRes.json().catch(() => null);
      if (!presignRes.ok) {
        errores.push(presign?.error ?? `No se pudo subir «${file.name}»`);
        // Si se acabó la cuota, seguir con el resto solo genera más errores
        // iguales: se para y se informa una vez.
        if (presign?.quotaExceeded) break;
        continue;
      }

      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": presign.mimeType },
        body: file,
      });
      if (!putRes.ok) {
        errores.push(`Falló la subida de «${file.name}»`);
        continue;
      }

      const { titulo, artista } = deducirMetadatos(file.name);
      const duracionSeg = await leerDuracion(file);

      const reg = await registrarCancion({
        titulo,
        artista,
        duracionSeg,
        r2Key: presign.r2Key,
        bytes: file.size,
        mimeType: presign.mimeType,
        listaId,
      });
      if (!reg.ok) {
        errores.push(reg.error ?? `No se pudo guardar «${file.name}»`);
        continue;
      }
      subidas++;
    } catch {
      errores.push(`Error inesperado con «${file.name}»`);
    }
  }

  return { subidas, errores };
}
