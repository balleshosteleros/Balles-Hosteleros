/**
 * Cron: continúa las importaciones de Drive que se quedaron a medias.
 *
 * La copia avanzaba solo mientras la pantalla pedía la siguiente tanda: cerrar
 * la pestaña la paraba en seco. Con 124 GB de Marketing eso obliga a tener el
 * ordenador encendido un día entero, y cualquier recarga la interrumpe.
 *
 * Aquí se retoma sin nadie delante: el permiso de Google se saca de
 * `google_cuentas_usuario` (donde queda guardado el refresh token) y se canjea
 * por uno nuevo, porque el de la cookie ya habrá caducado.
 *
 * Schedule: cada 5 minutos (vercel.json).
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ejecutarImportacion } from "@/features/archivos/actions/importar-drive-actions";
import { readAccountsFor } from "@/lib/google/accounts";
import { refreshAccessToken } from "@/lib/google/api";
import type { Mapeo } from "@/features/archivos/types/paneles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Se ignoran las tocadas hace menos de un minuto: si la pantalla sigue abierta
 * ya está trabajando, y dos procesos copiando lo mismo se pisan.
 */
const MARGEN_SEGUNDOS = 60;

/**
 * Cuántas migraciones avanzan a la vez.
 *
 * Cada una consume su propia ventana de 3 minutos copiando de Drive a R2, y
 * son empresas y cuentas de Google distintas: no compiten entre ellas. Con dos
 * abiertas (Marketing de HABANA y de BACANAL) las dos avanzan a ritmo completo
 * en vez de turnarse. El tope evita que media docena de migraciones agoten a la
 * vez la memoria de la función.
 */
const MAX_EN_PARALELO = 3;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/archivos-importacion] CRON_SECRET no configurado");
    return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const corte = new Date(Date.now() - MARGEN_SEGUNDOS * 1000).toISOString();
  const { data: pendientes } = await admin
    .from("archivos_importaciones")
    .select("id, empresa_id, unidad_id, unidad_nombre, mapeo, creado_por, google_email")
    .in("estado", ["en_curso", "parada"])
    .lt("updated_at", corte)
    .order("updated_at", { ascending: true })
    .limit(MAX_EN_PARALELO);

  if (!pendientes?.length) {
    return NextResponse.json({ ok: true, mensaje: "Nada pendiente" });
  }

  // Las importaciones de empresas distintas avanzan A LA VEZ.
  //
  // Antes se cogía una sola por vuelta: con dos migraciones abiertas se iban
  // alternando y cada una avanzaba a la mitad de ritmo, aunque no compitieran
  // por nada (empresas, cuentas de Google y carpetas distintas). Corren en
  // paralelo dentro de la misma ventana.
  const resultados = await Promise.all(
    pendientes.map(async (pendiente) => {
      // El permiso de Google: el de la cookie no existe aquí, así que se canjea
      // el refresh token guardado. Sin cuenta anotada se coge la primera del
      // usuario, que es lo que había antes de guardarla.
      const cuentas = await readAccountsFor(pendiente.creado_por as string);
      const cuenta =
        cuentas.find((c) => c.email === pendiente.google_email) ?? cuentas[0];
      if (!cuenta?.refreshToken) {
        console.error(
          `[cron/archivos-importacion] sin permiso de Google para ${pendiente.google_email ?? "(sin cuenta anotada)"}`,
        );
        return { unidad: pendiente.unidad_nombre, ok: false, error: "Sin permiso de Google" };
      }

      const token = await refreshAccessToken(cuenta.refreshToken);
      if (!token) {
        return {
          unidad: pendiente.unidad_nombre,
          ok: false,
          error: "No se pudo renovar el permiso",
        };
      }

      const res = await ejecutarImportacion({
        empresaId: pendiente.empresa_id as string,
        userId: pendiente.creado_por as string,
        tokenInicial: token,
        refreshToken: cuenta.refreshToken,
        googleEmail: cuenta.email,
        unidadId: pendiente.unidad_id as string,
        unidadNombre: pendiente.unidad_nombre as string,
        mapeo: pendiente.mapeo as Mapeo,
        importacionId: pendiente.id as string,
      });

      if (!res.ok) {
        console.error("[cron/archivos-importacion]", pendiente.unidad_nombre, res.error);
        return { unidad: pendiente.unidad_nombre, ok: false, error: res.error };
      }
      return {
        unidad: pendiente.unidad_nombre,
        ok: true,
        terminada: res.data.terminada,
      };
    }),
  );

  return NextResponse.json({ ok: true, importaciones: resultados });
}
