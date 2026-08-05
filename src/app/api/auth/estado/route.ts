import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ¿El servidor sigue reconociendo esta sesión?
 *
 * Existe para el caso de la PWA congelada (Iván, 05-ago): en iOS la app instalada
 * resucita un snapshot de la última vez, así que la pantalla muestra al usuario
 * dentro aunque su sesión esté muerta en el servidor. En ese estado el botón de
 * cerrar sesión "no hace nada" —no queda nada que cerrar— y no hay forma de salir.
 *
 * `VersionAutoUpdate` consulta esto al abrir la app y al volver a ella; si la
 * respuesta es `autenticado: false`, manda al login.
 *
 * Deliberadamente NO devuelve datos del usuario: solo sí/no. Y nunca se cachea,
 * o daría una respuesta obsoleta justo cuando más importa.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return NextResponse.json(
      { autenticado: !!user },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    // Ante la duda, NO se declara la sesión muerta: echar a alguien por un fallo
    // puntual del servidor sería peor que dejarle seguir.
    return NextResponse.json(
      { autenticado: true },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
