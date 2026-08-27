import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { listarUnidadCompleta } from "@/lib/google/drive";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PRP-081 — Inventario de una unidad compartida de Drive.
 *
 * Va en una ruta de API y NO en una server action porque aquí sí se puede
 * ampliar el tiempo máximo: leer una unidad grande pasa del límite por defecto
 * y la función moría sin responder, dejando la pantalla "Leyendo Drive…" para
 * siempre.
 */
export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const unidadId = url.searchParams.get("unidadId");
    const unidadNombre = url.searchParams.get("unidadNombre") ?? "";
    if (!unidadId) {
      return NextResponse.json({ ok: false, error: "unidadId requerido" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const token = (await cookies()).get("g_access_token")?.value;
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Conecta primero la cuenta de Google." },
        { status: 403 },
      );
    }

    const todos = await listarUnidadCompleta(token, unidadId);

    // Hijos por carpeta, para recorrer el árbol sin volver a Drive.
    const hijosDe = new Map<string, typeof todos>();
    for (const f of todos) {
      const padre = f.padreId ?? unidadId;
      const lista = hijosDe.get(padre) ?? [];
      lista.push(f);
      hijosDe.set(padre, lista);
    }

    /** Suma todo lo que cuelga de una carpeta, ya en memoria. */
    const contarRama = (carpetaId: string) => {
      let archivos = 0;
      let bytes = 0;
      const pendientes = [carpetaId];
      const vistos = new Set<string>();
      while (pendientes.length) {
        const actual = pendientes.pop()!;
        // Un atajo de Drive puede apuntar a un ancestro: se corta el ciclo.
        if (vistos.has(actual)) continue;
        vistos.add(actual);
        for (const h of hijosDe.get(actual) ?? []) {
          if (h.esCarpeta) pendientes.push(h.id);
          else {
            archivos++;
            bytes += h.tamano;
          }
        }
      }
      return { archivos, bytes };
    };

    const carpetas: Array<{ id: string; nombre: string; archivos: number; bytes: number }> = [];
    let sueltos = 0;
    let sueltosBytes = 0;

    for (const item of hijosDe.get(unidadId) ?? []) {
      if (item.esCarpeta) {
        const { archivos, bytes } = contarRama(item.id);
        carpetas.push({ id: item.id, nombre: item.nombre, archivos, bytes });
      } else {
        sueltos++;
        sueltosBytes += item.tamano;
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        unidadId,
        unidadNombre,
        carpetas: carpetas.sort((a, b) => a.nombre.localeCompare(b.nombre)),
        sueltos,
        sueltosBytes,
        totalArchivos: carpetas.reduce((s, c) => s + c.archivos, 0) + sueltos,
        totalBytes: carpetas.reduce((s, c) => s + c.bytes, 0) + sueltosBytes,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al leer Drive";
    console.error("[archivos drive inventario]", msg);
    const permiso = msg.includes("SCOPE_INSUFFICIENT") || msg.includes("insufficient");
    return NextResponse.json(
      {
        ok: false,
        error: permiso
          ? "Tu conexión con Google es anterior al permiso de Drive. Vuelve a conectar la cuenta y acepta el acceso a Drive."
          : msg,
      },
      { status: permiso ? 403 : 500 },
    );
  }
}
